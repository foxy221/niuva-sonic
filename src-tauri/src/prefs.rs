//! Ablage fuer die Windows-Einstellungen (Tray, Medientasten).
//!
//! Die Datei `window.json` liegt im Konfigurationsordner der App. Sie ist bewusst
//! getrennt von `settings.json` der Oberflaeche, damit beide Seiten nicht in
//! dieselbe Datei schreiben.

use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::Mutex;
use tauri::{AppHandle, Runtime};
use tauri_plugin_store::StoreExt;

const FILE: &str = "window.json";
const KEY: &str = "prefs";

/// Was der Nutzer in den Einstellungen zur Windows-Integration waehlt.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct Prefs {
    /// Schliessen legt das Fenster in den Tray, statt die App zu beenden.
    pub close_to_tray: bool,
    /// Medientasten systemweit abfangen. Windows regelt sie sonst ueber die Media Session.
    pub global_shortcuts: bool,
}

impl Default for Prefs {
    fn default() -> Self {
        Self {
            close_to_tray: false,
            global_shortcuts: false,
        }
    }
}

/// Haelt die Einstellungen im Speicher, damit das Schliessen-Ereignis sie ohne
/// Zugriff auf die Ablage lesen kann.
pub struct PrefsState(Mutex<Prefs>);

impl PrefsState {
    pub fn load<R: Runtime>(app: &AppHandle<R>) -> Self {
        Self(Mutex::new(read(app)))
    }

    pub fn get(&self) -> Prefs {
        *self.0.lock().unwrap_or_else(|broken| broken.into_inner())
    }

    pub fn set(&self, prefs: Prefs) {
        *self.0.lock().unwrap_or_else(|broken| broken.into_inner()) = prefs;
    }
}

/// Liest die Einstellungen. Fehlende Felder und unbrauchbare Eintraege fallen auf
/// die Vorgaben zurueck, damit ein kaputter Eintrag den Start nicht blockiert.
pub fn read<R: Runtime>(app: &AppHandle<R>) -> Prefs {
    app.store(FILE)
        .ok()
        .and_then(|store| store.get(KEY))
        .and_then(|value| serde_json::from_value(value).ok())
        .unwrap_or_default()
}

pub fn write<R: Runtime>(app: &AppHandle<R>, prefs: Prefs) -> Result<(), String> {
    let store = app.store(FILE).map_err(|error| error.to_string())?;
    store.set(KEY, json!(prefs));
    store.save().map_err(|error| error.to_string())
}

#[cfg(test)]
mod tests {
    use super::Prefs;

    #[test]
    fn vorgaben_lassen_die_app_normal_schliessen() {
        let prefs = Prefs::default();
        assert!(!prefs.close_to_tray);
        assert!(!prefs.global_shortcuts);
    }

    #[test]
    fn fehlende_felder_nehmen_die_vorgabe() {
        let prefs: Prefs = serde_json::from_str(r#"{"closeToTray":true}"#).expect("lesbar");
        assert!(prefs.close_to_tray);
        assert!(!prefs.global_shortcuts);
    }

    #[test]
    fn hin_und_zurueck_bleibt_gleich() {
        let prefs = Prefs {
            close_to_tray: true,
            global_shortcuts: true,
        };
        let text = serde_json::to_string(&prefs).expect("schreibbar");
        assert_eq!(text, r#"{"closeToTray":true,"globalShortcuts":true}"#);
        assert_eq!(serde_json::from_str::<Prefs>(&text).expect("lesbar"), prefs);
    }

    #[test]
    fn unbrauchbare_werte_werden_abgelehnt() {
        assert!(serde_json::from_str::<Prefs>(r#"{"closeToTray":"ja"}"#).is_err());
    }
}
