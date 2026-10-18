//! Windows-Integration: Tray-Symbol, Fensterverhalten, Medientasten und Update-Pruefung.

use std::sync::atomic::{AtomicBool, Ordering};

use tauri::{
    AppHandle, Emitter, Manager, Runtime, Window, WindowEvent,
    image::Image,
    menu::{IsMenuItem, Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Shortcut, ShortcutState};
use tauri_plugin_updater::UpdaterExt;

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

/// Tray-Symbol mit Menue. Linksklick holt das Fenster nach vorn, das Menue haengt
/// am Rechtsklick.
pub fn setup_tray<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<()> {
    let show = MenuItem::with_id(app, "show", "Fenster anzeigen", true, None::<&str>)?;
    let toggle = MenuItem::with_id(app, "toggle", "Wiedergabe / Pause", true, None::<&str>)?;
    let next = MenuItem::with_id(app, "next", "Naechster Titel", true, None::<&str>)?;
    let previous = MenuItem::with_id(app, "previous", "Vorheriger Titel", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Beenden", true, None::<&str>)?;
    let before = PredefinedMenuItem::separator(app)?;
    let after = PredefinedMenuItem::separator(app)?;

    let items: Vec<&dyn IsMenuItem<R>> = vec![&show, &before, &toggle, &next, &previous, &after, &quit];
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
            "quit" => app.exit(0),
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

    Ok(())
}

/// Fenster schliessen: je nach Einstellung in den Tray legen oder die App beenden.
///
/// Nur wenn das Tray-Symbol wirklich da ist: sonst bleibt die App unsichtbar
/// erreichbar und niemand kann sie wieder nach vorn holen.
pub fn handle_window_event<R: Runtime>(window: &Window<R>, event: &WindowEvent) {
    if let WindowEvent::CloseRequested { api, .. } = event {
        let app = window.app_handle();
        let hide = app.state::<PrefsState>().get().close_to_tray && app.state::<TrayState>().ready();
        if hide {
            // Die Wiedergabe laeuft weiter: das Fenster verschwindet nur.
            api.prevent_close();
            let _ = window.hide();
        }
    }
}

/// Medientasten systemweit abfangen oder wieder freigeben.
///
/// Schlaegt das Belegen fehl, wird nichts halb belegt gelassen: eine andere App
/// haelt die Taste dann womoeglich schon.
pub fn apply_global_shortcuts<R: Runtime>(app: &AppHandle<R>, enabled: bool) -> Result<(), String> {
    let shortcuts = app.global_shortcut();
    shortcuts.unregister_all().map_err(|error| error.to_string())?;
    if !enabled {
        return Ok(());
    }

    for (code, command) in MEDIA_KEYS {
        let registered = shortcuts.on_shortcut(Shortcut::new(None, code), move |app, _shortcut, event| {
            if event.state == ShortcutState::Pressed {
                emit_command(app, command);
            }
        });
        if let Err(error) = registered {
            let _ = shortcuts.unregister_all();
            return Err(format!("{code:?} konnte nicht belegt werden: {error}"));
        }
    }

    Ok(())
}

/// Nach einer neuen Fassung suchen. Ohne hinterlegte Adresse kann nicht gesucht
/// werden; das ist der Normalfall, solange kein Update-Server eingerichtet ist.
pub async fn check_for_update<R: Runtime>(app: &AppHandle<R>) -> UpdateStatus {
    let current_version = app.package_info().version.to_string();
    let Ok(updater) = app.updater_builder().build() else {
        return UpdateStatus {
            state: "notConfigured",
            current_version,
            version: None,
            message: None,
        };
    };

    match updater.check().await {
        Ok(Some(update)) => UpdateStatus {
            state: "available",
            current_version,
            version: Some(update.version.clone()),
            message: None,
        },
        Ok(None) => UpdateStatus {
            state: "upToDate",
            current_version,
            version: None,
            message: None,
        },
        Err(error) => UpdateStatus {
            state: "error",
            current_version,
            version: None,
            message: Some(error.to_string()),
        },
    }
}
