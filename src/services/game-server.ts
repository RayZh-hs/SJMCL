import { invoke } from "@tauri-apps/api/core";
import {
  ManagedGameServerConfig,
  ManagedGameServerRequest,
  ManagedGameServerStatus,
} from "@/models/game-server";
import { InvokeResponse } from "@/models/response";
import { responseHandler } from "@/utils/response";

export class GameServerService {
  @responseHandler("resource")
  static async installManagedGameServer(
    request: ManagedGameServerRequest
  ): Promise<InvokeResponse<string>> {
    return await invoke("install_managed_game_server", { request });
  }

  @responseHandler("resource")
  static async retrieveManagedGameServer(
    instanceId: string
  ): Promise<InvokeResponse<ManagedGameServerStatus>> {
    return await invoke("retrieve_managed_game_server", { instanceId });
  }

  @responseHandler("resource")
  static async updateManagedGameServer(
    instanceId: string,
    config: ManagedGameServerConfig
  ): Promise<InvokeResponse<void>> {
    return await invoke("update_managed_game_server", { instanceId, config });
  }

  @responseHandler("resource")
  static async setManagedGameServerEula(
    instanceId: string,
    accepted: boolean,
    autoAcceptEula?: boolean
  ): Promise<InvokeResponse<void>> {
    return await invoke("set_managed_game_server_eula", {
      instanceId,
      accepted,
      autoAcceptEula,
    });
  }

  @responseHandler("resource")
  static async importManagedGameServerWorld(
    instanceId: string,
    sourcePath: string
  ): Promise<InvokeResponse<void>> {
    return await invoke("import_managed_game_server_world", {
      instanceId,
      sourcePath,
    });
  }

  @responseHandler("resource")
  static async startManagedGameServer(
    instanceId: string
  ): Promise<InvokeResponse<void>> {
    return await invoke("start_managed_game_server", { instanceId });
  }

  @responseHandler("resource")
  static async stopManagedGameServer(
    instanceId: string
  ): Promise<InvokeResponse<void>> {
    return await invoke("stop_managed_game_server", { instanceId });
  }
}
