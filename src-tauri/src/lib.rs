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
            commands::set_close_to_tray,
            commands::set_global_shortcuts,
            commands::check_for_update
        ])
        .setup(|app| {
            app.manage(prefs::PrefsState::load(app.handle()));

            #[cfg(desktop)]
            {
                // Ein fehlendes Tray-Symbol oder eine belegte Medientaste darf den
                // Start nicht verhindern; die Einstellungen zeigen den Zustand.
                if let Err(error) = desktop::setup_tray(app.handle()) {
                    eprintln!("Tray-Symbol konnte nicht angelegt werden: {error}");
                }
                let prefs = app.state::<prefs::PrefsState>().get();
                if let Err(error) = desktop::apply_global_shortcuts(app.handle(), prefs.global_shortcuts) {
                    eprintln!("Medientasten konnten nicht belegt werden: {error}");
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