use crate::error::{SJMCLError, SJMCLResult};
use crate::game_server::models::{
  GameServerBackgroundMode, GameServerKind, ManagedGameServerConfig, ManagedGameServerProperties,
  ManagedGameServerRequest, ManagedGameServerRuntime, ManagedGameServerStatus,
};
use crate::instance::models::misc::{
  Instance, InstanceType, ModLoader, ModLoaderStatus, ModLoaderType,
};
use crate::launch::helpers::file_validator::convert_library_name_to_path;
use crate::launch::helpers::process_monitor::kill_process;
use crate::resource::helpers::misc::{
  convert_url_to_target_source, get_download_api, get_source_priority_list,
};
use crate::resource::models::{GameClientResourceInfo, ResourceType, SourceType};
use crate::tasks::commands::schedule_progressive_task_group;
use crate::tasks::download::DownloadParam;
use crate::tasks::PTaskParam;
use crate::utils::fs::copy_whole_dir;
use crate::utils::shell::execute_command_line;
use serde_json::Value;
use shlex::{split as shlex_split, try_quote};
use std::collections::HashMap;
use std::fs::{self, File, OpenOptions};
use std::io::{Cursor, Write};
use std::path::{Component, Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::Mutex;
use tauri::{AppHandle, Manager, State};
use tauri_plugin_http::reqwest;
use url::Url;
use zip::read::ZipArchive;

pub const MANAGED_SERVER_CONFIG_FILE: &str = "sjmcl-server.json";

const EULA_FILE_NAME: &str = "eula.txt";
const SERVER_PROPERTIES_FILE_NAME: &str = "server.properties";

fn quote_shell(input: &str) -> String {
  try_quote(input)
    .map(|value| value.to_string())
    .unwrap_or_else(|_| format!("'{}'", input.replace('\'', "'\"'\"'")))
}

fn normalize_name(name: &str) -> SJMCLResult<String> {
  let trimmed = name.trim();
  if trimmed.is_empty() {
    return Err(SJMCLError("Server name cannot be empty".to_string()));
  }
  if !sanitize_filename::is_sanitized(trimmed) {
    return Err(SJMCLError(
      "Server name contains unsupported characters".to_string(),
    ));
  }
  Ok(trimmed.to_string())
}

fn classpath_separator() -> &'static str {
  #[cfg(target_os = "windows")]
  {
    ";"
  }

  #[cfg(not(target_os = "windows"))]
  {
    ":"
  }
}

fn managed_server_config_path(server_dir: &Path) -> PathBuf {
  server_dir.join(MANAGED_SERVER_CONFIG_FILE)
}

fn eula_path(server_dir: &Path) -> PathBuf {
  server_dir.join(EULA_FILE_NAME)
}

fn server_properties_path(server_dir: &Path) -> PathBuf {
  server_dir.join(SERVER_PROPERTIES_FILE_NAME)
}

fn ensure_command_status(status: std::process::ExitStatus, context: &str) -> SJMCLResult<()> {
  if status.success() {
    Ok(())
  } else {
    Err(SJMCLError(format!(
      "{context} exited with status {}",
      status
        .code()
        .map(|value| value.to_string())
        .unwrap_or_else(|| "unknown".to_string())
    )))
  }
}

fn load_managed_server_instance(app: &AppHandle, instance_id: &str) -> SJMCLResult<Instance> {
  let binding = app.state::<Mutex<HashMap<String, Instance>>>();
  let state = binding.lock()?;
  let instance = state
    .get(instance_id)
    .ok_or_else(|| SJMCLError("Managed server instance was not found".to_string()))?;
  if instance.instance_type != InstanceType::Server {
    return Err(SJMCLError(
      "The selected instance is not a managed server".to_string(),
    ));
  }
  Ok(instance.clone())
}

fn load_managed_server_config(server_dir: &Path) -> SJMCLResult<ManagedGameServerConfig> {
  let config = fs::read(managed_server_config_path(server_dir))?;
  Ok(serde_json::from_slice(&config)?)
}

fn save_managed_server_config(
  server_dir: &Path,
  config: &ManagedGameServerConfig,
) -> SJMCLResult<()> {
  fs::write(
    managed_server_config_path(server_dir),
    serde_json::to_vec_pretty(config)?,
  )?;
  Ok(())
}

