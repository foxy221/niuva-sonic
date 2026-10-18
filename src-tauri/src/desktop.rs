//! Windows-Integration: Tray-Symbol, Fensterverhalten, Medientasten und Update-Pruefung.

use std::sync::Mutex;
use std::sync::atomic::{AtomicBool, Ordering};

use tauri::{
    AppHandle, Emitter, Manager, Runtime, Window, WindowEvent,
    image::Image,
    menu::{IsMenuItem, Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Shortcut, ShortcutState};
use tauri_plugin_updater::{Update, UpdaterExt};

use crate::commands::UpdateStatus;
use crate::prefs::PrefsState;

/// Ob das Tray-Symbol wirklich angelegt wurde.
///
/// Ohne Symbol darf Schliessen nicht in den Tray legen: sonst waere das Fenster
/// nicht mehr zu erreichen und die App liefe unsichtbar weiter.
pub struct TrayState(AtomicBool);

impl TrayState {
    pub fn new() -> Self {
        Self(AtomicBool::new(false))
    }

    pub fn set_ready(&self, ready: bool) {
        self.0.store(ready, Ordering::Relaxed);
    }

    pub fn ready(&self) -> bool {
        self.0.load(Ordering::Relaxed)
    }
}

impl Default for TrayState {
    fn default() -> Self {
        Self::new()
    }
}

/// Ereignis an die Oberflaeche: Tray-Menue und Medientasten loesen dieselben
/// Befehle aus wie die Knoepfe im Fenster.
pub const EVENT_PLAYER_COMMAND: &str = "player-command";

#[derive(Default)]
pub struct ExitState {
    requested: AtomicBool,
    finished: AtomicBool,
}

pub fn finish_exit<R: Runtime>(app: &AppHandle<R>) {
    let state = app.state::<ExitState>();
    if state.requested.load(Ordering::SeqCst) && !state.finished.swap(true, Ordering::SeqCst) {
        app.exit(0);
    }
}

fn request_exit<R: Runtime>(app: &AppHandle<R>) {
    if app
        .state::<ExitState>()
        .requested
        .swap(true, Ordering::SeqCst)
    {
        return;
    }
    let _ = crate::logfile::write(app, "info", "Exit requested");
    let _ = app.emit_to("main", "app-exit-requested", ());
    // Auch bei einem defekten WebView muss Beenden möglich bleiben.
    let app = app.clone();
    std::thread::spawn(move || {
        std::thread::sleep(std::time::Duration::from_secs(3));
        finish_exit(&app);
    });
}

const COMMAND_TOGGLE: &str = "toggle";
const COMMAND_NEXT: &str = "next";
const COMMAND_PREVIOUS: &str = "previous";

/// Medientasten und der Befehl, den sie ausloesen.
const MEDIA_KEYS: [(Code, &str); 3] = [
    (Code::MediaPlayPause, COMMAND_TOGGLE),
    (Code::MediaTrackNext, COMMAND_NEXT),
    (Code::MediaTrackPrevious, COMMAND_PREVIOUS),
];

/// Fenster nach vorn holen. Auch eine zweite Instanz landet hier.
pub fn show_main_window<R: Runtime>(app: &AppHandle<R>) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
}

fn emit_command<R: Runtime>(app: &AppHandle<R>, command: &str) {
    let _ = app.emit(EVENT_PLAYER_COMMAND, command);
}

/// Texte des Tray-Menues in der Reihenfolge Fenster, Wiedergabe, Weiter, Zurueck, Beenden.
/// Unbekannte Sprachen fallen auf Englisch zurueck, wie in der Oberflaeche.
pub fn tray_texts(language: &str) -> [&'static str; 5] {
    match language {
        "de" => ["Fenster anzeigen", "Wiedergabe / Pause", "Nächster Titel", "Vorheriger Titel", "Beenden"],
        _ => ["Show window", "Play / Pause", "Next track", "Previous track", "Quit"],
    }
}

/// Die Menuepunkte des Tray-Symbols, damit die Sprache spaeter wechseln kann.
pub struct TrayItems<R: Runtime> {
    items: [MenuItem<R>; 5],
}

/// Tray-Menue in eine andere Sprache umstellen. Ohne Tray-Symbol ist das ein Nichts.
pub fn apply_language<R: Runtime>(app: &AppHandle<R>, language: &str) -> Result<(), String> {
    let Some(tray) = app.try_state::<TrayItems<R>>() else {
        return Ok(());
    };
    for (item, text) in tray.items.iter().zip(tray_texts(language)) {
        item.set_text(text).map_err(|error| error.to_string())?;
    }
    Ok(())
}

