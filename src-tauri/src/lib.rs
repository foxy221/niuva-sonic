mod commands;
#[cfg(desktop)]
mod desktop;
mod logfile;
mod offline;
mod prefs;
mod secrets;

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
            commands::download_update,
            commands::install_update,
            commands::finish_exit,
            offline::offline_base_dir,
            offline::download_file,
            offline::cancel_download,
            offline::offline_disk_usage,
            offline::delete_offline_file,
            offline::clear_offline,
            logfile::log_message,
            logfile::log_location,
            logfile::read_log,
            logfile::clear_log,
            secrets::keychain_available,
            secrets::save_credential,
            secrets::load_credential,
            secrets::delete_credential
        ])
        .setup(|app| {
            app.manage(prefs::PrefsState::load(app.handle()));
            app.manage(offline::Downloads::new());

            let version = app.package_info().version.to_string();
            if let Err(error) = logfile::write(
                app.handle(),
                "info",
                &format!("Niuva Sonic {version} gestartet"),
            ) {
                eprintln!("{error}");
            }

            #[cfg(desktop)]
            {
                app.manage(desktop::TrayState::new());
                app.manage(desktop::ExitState::default());
                app.manage(desktop::PendingUpdate::default());

                // Ein fehlendes Tray-Symbol oder eine belegte Medientaste darf den
                // Start nicht verhindern. Ohne Symbol beendet Schliessen die App
                // wieder normal, damit sie nicht unsichtbar weiterlaeuft.
                let tray_ready = match desktop::setup_tray(app.handle()) {
                    Ok(()) => true,
                    Err(error) => {
                        eprintln!("Tray-Symbol konnte nicht angelegt werden: {error}");
                        let _ = logfile::write(
                            app.handle(),
                            "error",
                            &format!("Tray-Symbol konnte nicht angelegt werden: {error}"),
                        );
                        false
                    }
                };
                app.state::<desktop::TrayState>().set_ready(tray_ready);

                let prefs = app.state::<prefs::PrefsState>().get();
                if let Err(error) =
                    desktop::apply_global_shortcuts(app.handle(), prefs.global_shortcuts)
                {
                    eprintln!("Medientasten konnten nicht belegt werden: {error}");
                    let _ = logfile::write(
                        app.handle(),
                        "warn",
                        &format!("Medientasten konnten nicht belegt werden: {error}"),
                    );
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
