mod commands;
#[cfg(desktop)]
mod desktop;
mod prefs;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let context = tauri::generate_context!();
    let builder = tauri::Builder::default();

    // Die Erkennung der zweiten Instanz muss vor allen anderen Plugins stehen.
    #[cfg(desktop)]
    let builder = builder
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            desktop::show_main_window(app);
        }))
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_updater::Builder::new().build());

    builder
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            commands::window_prefs,
            commands::tray_ready,
            commands::set_close_to_tray,
            commands::set_global_shortcuts,
            commands::check_for_update,
            commands::finish_exit
        ])
        .setup(|app| {
            app.manage(prefs::PrefsState::load(app.handle()));

            #[cfg(desktop)]
            {
                app.manage(desktop::TrayState::new());
                app.manage(desktop::ExitState::default());

                // Ein fehlendes Tray-Symbol oder eine belegte Medientaste darf den
                // Start nicht verhindern. Ohne Symbol beendet Schliessen die App
                // wieder normal, damit sie nicht unsichtbar weiterlaeuft.
                let tray_ready = match desktop::setup_tray(app.handle()) {
                    Ok(()) => true,
                    Err(error) => {
                        eprintln!("Tray-Symbol konnte nicht angelegt werden: {error}");
                        false
                    }
                };
                app.state::<desktop::TrayState>().set_ready(tray_ready);

                let prefs = app.state::<prefs::PrefsState>().get();
                if let Err(error) =
                    desktop::apply_global_shortcuts(app.handle(), prefs.global_shortcuts)
                {
                    eprintln!("Medientasten konnten nicht belegt werden: {error}");
                    let fallback = prefs::Prefs {
                        global_shortcuts: false,
                        ..prefs
                    };
                    app.state::<prefs::PrefsState>().set(fallback);
                    if let Err(error) = prefs::write(app.handle(), fallback) {
                        eprintln!(
                            "Deaktivierte Medientasten konnten nicht gespeichert werden: {error}"
                        );
                    }
                }
            }

            Ok(())
        })
        .on_window_event(|window, event| {
            #[cfg(desktop)]
            desktop::handle_window_event(window, event);

            #[cfg(not(desktop))]
            let _ = (window, event);
        })
        .run(context)
        .expect("Fehler beim Start der Anwendung");
}
