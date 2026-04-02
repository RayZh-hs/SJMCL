import { ModLoaderType } from "@/enums/instance";
import { GameDirectory } from "@/models/config";
import {
  GameClientResourceInfo,
  ModLoaderResourceInfo,
} from "@/models/resource";

export enum GameServerKind {
  Vanilla = "vanilla",
  Fabric = "fabric",
}

export enum GameServerBackgroundMode {
  Direct = "direct",
  ExternalCommand = "externalCommand",
}

export interface ManagedGameServerProperties {
  motd: string;
  serverPort: number;
  maxPlayers: number;
  difficulty: string;
  gamemode: string;
  onlineMode: boolean;
  pvp: boolean;
  allowFlight: boolean;
  levelName: string;
  levelSeed: string;
  levelType: string;
}

export interface ManagedGameServerRequest {
  directory: GameDirectory;
  name: string;
  description: string;
  iconSrc: string;
  game: GameClientResourceInfo;
  kind: GameServerKind;
  modLoader?: ModLoaderResourceInfo;
  javaPath: string;
  jvmArgs: string;
  autoAcceptEula: boolean;
  backgroundMode: GameServerBackgroundMode;
  backgroundCommand: string;
  stopCommand: string;
  properties: ManagedGameServerProperties;
  worldSource?: string;
}

export interface ManagedGameServerConfig {
  name: string;
  kind: GameServerKind;
  gameVersion: string;
  javaPath: string;
  jvmArgs: string;
  mainClass?: string;
  classpath: string[];
  modLoaderType: ModLoaderType;
  modLoaderVersion?: string;
  autoAcceptEula: boolean;
  backgroundMode: GameServerBackgroundMode;
  backgroundCommand: string;
  stopCommand: string;
  properties: ManagedGameServerProperties;
}

export interface ManagedGameServerStatus {
  config: ManagedGameServerConfig;
  running: boolean;
  canStop: boolean;
  eulaAccepted: boolean;
}

export const defaultManagedGameServerProperties: ManagedGameServerProperties = {
  motd: "A SJMCL managed server",
  serverPort: 25565,
  maxPlayers: 20,
  difficulty: "easy",
  gamemode: "survival",
  onlineMode: true,
  pvp: true,
  allowFlight: false,
  levelName: "world",
  levelSeed: "",
  levelType: "default",
};

export const defaultFabricServerLoader: ModLoaderResourceInfo = {
  loaderType: ModLoaderType.Fabric,
  version: "",
  description: "",
  stable: true,
};