/// Tray-Symbol mit Menue. Linksklick holt das Fenster nach vorn, das Menue haengt
/// am Rechtsklick. Die Oberflaeche stellt die Sprache nach dem Start um.
pub fn setup_tray<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<()> {
    let [t_show, t_toggle, t_next, t_previous, t_quit] = tray_texts("en");
    let show = MenuItem::with_id(app, "show", t_show, true, None::<&str>)?;
    let toggle = MenuItem::with_id(app, "toggle", t_toggle, true, None::<&str>)?;
    let next = MenuItem::with_id(app, "next", t_next, true, None::<&str>)?;
    let previous = MenuItem::with_id(app, "previous", t_previous, true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", t_quit, true, None::<&str>)?;
    let before = PredefinedMenuItem::separator(app)?;
    let after = PredefinedMenuItem::separator(app)?;

    let items: Vec<&dyn IsMenuItem<R>> =
        vec![&show, &before, &toggle, &next, &previous, &after, &quit];
    let menu = Menu::with_items(app, &items)?;

    TrayIconBuilder::with_id("main")
        .icon(Image::from_bytes(include_bytes!("../icons/32x32.png"))?)
        .tooltip("Niuva Sonic")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id().as_ref() {
            "show" => show_main_window(app),
            "toggle" => emit_command(app, COMMAND_TOGGLE),
            "next" => emit_command(app, COMMAND_NEXT),
            "previous" => emit_command(app, COMMAND_PREVIOUS),
            "quit" => request_exit(app),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                show_main_window(tray.app_handle());
            }
        })
        .build(app)?;

    app.manage(TrayItems { items: [show, toggle, next, previous, quit] });

    Ok(())
}

/// Fenster schliessen: je nach Einstellung in den Tray legen oder die App beenden.
///
/// Nur wenn das Tray-Symbol wirklich da ist: sonst bleibt die App unsichtbar
/// erreichbar und niemand kann sie wieder nach vorn holen.
pub fn handle_window_event<R: Runtime>(window: &Window<R>, event: &WindowEvent) {
    if let WindowEvent::CloseRequested { api, .. } = event {
        let app = window.app_handle();
        let hide =
            app.state::<PrefsState>().get().close_to_tray && app.state::<TrayState>().ready();
        api.prevent_close();
        if hide {
            // Die Wiedergabe laeuft weiter: das Fenster verschwindet nur.
            let _ = window.hide();
        } else {
            request_exit(app);
        }
    }
}

/// Medientasten systemweit abfangen oder wieder freigeben.
///
/// Schlaegt das Belegen fehl, wird nichts halb belegt gelassen: eine andere App
/// haelt die Taste dann womoeglich schon.
pub fn apply_global_shortcuts<R: Runtime>(app: &AppHandle<R>, enabled: bool) -> Result<(), String> {
    let shortcuts = app.global_shortcut();
    shortcuts
        .unregister_all()
        .map_err(|error| error.to_string())?;
    if !enabled {
        return Ok(());
    }

    for (code, command) in MEDIA_KEYS {
        let registered =
            shortcuts.on_shortcut(Shortcut::new(None, code), move |app, _shortcut, event| {
                if event.state == ShortcutState::Pressed {
                    emit_command(app, command);
                }
            });
        if let Err(error) = registered {
            let _ = shortcuts.unregister_all();
            return Err(format!("{code:?} could not be registered: {error}"));
        }
    }

    Ok(())
}

/// Ereignis an die Oberflaeche: Fortschritt beim Herunterladen eines Updates.
pub const EVENT_UPDATE_PROGRESS: &str = "update-progress";

/// Die gefundene Fassung und, sobald geladen, ihr Installationspaket.
///
/// Herunterladen und Einspielen sind getrennt: Die Oberflaeche sichert den
/// Player-Zustand, bevor der Installer die App unter Windows beendet.
#[derive(Default)]
pub struct PendingUpdate(Mutex<UpdateSlot>);

#[derive(Default)]
struct UpdateSlot {
    update: Option<Update>,
    bytes: Option<Vec<u8>>,
    downloading: bool,
}

impl PendingUpdate {
    fn lock(&self) -> std::sync::MutexGuard<'_, UpdateSlot> {
        self.0.lock().unwrap_or_else(|e| e.into_inner())
    }

    /// Eine Suche ersetzt den Merker, solange nichts laedt und nicht schon genau
    /// diese Fassung bereitliegt.
    fn remember(&self, found: Option<Update>) {
        let mut slot = self.lock();
        if slot.downloading {
            return;
        }
        let same = matches!((&slot.update, &found), (Some(a), Some(b)) if a.version == b.version);
        if !same {
            slot.bytes = None;
        }
        slot.update = found;
    }
}

