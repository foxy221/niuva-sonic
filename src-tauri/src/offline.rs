//! Downloads und lokale Ablage fuer die Offline-Bibliothek.
//!
//! Die Oberflaeche orchestriert (welche Titel, Speicherlimit, Index), diese
//! Seite kuemmert sich um die Bytes: Dateien stueckweise herunterladen,
//! Fortschritt melden, Abbrueche, Groesse messen und loeschen. Die Dateien
//! liegen unter `<AppData>/offline/<Serverkuerzel>/…`; die Oberflaeche nennt
//! nur relative Pfade, die hier geprueft werden, bevor sie an den Wurzelordner
//! gehaengt werden.

use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager, Runtime, State};
use tauri_plugin_http::reqwest;
use tokio::io::AsyncWriteExt;

/// Fortschritt hoechstens so oft melden; die letzten Bytes immer.
const PROGRESS_EVERY: Duration = Duration::from_millis(250);

/// Ergebnis eines abgeschlossenen Downloads.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadedFile {
    /// Absoluter Pfad; die Oberflaeche wandelt ihn fuer die Wiedergabe um.
    pub path: String,
    pub size: u64,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct Progress<'a> {
    job_id: &'a str,
    received: u64,
    total: u64,
}

/// Laufende Downloads: Abbruch-Flag pro Job und ein gemeinsamer HTTP-Client.
pub struct Downloads {
    cancels: Mutex<HashMap<String, Arc<AtomicBool>>>,
    client: reqwest::Client,
}

impl Downloads {
    pub fn new() -> Self {
        let client = reqwest::Client::builder()
            .connect_timeout(Duration::from_secs(15))
            .build()
            .expect("HTTP-Client anlegbar");
        Self {
            cancels: Mutex::new(HashMap::new()),
            client,
        }
    }

    fn register(&self, job: &str) -> Result<Arc<AtomicBool>, String> {
        let mut cancels = self.cancels.lock().unwrap_or_else(|broken| broken.into_inner());
        // Pro Job genau ein Download: die Oberflaeche arbeitet die Titel der
        // Reihe nach ab, ein zweiter Aufruf waere ein Versehen.
        if cancels.contains_key(job) {
            return Err("This download is already running.".to_string());
        }
        let flag = Arc::new(AtomicBool::new(false));
        cancels.insert(job.to_string(), Arc::clone(&flag));
        Ok(flag)
    }

    fn unregister(&self, job: &str) {
        self.cancels
            .lock()
            .unwrap_or_else(|broken| broken.into_inner())
            .remove(job);
    }
}

/// Wurzel der Offline-Ablage; wird beim ersten Zugriff angelegt.
fn offline_root<R: Runtime>(app: &AppHandle<R>) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("The app folder cannot be determined: {error}"))?
        .join("offline");
    std::fs::create_dir_all(&dir).map_err(|error| format!("The offline folder cannot be created: {error}"))?;
    Ok(dir)
}

/// Relative Pfade der Oberflaeche: nur Buchstaben, Ziffern und `-_.` zwischen
/// Schraegstrichen. Das weist `..`, Laufwerkspfade und Trennzeichen anderer
/// Plattformen ab, bevor der Pfad an die Wurzel gehaengt wird.
pub fn validate_rel(rel: &str) -> Result<(), String> {
    let invalid = || format!("Invalid path for offline storage: {rel}");
    if rel.is_empty() || rel.len() > 240 || rel.starts_with('/') {
        return Err(invalid());
    }
    for part in rel.split('/') {
        if part.is_empty() || part == "." || part == ".." {
            return Err(invalid());
        }
        if !part
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || matches!(c, '-' | '_' | '.'))
        {
            return Err(invalid());
        }
    }
    Ok(())
}

async fn download<R: Runtime>(
    app: &AppHandle<R>,
    client: &reqwest::Client,
    job_id: &str,
    url: &str,
    rel: &str,
    cancel: &AtomicBool,
) -> Result<DownloadedFile, String> {
    let root = offline_root(app)?;
    let dest = root.join(rel);
    if let Some(parent) = dest.parent() {
        std::fs::create_dir_all(parent).map_err(|error| format!("The target folder cannot be created: {error}"))?;
    }
    // Erst in einer Teildatei sammeln, dann umbenennen: Abstuerze und Abbrueche
    // hinterlassen keine halben Titel, die wie vollstaendige aussehen.
    let mut tmp = dest.clone().into_os_string();
    tmp.push(".part");
    let tmp = PathBuf::from(tmp);

    let result = write_stream(app, client, job_id, url, &dest, &tmp, cancel).await;
    if result.is_err() {
        let _ = tokio::fs::remove_file(&tmp).await;
    }
    result
}