fn read_eula_accepted(server_dir: &Path) -> bool {
  fs::read_to_string(eula_path(server_dir))
    .map(|content| {
      content
        .lines()
        .any(|line| line.trim().eq_ignore_ascii_case("eula=true"))
    })
    .unwrap_or(false)
}

fn write_eula(server_dir: &Path, accepted: bool) -> SJMCLResult<()> {
  fs::write(
    eula_path(server_dir),
    format!("eula={}\n", if accepted { "true" } else { "false" }),
  )?;
  Ok(())
}

fn upsert_property(map: &mut HashMap<String, String>, key: &str, value: impl ToString) {
  map.insert(key.to_string(), value.to_string());
}

fn write_server_properties(
  server_dir: &Path,
  properties: &ManagedGameServerProperties,
) -> SJMCLResult<()> {
  let properties_path = server_properties_path(server_dir);
  let mut map = if properties_path.exists() {
    let raw = fs::read(&properties_path)?;
    java_properties::read(Cursor::new(raw)).unwrap_or_default()
  } else {
    HashMap::new()
  };

  upsert_property(&mut map, "motd", &properties.motd);
  upsert_property(&mut map, "server-port", properties.server_port);
  upsert_property(&mut map, "max-players", properties.max_players);
  upsert_property(&mut map, "difficulty", &properties.difficulty);
  upsert_property(&mut map, "gamemode", &properties.gamemode);
  upsert_property(&mut map, "online-mode", properties.online_mode);
  upsert_property(&mut map, "pvp", properties.pvp);
  upsert_property(&mut map, "allow-flight", properties.allow_flight);
  upsert_property(&mut map, "level-name", &properties.level_name);
  upsert_property(&mut map, "level-seed", &properties.level_seed);
  upsert_property(&mut map, "level-type", &properties.level_type);

  let mut keys = map.keys().cloned().collect::<Vec<_>>();
  keys.sort();

  let mut output = String::from("# Managed by SJMCL\n");
  for key in keys {
    if let Some(value) = map.get(&key) {
      output.push_str(&format!("{key}={value}\n"));
    }
  }

  fs::write(properties_path, output)?;
  Ok(())
}

fn build_server_launch_command(server_dir: &Path, config: &ManagedGameServerConfig) -> String {
  let java = if config.java_path.trim().is_empty() {
    "java".to_string()
  } else {
    quote_shell(config.java_path.trim())
  };
  let jvm_args = config.jvm_args.trim();

  match config.kind {
    GameServerKind::Vanilla => {
      let jar = quote_shell(&server_dir.join("server.jar").to_string_lossy());
      if jvm_args.is_empty() {
        format!("{java} -jar {jar} nogui")
      } else {
        format!("{java} {jvm_args} -jar {jar} nogui")
      }
    }
    GameServerKind::Fabric => {
      let classpath = config
        .classpath
        .iter()
        .map(|entry| quote_shell(&server_dir.join(entry).to_string_lossy()))
        .collect::<Vec<_>>()
        .join(classpath_separator());
      let main_class = config
        .main_class
        .clone()
        .unwrap_or_else(|| "net.fabricmc.loader.impl.launch.knot.KnotServer".to_string());
      if jvm_args.is_empty() {
        format!("{java} -cp {classpath} {main_class} nogui")
      } else {
        format!("{java} {jvm_args} -cp {classpath} {main_class} nogui")
      }
    }
  }
}

fn build_direct_launch_process(
  server_dir: &Path,
  config: &ManagedGameServerConfig,
) -> SJMCLResult<Command> {
  let java = if config.java_path.trim().is_empty() {
    "java".to_string()
  } else {
    config.java_path.trim().to_string()
  };

  let mut command = Command::new(java);
  if !config.jvm_args.trim().is_empty() {
    let args = shlex_split(config.jvm_args.trim())
      .ok_or_else(|| SJMCLError("Invalid JVM arguments".to_string()))?;
    command.args(args);
  }

  match config.kind {
    GameServerKind::Vanilla => {
      command
        .arg("-jar")
        .arg(server_dir.join("server.jar"))
        .arg("nogui");
    }
    GameServerKind::Fabric => {
      let classpath = config
        .classpath
        .iter()
        .map(|entry| server_dir.join(entry).to_string_lossy().to_string())
        .collect::<Vec<_>>()
        .join(classpath_separator());
      let main_class = config
        .main_class
        .clone()
        .unwrap_or_else(|| "net.fabricmc.loader.impl.launch.knot.KnotServer".to_string());
      command
        .arg("-cp")
        .arg(classpath)
        .arg(main_class)
        .arg("nogui");
    }
  }

  command.current_dir(server_dir);
  command.stdin(Stdio::null());
  Ok(command)
}

