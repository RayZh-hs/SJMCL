import {
  Alert,
  AlertIcon,
  Button,
  Checkbox,
  FormLabel,
  HStack,
  Input,
  ModalBody,
  ModalFooter,
  NumberInput,
  NumberInputField,
  Stack,
  Switch,
  Text,
} from "@chakra-ui/react";
import { open } from "@tauri-apps/plugin-dialog";
import { Dispatch, SetStateAction } from "react";
import { useTranslation } from "react-i18next";
import { MenuSelector } from "@/components/common/menu-selector";
import { InstanceBasicSettings } from "@/components/instance-basic-settings";
import { GameDirectory } from "@/models/config";
import {
  GameServerBackgroundMode,
  ManagedGameServerProperties,
} from "@/models/game-server";
import { GameClientResourceInfo } from "@/models/resource";
import { LaunchPreset } from "./constants";

interface CreateServerInfoStepProps {
  name: string;
  setName: (value: string) => void;
  description: string;
  setDescription: (value: string) => void;
  iconSrc: string;
  setIconSrc: (value: string) => void;
  gameDirectory: GameDirectory | undefined;
  setGameDirectory: (value: GameDirectory | undefined) => void;
  javaPath: string;
  setJavaPath: (value: string) => void;
  jvmArgs: string;
  setJvmArgs: (value: string) => void;
  autoAcceptEula: boolean;
  setAutoAcceptEula: (value: boolean) => void;
  launchPreset: LaunchPreset;
  onLaunchPresetChange: (value: LaunchPreset) => void;
  backgroundMode: GameServerBackgroundMode;
  backgroundCommand: string;
  setBackgroundCommand: (value: string) => void;
  stopCommand: string;
  setStopCommand: (value: string) => void;
  worldSource: string;
  setWorldSource: (value: string) => void;
  properties: ManagedGameServerProperties;
  setProperties: Dispatch<SetStateAction<ManagedGameServerProperties>>;
  selectedGameVersion: GameClientResourceInfo | undefined;
  loaderLabel: string;
  primaryColor: string;
  onClose: () => void;
  onPrevious: () => void;
  onFinish: () => void;
  canFinish: boolean;
  isLoading: boolean;
}