/// Die vorgemerkte Fassung herunterladen und pruefen. Meldet den Fortschritt als
/// `update-progress` und liefert die Versionsnummer zurueck.
pub async fn download_update<R: Runtime>(app: &AppHandle<R>) -> Result<String, String> {
    let pending = app.state::<PendingUpdate>();
    let update = {
        let mut slot = pending.lock();
        if slot.downloading {
            return Err("The update is already being downloaded.".to_string());
        }
        let update = slot
            .update
            .clone()
            .ok_or("No new version is pending. Please check again.")?;
        if slot.bytes.is_some() {
            return Ok(update.version);
        }
        slot.downloading = true;
        update
    };

    let _ = crate::logfile::write(app, "info", &format!("Downloading update {}", update.version));
    let mut received: u64 = 0;
    let result = update
        .download(
            |chunk, total| {
                received += chunk as u64;
                let _ = app.emit(
                    EVENT_UPDATE_PROGRESS,
                    serde_json::json!({ "received": received, "total": total.unwrap_or(0) }),
                );
            },
            || {},
        )
        .await;

    let mut slot = pending.lock();
    slot.downloading = false;
    match result {
        Ok(bytes) => {
            slot.bytes = Some(bytes);
            let _ = crate::logfile::write(app, "info", &format!("Update {} downloaded and verified", update.version));
            Ok(update.version)
        }
        Err(error) => {
            let _ = crate::logfile::write(app, "error", &format!("Update could not be downloaded: {error}"));
            Err(error.to_string())
        }
    }
}

/// Das geladene Paket einspielen. Unter Windows startet der Installer und
/// beendet die App; schlaegt das Einspielen fehl, bleibt sie offen und meldet den Grund.
pub fn install_update<R: Runtime>(app: &AppHandle<R>) -> Result<(), String> {
    let pending = app.state::<PendingUpdate>();
    let (update, bytes) = {
        let slot = pending.lock();
        match (slot.update.clone(), slot.bytes.clone()) {
            (Some(update), Some(bytes)) => (update, bytes),
            _ => return Err("The update has not been downloaded yet.".to_string()),
        }
    };
    let _ = crate::logfile::write(app, "info", &format!("Installing update {}", update.version));
    if let Err(error) = update.install(bytes) {
        let _ = crate::logfile::write(app, "error", &format!("Update could not be installed: {error}"));
        return Err(error.to_string());
    }
    app.restart()
}

/// Nach einer neuen Fassung suchen. Ohne hinterlegte Adresse kann nicht gesucht
/// werden; das ist der Normalfall, solange kein Update-Server eingerichtet ist.
pub async fn check_for_update<R: Runtime>(app: &AppHandle<R>) -> UpdateStatus {
    let current_version = app.package_info().version.to_string();
    if !updater_configured(app.config().plugins.0.get("updater")) {
        return UpdateStatus {
            state: "notConfigured",
            current_version,
            version: None,
            message: None,
        };
    }
    let updater = match app.updater_builder().build() {
        Ok(updater) => updater,
        Err(error) => {
            return UpdateStatus {
                state: "error",
                current_version,
                version: None,
                message: Some(error.to_string()),
            };
        }
    };

    match updater.check().await {
        Ok(Some(update)) => {
            let version = update.version.clone();
            app.state::<PendingUpdate>().remember(Some(update));
            UpdateStatus {
                state: "available",
                current_version,
                version: Some(version),
                message: None,
            }
        }
        Ok(None) => {
            app.state::<PendingUpdate>().remember(None);
            UpdateStatus {
                state: "upToDate",
                current_version,
                version: None,
                message: None,
            }
        }
        Err(error) => UpdateStatus {
            state: "error",
            current_version,
            version: None,
            message: Some(error.to_string()),
        },
    }
}

fn updater_configured(config: Option<&serde_json::Value>) -> bool {
    config.is_some_and(|config| {
        config
            .get("endpoints")
            .and_then(|v| v.as_array())
            .is_some_and(|urls| !urls.is_empty())
            && config
                .get("pubkey")
                .and_then(|v| v.as_str())
                .is_some_and(|key| !key.trim().is_empty())
    })
}

#[cfg(test)]
mod tests {
    use super::{tray_texts, updater_configured};
    use serde_json::json;

    #[test]
    fn tray_menue_gibt_es_auf_englisch_und_deutsch() {
        assert_eq!(tray_texts("en")[4], "Quit");
        assert_eq!(tray_texts("de")[4], "Beenden");
        // Unbekannte Sprachen fallen auf Englisch zurueck.
        assert_eq!(tray_texts("fr"), tray_texts("en"));
        assert!(tray_texts("de").iter().all(|text| !text.is_empty()));
    }

    #[test]
    fn update_braucht_adresse_und_schluessel() {
        assert!(!updater_configured(None));
        assert!(!updater_configured(Some(
            &json!({"endpoints": [], "pubkey": "key"})
        )));
        assert!(!updater_configured(Some(
            &json!({"endpoints": ["https://example.org/update"], "pubkey": " "})
        )));
        assert!(updater_configured(Some(
            &json!({"endpoints": ["https://example.org/update"], "pubkey": "key"})
        )));
    }
}
