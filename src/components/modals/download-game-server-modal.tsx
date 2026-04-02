import {
  Alert,
  AlertIcon,
  Box,
  Button,
  Checkbox,
  Flex,
  FormLabel,
  HStack,
  Input,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  ModalProps,
  NumberInput,
  NumberInputField,
  Stack,
  Step,
  StepDescription,
  StepIcon,
  StepIndicator,
  StepNumber,
  StepSeparator,
  StepStatus,
  StepTitle,
  Stepper,
  Switch,
  Text,
  useSteps,
} from "@chakra-ui/react";
import { open } from "@tauri-apps/plugin-dialog";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { MenuSelector } from "@/components/common/menu-selector";
import { GameVersionSelector } from "@/components/game-version-selector";
import { InstanceBasicSettings } from "@/components/instance-basic-settings";
import { useLauncherConfig } from "@/contexts/config";
import { useToast } from "@/contexts/toast";
import { ModLoaderType } from "@/enums/instance";
import { GameDirectory } from "@/models/config";
import {
  GameServerBackgroundMode,
  GameServerKind,
  defaultManagedGameServerProperties,
} from "@/models/game-server";
import {
  GameClientResourceInfo,
  ModLoaderResourceInfo,
} from "@/models/resource";
import { GameServerService } from "@/services/game-server";
import { ResourceService } from "@/services/resource";

const gameTypeIcons: Record<string, string> = {
  release: "/images/icons/JEIcon_Release.png",
  snapshot: "/images/icons/JEIcon_Snapshot.png",
  old_beta: "/images/icons/StoneOldBeta.png",
  april_fools: "/images/icons/YellowGlazedTerracotta.png",
};

const loaderIcons: Record<GameServerKind, string> = {
  [GameServerKind.Vanilla]: "/images/icons/JEIcon_Release.png",
  [GameServerKind.Fabric]: "/images/icons/Fabric.png",
};

type LaunchPreset =
  | "launcher"
  | "disown"
  | "screen"
  | "tmux"
  | "zellij"
  | "custom";

const presetCommands: Record<
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

export const DownloadGameServerModal: React.FC<
  Omit<ModalProps, "children">
