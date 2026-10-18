import { useEffect, useState, type FormEvent } from "react";
import { CircleAlert, LoaderCircle, LogIn, UserRound } from "lucide-react";
import { profileId, useProfiles } from "../state/profiles";
import { describeLoginError, useSession } from "../state/session";

export default function Login() {
  const login = useSession((s) => s.login);
  const profiles = useProfiles((s) => s.list);
  const profilesReady = useProfiles((s) => s.ready);
  const restoreProfiles = useProfiles((s) => s.restore);
  const activate = useProfiles((s) => s.activate);
  const profileBusy = useProfiles((s) => s.busy);
  const profileError = useProfiles((s) => s.error);
  const [serverUrl, setServerUrl] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void restoreProfiles();
  }, [restoreProfiles]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(serverUrl, username, password);
    } catch (err) {
      setError(describeLoginError(err));
    } finally {
      setBusy(false);
    }
  }

  async function choose(profile: { serverUrl: string; username: string }) {
    // Klappt der Wechsel nicht (etwa nach dem Abmelden), das Formular vorbelegen.
    if (!(await activate(profile))) {
      setServerUrl(profile.serverUrl);
      setUsername(profile.username);
    }
  }

  return (
    <main className="login">
      <img className="login-logo" src="/logo.png" alt="Niuva Sonic" />
      <p className="login-tagline">Deine Musik. Dein Server.</p>
      {profilesReady && profiles.length > 0 && (
        <div>
          <h2>Gemerkte Server</h2>
          <ul>
            {profiles.map((profile) => (
              <li key={profileId(profile)}>
                <button type="button" className="ghost" disabled={profileBusy} onClick={() => void choose(profile)}>
                  <UserRound size={18} /> {profile.username}
                </button>{" "}
                <span className="muted">{profile.serverUrl}</span>
              </li>
            ))}
          </ul>
          <p className="muted">Die Zugangsdaten liegen im Schlüsselbund von Windows.</p>
        </div>
      )}
      {profileError && <p className="form-error" role="alert"><CircleAlert size={18} /> {profileError}</p>}
      <form className="login-form" onSubmit={submit}>
        <label>Navidrome-Server<input type="url" inputMode="url" placeholder="https://musik.example.de" value={serverUrl} onChange={(e) => setServerUrl(e.target.value)} required autoFocus /></label>
        <label>Benutzername<input type="text" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} required /></label>
        <label>Passwort<input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required /></label>
        {error && <p className="form-error" role="alert"><CircleAlert size={18} /> {error}</p>}
        <button type="submit" disabled={busy}>
          {busy ? <><LoaderCircle size={20} className="spin" /> Verbinde …</> : <><LogIn size={20} /> Anmelden</>}
        </button>
      </form>
    </main>
  );
}