fn render_server_template(
  template: &str,
  launch_cmd: &str,
  server_dir: &Path,
  config: &ManagedGameServerConfig,
) -> String {
  let classpath = config
    .classpath
    .iter()
    .map(|entry| server_dir.join(entry).to_string_lossy().to_string())
    .collect::<Vec<_>>()
    .join(classpath_separator());
  let jar_path = server_dir.join("server.jar").to_string_lossy().to_string();
  let log_path = server_dir
    .join("logs/latest.log")
    .to_string_lossy()
    .to_string();
  let java = if config.java_path.trim().is_empty() {
    "java".to_string()
  } else {
    config.java_path.clone()
  };

  let mut rendered = template.to_string();
  for (key, value) in [
    ("{{name}}", config.name.clone()),
    ("{{launch_cmd}}", launch_cmd.to_string()),
    ("{{work_dir}}", server_dir.to_string_lossy().to_string()),
    ("{{java}}", java),
    ("{{jar}}", jar_path),
    ("{{classpath}}", classpath),
    (
      "{{main_class}}",
      config.main_class.clone().unwrap_or_default(),
    ),
    ("{{jvm_args}}", config.jvm_args.clone()),
    ("{{log_file}}", log_path),
  ] {
    rendered = rendered.replace(key, &value);
  }
  rendered
}

fn build_external_command(
  server_dir: &Path,
  config: &ManagedGameServerConfig,
  template: &str,
) -> SJMCLResult<String> {
  if template.trim().is_empty() {
    return Err(SJMCLError(
      "An external launch command is required for this server mode".to_string(),
    ));
  }

  let launch_cmd = build_server_launch_command(server_dir, config);
  let rendered = render_server_template(template, &launch_cmd, server_dir, config);

  #[cfg(target_os = "windows")]
  {
    Ok(format!(
      "cd /d \"{}\" && {}",
      server_dir.to_string_lossy(),
      rendered
    ))
  }

  #[cfg(not(target_os = "windows"))]
  {
    Ok(format!(
      "cd {} && {}",
      quote_shell(&server_dir.to_string_lossy()),
      rendered
    ))
  }
}

fn write_unix_script(path: &Path, content: &str) -> SJMCLResult<()> {
  fs::write(path, content)?;
  #[cfg(unix)]
  {
    use std::os::unix::fs::PermissionsExt;
    let mut permissions = fs::metadata(path)?.permissions();
    permissions.set_mode(0o755);
    fs::set_permissions(path, permissions)?;
  }
  Ok(())
}

