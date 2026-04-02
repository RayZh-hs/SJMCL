import {
  Button,
  Center,
  HStack,
  Image,
  ModalBody,
  ModalFooter,
  Radio,
  Tag,
  Text,
} from "@chakra-ui/react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { OptionItemProps } from "@/components/common/option-item-virtual";
import { LoaderSelectionLayout } from "@/components/loader-selection-layout";
import { GameServerKind } from "@/models/game-server";
import { ModLoaderResourceInfo } from "@/models/resource";
import { ISOToDatetime } from "@/utils/datetime";
import { serverKindToIcon } from "./constants";

interface CreateServerLoaderStepProps {
  serverKind: GameServerKind;
  setServerKind: (value: GameServerKind) => void;
  fabricLoaders: ModLoaderResourceInfo[];
  selectedFabricLoader: ModLoaderResourceInfo | undefined;
  setSelectedFabricLoader: (value: ModLoaderResourceInfo | undefined) => void;
  isLoadingFabricLoaders: boolean;
  primaryColor: string;
  onClose: () => void;
  onPrevious: () => void;
  onNext: () => void;
  canAdvance: boolean;
}

export const CreateServerLoaderStep: React.FC<CreateServerLoaderStepProps> = ({
  serverKind,
  setServerKind,
  fabricLoaders,
  selectedFabricLoader,
  setSelectedFabricLoader,
  isLoadingFabricLoaders,
  primaryColor,
  onClose,
  onPrevious,
  onNext,
  canAdvance,
}) => {
  const { t } = useTranslation();

  const serverLoaderCards = useMemo(
    () => [
      {
        title: "Vanilla",
        iconSrc: serverKindToIcon[GameServerKind.Vanilla],
        description:
          serverKind === GameServerKind.Vanilla
            ? "No additional loader version required"
            : "Official Mojang server",
        displayMode: "selector" as const,
        isSelected: serverKind === GameServerKind.Vanilla,
        isChevronShown: serverKind !== GameServerKind.Vanilla,
        onSelect: () => setServerKind(GameServerKind.Vanilla),
      },
      {
        title: "Fabric",
        iconSrc: serverKindToIcon[GameServerKind.Fabric],
        description:
          serverKind === GameServerKind.Fabric
            ? selectedFabricLoader?.version ||
              t("LoaderSelector.noVersionSelected")
            : "Fabric server loader",
        displayMode: "selector" as const,
        isSelected: serverKind === GameServerKind.Fabric,
        isChevronShown: serverKind !== GameServerKind.Fabric,
        onSelect: () => setServerKind(GameServerKind.Fabric),
      },
    ],
    [selectedFabricLoader?.version, serverKind, setServerKind, t]
  );

  const fabricLoaderOptions = useMemo<OptionItemProps[]>(
    () =>
      fabricLoaders.map((loader) => ({
        title: loader.version,
        description:
          loader.description &&
          t("LoaderSelector.releaseDate", {
            date: ISOToDatetime(loader.description),
          }),
        prefixElement: (
          <HStack spacing={2.5}>
            <Radio value={loader.version} colorScheme={primaryColor} />
            <Image
              src={serverKindToIcon[GameServerKind.Fabric]}
              alt={loader.version}
              boxSize="28px"
              borderRadius="4px"
            />
          </HStack>
        ),
        titleExtra: (
          <Tag colorScheme={primaryColor} className="tag-xs">
            {t(`LoaderSelector.${loader.stable ? "stable" : "beta"}`)}
          </Tag>
        ),
        children: <></>,
        isFullClickZone: true,
        onClick: () => setSelectedFabricLoader(loader),
      })),
    [fabricLoaders, primaryColor, setSelectedFabricLoader, t]
  );

  const loaderPanelContent = useMemo(() => {
    if (serverKind !== GameServerKind.Vanilla) return undefined;

    return (
      <Center h="100%" px={6}>
        <Text fontSize="sm" className="secondary-text" textAlign="center">
          Vanilla servers do not require a separate loader version. Continue to
          use the selected Minecraft server jar directly.
        </Text>
      </Center>
    );
  }, [serverKind]);

  return (
    <>
      <ModalBody>
        <LoaderSelectionLayout
          minH="28rem"
          cards={serverLoaderCards}
          options={
            serverKind === GameServerKind.Fabric ? fabricLoaderOptions : []
          }
          isLoading={
            serverKind === GameServerKind.Fabric && isLoadingFabricLoaders
          }
          selectedId={selectedFabricLoader?.version || ""}
          onSelectedIdChange={(value) =>
            setSelectedFabricLoader(
              fabricLoaders.find((loader) => loader.version === value)
            )
          }
          panelContent={loaderPanelContent}
          selectedCardKey={`${serverKind}-${selectedFabricLoader?.version || ""}`}
        />
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
          isDisabled={!canAdvance}
          onClick={onNext}
        >
          {t("General.next")}
        </Button>
      </ModalFooter>
    </>
  );
};
