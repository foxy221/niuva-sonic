# Review Technik Phase 3

Datum: 18.10.2026. Ausgangsstand: `1eb3125` auf `main`.

Geprüft wurden Tray/Beenden, Single-Instance-Anbindung, Fensterintegration,
Medientasten und lokale Tastaturbedienung, Windows-Einstellungen,
Update-Vorbereitung und die Plattformgrenzen der neuen Desktop-Plugins.

## Behobene Befunde

| Bereich | Fehler | Korrektur / Nachweis |
| --- | --- | --- |
| Beenden / Persistenz | „Beenden“ im Tray rief unmittelbar `app.exit(0)` auf. Der letzte Player-Zustand konnte noch im viersekündigen Save-Timer oder in einem nativen Schreibvorgang liegen. Normales Fensterschließen konnte den WebView ebenfalls vor dem Speichern zerstören. | Bei echtem Beenden bleibt der WebView bis zur Bestätigung erhalten. `app-exit-requested` löst `player.flush()` aus; Queue und bereits laufende native Schreibvorgänge werden abgewartet, dann bestätigt `finish_exit` das Beenden. Doppelte Signale werden zusammengefasst. Nach drei Sekunden beendet die Hülle auch ohne Antwort, damit ein defekter WebView die App nicht festhält. Tests prüfen Reihenfolge, doppelte Signale, Fehlerfall, aktuelle Position und ausstehende Settings-Saves. In-den-Tray-Schließen löst kein Beenden aus. |
| Medientasten-Einstellungen | Registrierung geschah vor dem Speichern; ein Speicherfehler ließ die Registrierung geändert, während die Oberfläche den alten Zustand anzeigte. Gleichzeitig eintreffende IPC-Änderungen konnten jeweils das andere Feld überschreiben. | Ein Mutex umfasst Lesen, Anwenden, Speichern und Übernehmen. Bei Fehlern wird die vorherige Registrierung wieder angewendet und der Store-Cache zurückgesetzt; auch ein Rollback-Fehler wird gemeldet. Rust-Tests für Registrierungsfehler, Speicherfehler und parallele Änderungen beider Felder. Die Windows-Schalter sind während des Requests gesperrt; ein synchroner Guard verhindert mehrere Requests vor dem React-Render. |
| Medientasten beim Start | War die gespeicherte Option aktiv, aber eine Taste durch eine andere Anwendung belegt, blieb der In-Memory-Schalter trotz fehlgeschlagener Registrierung aktiv. | Nach einer fehlgeschlagenen Startregistrierung zeigt der Laufzeitzustand „aus“ und die deaktivierte Option wird gespeichert. Ein erneuter Aktivierungsversuch meldet den konkreten Registrierungsfehler. |
| Listener-Lebensdauer | Abgewiesene Listener-Anmeldungen erzeugten unbehandelte Promise-Rejections. Ein bereits abgebauter Hook konnte vor Abschluss der asynchronen Abmeldung noch Player-Befehle ausführen, etwa beim Strict-Mode-Neustart. | Fehler werden abgefangen und protokolliert. Bereits abgemeldete Hooks ignorieren Ereignisse sofort und entfernen auch verspätet registrierte Listener. Regressionstests für beide Fälle. |
| Lokale Leertaste | Nur das direkte native Element und wenige ARIA-Rollen wurden erkannt. Ereignisse aus Button-Kindelementen, SVGs und eigenen Switch-/Checkbox-/Button-Rollen konnten zusätzlich den Player umschalten. Kompositionseingaben wurden nicht ausgeschlossen. | Interaktive Vorfahren werden über `closest` erkannt, einschließlich SVG-Kindelementen und ARIA-Steuerelementen. IME-Komposition bleibt unberührt. Sechs neue Tastaturtests. |
| Plattformgrenze | Die Oberfläche setzte jede Tauri-Laufzeit mit einer Desktop-App gleich und zeigte deshalb auch auf Android Windows-Schalter. Desktop-Plugins standen teilweise als allgemeine Cargo-Abhängigkeiten im gemeinsamen Projekt. | Windows-Funktionen werden in mobilen Tauri-WebViews ausgeblendet. Single-Instance, Window-State und Global-Shortcut sind wie der Updater Desktop-Zielabhängigkeiten. Android-User-Agent-Test sowie Prüfung des Cargo-Abhängigkeitsbaums für `aarch64-linux-android`: keine dieser Desktop-Plugin-Abhängigkeiten. |
| Update-Status | Eine verspätete automatische Prüfung konnte ein neueres, manuell angefordertes Ergebnis überschreiben. Ein leerer öffentlicher Schlüssel wurde bei vorhandener Adresse nicht als unvollständige Einrichtung erkannt; andere Builder-Fehler wurden pauschal als „nicht eingerichtet“ gemeldet. | Requests erhalten eine Revision. Eine vollständige Einrichtung verlangt Adresse und nichtleeren Schlüssel; echte Builder-Fehler werden als Fehler ausgegeben. Tests für verspätete Antworten und Konfigurationsvoraussetzungen. |

## Verifikation

- `pnpm test`: **112 Tests bestanden**, zuvor 96. Einschließlich verspäteter Initialisierung im React Strict Mode.
- `cargo test --locked --offline --manifest-path src-tauri/Cargo.toml`: **8 Tests bestanden**, zuvor 4.
- `pnpm build`: TypeScript und Vite erfolgreich.
- `pnpm tauri build`: Windows-Release und NSIS-Installer erfolgreich gebaut.
- `cargo fmt` und `git diff --check`: erfolgreich.
- Desktop-Plugin-Abgrenzung im Android-Abhängigkeitsbaum geprüft.

Die IPC-, Speicherfehler-, Tastatur- und Listener-Tests simulieren die jeweilige
Systemgrenze. Eine echte Windows-Medientasten-/Overlay-Sichtprüfung, Tray-Klicks,
Installation/Deinstallation und ein vollständiger Android-Build wurden in diesem
Review nicht wiederholt. Die vorhandenen manuellen Prüfnotizen in der Roadmap
bleiben davon getrennt. Es wurden keine Serverdaten verändert.

## Verbleibende Produktgrenzen

Authenticode-Signierung und die Veröffentlichung automatischer Updates brauchen
weiterhin Zertifikat bzw. Update-Adresse und Signierschlüssel. Sie wurden nicht
eingerichtet. Die bestehende WebView2-Einschränkung beim Anwendungsnamen im
Windows-Medienoverlay bleibt bestehen. Bei einem blockierten WebView oder
Speichervorgängen über drei Sekunden ist der Exit-Fallback absichtlich stärker
als die Garantie, jeden letzten Zustand zu speichern.