export const CreateServerInfoStep: React.FC<CreateServerInfoStepProps> = ({
  name,
  setName,
  description,
  setDescription,
  iconSrc,
  setIconSrc,
  gameDirectory,
  setGameDirectory,
  javaPath,
  setJavaPath,
  jvmArgs,
  setJvmArgs,
  autoAcceptEula,
  setAutoAcceptEula,
  launchPreset,
  onLaunchPresetChange,
  backgroundMode,
  backgroundCommand,
  setBackgroundCommand,
  stopCommand,
  setStopCommand,
  worldSource,
  setWorldSource,
  properties,
  setProperties,
  selectedGameVersion,
  loaderLabel,
  primaryColor,
  onClose,
  onPrevious,
  onFinish,
  canFinish,
  isLoading,
}) => {
  const { t } = useTranslation();

  return (
    <>
      <ModalBody>
        <Stack spacing={5}>
          <InstanceBasicSettings
            name={name}
            setName={setName}
            description={description}
            setDescription={setDescription}
            iconSrc={iconSrc}
            setIconSrc={setIconSrc}
            gameDirectory={gameDirectory}
            setGameDirectory={setGameDirectory}
          />

          <Stack spacing={4}>
            <Text fontWeight="bold">Server runtime</Text>
            <HStack spacing={4} align="start" flexWrap="wrap">
              <Stack spacing={2} minW="16rem" flex={1}>
                <FormLabel m={0}>Java path</FormLabel>
                <Input
                  value={javaPath}
                  onChange={(event) => setJavaPath(event.target.value)}
                  placeholder="java"
                />
              </Stack>
              <Stack spacing={2} minW="18rem" flex={1.2}>
                <FormLabel m={0}>JVM args</FormLabel>
                <Input
                  value={jvmArgs}
                  onChange={(event) => setJvmArgs(event.target.value)}
                  placeholder="-Xms1G -Xmx2G"
                />
              </Stack>
            </HStack>

            <Checkbox
              isChecked={autoAcceptEula}
              onChange={(event) => setAutoAcceptEula(event.target.checked)}
              colorScheme={primaryColor}
            >
              Auto-sign the Minecraft server EULA on first launch
            </Checkbox>

            <Stack spacing={2}>
              <FormLabel m={0}>Launch handling</FormLabel>
              <MenuSelector
                value={launchPreset}
                onSelect={(value) =>
                  onLaunchPresetChange(value as LaunchPreset)
                }
                options={[
                  {
                    value: "launcher",
                    label: "Launcher managed",
                  },
                  {
                    value: "disown",
                    label: "Disown / nohup",
                  },
                  {
                    value: "screen",
                    label: "screen",
                  },
                  {
                    value: "tmux",
                    label: "tmux",
                  },
                  {
                    value: "zellij",
                    label: "zellij",
                  },
                  {
                    value: "custom",
                    label: "Custom command",
                  },
                ]}
                buttonProps={{ w: "100%" }}
              />
              <Text fontSize="xs" className="secondary-text">
                Launcher-managed mode lets the launcher track the server process
                directly. Wrapper presets leave process ownership to shell
                tooling and rely on the configured commands.
              </Text>
            </Stack>

            {backgroundMode === GameServerBackgroundMode.ExternalCommand && (
              <Stack spacing={3}>
                <Stack spacing={2}>
                  <FormLabel m={0}>Start command</FormLabel>
                  <Input
                    value={backgroundCommand}
                    onChange={(event) =>
                      setBackgroundCommand(event.target.value)
                    }
                    placeholder="tmux new-session -d -s {{name}} 'cd {{work_dir}} && {{launch_cmd}}'"
                  />
                </Stack>
                <Stack spacing={2}>
                  <FormLabel m={0}>Stop command</FormLabel>
                  <Input
                    value={stopCommand}
                    onChange={(event) => setStopCommand(event.target.value)}
                    placeholder="tmux kill-session -t {{name}}"
                  />
                </Stack>
                <Alert status="info" borderRadius="md">
                  <AlertIcon />
                  <Text fontSize="sm">
                    Supported placeholders: {"{{name}}"}, {"{{launch_cmd}}"},{" "}
                    {"{{work_dir}}"}, {"{{java}}"}, {"{{jar}}"},{" "}
                    {"{{classpath}}"}, {"{{main_class}}"}, {"{{jvm_args}}"},{" "}
                    {"{{log_file}}"}
                  </Text>
                </Alert>
              </Stack>
            )}
          </Stack>

          <Stack spacing={4}>
            <Text fontWeight="bold">World setup</Text>
            <HStack spacing={3} flexWrap="wrap">
              <Button
                onClick={async () => {
                  const path = await open({
                    directory: true,
                    multiple: false,
                  });
                  if (typeof path === "string") setWorldSource(path);
                }}
              >
                Choose world folder
              </Button>
              <Button
                onClick={async () => {
                  const path = await open({
                    multiple: false,
                    filters: [
                      {
                        name: "World archive",
                        extensions: ["zip"],
                      },
                    ],
                  });
                  if (typeof path === "string") setWorldSource(path);
                }}
              >
                Choose world zip
              </Button>
              <Button variant="ghost" onClick={() => setWorldSource("")}>
                Generate new world
              </Button>
            </HStack>
            <Text fontSize="sm" className="secondary-text">
              {worldSource
                ? worldSource
                : "No world source selected. The server will generate a new world using the level settings below."}
            </Text>
          </Stack>

          <Stack spacing={4}>
            <Text fontWeight="bold">Server properties</Text>
            <Stack spacing={3}>
              <Stack spacing={2}>
                <FormLabel m={0}>MOTD</FormLabel>
                <Input
                  value={properties.motd}
                  onChange={(event) =>
                    setProperties((prev) => ({
                      ...prev,
                      motd: event.target.value,
                    }))
                  }
                />
              </Stack>

              <HStack spacing={4} align="start" flexWrap="wrap">
                <Stack spacing={2}>
                  <FormLabel m={0}>Server port</FormLabel>
                  <NumberInput
                    value={properties.serverPort}
                    min={1}
                    max={65535}
                    onChange={(_, valueAsNumber) =>
                      setProperties((prev) => ({
                        ...prev,
                        serverPort: Number.isFinite(valueAsNumber)
                          ? valueAsNumber
                          : prev.serverPort,
                      }))
                    }
                  >
                    <NumberInputField />
                  </NumberInput>
                </Stack>

                <Stack spacing={2}>
                  <FormLabel m={0}>Max players</FormLabel>
                  <NumberInput
                    value={properties.maxPlayers}
                    min={1}
                    max={1000}
                    onChange={(_, valueAsNumber) =>
                      setProperties((prev) => ({
                        ...prev,
                        maxPlayers: Number.isFinite(valueAsNumber)
                          ? valueAsNumber
                          : prev.maxPlayers,
                      }))
                    }
                  >
                    <NumberInputField />
                  </NumberInput>
                </Stack>

                <Stack spacing={2} minW="12rem">
                  <FormLabel m={0}>Difficulty</FormLabel>
                  <MenuSelector
                    value={properties.difficulty}
                    onSelect={(value) =>
                      setProperties((prev) => ({
                        ...prev,
                        difficulty: value as string,
                      }))
                    }
                    options={["peaceful", "easy", "normal", "hard"].map(
                      (value) => ({
                        value,
                        label: value,
                      })
                    )}
                  />
                </Stack>

                <Stack spacing={2} minW="12rem">
                  <FormLabel m={0}>Gamemode</FormLabel>
                  <MenuSelector
                    value={properties.gamemode}
                    onSelect={(value) =>
                      setProperties((prev) => ({
                        ...prev,
                        gamemode: value as string,
                      }))
                    }
                    options={[
                      "survival",
                      "creative",
                      "adventure",
                      "spectator",
                    ].map((value) => ({
                      value,
                      label: value,
                    }))}
                  />
                </Stack>
              </HStack>

              <HStack spacing={6} flexWrap="wrap">
                <HStack spacing={3}>
                  <Text fontSize="sm">Online mode</Text>
                  <Switch
                    colorScheme={primaryColor}
                    isChecked={properties.onlineMode}
                    onChange={(event) =>
                      setProperties((prev) => ({
                        ...prev,
                        onlineMode: event.target.checked,
                      }))
                    }
                  />
                </HStack>
                <HStack spacing={3}>
                  <Text fontSize="sm">PVP</Text>
                  <Switch
                    colorScheme={primaryColor}
                    isChecked={properties.pvp}
                    onChange={(event) =>
                      setProperties((prev) => ({
                        ...prev,
                        pvp: event.target.checked,
                      }))
                    }
                  />
                </HStack>
                <HStack spacing={3}>
                  <Text fontSize="sm">Allow flight</Text>
                  <Switch
                    colorScheme={primaryColor}
                    isChecked={properties.allowFlight}
                    onChange={(event) =>
                      setProperties((prev) => ({
                        ...prev,
                        allowFlight: event.target.checked,
                      }))
                    }
                  />
                </HStack>
              </HStack>

              <HStack spacing={4} align="start" flexWrap="wrap">
                <Stack spacing={2} minW="14rem" flex={1}>
                  <FormLabel m={0}>Level name</FormLabel>
                  <Input
                    value={properties.levelName}
                    onChange={(event) =>
                      setProperties((prev) => ({
                        ...prev,
                        levelName: event.target.value,
                      }))
                    }
                  />
                </Stack>
                <Stack spacing={2} minW="14rem" flex={1}>
                  <FormLabel m={0}>Level seed</FormLabel>
                  <Input
                    value={properties.levelSeed}
                    onChange={(event) =>
                      setProperties((prev) => ({
                        ...prev,
                        levelSeed: event.target.value,
                      }))
                    }
                  />
                </Stack>
                <Stack spacing={2} minW="14rem" flex={1}>
                  <FormLabel m={0}>Level type</FormLabel>
                  <Input
                    value={properties.levelType}
                    onChange={(event) =>
                      setProperties((prev) => ({
                        ...prev,
                        levelType: event.target.value,
                      }))
                    }
                  />
                </Stack>
              </HStack>
            </Stack>
          </Stack>

          <Alert status="info" borderRadius="md">
            <AlertIcon />
            <Text fontSize="sm">
              Selected version: {selectedGameVersion?.id || "None"}
              {" • "}Loader: {loaderLabel}
            </Text>
          </Alert>
        </Stack>
      </ModalBody>
      <ModalFooter mt={1}>
        <Button variant="ghost" onClick={onClose}>
          {t("General.cancel")}
        </Button>
        <Button variant="ghost" ml={2} onClick={onPrevious}>
          {t("General.previous")}
        </Button>
        <Button
          ml={2}
          colorScheme={primaryColor}
          onClick={onFinish}
          isDisabled={!canFinish}
          isLoading={isLoading}
        >
          {t("General.finish")}
        </Button>
      </ModalFooter>
    </>
  );
};
