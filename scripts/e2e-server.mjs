// End-to-End-Prüfung gegen den Testserver.
//
// Aufruf: `pnpm e2e` (liest `zugangsdaten.txt`, die nicht im Repo liegt).
// Geprüft werden Anmeldung, Bibliothek, ein ganzes Album und das Abspielen
// eines Titels – also die Kette, die auch die App geht. Es werden keine Daten
// verändert: kein Stern, kein Scrobble, keine Playlist.
//
// Der Lauf ist bewusst getrennt von `pnpm test`: die Testsuite läuft ohne Netz
// und ohne Zugangsdaten, dieser Lauf braucht beides.

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { md5 } from "js-md5";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const API_VERSION = "1.16.1";
const CLIENT = "niuva-sonic";

/** Zugangsdaten aus `zugangsdaten.txt`: erste Adresse, dann Benutzer und Passwort. */
async function readCredentials() {
  const text = await readFile(join(root, "zugangsdaten.txt"), "utf8").catch(() => {
    throw new Error("zugangsdaten.txt fehlt (Adresse, Benutzer, Passwort je Zeile).");
  });
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const serverUrl = lines.find((line) => /^https?:\/\//i.test(line))?.replace(/\/+$/, "");
  const value = (label) => {
    const line = lines.find((entry) => entry.toLowerCase().startsWith(label));
    return line?.split(/[\t:]\s*/).slice(1).join(":").trim() || "";
  };
  const username = value("username") || value("benutzer");
  const password = value("passwort") || value("password");
  if (!serverUrl || !username || !password) throw new Error("zugangsdaten.txt ist unvollständig.");
  return { serverUrl, username, password };
}

/** Adresse wie im Client: Salt, Token, Fassung, Client, JSON. */
function url(creds, endpoint, extra = {}) {
  const salt = Math.random().toString(16).slice(2, 14);
  const params = new URLSearchParams({
    u: creds.username,
    t: md5(creds.password + salt),
    s: salt,
    v: API_VERSION,
    c: CLIENT,
    f: "json",
    ...Object.fromEntries(Object.entries(extra).filter(([, v]) => v !== undefined)),
  });
  return `${creds.serverUrl}/rest/${endpoint}?${params}`;
}

/** Antwort wie im Client auswerten: HTTP-Status und `status` im Rumpf. */
async function call(creds, endpoint, extra) {
  const res = await fetch(url(creds, endpoint, extra));
  if (!res.ok) throw new Error(`HTTP ${res.status} bei ${endpoint}`);
  const body = (await res.json())["subsonic-response"];
  if (body?.status !== "ok") throw new Error(`Code ${body?.error?.code}: ${body?.error?.message ?? "unbekannt"}`);
  return body;
}

const results = [];
async function check(name, run) {
  try {
    const detail = await run();
    results.push({ name, ok: true });
    console.log(`  OK   ${name}${detail ? ` – ${detail}` : ""}`);
  } catch (error) {
    results.push({ name, ok: false });
    console.log(`  FEHL ${name} – ${error.message}`);
  }
}
const creds = await readCredentials();
console.log(`Testserver: ${creds.serverUrl} als ${creds.username}\n`);

await check("Anmeldung (ping)", async () => {
  const body = await call(creds, "ping");
  return `${body.type ?? "unbekannt"} ${body.serverVersion ?? ""}${body.openSubsonic ? ", OpenSubsonic" : ""}`.trim();
});

await check("OpenSubsonic-Erweiterungen", async () => {
  const body = await call(creds, "getOpenSubsonicExtensions");
  const names = (body.openSubsonicExtensions ?? []).map((entry) => entry.name);
  return names.length ? names.join(", ") : "keine gemeldet";
});

let albumId = null;
await check("Albenliste (getAlbumList2)", async () => {
  const body = await call(creds, "getAlbumList2", { type: "newest", size: 5 });
  const albums = body.albumList2?.album ?? [];
  if (!albums.length) throw new Error("Der Server liefert keine Alben.");
  albumId = albums[0].id;
  return `${albums.length} Alben, erstes: ${albums[0].name}`;
});

let songId = null;
await check("Album mit Titeln (getAlbum)", async () => {
  if (!albumId) throw new Error("Ohne Album aus dem vorherigen Schritt nicht prüfbar.");
  const body = await call(creds, "getAlbum", { id: albumId });
  const songs = body.album?.song ?? [];
  if (!songs.length) throw new Error("Das Album hat keine Titel.");
  songId = songs[0].id;
  return `${songs.length} Titel, erster: ${songs[0].title}`;
});

await check("Titel abspielen (stream, erste 64 KiB)", async () => {
  if (!songId) throw new Error("Ohne Titel aus dem vorherigen Schritt nicht prüfbar.");
  const res = await fetch(url(creds, "stream", { id: songId }), { headers: { Range: "bytes=0-65535" } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const bytes = (await res.arrayBuffer()).byteLength;
  const type = res.headers.get("content-type") ?? "unbekannt";
  if (!/audio|octet-stream/i.test(type)) throw new Error(`Unerwarteter Inhaltstyp: ${type}`);
  if (bytes < 1024) throw new Error(`Zu wenig Daten: ${bytes} Byte`);
  return `${bytes} Byte, ${type}`;
});

await check("Originaldatei erreichbar (download)", async () => {
  if (!songId) throw new Error("Ohne Titel aus dem vorherigen Schritt nicht prüfbar.");
  const res = await fetch(url(creds, "download", { id: songId }), { headers: { Range: "bytes=0-1023" } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return `HTTP ${res.status}`;
});

await check("Falsches Passwort wird abgewiesen", async () => {
  const wrong = { ...creds, password: `${creds.password}-falsch` };
  const body = (await (await fetch(url(wrong, "ping"))).json())["subsonic-response"];
  if (body?.status === "ok") throw new Error("Der Server hat ein falsches Passwort angenommen.");
  if (body?.error?.code !== 40) throw new Error(`Erwartet Code 40, bekommen: ${JSON.stringify(body?.error)}`);
  return "Code 40";
});

await check("Unbekannter Server meldet einen Fehler", async () => {
  const wrong = { ...creds, serverUrl: "https://kein-server.invalid" };
  try {
    await fetch(url(wrong, "ping"), { signal: AbortSignal.timeout(8000) });
    throw new Error("Die Anfrage ist unerwartet durchgelaufen.");
  } catch (error) {
    if (String(error.message).includes("unerwartet")) throw error;
    return "nicht erreichbar";
  }
});

const failed = results.filter((entry) => !entry.ok);
console.log(`\n${results.length - failed.length}/${results.length} Prüfungen bestanden.`);
if (failed.length) {
  console.log(`Fehlgeschlagen: ${failed.map((entry) => entry.name).join(", ")}`);
  process.exit(1);
}

