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
import { useLauncherConfig } from "@/contexts/config";
import { useToast } from "@/contexts/toast";
import { ModLoaderType } from "@/enums/instance";
import { GameDirectory } from "@/models/config";
import {
  GameClientResourceInfo,
  ModLoaderResourceInfo,
  OptiFineResourceInfo,
  defaultModLoaderResourceInfo,
} from "@/models/resource";
import { InstanceService } from "@/services/instance";
import { parseModLoaderVersion } from "@/utils/instance";
import { gameTypesToIcon, loaderTypesToIcon } from "./constants";
import { CreateInstanceGameStep } from "./step-game";
import { CreateInstanceInfoStep } from "./step-info";
import { CreateInstanceLoaderStep } from "./step-loader";

export { gameTypesToIcon, loaderTypesToIcon } from "./constants";

export const CreateInstanceModal: React.FC<Omit<ModalProps, "children">> = ({
  ...modalProps
}) => {
  const { t } = useTranslation();
  const { config } = useLauncherConfig();
  const primaryColor = config.appearance.theme.primaryColor;
  const toast = useToast();
  const router = useRouter();

  const { activeStep, setActiveStep } = useSteps({
    index: 0,
    count: 3,
  });

  const [selectedGameVersion, setSelectedGameVersion] =
    useState<GameClientResourceInfo>();
  const [selectedModLoader, setSelectedModLoader] =
    useState<ModLoaderResourceInfo>(defaultModLoaderResourceInfo);
  const [selectedOptiFine, setSelectedOptiFine] = useState<
    OptiFineResourceInfo | undefined
  >(undefined);
  const [instanceName, setInstanceName] = useState("");
  const [instanceDescription, setInstanceDescription] = useState("");
  const [instanceIconSrc, setInstanceIconSrc] = useState("");
  const [instanceDirectory, setInstanceDirectory] = useState<GameDirectory>();
  const [isLoading, setIsLoading] = useState(false);
  const [isInstallFabricApi, setIsInstallFabricApi] = useState(true);
  const [isInstallQfApi, setIsInstallQfApi] = useState(true);

  useEffect(() => {
    setSelectedModLoader(defaultModLoaderResourceInfo);
    setInstanceName("");
    setInstanceDescription("");
    setInstanceIconSrc(
      gameTypesToIcon[selectedGameVersion?.gameType || "release"]
    );
    setIsInstallFabricApi(true);
    setIsInstallQfApi(true);
  }, [selectedGameVersion]);

  const handleCreateInstance = useCallback(() => {
    if (!selectedGameVersion || !instanceDirectory) return;

    setIsLoading(true);
    InstanceService.createInstance(
      instanceDirectory,
      instanceName,
      instanceDescription,
      instanceIconSrc,
      selectedGameVersion,
      selectedModLoader,
      selectedOptiFine,
      undefined,
      isInstallFabricApi,
      isInstallQfApi
    )
      .then((res) => {
        if (res.status === "success") {
          modalProps.onClose();
          router.push("/downloads");
        } else {
          toast({
            title: res.message,
            description: res.details,
            status: "error",
          });
        }
      })
      .finally(() => setIsLoading(false));
  }, [
    selectedGameVersion,
    instanceDirectory,
    instanceName,
    instanceDescription,
    instanceIconSrc,
    selectedModLoader,
    selectedOptiFine,
    isInstallFabricApi,
    isInstallQfApi,
    modalProps,
    router,
    toast,
  ]);

  const handleLoaderStepNext = useCallback(() => {
    if (!selectedGameVersion) return;

    if (!selectedModLoader.version) {
      setSelectedModLoader(defaultModLoaderResourceInfo);
      setInstanceName(selectedGameVersion.id);
      setInstanceIconSrc(gameTypesToIcon[selectedGameVersion.gameType]);
    } else {
      setInstanceName(
        `${selectedGameVersion.id}-${selectedModLoader.loaderType}`
      );
      setInstanceIconSrc(loaderTypesToIcon[selectedModLoader.loaderType]);
    }

    if (selectedOptiFine) {
      if (!selectedOptiFine.filename) {
        setSelectedOptiFine(undefined);
      } else {
        setInstanceName((prev) => `${prev}-OptiFine`);
        setInstanceIconSrc(loaderTypesToIcon.OptiFine);
      }
    }

    setActiveStep(2);
  }, [selectedGameVersion, selectedModLoader, selectedOptiFine, setActiveStep]);

  const steps = useMemo(
    () => [
      {
        key: "game",
        content: (
          <CreateInstanceGameStep
            selectedGameVersion={selectedGameVersion}
            onVersionSelect={setSelectedGameVersion}
            onClose={modalProps.onClose}
            onNext={() => setActiveStep(1)}
            primaryColor={primaryColor}
          />
        ),
        description:
          selectedGameVersion &&
          `${selectedGameVersion.id} ${t(`GameVersionSelector.${selectedGameVersion.gameType}`)}`,
      },
      {
        key: "loader",
        content: selectedGameVersion ? (
          <CreateInstanceLoaderStep
            selectedGameVersion={selectedGameVersion}
            selectedModLoader={selectedModLoader}
            onSelectModLoader={setSelectedModLoader}
            selectedOptiFine={selectedOptiFine}
            onSelectOptiFine={setSelectedOptiFine}
            primaryColor={primaryColor}
            isInstallFabricApi={isInstallFabricApi}
            setIsInstallFabricApi={setIsInstallFabricApi}
            isInstallQfApi={isInstallQfApi}
            setIsInstallQfApi={setIsInstallQfApi}
            onClose={modalProps.onClose}
            onPrevious={() => setActiveStep(0)}
            onNext={handleLoaderStepNext}
          />
        ) : null,
        description: (() => {
          if (selectedModLoader.loaderType === ModLoaderType.Unknown) {
            return selectedOptiFine
              ? "OptiFine"
              : t("LoaderSelector.noVersionSelected");
          }

          let description = `${selectedModLoader.loaderType} ${
            parseModLoaderVersion(selectedModLoader.version) ||
            t("LoaderSelector.noVersionSelected")
          }`;
          if (selectedOptiFine) {
            description += " + OptiFine";
          }
          return description;
        })(),
      },
      {
        key: "info",
        content: (
          <CreateInstanceInfoStep
            name={instanceName}
            setName={setInstanceName}
            description={instanceDescription}
            setDescription={setInstanceDescription}
            iconSrc={instanceIconSrc}
            setIconSrc={setInstanceIconSrc}
            gameDirectory={instanceDirectory}
            setGameDirectory={setInstanceDirectory}
            onClose={modalProps.onClose}
            onPrevious={() => setActiveStep(1)}
            onFinish={handleCreateInstance}
            primaryColor={primaryColor}
            isLoading={isLoading}
          />
        ),
        description: "",
      },
    ],
    [
      handleCreateInstance,
      handleLoaderStepNext,
      instanceDescription,
      instanceDirectory,
      instanceIconSrc,
      instanceName,
      isInstallFabricApi,
      isInstallQfApi,
      isLoading,
      modalProps.onClose,
      primaryColor,
      selectedGameVersion,
      selectedModLoader,
      selectedOptiFine,
      t,
      setActiveStep,
    ]
  );

  return (
    <Modal
      scrollBehavior="inside"
      size={{ base: "2xl", lg: "3xl", xl: "4xl" }}
      {...modalProps}
    >
      <ModalOverlay />
      <ModalContent h="100%">
        <ModalHeader>{t("CreateInstanceModal.header.title")}</ModalHeader>
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
                  <StepTitle fontSize="sm">
                    {t(`CreateInstanceModal.stepper.${step.key}`)}
                  </StepTitle>
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