fn write_server_scripts(server_dir: &Path, config: &ManagedGameServerConfig) -> SJMCLResult<()> {
  let launch_cmd = build_server_launch_command(server_dir, config);

  #[cfg(not(target_os = "windows"))]
  {
    let start_script = format!(
      "#!/bin/sh\nset -eu\ncd {}\nexec {}\n",
      quote_shell(&server_dir.to_string_lossy()),
      launch_cmd
    );
    write_unix_script(&server_dir.join("start.sh"), &start_script)?;

    let background_script = match config.background_mode {
      GameServerBackgroundMode::Direct => format!(
        "#!/bin/sh\nset -eu\ncd {}\nnohup {} >> {} 2>&1 < /dev/null &\n",
        quote_shell(&server_dir.to_string_lossy()),
        launch_cmd,
        quote_shell(&server_dir.join("logs/latest.log").to_string_lossy()),
      ),
      GameServerBackgroundMode::ExternalCommand if !config.background_command.trim().is_empty() => {
        let command = build_external_command(server_dir, config, &config.background_command)?;
        format!("#!/bin/sh\nset -eu\n{}\n", command)
      }
      GameServerBackgroundMode::ExternalCommand => {
        "#!/bin/sh\necho \"No external start command configured.\"\nexit 1\n".to_string()
      }
    };
    write_unix_script(&server_dir.join("start-background.sh"), &background_script)?;

    if config.stop_command.trim().is_empty() {
      let _ = fs::remove_file(server_dir.join("stop.sh"));
    } else {
      let stop_command = build_external_command(server_dir, config, &config.stop_command)?;
      let stop_script = format!("#!/bin/sh\nset -eu\n{}\n", stop_command);
      write_unix_script(&server_dir.join("stop.sh"), &stop_script)?;
    }
  }

  #[cfg(target_os = "windows")]
  {
    fs::write(
      server_dir.join("start.cmd"),
      format!(
        "@echo off\r\ncd /d \"{}\"\r\n{}\r\n",
        server_dir.to_string_lossy(),
        launch_cmd
      ),
    )?;

    let background = match config.background_mode {
      GameServerBackgroundMode::Direct => format!(
        "@echo off\r\ncd /d \"{}\"\r\nstart \"\" /B cmd /C \"{} >> {} 2>&1\"\r\n",
        server_dir.to_string_lossy(),
        launch_cmd,
        server_dir.join("logs/latest.log").to_string_lossy(),
      ),
      GameServerBackgroundMode::ExternalCommand if !config.background_command.trim().is_empty() => {
        let command = build_external_command(server_dir, config, &config.background_command)?;
        format!("@echo off\r\n{}\r\n", command)
      }
      GameServerBackgroundMode::ExternalCommand => {
        "@echo off\r\necho No external start command configured.\r\nexit /b 1\r\n".to_string()
      }
    };
    fs::write(server_dir.join("start-background.cmd"), background)?;

    if config.stop_command.trim().is_empty() {
      let _ = fs::remove_file(server_dir.join("stop.cmd"));
    } else {
      let stop_command = build_external_command(server_dir, config, &config.stop_command)?;
      fs::write(
        server_dir.join("stop.cmd"),
        format!("@echo off\r\n{}\r\n", stop_command),
      )?;
    }
  }

  Ok(())
}

fn build_server_instance(
  request: &ManagedGameServerRequest,
  server_dir: &Path,
) -> SJMCLResult<Instance> {
  let name = normalize_name(&request.name)?;
  let mod_loader = request.mod_loader.clone().unwrap_or_default();

  Ok(Instance {
    id: format!("{}:{}", request.directory.name, name.clone()),
    instance_type: InstanceType::Server,
    name,
    description: request.description.clone(),
    tag: None,
    icon_src: request.icon_src.clone(),
    starred: false,
    play_time: 0,
    version: request.game.id.clone(),
    version_path: server_dir.to_path_buf(),
    mod_loader: ModLoader {
      status: ModLoaderStatus::Installed,
      loader_type: if request.kind == GameServerKind::Fabric {
        mod_loader.loader_type
      } else {
        ModLoaderType::Unknown
      },
      version: if request.kind == GameServerKind::Fabric {
        mod_loader.version
      } else {
        String::new()
      },
      branch: if request.kind == GameServerKind::Fabric {
        mod_loader.branch
      } else {
        None
      },
    },
    optifine: None,
    use_spec_game_config: false,
    spec_game_config: None,
  })
}

fn persist_managed_server_files(
  server_dir: &Path,
  config: &ManagedGameServerConfig,
  eula_accepted: bool,
) -> SJMCLResult<()> {
  fs::create_dir_all(server_dir.join("logs"))?;
  write_eula(server_dir, eula_accepted)?;
  write_server_properties(server_dir, &config.properties)?;
  save_managed_server_config(server_dir, config)?;
  write_server_scripts(server_dir, config)?;
  Ok(())
}

