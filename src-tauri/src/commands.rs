//! Befehle, die die Oberflaeche aufruft.
//!
//! Tray-Symbol, Medientasten und Auto-Update gibt es nur auf dem Desktop; die
//! betroffenen Befehle sagen auf Android ab, damit die gemeinsame Oberflaeche
//! nicht zwei Wege braucht.

use serde::Serialize;
use tauri::{AppHandle, Manager, State};

use crate::prefs::{self, Prefs, PrefsState};

/// Ergebnis der Update-Pruefung fuer die Einstellungen.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateStatus {
    /// `notConfigured`, `upToDate`, `available` oder `error`.
    pub state: &'static str,
    pub current_version: String,
    pub version: Option<String>,
    pub message: Option<String>,
}

impl UpdateStatus {
    #[cfg(not(desktop))]
    fn not_configured(app: &AppHandle) -> Self {
        Self {
            state: "notConfigured",
            current_version: app.package_info().version.to_string(),
            version: None,
            message: None,
        }
    }
}

/// Fenster- und Tastatur-Einstellungen der Desktop-Huelle.
#[tauri::command]
pub fn window_prefs(state: State<PrefsState>) -> Prefs {
    state.get()
}

/// Liegt das Tray-Symbol wirklich vor? Davon haengt ab, ob Schliessen in den
/// Tray legen darf.
#[tauri::command]
pub fn tray_ready(app: AppHandle) -> bool {
    #[cfg(not(desktop))]
    {
        let _ = &app;
        false
    }
    #[cfg(desktop)]
    {
        app.state::<crate::desktop::TrayState>().ready()
    }
}

/// Schliessen legt das Fenster in den Tray oder beendet die App.
#[tauri::command]
pub fn set_close_to_tray(
    app: AppHandle,
    state: State<PrefsState>,
    enabled: bool,
) -> Result<Prefs, String> {
    state.update(
        |p| Prefs {
            close_to_tray: enabled,
            ..p
        },
        |_| Ok(()),
        |p| prefs::write(&app, p),
    )
}

/// Medientasten systemweit abfangen. Erst belegen, dann merken: schlaegt das
/// Belegen fehl, bleibt die Einstellung aus und die Oberflaeche zeigt den Grund.
#[tauri::command]
pub fn set_global_shortcuts(
    app: AppHandle,
    state: State<PrefsState>,
    enabled: bool,
) -> Result<Prefs, String> {
    #[cfg(not(desktop))]
    {
        let _ = (&app, &state, enabled);
        Err("Medientasten gibt es nur in der Desktop-App.".to_string())
    }
    #[cfg(desktop)]
    {
        state.update(
            |p| Prefs {
                global_shortcuts: enabled,
                ..p
            },
            |p| crate::desktop::apply_global_shortcuts(&app, p.global_shortcuts),
            |p| prefs::write(&app, p),
        )
    }
}

/// Die Oberfläche hat ihren letzten Player-Zustand gespeichert.
#[tauri::command]
pub fn finish_exit(app: AppHandle) {
    #[cfg(desktop)]
    crate::desktop::finish_exit(&app);
    #[cfg(not(desktop))]
    let _ = app;
}

/// Nach einer neuen Fassung suchen. Ohne hinterlegte Adresse meldet die Pruefung
/// nur, dass Auto-Update noch nicht eingerichtet ist.
#[tauri::command]
pub async fn check_for_update(app: AppHandle) -> UpdateStatus {
    #[cfg(not(desktop))]
    {
        UpdateStatus::not_configured(&app)
    }
    #[cfg(desktop)]
    {
        crate::desktop::check_for_update(&app).await
    }
}

/// Die gefundene Fassung herunterladen; der Fortschritt kommt als `update-progress`.
#[tauri::command]
pub async fn download_update(app: AppHandle) -> Result<String, String> {
    #[cfg(not(desktop))]
    {
        let _ = &app;
        Err("Updates gibt es nur in der Desktop-App.".to_string())
    }
    #[cfg(desktop)]
    {
        crate::desktop::download_update(&app).await
    }
}

/// Das geladene Update einspielen und die App neu starten.
#[tauri::command]
pub fn install_update(app: AppHandle) -> Result<(), String> {
    #[cfg(not(desktop))]
    {
        let _ = &app;
        Err("Updates gibt es nur in der Desktop-App.".to_string())
    }
    #[cfg(desktop)]
    {
        crate::desktop::install_update(&app)
    }
}
