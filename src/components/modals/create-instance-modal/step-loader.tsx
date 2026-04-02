import {
  Button,
  Checkbox,
  HStack,
  ModalBody,
  ModalFooter,
  Text,
} from "@chakra-ui/react";
import { useTranslation } from "react-i18next";
import { LoaderSelector } from "@/components/loader-selector";
import { ModLoaderType } from "@/enums/instance";
import {
  GameClientResourceInfo,
  ModLoaderResourceInfo,
  OptiFineResourceInfo,
} from "@/models/resource";

interface CreateInstanceLoaderStepProps {
  selectedGameVersion: GameClientResourceInfo;
  selectedModLoader: ModLoaderResourceInfo;
  onSelectModLoader: (resource: ModLoaderResourceInfo) => void;
  selectedOptiFine: OptiFineResourceInfo | undefined;
  onSelectOptiFine: (resource: OptiFineResourceInfo | undefined) => void;
  primaryColor: string;
  isInstallFabricApi: boolean;
  setIsInstallFabricApi: (checked: boolean) => void;
  isInstallQfApi: boolean;
  setIsInstallQfApi: (checked: boolean) => void;
  onClose: () => void;
  onPrevious: () => void;
  onNext: () => void;
}

export const CreateInstanceLoaderStep: React.FC<
  CreateInstanceLoaderStepProps
> = ({
  selectedGameVersion,
  selectedModLoader,
  onSelectModLoader,
  selectedOptiFine,
  onSelectOptiFine,
  primaryColor,
  isInstallFabricApi,
  setIsInstallFabricApi,
  isInstallQfApi,
  setIsInstallQfApi,
  onClose,
  onPrevious,
  onNext,
}) => {
  const { t } = useTranslation();

  return (
    <>
      <ModalBody>
        <LoaderSelector
          selectedGameVersion={selectedGameVersion}
          selectedModLoader={selectedModLoader}
          onSelectModLoader={onSelectModLoader}
          selectedOptiFine={selectedOptiFine}
          onSelectOptiFine={onSelectOptiFine}
        />
      </ModalBody>
      <ModalFooter>
        {selectedModLoader.loaderType === ModLoaderType.Fabric && (
          <Checkbox
            colorScheme={primaryColor}
            isChecked={selectedModLoader.version !== "" && isInstallFabricApi}
            disabled={!selectedModLoader.version}
            onChange={(event) => setIsInstallFabricApi(event.target.checked)}
          >
            <Text fontSize="sm">
              {t("CreateInstanceModal.footer.installFabricApi")}
            </Text>
          </Checkbox>
        )}
        {selectedModLoader.loaderType === ModLoaderType.Quilt && (
          <Checkbox
            colorScheme={primaryColor}
            isChecked={selectedModLoader.version !== "" && isInstallQfApi}
            disabled={!selectedModLoader.version}
            onChange={(event) => setIsInstallQfApi(event.target.checked)}
          >
            <Text fontSize="sm">
              {t("CreateInstanceModal.footer.installQFAPI")}
            </Text>
          </Checkbox>
        )}

        <HStack spacing={3} ml="auto">
          <Button variant="ghost" onClick={onClose}>
            {t("General.cancel")}
          </Button>
          <Button variant="ghost" onClick={onPrevious}>
            {t("General.previous")}
          </Button>
          <Button colorScheme={primaryColor} onClick={onNext}>
            {t("General.next")}
          </Button>
        </HStack>
      </ModalFooter>
    </>
  );
};
