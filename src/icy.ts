/**
 * ICY-Metadaten von Internetradio-Streams.
 *
 * Fragt man einen Stream mit `Icy-MetaData: 1`, antwortet er mit `icy-metaint`:
 * nach jeweils so vielen Audiobytes folgt ein Längenbyte (Länge / 16) und
 * danach ein Textblock mit `StreamTitle='Interpret - Titel';`. Das <audio>-Element
 * gibt diese Daten nicht heraus, deshalb liest die App sie über eine eigene Verbindung.
 */

/** Zerlegt den Bytestrom und meldet jeden Metadatenblock. */
export class IcyParser {
  private audioLeft: number;
  private metaLeft = -1;
  private meta: number[] = [];

  constructor(private metaint: number, private onMeta: (block: string) => void) {
    this.audioLeft = metaint;
  }

  push(chunk: Uint8Array) {
    let i = 0;
    while (i < chunk.length) {
      if (this.audioLeft > 0) {
        const take = Math.min(this.audioLeft, chunk.length - i);
        this.audioLeft -= take;
        i += take;
      } else if (this.metaLeft < 0) {
        this.metaLeft = chunk[i++] * 16;
        this.meta = [];
        if (this.metaLeft === 0) this.finish();
      } else {
        const take = Math.min(this.metaLeft, chunk.length - i);
        for (let k = 0; k < take; k++) this.meta.push(chunk[i + k]);
        this.metaLeft -= take;
        i += take;
        if (this.metaLeft === 0) this.finish();
      }
    }
  }

  private finish() {
    const bytes = Uint8Array.from(this.meta);
    this.metaLeft = -1;
    this.audioLeft = this.metaint;
    if (!bytes.length) return;
    let text: string;
    try {
      text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch {
      // Ältere Sender schicken Latin-1.
      text = new TextDecoder("latin1").decode(bytes);
    }
    this.onMeta(text.replace(/\0+$/, ""));
  }
}

/** `StreamTitle='…'` aus einem Block; `null`, wenn nichts Brauchbares drinsteht. */
export function streamTitle(block: string): string | null {
  const match = /StreamTitle='(.*?)';(?:\w+=|$)/s.exec(block) ?? /StreamTitle='(.*)'/s.exec(block);
  const title = match?.[1].trim();
  return title ? title : null;
}

/**
 * Liest die Titelinfos, bis `signal` abbricht. Der Audioteil wird verworfen;
 * ein Fehler (kein ICY, kein CORS) bleibt still, dann gibt es eben keine Anzeige.
 */
export async function watchIcy(url: string, fetcher: typeof fetch, onTitle: (title: string | null) => void, signal: AbortSignal) {
  try {
    const res = await fetcher(url, { headers: { "Icy-MetaData": "1" }, signal });
    const metaint = Number(res.headers.get("icy-metaint"));
    if (!res.ok || !res.body || !Number.isInteger(metaint) || metaint <= 0) return;
    const parser = new IcyParser(metaint, (block) => onTitle(streamTitle(block)));
    const reader = res.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) return;
      parser.push(value);
    }
  } catch {
    // Abbruch oder Netzfehler: nichts anzeigen.
  }
}