async fn write_stream<R: Runtime>(
    app: &AppHandle<R>,
    client: &reqwest::Client,
    job_id: &str,
    url: &str,
    dest: &Path,
    tmp: &Path,
    cancel: &AtomicBool,
) -> Result<DownloadedFile, String> {
    let response = client
        .get(url)
        .send()
        .await
        .map_err(|error| format!("The server cannot be reached: {error}"))?;
    if !response.status().is_success() {
        return Err(format!("The server answered with HTTP {}", response.status()));
    }
    // Subsonic meldet Fehler (falsche ID, fehlende Download-Rolle) mit HTTP 200 und
    // einem XML-/JSON-Text; der darf nicht als Titel in der Ablage landen.
    if is_error_body(response.headers().get(reqwest::header::CONTENT_TYPE)) {
        return Err("The server sent an error message instead of the file.".to_string());
    }
    let total = response.content_length().unwrap_or(0);
    let mut file = tokio::fs::File::create(tmp)
        .await
        .map_err(|error| format!("The file cannot be created: {error}"))?;
    let mut received: u64 = 0;
    let mut last_emit: Option<Instant> = None;
    let mut stream = response.bytes_stream();
    use futures_util::StreamExt;
    while let Some(chunk) = stream.next().await {
        if cancel.load(Ordering::Relaxed) {
            return Err("Download canceled.".to_string());
        }
        let chunk = chunk.map_err(|error| format!("The download was interrupted: {error}"))?;
        file.write_all(&chunk)
            .await
            .map_err(|error| format!("The file cannot be written: {error}"))?;
        received += chunk.len() as u64;
        let due = last_emit.is_none_or(|at| at.elapsed() >= PROGRESS_EVERY);
        if due {
            let _ = app.emit("download-progress", Progress { job_id, received, total });
            last_emit = Some(Instant::now());
        }
    }
    file.flush().await.map_err(|error| format!("The file cannot be finished: {error}"))?;
    drop(file);
    if received == 0 {
        return Err("The server sent an empty file.".to_string());
    }
    let _ = app.emit("download-progress", Progress { job_id, received, total: received });
    tokio::fs::rename(tmp, dest)
        .await
        .map_err(|error| format!("The file cannot be finished: {error}"))?;
    Ok(DownloadedFile {
        path: dest.to_string_lossy().into_owned(),
        size: received,
    })
}

/// Textantworten (XML, JSON, HTML) sind keine Audio- oder Bilddateien.
fn is_error_body(content_type: Option<&reqwest::header::HeaderValue>) -> bool {
    let Some(value) = content_type.and_then(|v| v.to_str().ok()) else { return false };
    let value = value.to_ascii_lowercase();
    value.starts_with("text/") || value.contains("xml") || value.contains("json")
}

/// Groesse eines Ordnerbaums in Bytes; angebrochene `.part`-Dateien zaehlen nicht.
fn dir_size(path: &Path) -> u64 {
    let mut total = 0;
    let Ok(entries) = std::fs::read_dir(path) else { return 0 };
    for entry in entries.flatten() {
        let Ok(file_type) = entry.file_type() else { continue };
        if file_type.is_dir() {
            total += dir_size(&entry.path());
        } else if file_type.is_file() {
            let is_partial = entry.file_name().to_string_lossy().ends_with(".part");
            if !is_partial {
                total += entry.metadata().map(|m| m.len()).unwrap_or(0);
            }
        }
    }
    total
}

/// Absoluter Pfad der Offline-Ablage; die Oberflaeche braucht ihn, um lokale
/// Dateien der Wiedergabe zu uebergeben.
#[tauri::command]
pub fn offline_base_dir<R: Runtime>(app: AppHandle<R>) -> Result<String, String> {
    Ok(offline_root(&app)?.to_string_lossy().into_owned())
}

/// Laedt eine Datei in die Offline-Ablage und meldet Fortschritt als Ereignis
/// `download-progress`. Ein Abbruch wird mit einer Fehlermeldung quittiert.
#[tauri::command]
pub async fn download_file<R: Runtime>(
    app: AppHandle<R>,
    downloads: State<'_, Downloads>,
    job_id: String,
    url: String,
    rel_path: String,
) -> Result<DownloadedFile, String> {
    validate_rel(&rel_path)?;
    let cancel = downloads.register(&job_id)?;
    let result = download(&app, &downloads.client, &job_id, &url, &rel_path, &cancel).await;
    downloads.unregister(&job_id);
    result
}

