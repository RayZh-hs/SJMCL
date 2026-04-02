use crate::instance::models::misc::ModLoaderType;
use crate::launcher_config::models::GameDirectory;
use crate::resource::models::{GameClientResourceInfo, ModLoaderResourceInfo};
use partial_derive::Partial;
use serde::{Deserialize, Serialize};
use std::process::Child;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub enum GameServerKind {
  #[default]
  Vanilla,
  Fabric,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub enum GameServerBackgroundMode {
  #[default]
  Direct,
  ExternalCommand,
}

#[derive(Partial, Debug, Clone, PartialEq, Eq, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ManagedGameServerProperties {
  pub motd: String,
  pub server_port: u16,
  pub max_players: u16,
  pub difficulty: String,
  pub gamemode: String,
  pub online_mode: bool,
  pub pvp: bool,
  pub allow_flight: bool,
  pub level_name: String,
  pub level_seed: String,
  pub level_type: String,
}

impl Default for ManagedGameServerProperties {
  fn default() -> Self {
    Self {
      motd: "A SJMCL managed server".to_string(),
      server_port: 25565,
      max_players: 20,
      difficulty: "easy".to_string(),
      gamemode: "survival".to_string(),
      online_mode: true,
      pvp: true,
      allow_flight: false,
      level_name: "world".to_string(),
      level_seed: String::new(),
      level_type: "default".to_string(),
    }
  }
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ManagedGameServerRequest {
  pub directory: GameDirectory,
  pub name: String,
  pub description: String,
  pub icon_src: String,
  pub game: GameClientResourceInfo,
  pub kind: GameServerKind,
  pub mod_loader: Option<ModLoaderResourceInfo>,
  pub java_path: String,
  pub jvm_args: String,
  pub auto_accept_eula: bool,
  pub background_mode: GameServerBackgroundMode,
  pub background_command: String,
  pub stop_command: String,
  pub properties: ManagedGameServerProperties,
  pub world_source: Option<String>,
}

impl Default for ManagedGameServerRequest {
  fn default() -> Self {
    Self {
      directory: GameDirectory {
        name: String::new(),
        dir: Default::default(),
      },
      name: String::new(),
      description: String::new(),
      icon_src: String::new(),
      game: GameClientResourceInfo::default(),
      kind: GameServerKind::default(),
      mod_loader: None,
      java_path: "java".to_string(),
      jvm_args: String::new(),
      auto_accept_eula: false,
      background_mode: GameServerBackgroundMode::default(),
      background_command: String::new(),
      stop_command: String::new(),
      properties: ManagedGameServerProperties::default(),
      world_source: None,
    }
  }
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ManagedGameServerConfig {
  pub name: String,
  pub kind: GameServerKind,
  pub game_version: String,
  pub java_path: String,
  pub jvm_args: String,
  pub main_class: Option<String>,
  pub classpath: Vec<String>,
  pub mod_loader_type: ModLoaderType,
  pub mod_loader_version: Option<String>,
  pub auto_accept_eula: bool,
  pub background_mode: GameServerBackgroundMode,
  pub background_command: String,
  pub stop_command: String,
  pub properties: ManagedGameServerProperties,
}

impl Default for ManagedGameServerConfig {
  fn default() -> Self {
    Self {
      name: String::new(),
      kind: GameServerKind::default(),
      game_version: String::new(),
      java_path: "java".to_string(),
      jvm_args: "-Xms1G -Xmx2G".to_string(),
      main_class: None,
      classpath: Vec::new(),
      mod_loader_type: ModLoaderType::Unknown,
      mod_loader_version: None,
      auto_accept_eula: false,
      background_mode: GameServerBackgroundMode::default(),
      background_command: String::new(),
      stop_command: String::new(),
      properties: ManagedGameServerProperties::default(),
    }
  }
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ManagedGameServerStatus {
  pub config: ManagedGameServerConfig,
  pub running: bool,
  pub can_stop: bool,
  pub eula_accepted: bool,
}

pub enum ManagedGameServerRuntime {
  Direct { child: Child },
  External,
}
