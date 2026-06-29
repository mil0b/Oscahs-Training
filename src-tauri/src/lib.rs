use std::path::PathBuf;
use serde::{Deserialize, Serialize};

#[derive(Deserialize, Default)]
struct ManifestEntry {
    filename: Option<String>,
    title: Option<String>,
    description: Option<String>,
    chapters: Option<Vec<Chapter>>,
}

#[derive(Serialize, Deserialize, Clone)]
struct Chapter {
    time: f64,
    title: String,
}

#[derive(Serialize)]
struct VideoResult {
    path: String,
    title: String,
    description: Option<String>,
    chapters: Vec<Chapter>,
}

fn find_dropbox_root() -> Option<PathBuf> {
    // On Windows, Dropbox writes its actual sync path to a known config file.
    #[cfg(target_os = "windows")]
    {
        if let Ok(local_app_data) = std::env::var("LOCALAPPDATA") {
            let info = PathBuf::from(&local_app_data)
                .join("Dropbox")
                .join("info.json");
            if let Ok(content) = std::fs::read_to_string(info) {
                if let Ok(json) = serde_json::from_str::<serde_json::Value>(&content) {
                    let path = json["personal"]["path"]
                        .as_str()
                        .or_else(|| json["business"]["path"].as_str());
                    if let Some(p) = path {
                        return Some(PathBuf::from(p));
                    }
                }
            }
            if let Ok(profile) = std::env::var("USERPROFILE") {
                return Some(PathBuf::from(profile).join("Dropbox"));
            }
        }
    }

    // Linux / macOS
    std::env::var("HOME")
        .ok()
        .map(|h| PathBuf::from(h).join("Dropbox"))
}

fn title_from_filename(name: &str) -> String {
    let stem = std::path::Path::new(name)
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or(name);
    stem.replace(['-', '_'], " ")
        .split_whitespace()
        .map(|w| {
            let mut chars = w.chars();
            match chars.next() {
                None => String::new(),
                Some(f) => f.to_uppercase().collect::<String>() + chars.as_str(),
            }
        })
        .collect::<Vec<_>>()
        .join(" ")
}

#[tauri::command]
fn scan_videos() -> Result<Vec<VideoResult>, String> {
    let dropbox = find_dropbox_root().ok_or("Dropbox folder not found on this machine")?;
    let folder = dropbox.join("Oscahs Team").join("Magicbooking Training");

    if !folder.exists() {
        return Ok(vec![]);
    }

    let manifest: Vec<ManifestEntry> = {
        let json_path = folder.join("videos.json");
        std::fs::read_to_string(json_path)
            .ok()
            .and_then(|s| serde_json::from_str(&s).ok())
            .unwrap_or_default()
    };

    let mut mp4s: Vec<PathBuf> = std::fs::read_dir(&folder)
        .map_err(|e| e.to_string())?
        .filter_map(|e| e.ok().map(|e| e.path()))
        .filter(|p| {
            p.extension()
                .and_then(|e| e.to_str())
                .map(|e| e.eq_ignore_ascii_case("mp4"))
                .unwrap_or(false)
        })
        .collect();
    mp4s.sort();

    let results = mp4s
        .into_iter()
        .map(|path| {
            let filename = path
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("")
                .to_string();
            let meta = manifest
                .iter()
                .find(|m| m.filename.as_deref() == Some(filename.as_str()));
            VideoResult {
                title: meta
                    .and_then(|m| m.title.as_deref())
                    .map(str::to_string)
                    .unwrap_or_else(|| title_from_filename(&filename)),
                description: meta.and_then(|m| m.description.clone()),
                chapters: meta
                    .and_then(|m| m.chapters.clone())
                    .unwrap_or_default(),
                path: path.to_string_lossy().into_owned(),
            }
        })
        .collect();

    Ok(results)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![scan_videos])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
