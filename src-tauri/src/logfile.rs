//! Fehlerprotokoll in einer Datei.
//!
//! Die Oberflaeche meldet Fehler ueber `log_message`, die Huelle schreibt beim
//! Start und beim Beenden mit. Die Datei liegt im Protokollordner der App und
//! wird ab einer Megabyte-Groesse einmal umbenannt, damit sie nicht unbegrenzt
//! waechst. Die Diagnoseansicht liest die letzten Zeilen ueber `read_log`.

use std::fs::OpenOptions;
use std::io::Write;
use std::path::PathBuf;
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

use serde::Serialize;
use tauri::{AppHandle, Manager, Runtime};

const FILE: &str = "niuva-sonic.log";
/// Ab dieser Groesse wird die Datei zu `<Datei>.1` und neu begonnen.
const MAX_BYTES: u64 = 1_000_000;
/// Eine Meldung wird gekuerzt; ein Fehlertext soll die Datei nicht fluten.
const MAX_MESSAGE: usize = 2000;
/// Obergrenze fuer die Diagnoseansicht.
const MAX_LINES: usize = 1000;

/// Schreibvorgaenge nacheinander, damit sich Zeilen nicht durchmischen.
static WRITE_LOCK: Mutex<()> = Mutex::new(());

/// Auskunft fuer die Diagnoseansicht.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LogTail {
    pub path: String,
    pub lines: Vec<String>,
}

/// Zulaessige Stufen; die Oberflaeche schickt sie klein geschrieben.
pub fn validate_level(level: &str) -> Result<&str, String> {
    match level {
        "error" => Ok("ERROR"),
        "warn" => Ok("WARN "),
        "info" => Ok("INFO "),
        other => Err(format!("Unbekannte Protokollstufe: {other}")),
    }
}

/// Eine Zeile ohne Zeilenumbrueche und in vertretbarer Laenge.
pub fn sanitize(message: &str) -> String {
    let cleaned: String = message
        .chars()
        .map(|c| if c.is_control() { ' ' } else { c })
        .collect();
    let trimmed = cleaned.trim();
    if trimmed.chars().count() > MAX_MESSAGE {
        let short: String = trimmed.chars().take(MAX_MESSAGE).collect();
        return format!("{short} …");
    }
    trimmed.to_string()
}

/// Zeitstempel als `JJJJ-MM-TT HH:MM:SS` (UTC).
///
/// Bewusst ohne zusaetzliche Abhaengigkeit: die Umrechnung von Sekunden seit
/// 1970 in ein Kalenderdatum ist kurz und mit einem Test abgesichert.
pub fn timestamp(seconds: u64) -> String {
    let days = (seconds / 86_400) as i64;
    let rest = seconds % 86_400;
    let (hour, minute, second) = (rest / 3600, (rest % 3600) / 60, rest % 60);
    let (year, month, day) = civil_from_days(days);
    format!("{year:04}-{month:02}-{day:02} {hour:02}:{minute:02}:{second:02}")
}

/// Tage seit 1970 in Jahr, Monat, Tag (Howard Hinnant, `civil_from_days`).
fn civil_from_days(days: i64) -> (i64, u32, u32) {
    let z = days + 719_468;
    let era = z.div_euclid(146_097);
    let doe = z.rem_euclid(146_097);
    let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365;
    let y = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = (doy - (153 * mp + 2) / 5 + 1) as u32;
    let m = if mp < 10 { mp + 3 } else { mp - 9 } as u32;
    (if m <= 2 { y + 1 } else { y }, m, d)
}

/// Vollstaendige Protokollzeile.
pub fn format_line(level: &str, message: &str) -> String {
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    let label = validate_level(level).unwrap_or("INFO ");
    format!("{} {} {}\r\n", timestamp(now), label, sanitize(message))
}

/// Protokollordner der App; wird angelegt, wenn er fehlt.
pub fn log_dir<R: Runtime>(app: &AppHandle<R>) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_log_dir()
        .map_err(|error| format!("Der Protokollordner ist nicht ermittelbar: {error}"))?;
    std::fs::create_dir_all(&dir)
        .map_err(|error| format!("Der Protokollordner liegt nicht an: {error}"))?;
    Ok(dir)
}

/// Pfad der Protokolldatei.
pub fn log_path<R: Runtime>(app: &AppHandle<R>) -> Result<PathBuf, String> {
    Ok(log_dir(app)?.join(FILE))
}

