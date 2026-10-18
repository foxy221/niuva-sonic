# Review Technik Phase 2

Datum: 18.10.2026. Geprüfter Ausgangsstand: `b780e60` auf `main`.

Geprüft wurden Queue-Verwaltung, Shuffle/Wiederholung, Wiederherstellung,
Scrobbling, Vorladen, Transcoding-Wechsel, ReplayGain-Anbindung und
Fehler-/Netzwechselbehandlung. Alle unten aufgeführten Befunde sind behoben.

## Befunde und Korrekturen

| Priorität | Fehler / Reproduktion | Korrektur und Nachweis |
| --- | --- | --- |
| P1 | Beim Wiederherstellen der Sitzung löschte `reset()` die gespeicherte Queue vor dem Lesen. Die doppelte Initialisierung durch React Strict Mode konnte dieselbe Löschung nochmals auslösen. | Speicherzustand zurücksetzen und gespeicherte Queue löschen sind getrennt. Gleichzeitige Sitzungs-Restores teilen sich einen Vorgang. Der Test startet über die echte Sitzungswiederherstellung mit zwei gleichzeitigen Aufrufen und prüft Queue, Position, pausierten Zustand und ausbleibendes Scrobbling. |
| P1 | Queues waren nur an die Serveradresse gebunden. Ein anderer Benutzer desselben Servers konnte sie übernehmen. Ein langsamer Restore konnte außerdem nach Abmeldung oder dem Start einer neuen Queue alte Daten einspielen. | Gespeicherte Queues enthalten den Benutzernamen. Restore prüft Sitzung und Queue-Revision nach jedem asynchronen Schritt. Tests für Benutzerwechsel, verspätete Antwort nach Abmeldung und neu gestartete Wiedergabe. |
| P2 | Asynchrone native Schreibvorgänge konnten ein späteres Löschen überholen und eine geleerte Queue wiederherstellen. Interne Audio-Pausen konnten während des Zurücksetzens zusätzliche Saves auslösen. | Native Änderungen laufen pro Datei in Aufrufreihenfolge; Reads warten auf vorherige Änderungen. Fehler blockieren spätere Schreibvorgänge nicht. Interne Audio-Quellenwechsel und Stop-Ereignisse werden nicht als Benutzerpause behandelt. Tests mit verzögertem und fehlgeschlagenem nativen Store. |
| P2 | Titelwiederholung und manuelles Neustarten nach Queue-Ende zählten nur einmal. Qualitäts-/Netzwechsel setzten dagegen Hörzeit und Zählstatus zurück. Schon das pausierte Wiederherstellen meldete „läuft jetzt“. | Ein Hörvorgang beginnt erst beim tatsächlichen Play-Ereignis. Technisches Neuladen behält Hörzeit und Submission-Status; neue Wiederholungen beginnen neu. Fortschritt während einer Pause zählt nicht. Tests für Wiederholung, erneuten Start, Qualitätswechsel vor/nach Submission und pausierte Zeitereignisse. |
| P2 | Der Fehlerzähler wurde bei jedem Laden und `canplay` zurückgesetzt. Eine Queue mit defekten Dateien konnte endlos durchlaufen. Ein geplanter Fehlersprung konnte nach einer Pause weiterlaufen. | Fehlerbudget bleibt über automatische Sprünge erhalten; erst echter Wiedergabefortschritt setzt es zurück. Timer werden bei manueller Pause, Quellenwechsel und Reset abgebrochen. Fehlerzustand zeigt keine laufende Wiedergabe an. Tests für vier aufeinanderfolgende Fehler einschließlich `canplay` und explizite Pause. |
| P2 | Ein verspätet abgewiesenes `play()` konnte den neuen Titel auf „pausiert“ setzen. Blockierte Starts erhielten keine Fehlermeldung. Ein früher gespeicherter Seek konnte einen neueren Seek überschreiben. Beim Gapless-Wechsel fehlte bei Titeln ohne API-Dauer die bereits vorgeladene Dauer. | Audio-Ladevorgänge haben eine Revision. Veraltete Promise-Ergebnisse werden ignoriert; aktuelle Startfehler werden angezeigt. Neue Seeks ersetzen ausstehende Seeks und werden auf die tatsächliche Dauer begrenzt. Beim Übernehmen des Standby-Elements wird dessen Dauer gemeldet. Eigene Engine-Tests und ein Player-Integrationstest. |
| P2 | Shuffle verlor seine ursprüngliche Reihenfolge beim Neustart. Entfernen eines mehrfach eingefügten identischen Song-Objekts entfernte alle Vorkommen aus der ursprünglichen Reihenfolge. | Die ursprüngliche Reihenfolge wird als Zuordnung auf Queue-Indizes gespeichert und validiert wiederhergestellt. Entfernen betrifft genau ein Vorkommen. Tests für Shuffle-Restore und doppelte Einträge. |
| P2 | Abschalten des Vorladens ließ den nächsten Stream weiterladen. Abschalten von „Queue merken“ behielt die alte gespeicherte Queue. Ein langsamer Settings-Restore überschrieb neu eingegebene Einstellungen. | Die beiden Schalter werden sofort angewendet; Ausschalten löscht gespeicherte Queue und ausstehenden Save-Timer. Versionsprüfung schützt neuere Einstellungen. Tests für beide Schalter und verspätete Einstellungsantwort. |
| P2 | Media-Session-„play“ und „pause“ waren beide Toggle-Aktionen: Wiederholtes „pause“ startete die Wiedergabe. Entfernen eines pausierten Queue-Titels startete den Nachfolger ungefragt. Offline-Ereignisse zeigten selbst bei pausierter Queue „Puffert“. | Explizite, idempotente Play-/Pause-Aktionen und getrennte Wiedergabeabsicht. Entfernen erhält den Pausenzustand. Netzereignisse starten nur zuvor beabsichtigte Wiedergabe neu. Tests für Systemaktionen, pausiertes Entfernen und Offline/Online bei pausierter Queue. |

## Prüfung

- `pnpm test`: **88 Tests bestanden** in sieben Dateien, davon 26 neue Regressionstests gegenüber dem Ausgangsstand mit 62 Tests.
- `pnpm build`: TypeScript-Prüfung und Vite-Produktionsbuild erfolgreich.
- `cargo check --locked --offline`: erfolgreich.
- `git diff --check`: ohne Whitespace-Fehler.

Neue Tests: `tests/player.review.test.js`, `tests/audioEngine.test.js` und
`tests/storage.test.js`. Die bestehenden Phase-1- und Phase-2-Tests bleiben bestehen.

Die Tests verwenden echte Stores, Player-Logik und Audio-Engine mit simulierten
Audio-Elementen, Serverantworten und nativen Store-Aufrufen. Es gab keinen
Hörtest, keinen Test auf einem Android-Gerät und keinen vollständigen
Desktop-End-to-End-Test. Am Testserver wurden keine Daten verändert.
Samplegenaues Gapless-Audio und plattformspezifische Media-Session-Ereignisse
sind dadurch nicht als auf Hardware geprüft zu verstehen.

## Kompatibilität gespeicherter Queues

Ältere Queues ohne Benutzernamen werden bewusst nicht wiederhergestellt, weil
ihre Kontozugehörigkeit nicht sicher feststellbar ist. Nach dem nächsten Start
einer Queue wird das neue Format gespeichert. Zugangsdaten und Einstellungen
behalten ihre bisherigen Formate.