/// Bricht den laufenden Download eines Jobs ab. `false`, wenn er schon vorbei ist.
#[tauri::command]
pub fn cancel_download(downloads: State<Downloads>, job_id: String) -> bool {
    let cancels = downloads.cancels.lock().unwrap_or_else(|broken| broken.into_inner());
    match cancels.get(&job_id) {
        Some(flag) => {
            flag.store(true, Ordering::Relaxed);
            true
        }
        None => false,
    }
}

/// Belegte Groesse der Offline-Ablage in Bytes.
#[tauri::command]
pub fn offline_disk_usage<R: Runtime>(app: AppHandle<R>) -> Result<u64, String> {
    Ok(dir_size(&offline_root(&app)?))
}

/// Loescht eine Datei aus der Ablage. Fehlt sie bereits, gilt das als Erfolg:
/// Index und Platte duerfen auseinanderlaufen, etwa nach Eingriffen im Explorer.
#[tauri::command]
pub fn delete_offline_file<R: Runtime>(app: AppHandle<R>, rel_path: String) -> Result<(), String> {
    validate_rel(&rel_path)?;
    let dest = offline_root(&app)?.join(rel_path);
    match std::fs::remove_file(&dest) {
        Ok(()) => Ok(()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(error) => Err(format!("The file cannot be deleted: {error}")),
    }
}

/// Loescht die gesamte Offline-Ablage und meldet, wie viel Platz frei wurde.
#[tauri::command]
pub fn clear_offline<R: Runtime>(app: AppHandle<R>) -> Result<u64, String> {
    let root = offline_root(&app)?;
    let freed = dir_size(&root);
    let Ok(entries) = std::fs::read_dir(&root) else { return Ok(0) };
    for entry in entries.flatten() {
        let path = entry.path();
        let Ok(file_type) = entry.file_type() else { continue };
        let removed = if file_type.is_dir() {
            std::fs::remove_dir_all(&path)
        } else {
            std::fs::remove_file(&path)
        };
        if let Err(error) = removed {
            return Err(format!("The storage cannot be emptied: {error}"));
        }
    }
    Ok(freed)
}

#[cfg(test)]
mod tests {
    use super::{Downloads, is_error_body, validate_rel};

    #[test]
    fn zulaessige_pfade_werden_angenommen() {
        assert!(validate_rel("abc123/song.flac").is_ok());
        assert!(validate_rel("a1b2c3d4e5f6/covers/al-7.jpg").is_ok());
        assert!(validate_rel("mf-000012_Highlight.mp3").is_ok());
    }

    #[test]
    fn ausbrueche_werden_abgelehnt() {
        assert!(validate_rel("").is_err());
        assert!(validate_rel("/absolut/flac").is_err());
        assert!(validate_rel("ordner/../nachbar/song.flac").is_err());
        assert!(validate_rel("..").is_err());
        assert!(validate_rel("c:/daten/song.flac").is_err());
        assert!(validate_rel("ordner\\song.flac").is_err());
        assert!(validate_rel("ordner//song.flac").is_err());
        assert!(validate_rel("song name.flac").is_err());
        assert!(validate_rel("gänseblümchen.flac").is_err());
    }

    #[test]
    fn abbruch_laesst_sich_nur_einmal_anmelden() {
        let downloads = Downloads::new();
        let flag = downloads.register("job-1").expect("erste Anmeldung");
        assert!(downloads.register("job-1").is_err());
        downloads.unregister("job-1");
        assert!(downloads.register("job-1").is_ok());
        assert!(!flag.load(std::sync::atomic::Ordering::Relaxed));
    }

    #[test]
    fn textantworten_gelten_als_fehlerseite() {
        use tauri_plugin_http::reqwest::header::HeaderValue;
        let header = |v: &'static str| HeaderValue::from_static(v);
        assert!(is_error_body(Some(&header("text/xml; charset=utf-8"))));
        assert!(is_error_body(Some(&header("application/json"))));
        assert!(!is_error_body(Some(&header("audio/flac"))));
        assert!(!is_error_body(Some(&header("application/octet-stream"))));
        assert!(!is_error_body(None));
    }
}
