import { Button, ModalBody, ModalFooter } from "@chakra-ui/react";
import { useTranslation } from "react-i18next";
import { InstanceBasicSettings } from "@/components/instance-basic-settings";
import { GameDirectory } from "@/models/config";

interface CreateInstanceInfoStepProps {
  name: string;
  setName: (value: string) => void;
  description: string;
  setDescription: (value: string) => void;
  iconSrc: string;
  setIconSrc: (value: string) => void;
  gameDirectory: GameDirectory | undefined;
  setGameDirectory: (value: GameDirectory | undefined) => void;
  onClose: () => void;
  onPrevious: () => void;
  onFinish: () => void;
  primaryColor: string;
  isLoading: boolean;
}

export const CreateInstanceInfoStep: React.FC<CreateInstanceInfoStepProps> = ({
  name,
  setName,
  description,
  setDescription,
  iconSrc,
  setIconSrc,
  gameDirectory,
  setGameDirectory,
  onClose,
  onPrevious,
  onFinish,
  primaryColor,
  isLoading,
}) => {
  const { t } = useTranslation();

  return (
    <>
      <ModalBody>
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
      </ModalBody>
      <ModalFooter>
        <Button variant="ghost" onClick={onClose}>
          {t("General.cancel")}
        </Button>
        <Button variant="ghost" onClick={onPrevious}>
          {t("General.previous")}
        </Button>
        <Button
          disabled={!gameDirectory || name === ""}
          colorScheme={primaryColor}
          onClick={onFinish}
          isLoading={isLoading}
        >
          {t("General.finish")}
        </Button>
      </ModalFooter>
    </>
  );
};