> = ({ ...modalProps }) => {
  const { t } = useTranslation();
  const { config } = useLauncherConfig();
  const toast = useToast();
  const router = useRouter();
  const primaryColor = config.appearance.theme.primaryColor;

  const { activeStep, setActiveStep } = useSteps({
    index: 0,
    count: 3,
  });

  const [selectedGameVersion, setSelectedGameVersion] =
    useState<GameClientResourceInfo>();
  const [serverKind, setServerKind] = useState<GameServerKind>(
    GameServerKind.Vanilla
  );
  const [fabricLoaders, setFabricLoaders] = useState<ModLoaderResourceInfo[]>(
    []
  );
  const [selectedFabricLoader, setSelectedFabricLoader] =
    useState<ModLoaderResourceInfo>();

  const [instanceName, setInstanceName] = useState("");
  const [instanceDescription, setInstanceDescription] = useState("");
  const [instanceIconSrc, setInstanceIconSrc] = useState(
    loaderIcons[GameServerKind.Vanilla]
  );
  const [instanceDirectory, setInstanceDirectory] = useState<GameDirectory>();

  const [javaPath, setJavaPath] = useState("java");
  const [jvmArgs, setJvmArgs] = useState("-Xms1G -Xmx2G");
  const [autoAcceptEula, setAutoAcceptEula] = useState(false);
  const [launchPreset, setLaunchPreset] = useState<LaunchPreset>("launcher");
  const [backgroundMode, setBackgroundMode] =
    useState<GameServerBackgroundMode>(GameServerBackgroundMode.Direct);
  const [backgroundCommand, setBackgroundCommand] = useState("");
  const [stopCommand, setStopCommand] = useState("");
  const [worldSource, setWorldSource] = useState("");
  const [properties, setProperties] = useState(
    defaultManagedGameServerProperties
  );
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!modalProps.isOpen) {
      setActiveStep(0);
      return;
    }

    setSelectedGameVersion(undefined);
    setServerKind(GameServerKind.Vanilla);
    setFabricLoaders([]);
    setSelectedFabricLoader(undefined);
    setInstanceName("");
    setInstanceDescription("");
    setInstanceIconSrc(loaderIcons[GameServerKind.Vanilla]);
    setInstanceDirectory(config.localGameDirectories[0]);
    setJavaPath("java");
    setJvmArgs("-Xms1G -Xmx2G");
    setAutoAcceptEula(false);
    setLaunchPreset("launcher");
    setBackgroundMode(GameServerBackgroundMode.Direct);
    setBackgroundCommand("");
    setStopCommand("");
    setWorldSource("");
    setProperties(defaultManagedGameServerProperties);
    setActiveStep(0);
  }, [config.localGameDirectories, modalProps.isOpen, setActiveStep]);

  useEffect(() => {
    if (!selectedGameVersion) return;
    setInstanceIconSrc(
      serverKind === GameServerKind.Fabric
        ? loaderIcons[serverKind]
        : gameTypeIcons[selectedGameVersion.gameType] ||
            loaderIcons[GameServerKind.Vanilla]
    );
    setInstanceName(
      serverKind === GameServerKind.Fabric
        ? `${selectedGameVersion.id}-fabric-server`
        : `${selectedGameVersion.id}-server`
    );
  }, [selectedGameVersion, serverKind]);

  useEffect(() => {
    if (serverKind !== GameServerKind.Fabric || !selectedGameVersion) {
      setFabricLoaders([]);
      setSelectedFabricLoader(undefined);
      return;
    }

    ResourceService.fetchModLoaderVersionList(
      selectedGameVersion.id,
      ModLoaderType.Fabric
    ).then((response) => {
      if (response.status !== "success") return;
      setFabricLoaders(response.data);
      setSelectedFabricLoader(
        response.data.find((loader) => loader.stable) || response.data[0]
      );
    });
  }, [selectedGameVersion, serverKind]);

  const loaderLabel = useMemo(() => {
    if (serverKind === GameServerKind.Vanilla) return "Vanilla";
    return selectedFabricLoader
      ? `Fabric ${selectedFabricLoader.version}`
      : "Fabric";
  }, [selectedFabricLoader, serverKind]);

  const handlePresetChange = (preset: LaunchPreset) => {
    setLaunchPreset(preset);
    const commands = presetCommands[preset];
    setBackgroundMode(commands.mode);
    if (preset !== "custom") {
      setBackgroundCommand(commands.start);
      setStopCommand(commands.stop);
    }
  };

  const handleInstallManagedServer = async () => {
    if (!selectedGameVersion || !instanceDirectory || !instanceName.trim()) {
      return;
    }

    if (
      serverKind === GameServerKind.Fabric &&
      (!selectedFabricLoader || !selectedFabricLoader.version)
    ) {
      return;
    }

    setIsLoading(true);
    const response = await GameServerService.installManagedGameServer({
      directory: instanceDirectory,
      name: instanceName.trim(),
      description: instanceDescription,
      iconSrc: instanceIconSrc,
      game: selectedGameVersion,
      kind: serverKind,
      modLoader:
        serverKind === GameServerKind.Fabric ? selectedFabricLoader : undefined,
      javaPath,
      jvmArgs,
      autoAcceptEula,
      backgroundMode,
      backgroundCommand,
      stopCommand,
      properties,
      worldSource: worldSource || undefined,
    });
    setIsLoading(false);

    if (response.status === "success") {
      modalProps.onClose?.();
      router.push("/downloads");
      return;
    }

    toast({
      title: response.message,
      description: response.details,
      status: "error",
    });
  };

  const canAdvanceLoaderStep =
    serverKind === GameServerKind.Vanilla ||
    Boolean(selectedFabricLoader && selectedFabricLoader.version);
  const hasValidLaunchCommand =
    backgroundMode !== GameServerBackgroundMode.ExternalCommand ||
    Boolean(backgroundCommand.trim());
  const canFinish =
    Boolean(selectedGameVersion) &&
    Boolean(instanceDirectory) &&
    Boolean(instanceName.trim()) &&
    canAdvanceLoaderStep &&
    hasValidLaunchCommand;

  const steps = [
    {
      title: "Minecraft",
      description: "Choose a server version",
    },
    {
      title: "Loader",
      description: "Vanilla or Fabric",
    },
    {
      title: "Setup",
      description: "Settings, world, and launch mode",
    },
  ];

  return (
    <Modal
      scrollBehavior="inside"
      size={{ base: "2xl", lg: "4xl", xl: "5xl" }}
      {...modalProps}
    >
      <ModalOverlay />
      <ModalContent h="100%">
        <ModalHeader>
          {t("AddAndImportInstancePage.moreOptions.server.title")}
        </ModalHeader>
        <ModalCloseButton />
        <Flex flexGrow="1" flexDir="column" minH={0}>
          <ModalBody pb={0}>
            <Stepper index={activeStep} size="sm" mb={5}>
              {steps.map((step) => (
                <Step key={step.title}>
                  <StepIndicator>
                    <StepStatus
                      complete={<StepIcon />}
                      incomplete={<StepNumber />}
                      active={<StepNumber />}
                    />
                  </StepIndicator>
                  <Box flexShrink={0}>
                    <StepTitle>{step.title}</StepTitle>
                    <StepDescription>{step.description}</StepDescription>
                  </Box>
                  <StepSeparator />
                </Step>
              ))}
            </Stepper>

            {activeStep === 0 && (
              <GameVersionSelector
                selectedVersion={selectedGameVersion}
                onVersionSelect={setSelectedGameVersion}
              />
            )}

            {activeStep === 1 && (
              <Stack spacing={5}>
                <Stack spacing={2}>
                  <FormLabel m={0}>Server loader</FormLabel>
                  <MenuSelector
                    options={[
                      { value: GameServerKind.Vanilla, label: "Vanilla" },
                      { value: GameServerKind.Fabric, label: "Fabric" },
                    ]}
                    value={serverKind}
                    onSelect={(value) => setServerKind(value as GameServerKind)}
                    buttonProps={{ w: "100%" }}
                  />
                </Stack>

                {serverKind === GameServerKind.Fabric && (
                  <Stack spacing={2}>
                    <FormLabel m={0}>Fabric loader</FormLabel>
                    <MenuSelector
                      options={fabricLoaders.map((loader) => ({
                        value: loader.version,
                        label: `${loader.version}${loader.stable ? " (stable)" : ""}`,
                      }))}
                      value={selectedFabricLoader?.version}
                      onSelect={(value) =>
                        setSelectedFabricLoader(
                          fabricLoaders.find(
                            (loader) => loader.version === value
                          )
                        )
                      }
                      buttonProps={{ w: "100%" }}
                      disabled={
                        !selectedGameVersion || fabricLoaders.length === 0
                      }
                      placeholder="Select a Fabric loader"
                    />
                  </Stack>
                )}

                <Alert status="info" borderRadius="md">
                  <AlertIcon />
                  <Text fontSize="sm">
                    The managed server will install the selected Minecraft
                    version first, then apply the chosen loader configuration.
                  </Text>
                </Alert>
              </Stack>
            )}

            {activeStep === 2 && (
              <Stack spacing={5}>
                <InstanceBasicSettings
                  name={instanceName}
                  setName={setInstanceName}
                  description={instanceDescription}
                  setDescription={setInstanceDescription}
                  iconSrc={instanceIconSrc}
                  setIconSrc={setInstanceIconSrc}
                  gameDirectory={instanceDirectory}
                  setGameDirectory={setInstanceDirectory}
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
                    onChange={(event) =>
                      setAutoAcceptEula(event.target.checked)
                    }
                    colorScheme={primaryColor}
                  >
                    Auto-sign the Minecraft server EULA on first launch
                  </Checkbox>

                  <Stack spacing={2}>
                    <FormLabel m={0}>Launch handling</FormLabel>
                    <MenuSelector
                      value={launchPreset}
                      onSelect={(value) =>
                        handlePresetChange(value as LaunchPreset)
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
                      Launcher-managed mode lets the launcher track the server
                      process directly. Wrapper presets leave process ownership
                      to shell tooling and rely on the configured commands.
                    </Text>
                  </Stack>

                  {backgroundMode ===
                    GameServerBackgroundMode.ExternalCommand && (
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
                          onChange={(event) =>
                            setStopCommand(event.target.value)
                          }
                          placeholder="tmux kill-session -t {{name}}"
                        />
                      </Stack>
                      <Alert status="info" borderRadius="md">
                        <AlertIcon />
                        <Text fontSize="sm">
                          Supported placeholders: {"{{name}}"},{" "}
                          {"{{launch_cmd}}"}, {"{{work_dir}}"}, {"{{java}}"},{" "}
                          {"{{jar}}"}, {"{{classpath}}"}, {"{{main_class}}"},{" "}
                          {"{{jvm_args}}"}, {"{{log_file}}"}
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
            )}
          </ModalBody>

          <ModalFooter mt={1}>
            <Button variant="ghost" onClick={modalProps.onClose}>
              {t("General.cancel")}
            </Button>
            {activeStep > 0 && (
              <Button
                variant="ghost"
                ml={2}
                onClick={() => setActiveStep(activeStep - 1)}
              >
                {t("General.previous")}
              </Button>
            )}
            {activeStep < steps.length - 1 ? (
              <Button
                ml={2}
                colorScheme={primaryColor}
                isDisabled={
                  activeStep === 0
                    ? !selectedGameVersion
                    : !canAdvanceLoaderStep
                }
                onClick={() => setActiveStep(activeStep + 1)}
              >
                {t("General.next")}
              </Button>
            ) : (
              <Button
                ml={2}
                colorScheme={primaryColor}
                onClick={handleInstallManagedServer}
                isDisabled={!canFinish}
                isLoading={isLoading}
              >
                {t("General.finish")}
              </Button>
            )}
          </ModalFooter>
        </Flex>
      </ModalContent>
    </Modal>
  );
};
