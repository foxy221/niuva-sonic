//! Zugangsdaten im Schluesselbund des Betriebssystems.
//!
//! Unter Windows liegen die Anmeldedaten in der Anmeldeinformationsverwaltung
//! ("Windows-Anmeldeinformationen"). Die Oberflaeche nennt nur einen Schluessel
//! aus Server und Benutzer; Token und Salt stehen nicht mehr im Klartext in der
//! Store-Datei. Pro Zugang gibt es genau einen Eintrag, damit mehrere
//! Server-Profile nebeneinander bestehen koennen.

/// Name, unter dem die Eintraege in der Anmeldeinformationsverwaltung stehen.
pub const SERVICE: &str = "de.niuva.sonic";

/// Obergrenze des Schluessels: die Anmeldeinformationsverwaltung begrenzt den
/// Benutzernamen, und ein Server samt Benutzer soll bequem hineinpassen.
const MAX_KEY: usize = 400;
/// Obergrenze des Geheimnisses: die Anmeldeinformationsverwaltung nimmt 2560 Byte
/// auf, `keyring` legt den Text als UTF-16 ab (bis zu doppelt so gross wie in
/// UTF-8). Ein Zugangsobjekt der Oberflaeche bleibt weit darunter.
const MAX_SECRET: usize = 1200;

/// Der Schluessel kommt aus der Oberflaeche (`<Serveradresse>|<Benutzer>`).
/// Steuerzeichen wuerden die Anmeldeinformationsverwaltung verwirren, ein
/// leerer Schluessel koennte einen fremden Eintrag treffen.
pub fn validate_key(key: &str) -> Result<(), String> {
    if key.trim().is_empty() {
        return Err("The credential key must not be empty.".to_string());
    }
    if key.len() > MAX_KEY {
        return Err("The credential key is too long.".to_string());
    }
    if key.chars().any(|c| c.is_control()) {
        return Err("The credential key contains control characters.".to_string());
    }
    Ok(())
}

/// Prueft, was gespeichert werden darf. Leere Geheimnisse werden abgelehnt,
/// damit ein Fehler in der Oberflaeche keinen leeren Eintrag hinterlaesst.
pub fn validate_secret(secret: &str) -> Result<(), String> {
    if secret.trim().is_empty() {
        return Err("There is nothing to store.".to_string());
    }
    if secret.len() > MAX_SECRET {
        return Err("The credentials are too large for the credential manager.".to_string());
    }
    Ok(())
}

#[cfg(windows)]
mod store {
    use keyring::{Entry, Error};

    use super::SERVICE;

    pub fn save(key: &str, secret: &str) -> Result<(), String> {
        let entry = Entry::new(SERVICE, key).map_err(|error| error.to_string())?;
        entry
            .set_password(secret)
            .map_err(|error| format!("The credential manager does not accept the credentials: {error}"))
    }

    pub fn load(key: &str) -> Result<Option<String>, String> {
        let entry = Entry::new(SERVICE, key).map_err(|error| error.to_string())?;
        match entry.get_password() {
            Ok(secret) => Ok(Some(secret)),
            Err(Error::NoEntry) => Ok(None),
            Err(error) => Err(format!("The credential manager does not respond: {error}")),
        }
    }

    /// Ein fehlender Eintrag gilt als Erfolg: das Ziel ist "weg".
    pub fn delete(key: &str) -> Result<(), String> {
        let entry = Entry::new(SERVICE, key).map_err(|error| error.to_string())?;
        match entry.delete_credential() {
            Ok(()) | Err(Error::NoEntry) => Ok(()),
            Err(error) => Err(format!(
                "The credential manager does not release the entry: {error}"
            )),
        }
    }

    /// Ein Probe-Eintrag zeigt, ob die Anmeldeinformationsverwaltung nutzbar ist.
    pub fn available() -> bool {
        Entry::new(SERVICE, "probe").is_ok()
    }
}

/// Gibt es auf diesem System einen Schluesselbund?
#[tauri::command]
pub fn keychain_available() -> bool {
    #[cfg(windows)]
    {
        store::available()
    }
    #[cfg(not(windows))]
    {
        false
    }
}

/// Legt die Zugangsdaten eines Profils ab.
#[tauri::command]
pub fn save_credential(key: String, secret: String) -> Result<(), String> {
    validate_key(&key)?;
    validate_secret(&secret)?;
    #[cfg(windows)]
    {
        store::save(&key, &secret)
    }
    #[cfg(not(windows))]
    {
        let _ = (key, secret);
        Err("The credential manager is only available on Windows.".to_string())
    }
}

/// Liest die Zugangsdaten eines Profils. `None` heisst: kein Eintrag vorhanden.
#[tauri::command]
pub fn load_credential(key: String) -> Result<Option<String>, String> {
    validate_key(&key)?;
    #[cfg(windows)]
    {
        store::load(&key)
    }
    #[cfg(not(windows))]
    {
        let _ = key;
        Err("The credential manager is only available on Windows.".to_string())
    }
}

/// Entfernt die Zugangsdaten eines Profils.
#[tauri::command]
pub fn delete_credential(key: String) -> Result<(), String> {
    validate_key(&key)?;
    #[cfg(windows)]
    {
        store::delete(&key)
    }
    #[cfg(not(windows))]
    {
        let _ = key;
        Err("The credential manager is only available on Windows.".to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::{MAX_KEY, MAX_SECRET, validate_key, validate_secret};

    #[test]
    fn brauchbare_schluessel_werden_angenommen() {
        assert!(validate_key("https://musik.example|testuser").is_ok());
        assert!(validate_key("http://192.168.0.10:4533|a").is_ok());
    }

    #[test]
    fn leere_und_unsaubere_schluessel_werden_abgelehnt() {
        assert!(validate_key("").is_err());
        assert!(validate_key("   ").is_err());
        assert!(validate_key("server\nuser").is_err());
        assert!(validate_key(&"a".repeat(MAX_KEY + 1)).is_err());
    }

    #[test]
    fn geheimnisse_haben_grenzen() {
        assert!(validate_secret("{\"token\":\"x\"}").is_ok());
        assert!(validate_secret("").is_err());
        assert!(validate_secret("  ").is_err());
        assert!(validate_secret(&"x".repeat(MAX_SECRET + 1)).is_err());
    }
}
