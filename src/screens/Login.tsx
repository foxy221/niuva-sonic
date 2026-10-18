import { useState, type FormEvent } from "react";
import { describeLoginError, useSession } from "../state/session";

export default function Login() {
  const login = useSession((s) => s.login);
  const [serverUrl, setServerUrl] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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

  return (
    <main className="login">
      <img className="login-logo" src="/logo.png" alt="Niuva Sonic" />
      <form className="login-form" onSubmit={submit}>
        <label>Navidrome-Server<input type="url" inputMode="url" placeholder="https://musik.example.de" value={serverUrl} onChange={(e) => setServerUrl(e.target.value)} required autoFocus /></label>
        <label>Benutzername<input type="text" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} required /></label>
        <label>Passwort<input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required /></label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button type="submit" disabled={busy}>{busy ? "Verbinde …" : "Anmelden"}</button>
      </form>
    </main>
  );
}