fn current_server_runtime_status(
  app: &AppHandle,
  instance_id: &str,
  config: &ManagedGameServerConfig,
) -> SJMCLResult<(bool, bool)> {
  let runtime_state = app.state::<Mutex<HashMap<String, ManagedGameServerRuntime>>>();
  let mut runtimes = runtime_state.lock()?;

  let mut should_remove = false;
  let mut running = false;
  let mut can_stop = false;

  if let Some(runtime) = runtimes.get_mut(instance_id) {
    match runtime {
      ManagedGameServerRuntime::Direct { child } => match child.try_wait() {
        Ok(Some(_)) => {
          should_remove = true;
        }
        Ok(None) => {
          running = true;
          can_stop = true;
        }
        Err(_) => {
          should_remove = true;
        }
      },
      ManagedGameServerRuntime::External => {
        running = true;
        can_stop = !config.stop_command.trim().is_empty();
      }
    }
  }

  if should_remove {
    runtimes.remove(instance_id);
  }

  Ok((running, can_stop))
}

fn ensure_server_eula(server_dir: &Path, config: &ManagedGameServerConfig) -> SJMCLResult<()> {
  let eula_accepted = read_eula_accepted(server_dir);
  if eula_accepted {
    return Ok(());
  }
  if !config.auto_accept_eula {
    return Err(SJMCLError(
      "The Minecraft server EULA must be accepted before the server can start".to_string(),
    ));
  }
  write_eula(server_dir, true)
}

fn import_world_directory(source: &Path, target: &Path) -> SJMCLResult<()> {
  if target.exists() {
    fs::remove_dir_all(target)?;
  }
  copy_whole_dir(source, target)?;
  Ok(())
}

fn detect_zip_root_dir<R: std::io::Read + std::io::Seek>(
  archive: &mut ZipArchive<R>,
) -> Option<PathBuf> {
  let mut root: Option<PathBuf> = None;

  for index in 0..archive.len() {
    let Ok(file) = archive.by_index(index) else {
      continue;
    };
    let Some(path) = file.enclosed_name() else {
      continue;
    };

    let mut components = path.components();
    let first = match components.next() {
      Some(Component::Normal(value)) => PathBuf::from(value),
      _ => return None,
    };

    if components.next().is_none() {
      continue;
    }

    match &root {
      None => root = Some(first),
      Some(existing) if existing == &first => {}
      Some(_) => return None,
    }
  }

  root
}

fn import_world_archive(source: &Path, target: &Path) -> SJMCLResult<()> {
  if target.exists() {
    fs::remove_dir_all(target)?;
  }
  fs::create_dir_all(target)?;

  let file = File::open(source)?;
  let mut archive = ZipArchive::new(file)?;
  let strip_root = detect_zip_root_dir(&mut archive);

  for index in 0..archive.len() {
    let mut zipped = archive.by_index(index)?;
    let Some(enclosed) = zipped.enclosed_name().map(|value| value.to_path_buf()) else {
      continue;
    };
    let relative = match strip_root.as_ref() {
      Some(root) => enclosed
        .strip_prefix(root)
        .map(|value| value.to_path_buf())
        .unwrap_or(enclosed.clone()),
      None => enclosed.clone(),
    };
    if relative.as_os_str().is_empty() {
      continue;
    }

    let out_path = target.join(&relative);
    if zipped.is_dir() {
      fs::create_dir_all(&out_path)?;
      continue;
    }

    if let Some(parent) = out_path.parent() {
      fs::create_dir_all(parent)?;
    }

    let mut output = File::create(&out_path)?;
    std::io::copy(&mut zipped, &mut output)?;
    output.flush()?;
  }

  Ok(())
}

fn import_world_source(
  server_dir: &Path,
  config: &ManagedGameServerConfig,
  source_path: &Path,
) -> SJMCLResult<()> {
  if !source_path.exists() {
    return Err(SJMCLError(
      "The selected world source does not exist".to_string(),
    ));
  }

  let target = server_dir.join(&config.properties.level_name);
  if source_path.is_dir() {
    import_world_directory(source_path, &target)
  } else if source_path
    .extension()
    .and_then(|value| value.to_str())
    .is_some_and(|value| value.eq_ignore_ascii_case("zip"))
  {
    import_world_archive(source_path, &target)
  } else {
    Err(SJMCLError(
      "World import only supports directories and .zip archives".to_string(),
    ))
  }
}

