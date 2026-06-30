use std::path::PathBuf;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

#[derive(Serialize, Deserialize, Default, Clone)]
struct ManifestEntry {
    filename: Option<String>,
    title: Option<String>,
    description: Option<String>,
    category: Option<String>,
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
    filename: String,
    title: String,
    description: Option<String>,
    category: Option<String>,
    chapters: Vec<Chapter>,
}

#[derive(Serialize, Deserialize)]
struct AdminAuth {
    salt: String,
    hash: String,
}

#[derive(Serialize, Deserialize, Default)]
struct AppConfig {
    training_folder: Option<String>,
}

fn config_path() -> Result<PathBuf, String> {
    #[cfg(target_os = "windows")]
    {
        if let Ok(appdata) = std::env::var("APPDATA") {
            return Ok(PathBuf::from(appdata)
                .join("com.oscahs.training")
                .join("config.json"));
        }
    }
    std::env::var("HOME")
        .map(|h| PathBuf::from(h).join(".oscahs-training").join("config.json"))
        .map_err(|_| "Cannot determine config directory".into())
}

fn read_config() -> AppConfig {
    config_path()
        .ok()
        .and_then(|p| std::fs::read_to_string(p).ok())
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
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

fn training_folder() -> Result<PathBuf, String> {
    let config = read_config();
    if let Some(custom) = config.training_folder {
        return Ok(PathBuf::from(custom));
    }
    let dropbox = find_dropbox_root()
        .ok_or("Dropbox folder not found. Use the folder icon in the top bar to set the training folder path manually.")?;
    Ok(dropbox.join("Oscahs Team").join("Magicbooking Training"))
}

fn admin_file_path() -> Result<PathBuf, String> {
    Ok(training_folder()?.join("admin.json"))
}

fn to_hex(bytes: &[u8]) -> String {
    bytes.iter().map(|b| format!("{:02x}", b)).collect()
}

fn hash_password(password: &str, salt: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(salt.as_bytes());
    hasher.update(password.as_bytes());
    to_hex(&hasher.finalize())
}

fn generate_salt() -> String {
    let bytes: [u8; 16] = rand::random();
    to_hex(&bytes)
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

fn read_manifest(folder: &PathBuf) -> Vec<ManifestEntry> {
    let json_path = folder.join("videos.json");
    std::fs::read_to_string(json_path)
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

#[tauri::command]
fn scan_videos() -> Result<Vec<VideoResult>, String> {
    let folder = training_folder()?;

    if !folder.exists() {
        return Ok(vec![]);
    }

    let manifest = read_manifest(&folder);

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
                category: meta.and_then(|m| m.category.clone()),
                chapters: meta
                    .and_then(|m| m.chapters.clone())
                    .unwrap_or_default(),
                path: path.to_string_lossy().into_owned(),
                filename,
            }
        })
        .collect();

    Ok(results)
}

#[tauri::command]
fn admin_status() -> Result<bool, String> {
    Ok(admin_file_path()?.exists())
}

#[tauri::command]
fn admin_setup(password: String) -> Result<(), String> {
    if password.len() < 6 {
        return Err("Password must be at least 6 characters".into());
    }
    let folder = training_folder()?;
    if !folder.exists() {
        std::fs::create_dir_all(&folder).map_err(|e| e.to_string())?;
    }
    let path = admin_file_path()?;
    if path.exists() {
        return Err("An admin password is already set up for this team".into());
    }
    let salt = generate_salt();
    let hash = hash_password(&password, &salt);
    let json = serde_json::to_string_pretty(&AdminAuth { salt, hash }).map_err(|e| e.to_string())?;
    std::fs::write(path, json).map_err(|e| e.to_string())
}

#[tauri::command]
fn admin_login(password: String) -> Result<bool, String> {
    let path = admin_file_path()?;
    let content = std::fs::read_to_string(&path)
        .map_err(|_| "Admin password has not been set up yet".to_string())?;
    let auth: AdminAuth = serde_json::from_str(&content).map_err(|e| e.to_string())?;
    Ok(hash_password(&password, &auth.salt) == auth.hash)
}

#[tauri::command]
fn admin_change_password(current_password: String, new_password: String) -> Result<(), String> {
    if new_password.len() < 6 {
        return Err("New password must be at least 6 characters".into());
    }
    if !admin_login(current_password)? {
        return Err("Current password is incorrect".into());
    }
    let salt = generate_salt();
    let hash = hash_password(&new_password, &salt);
    let json = serde_json::to_string_pretty(&AdminAuth { salt, hash }).map_err(|e| e.to_string())?;
    std::fs::write(admin_file_path()?, json).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_training_folder() -> serde_json::Value {
    let config = read_config();
    let auto_path = find_dropbox_root()
        .map(|p| p.join("Oscahs Team").join("Magicbooking Training").to_string_lossy().into_owned());
    let effective = config.training_folder.clone().or_else(|| auto_path.clone());
    serde_json::json!({
        "path": effective,
        "is_override": config.training_folder.is_some(),
        "auto_path": auto_path,
    })
}

#[tauri::command]
fn set_training_folder(path: Option<String>) -> Result<(), String> {
    let config = AppConfig { training_folder: path };
    let p = config_path()?;
    if let Some(parent) = p.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let json = serde_json::to_string_pretty(&config).map_err(|e| e.to_string())?;
    std::fs::write(p, json).map_err(|e| e.to_string())
}

#[tauri::command]
fn save_videos_manifest(password: String, entries: Vec<ManifestEntry>) -> Result<(), String> {
    if !admin_login(password)? {
        return Err("Incorrect admin password".into());
    }
    let folder = training_folder()?;
    let json = serde_json::to_string_pretty(&entries).map_err(|e| e.to_string())?;
    std::fs::write(folder.join("videos.json"), json).map_err(|e| e.to_string())
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
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .invoke_handler(tauri::generate_handler![
            scan_videos,
            get_training_folder,
            set_training_folder,
            admin_status,
            admin_setup,
            admin_login,
            admin_change_password,
            save_videos_manifest
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