/// Haengt eine Zeile an. Schlaegt das Schreiben fehl, darf die App weiterlaufen;
/// der Aufrufer entscheidet, ob er den Fehler meldet.
pub fn write<R: Runtime>(app: &AppHandle<R>, level: &str, message: &str) -> Result<(), String> {
    let path = log_path(app)?;
    let _guard = WRITE_LOCK
        .lock()
        .unwrap_or_else(|broken| broken.into_inner());
    rotate_if_large(&path);
    let mut file = OpenOptions::new()
        .create(true)
        .append(true)
        .open(&path)
        .map_err(|error| format!("Das Protokoll laesst sich nicht oeffnen: {error}"))?;
    file.write_all(format_line(level, message).as_bytes())
        .map_err(|error| format!("Das Protokoll laesst sich nicht schreiben: {error}"))
}

/// Eine zu grosse Datei wird zu `<Datei>.1`; die vorherige Sicherung faellt weg.
fn rotate_if_large(path: &PathBuf) {
    let too_large = std::fs::metadata(path)
        .map(|meta| meta.len() > MAX_BYTES)
        .unwrap_or(false);
    if !too_large {
        return;
    }
    let backup = path.with_extension("log.1");
    let _ = std::fs::remove_file(&backup);
    let _ = std::fs::rename(path, &backup);
}

/// Die letzten Zeilen der Datei; eine fehlende Datei ist kein Fehler.
pub fn tail<R: Runtime>(app: &AppHandle<R>, max_lines: usize) -> Result<LogTail, String> {
    let path = log_path(app)?;
    let lines = std::fs::read_to_string(&path)
        .map(|content| {
            let mut lines: Vec<String> = content
                .lines()
                .rev()
                .take(max_lines.clamp(1, MAX_LINES))
                .map(|line| line.to_string())
                .collect();
            lines.reverse();
            lines
        })
        .unwrap_or_default();
    Ok(LogTail {
        path: path.to_string_lossy().to_string(),
        lines,
    })
}

/// Meldung aus der Oberflaeche.
#[tauri::command]
pub fn log_message(app: AppHandle, level: String, message: String) -> Result<(), String> {
    validate_level(&level)?;
    write(&app, &level, &message)
}

/// Wo liegt das Protokoll? Fuer die Diagnoseansicht, auch ohne Datei.
#[tauri::command]
pub fn log_location(app: AppHandle) -> Result<String, String> {
    Ok(log_path(&app)?.to_string_lossy().to_string())
}

/// Die letzten Zeilen des Protokolls.
#[tauri::command]
pub fn read_log(app: AppHandle, max_lines: Option<usize>) -> Result<LogTail, String> {
    tail(&app, max_lines.unwrap_or(200))
}

/// Leert das Protokoll; eine Sicherung `.1` verschwindet mit.
#[tauri::command]
pub fn clear_log(app: AppHandle) -> Result<(), String> {
    let path = log_path(&app)?;
    let _guard = WRITE_LOCK
        .lock()
        .unwrap_or_else(|broken| broken.into_inner());
    for target in [path.clone(), path.with_extension("log.1")] {
        match std::fs::remove_file(&target) {
            Ok(()) => {}
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
            Err(error) => return Err(format!("Das Protokoll laesst sich nicht leeren: {error}")),
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{MAX_MESSAGE, format_line, sanitize, timestamp, validate_level};

    #[test]
    fn stufen_sind_festgelegt() {
        assert_eq!(validate_level("error").unwrap(), "ERROR");
        assert_eq!(validate_level("warn").unwrap(), "WARN ");
        assert_eq!(validate_level("info").unwrap(), "INFO ");
        assert!(validate_level("debug").is_err());
        assert!(validate_level("").is_err());
    }

    #[test]
    fn meldungen_werden_bereinigt() {
        assert_eq!(sanitize("  zwei\nZeilen\t "), "zwei Zeilen");
        let long = sanitize(&"x".repeat(MAX_MESSAGE + 50));
        assert!(long.ends_with('…'));
        assert_eq!(long.chars().count(), MAX_MESSAGE + 2);
    }

    #[test]
    fn zeitstempel_trifft_bekannte_tage() {
        assert_eq!(timestamp(0), "1970-01-01 00:00:00");
        assert_eq!(timestamp(86_399), "1970-01-01 23:59:59");
        assert_eq!(timestamp(1_700_000_000), "2023-11-14 22:13:20");
        // Schaltjahr: der 29. Februar liegt zwischen dem 28. und dem 1. Maerz.
        assert_eq!(timestamp(1_709_164_800), "2024-02-29 00:00:00");
    }

    #[test]
    fn zeile_hat_zeit_stufe_und_text() {
        let line = format_line("error", "KeinNetz");
        assert!(line.ends_with("ERROR KeinNetz\r\n"), "{line}");
        assert_eq!(line.split(' ').count(), 4, "{line}");
    }
}