async fn fetch_version_details(
  client: &reqwest::Client,
  resource_info: &GameClientResourceInfo,
) -> SJMCLResult<crate::instance::helpers::client_json::McClientInfo> {
  client
    .get(&resource_info.url)
    .send()
    .await
    .map_err(|_| SJMCLError("Failed to fetch version manifest".to_string()))?
    .json::<crate::instance::helpers::client_json::McClientInfo>()
    .await
    .map_err(|_| SJMCLError("Failed to parse version manifest".to_string()).into())
}

async fn fetch_fabric_meta(
  app: &AppHandle,
  game_version: &str,
  loader_version: &str,
) -> SJMCLResult<(Value, Url, Vec<SourceType>)> {
  let priority_list = {
    let launcher_config_state =
      app.state::<std::sync::Mutex<crate::launcher_config::models::LauncherConfig>>();
    let launcher_config = launcher_config_state.lock()?;
    get_source_priority_list(&launcher_config)
  };

  let client = app.state::<reqwest::Client>();
  for source_type in &priority_list {
    if let Ok(root) = get_download_api(*source_type, ResourceType::FabricMeta) {
      let Ok(url) = root.join(&format!(
        "v2/versions/loader/{game_version}/{loader_version}"
      )) else {
        continue;
      };
      if let Ok(resp) = client.get(url).send().await {
        if resp.status().is_success() {
          let json = resp
            .json::<Value>()
            .await
            .map_err(|_| SJMCLError("Failed to parse Fabric metadata".to_string()))?;
          let maven_root = get_download_api(*source_type, ResourceType::FabricMaven)?;
          return Ok((json, maven_root, priority_list));
        }
      }
    }
  }

  Err(SJMCLError("Failed to fetch Fabric server metadata".to_string()).into())
}

fn build_fabric_server_files(
  server_dir: &Path,
  meta: &Value,
) -> SJMCLResult<(Vec<String>, String, Vec<(String, Url)>)> {
  let libraries_dir = server_dir.join("libraries");
  fs::create_dir_all(&libraries_dir)?;

  let loader_path = meta["loader"]["maven"]
    .as_str()
    .ok_or_else(|| SJMCLError("Fabric metadata missing loader.maven".to_string()))?;
  let intermediary_path = meta["intermediary"]["maven"]
    .as_str()
    .ok_or_else(|| SJMCLError("Fabric metadata missing intermediary.maven".to_string()))?;
  let main_class = meta["launcherMeta"]["mainClass"]["server"]
    .as_str()
    .ok_or_else(|| SJMCLError("Fabric metadata missing mainClass.server".to_string()))?
    .to_string();

  let mut classpath = vec!["server.jar".to_string()];
  let mut downloads = Vec::new();
  for coord in [loader_path, intermediary_path] {
    let rel = convert_library_name_to_path(coord, None)?;
    classpath.push(rel.clone());
  }

  let launcher_meta = &meta["launcherMeta"]["libraries"];
  for side in ["common", "server"] {
    if let Some(items) = launcher_meta.get(side).and_then(|value| value.as_array()) {
      for item in items {
        if let Some(name) = item["name"].as_str() {
          let rel = convert_library_name_to_path(name, None)?;
          if !classpath.contains(&rel) {
            classpath.push(rel.clone());
          }
          let url = item
            .get("url")
            .and_then(|value| value.as_str())
            .and_then(|value| Url::parse(value).ok())
            .unwrap_or_else(|| Url::parse("https://maven.fabricmc.net/").unwrap());
          downloads.push((name.to_string(), url));
        }
      }
    }
  }

  downloads.push((
    loader_path.to_string(),
    Url::parse("https://maven.fabricmc.net/").unwrap(),
  ));
  downloads.push((
    intermediary_path.to_string(),
    Url::parse("https://maven.fabricmc.net/").unwrap(),
  ));

  Ok((classpath, main_class, downloads))
}

