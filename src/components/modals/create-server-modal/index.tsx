import {
  Box,
  Center,
  Flex,
  Modal,
  ModalCloseButton,
  ModalContent,
  ModalHeader,
  ModalOverlay,
  ModalProps,
  Step,
  StepDescription,
  StepIcon,
  StepIndicator,
  StepNumber,
  StepSeparator,
  StepStatus,
  StepTitle,
  Stepper,
  useSteps,
} from "@chakra-ui/react";
import { useRouter } from "next/router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { gameTypesToIcon } from "@/components/modals/create-instance-modal";
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
import {
  type LaunchPreset,
  presetCommands,
  serverKindToIcon,
} from "./constants";
import { CreateServerGameStep } from "./step-game";
import { CreateServerInfoStep } from "./step-info";
import { CreateServerLoaderStep } from "./step-loader";

export const CreateServerModal: React.FC<Omit<ModalProps, "children">> = ({
  ...modalProps
}) => {
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
  const [isLoadingFabricLoaders, setIsLoadingFabricLoaders] = useState(false);

  const [instanceName, setInstanceName] = useState("");
  const [instanceDescription, setInstanceDescription] = useState("");
  const [instanceIconSrc, setInstanceIconSrc] = useState(
    serverKindToIcon[GameServerKind.Vanilla]
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
    setIsLoadingFabricLoaders(false);
    setInstanceName("");
    setInstanceDescription("");
    setInstanceIconSrc(serverKindToIcon[GameServerKind.Vanilla]);
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
        ? serverKindToIcon[serverKind]
        : gameTypesToIcon[selectedGameVersion.gameType] ||
            serverKindToIcon[GameServerKind.Vanilla]
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
      setIsLoadingFabricLoaders(false);
      return;
    }

    setIsLoadingFabricLoaders(true);
    ResourceService.fetchModLoaderVersionList(
      selectedGameVersion.id,
      ModLoaderType.Fabric
    )
      .then((response) => {
        if (response.status !== "success") {
          setFabricLoaders([]);
          setSelectedFabricLoader(undefined);
          toast({
            title: response.message,
            description: response.details,
            status: "error",
          });
          return;
        }

        setFabricLoaders(response.data);
        setSelectedFabricLoader(
          response.data.find((loader) => loader.stable) || response.data[0]
        );
      })
      .finally(() => setIsLoadingFabricLoaders(false));
  }, [selectedGameVersion, serverKind, toast]);

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

  const handleInstallManagedServer = useCallback(async () => {
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
  }, [
    autoAcceptEula,
    backgroundCommand,
    backgroundMode,
    instanceDescription,
    instanceDirectory,
    instanceIconSrc,
    instanceName,
    javaPath,
    jvmArgs,
    modalProps,
    properties,
    router,
    selectedFabricLoader,
    selectedGameVersion,
    serverKind,
    stopCommand,
    toast,
    worldSource,
  ]);

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

  const steps = useMemo(
    () => [
      {
        key: "game",
        title: "Minecraft",
        content: (
          <CreateServerGameStep
            selectedGameVersion={selectedGameVersion}
            onVersionSelect={setSelectedGameVersion}
            onClose={modalProps.onClose}
            onNext={() => setActiveStep(1)}
            primaryColor={primaryColor}
          />
        ),
        description: selectedGameVersion?.id || "Select version",
      },
      {
        key: "loader",
        title: "Loader",
        content: (
          <CreateServerLoaderStep
            serverKind={serverKind}
            setServerKind={setServerKind}
            fabricLoaders={fabricLoaders}
            selectedFabricLoader={selectedFabricLoader}
            setSelectedFabricLoader={setSelectedFabricLoader}
            isLoadingFabricLoaders={isLoadingFabricLoaders}
            primaryColor={primaryColor}
            onClose={modalProps.onClose}
            onPrevious={() => setActiveStep(0)}
            onNext={() => setActiveStep(2)}
            canAdvance={canAdvanceLoaderStep}
          />
        ),
        description: loaderLabel,
      },
      {
        key: "info",
        title: "Setup",
        content: (
          <CreateServerInfoStep
            name={instanceName}
            setName={setInstanceName}
            description={instanceDescription}
            setDescription={setInstanceDescription}
            iconSrc={instanceIconSrc}
            setIconSrc={setInstanceIconSrc}
            gameDirectory={instanceDirectory}
            setGameDirectory={setInstanceDirectory}
            javaPath={javaPath}
            setJavaPath={setJavaPath}
            jvmArgs={jvmArgs}
            setJvmArgs={setJvmArgs}
            autoAcceptEula={autoAcceptEula}
            setAutoAcceptEula={setAutoAcceptEula}
            launchPreset={launchPreset}
            onLaunchPresetChange={handlePresetChange}
            backgroundMode={backgroundMode}
            backgroundCommand={backgroundCommand}
            setBackgroundCommand={setBackgroundCommand}
            stopCommand={stopCommand}
            setStopCommand={setStopCommand}
            worldSource={worldSource}
            setWorldSource={setWorldSource}
            properties={properties}
            setProperties={setProperties}
            selectedGameVersion={selectedGameVersion}
            loaderLabel={loaderLabel}
            primaryColor={primaryColor}
            onClose={modalProps.onClose}
            onPrevious={() => setActiveStep(1)}
            onFinish={handleInstallManagedServer}
            canFinish={canFinish}
            isLoading={isLoading}
          />
        ),
        description: "",
      },
    ],
    [
      autoAcceptEula,
      backgroundCommand,
      backgroundMode,
      canAdvanceLoaderStep,
      canFinish,
      fabricLoaders,
      instanceDescription,
      instanceDirectory,
      instanceIconSrc,
      instanceName,
      isLoading,
      javaPath,
      jvmArgs,
      launchPreset,
      loaderLabel,
      handleInstallManagedServer,
      isLoadingFabricLoaders,
      modalProps.onClose,
      primaryColor,
      properties,
      selectedFabricLoader,
      selectedGameVersion,
      serverKind,
      setActiveStep,
      stopCommand,
      worldSource,
    ]
  );

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
        <Center>
          <Stepper
            colorScheme={primaryColor}
            index={activeStep}
            w="80%"
            my={1.5}
          >
            {steps.map((step, index) => (
              <Step key={step.key}>
                <StepIndicator>
                  <StepStatus
                    complete={<StepIcon />}
                    incomplete={<StepNumber />}
                    active={<StepNumber />}
                  />
                </StepIndicator>
                <Box flexShrink="0">
                  <StepTitle fontSize="sm">{step.title}</StepTitle>
                  <StepDescription fontSize="xs">
                    {index < activeStep && step.description}
                  </StepDescription>
                </Box>
                <StepSeparator />
              </Step>
            ))}
          </Stepper>
        </Center>
        <Flex flexGrow="1" flexDir="column" h="100%" overflow="auto">
          {steps[activeStep].content}
        </Flex>
      </ModalContent>
    </Modal>
  );
};
