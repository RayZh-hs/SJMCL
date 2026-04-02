import {
  gameTypesToIcon,
  loaderTypesToIcon,
} from "@/components/modals/create-instance-modal/constants";
import { GameServerBackgroundMode, GameServerKind } from "@/models/game-server";

export const serverKindToIcon: Record<GameServerKind, string> = {
  [GameServerKind.Vanilla]: gameTypesToIcon.release,
  [GameServerKind.Fabric]: loaderTypesToIcon.Fabric,
};

export type LaunchPreset =
  | "launcher"
  | "disown"
  | "screen"
  | "tmux"
  | "zellij"
  | "custom";

export const presetCommands: Record<
  LaunchPreset,
  {
    mode: GameServerBackgroundMode;
    start: string;
    stop: string;
  }
> = {
  launcher: {
    mode: GameServerBackgroundMode.Direct,
    start: "",
    stop: "",
  },
  disown: {
    mode: GameServerBackgroundMode.ExternalCommand,
    start: "nohup sh -lc '{{launch_cmd}}' >> {{log_file}} 2>&1 < /dev/null &",
    stop: "",
  },
  screen: {
    mode: GameServerBackgroundMode.ExternalCommand,
    start: "screen -dmS {{name}} sh -lc '{{launch_cmd}}'",
    stop: "screen -S {{name}} -X quit",
  },
  tmux: {
    mode: GameServerBackgroundMode.ExternalCommand,
    start:
      "tmux new-session -d -s {{name}} 'cd {{work_dir}} && {{launch_cmd}}'",
    stop: "tmux kill-session -t {{name}}",
  },
  zellij: {
    mode: GameServerBackgroundMode.ExternalCommand,
    start: "zellij --session {{name}} run -- sh -lc '{{launch_cmd}}'",
    stop: "zellij delete-session {{name}}",
  },
  custom: {
    mode: GameServerBackgroundMode.ExternalCommand,
    start: "",
    stop: "",
  },
};