#[tauri::command]
pub async fn install_managed_game_server(
  app: AppHandle,
  client: State<'_, reqwest::Client>,
  request: ManagedGameServerRequest,
) -> SJMCLResult<String> {
  let server_name = normalize_name(&request.name)?;
  let server_dir = request.directory.dir.join("versions").join(&server_name);
  if server_dir.exists() {
    return Err(SJMCLError("Target server directory already exists".to_string()).into());
  }

  fs::create_dir_all(server_dir.join("logs"))?;

  let version_details = fetch_version_details(&client, &request.game).await?;
  let server_download = version_details.downloads.get("server").ok_or_else(|| {
    SJMCLError("This version does not provide a vanilla server download".to_string())
  })?;

  let mut tasks = vec![PTaskParam::Download(DownloadParam {
    src: Url::parse(&server_download.url)
      .map_err(|_| SJMCLError("Invalid server download URL".to_string()))?,
    dest: server_dir.join("server.jar"),
    filename: None,
    sha1: Some(server_download.sha1.clone()),
  })];

  let mut server_config = ManagedGameServerConfig {
    name: server_name.clone(),
    kind: request.kind,
    game_version: request.game.id.clone(),
    java_path: request.java_path.clone(),
    jvm_args: request.jvm_args.clone(),
    main_class: None,
    classpath: vec![],
    mod_loader_type: ModLoaderType::Unknown,
    mod_loader_version: None,
    auto_accept_eula: request.auto_accept_eula,
    background_mode: request.background_mode,
    background_command: request.background_command.clone(),
    stop_command: request.stop_command.clone(),
    properties: request.properties.clone(),
  };

  if request.kind == GameServerKind::Fabric {
    let mod_loader = request.mod_loader.clone().ok_or_else(|| {
      SJMCLError("Fabric server installation requires a Fabric loader version".to_string())
    })?;
    let (meta, _maven_root, priority_list) =
      fetch_fabric_meta(&app, &request.game.id, &mod_loader.version).await?;
    let (classpath, main_class, downloads) = build_fabric_server_files(&server_dir, &meta)?;

    for (coord, root) in downloads {
      let rel = convert_library_name_to_path(&coord, None)?;
      let full_url = root.join(&rel)?;
      let mut src = None;
      for source_type in &priority_list {
        if let Ok(mapped) = convert_url_to_target_source(
          &full_url,
          &[ResourceType::FabricMaven, ResourceType::Libraries],
          source_type,
        ) {
          src = Some(mapped);
          break;
        }
      }
      tasks.push(PTaskParam::Download(DownloadParam {
        src: src.unwrap_or(full_url),
        dest: server_dir.join(&rel),
        filename: None,
        sha1: None,
      }));
    }

    server_config.main_class = Some(main_class);
    server_config.classpath = classpath;
    server_config.mod_loader_type = mod_loader.loader_type;
    server_config.mod_loader_version = Some(mod_loader.version);
  }

  schedule_progressive_task_group(
    app.clone(),
    format!("managed-game-server?{}&{}", request.game.id, server_name),
    tasks,
    true,
  )
  .await?;

  let instance = build_server_instance(&request, &server_dir)?;
  persist_managed_server_files(&server_dir, &server_config, false)?;
  instance.save_json_cfg().await?;

  if let Some(world_source) = request
    .world_source
    .as_ref()
    .filter(|value| !value.trim().is_empty())
  {
    import_world_source(&server_dir, &server_config, Path::new(world_source))?;
  }

  Ok(instance.id)
}

#[tauri::command]
pub fn retrieve_managed_game_server(
  app: AppHandle,
  instance_id: String,
) -> SJMCLResult<ManagedGameServerStatus> {
  let instance = load_managed_server_instance(&app, &instance_id)?;
  let config = load_managed_server_config(&instance.version_path)?;
  let (running, can_stop) = current_server_runtime_status(&app, &instance_id, &config)?;

  Ok(ManagedGameServerStatus {
    config,
    running,
    can_stop,
    eula_accepted: read_eula_accepted(&instance.version_path),
  })
}

#[tauri::command]
pub fn update_managed_game_server(
  app: AppHandle,
  instance_id: String,
  config: ManagedGameServerConfig,
) -> SJMCLResult<()> {
  let instance = load_managed_server_instance(&app, &instance_id)?;
  persist_managed_server_files(
    &instance.version_path,
    &config,
    read_eula_accepted(&instance.version_path),
  )?;
  Ok(())
}

