import { Button, ModalBody, ModalFooter } from "@chakra-ui/react";
import { useTranslation } from "react-i18next";
import { GameVersionSelector } from "@/components/game-version-selector";
import { GameClientResourceInfo } from "@/models/resource";

interface CreateServerGameStepProps {
  selectedGameVersion: GameClientResourceInfo | undefined;
  onVersionSelect: (version: GameClientResourceInfo) => void;
  onClose: () => void;
  onNext: () => void;
  primaryColor: string;
}

export const CreateServerGameStep: React.FC<CreateServerGameStepProps> = ({
  selectedGameVersion,
  onVersionSelect,
  onClose,
  onNext,
  primaryColor,
}) => {
  const { t } = useTranslation();

  return (
    <>
      <ModalBody>
        <GameVersionSelector
          selectedVersion={selectedGameVersion}
          onVersionSelect={onVersionSelect}
        />
      </ModalBody>
      <ModalFooter mt={1}>
        <Button variant="ghost" onClick={onClose}>
          {t("General.cancel")}
        </Button>
        <Button
          disabled={!selectedGameVersion}
          colorScheme={primaryColor}
          onClick={onNext}
        >
          {t("General.next")}
        </Button>
      </ModalFooter>
    </>
  );
};