#[tauri::command]
pub fn set_managed_game_server_eula(
  app: AppHandle,
  instance_id: String,
  accepted: bool,
  auto_accept_eula: Option<bool>,
) -> SJMCLResult<()> {
  let instance = load_managed_server_instance(&app, &instance_id)?;
  let mut config = load_managed_server_config(&instance.version_path)?;
  if let Some(value) = auto_accept_eula {
    config.auto_accept_eula = value;
    save_managed_server_config(&instance.version_path, &config)?;
  }
  write_eula(&instance.version_path, accepted)?;
  Ok(())
}

#[tauri::command]
pub fn import_managed_game_server_world(
  app: AppHandle,
  instance_id: String,
  source_path: String,
) -> SJMCLResult<()> {
  let instance = load_managed_server_instance(&app, &instance_id)?;
  let config = load_managed_server_config(&instance.version_path)?;
  import_world_source(&instance.version_path, &config, Path::new(&source_path))
}

#[tauri::command]
pub fn start_managed_game_server(app: AppHandle, instance_id: String) -> SJMCLResult<()> {
  let instance = load_managed_server_instance(&app, &instance_id)?;
  let config = load_managed_server_config(&instance.version_path)?;
  let (running, _) = current_server_runtime_status(&app, &instance_id, &config)?;
  if running {
    return Err(SJMCLError("This server is already running".to_string()));
  }

  ensure_server_eula(&instance.version_path, &config)?;

  match config.background_mode {
    GameServerBackgroundMode::Direct => {
      fs::create_dir_all(instance.version_path.join("logs"))?;
      let log_path = instance.version_path.join("logs/latest.log");
      let stdout = OpenOptions::new()
        .create(true)
        .append(true)
        .open(&log_path)?;
      let stderr = stdout.try_clone()?;

      let mut command = build_direct_launch_process(&instance.version_path, &config)?;
      command.stdout(Stdio::from(stdout));
      command.stderr(Stdio::from(stderr));

      let child = command.spawn()?;
      let runtime_state = app.state::<Mutex<HashMap<String, ManagedGameServerRuntime>>>();
      let mut runtimes = runtime_state.lock()?;
      runtimes.insert(instance_id, ManagedGameServerRuntime::Direct { child });
    }
    GameServerBackgroundMode::ExternalCommand => {
      let command =
        build_external_command(&instance.version_path, &config, &config.background_command)?;
      let status = execute_command_line(&command)?;
      ensure_command_status(status, "Managed server start command")?;

      let runtime_state = app.state::<Mutex<HashMap<String, ManagedGameServerRuntime>>>();
      let mut runtimes = runtime_state.lock()?;
      runtimes.insert(instance_id, ManagedGameServerRuntime::External);
    }
  }

  Ok(())
}

#[tauri::command]
pub fn stop_managed_game_server(app: AppHandle, instance_id: String) -> SJMCLResult<()> {
  let instance = load_managed_server_instance(&app, &instance_id)?;
  let config = load_managed_server_config(&instance.version_path)?;

  match config.background_mode {
    GameServerBackgroundMode::Direct => {
      let runtime_state = app.state::<Mutex<HashMap<String, ManagedGameServerRuntime>>>();
      let runtime = {
        let mut runtimes = runtime_state.lock()?;
        runtimes.remove(&instance_id)
      };

      match runtime {
        Some(ManagedGameServerRuntime::Direct { mut child }) => {
          kill_process(child.id())?;
          let _ = child.wait();
        }
        Some(ManagedGameServerRuntime::External) => {
          return Err(SJMCLError(
            "Server runtime state is inconsistent".to_string(),
          ));
        }
        None => {
          return Err(SJMCLError("This server is not running".to_string()));
        }
      }
    }
    GameServerBackgroundMode::ExternalCommand => {
      if config.stop_command.trim().is_empty() {
        return Err(SJMCLError(
          "No stop command is configured for this external server mode".to_string(),
        ));
      }

      let command = build_external_command(&instance.version_path, &config, &config.stop_command)?;
      let status = execute_command_line(&command)?;
      ensure_command_status(status, "Managed server stop command")?;

      let runtime_state = app.state::<Mutex<HashMap<String, ManagedGameServerRuntime>>>();
      let mut runtimes = runtime_state.lock()?;
      runtimes.remove(&instance_id);
    }
  }

  Ok(())
}
