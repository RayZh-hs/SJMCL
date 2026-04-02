import {
  Box,
  Button,
  ModalBody,
  ModalFooter,
  NumberInput,
  NumberInputField,
  Stack,
  Switch,
} from "@chakra-ui/react";
import { open } from "@tauri-apps/plugin-dialog";
import {
  Dispatch,
  SetStateAction,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import Editable from "@/components/common/editable";
import { MenuSelector } from "@/components/common/menu-selector";
import {
  OptionItemGroup,
  OptionItemProps,
} from "@/components/common/option-item";
import { Section } from "@/components/common/section";
import { InstanceBasicSettings } from "@/components/instance-basic-settings";
import { GameDirectory } from "@/models/config";
import {
  GameServerBackgroundMode,
  ManagedGameServerProperties,
} from "@/models/game-server";
import { GameClientResourceInfo } from "@/models/resource";
import { LaunchPreset } from "./constants";

type WorldSetupMode = "generate" | "folder" | "zip";

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

const worldSetupModeFromSource = (worldSource: string): WorldSetupMode => {
  if (!worldSource) return "generate";
  return worldSource.toLowerCase().endsWith(".zip") ? "zip" : "folder";
};

const selectorButtonProps = {
  w: { base: "10rem", md: "13rem" },
  maxW: "100%",
  size: "sm" as const,
  justifyContent: "space-between" as const,
  fontSize: "xs",
};

const editableWidth = { base: "10rem", md: "13rem" };
const numberInputWidth = { base: "7.5rem", md: "9rem" };
const sectionContentProps = {
  px: 2,
  pb: 1.5,
};

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
  const [worldSetupMode, setWorldSetupMode] = useState<WorldSetupMode>(
    worldSetupModeFromSource(worldSource)
  );

  useEffect(() => {
    if (!worldSource) return;
    setWorldSetupMode(worldSetupModeFromSource(worldSource));
  }, [worldSource]);

  const renderEditableField = useCallback(
    (
      value: string,
      onEditSubmit: (value: string) => void,
      placeholder?: string
    ) => (
      <Editable
        isTextArea={false}
        value={value}
        onEditSubmit={onEditSubmit}
        placeholder={placeholder}
        minW={editableWidth}
        textProps={{ fontSize: "sm" }}
        inputProps={{
          size: "sm",
          w: editableWidth,
        }}
      />
    ),
    []
  );

  const handleWorldSourcePick = useCallback(
    async (mode: Extract<WorldSetupMode, "folder" | "zip">) => {
      const path =
        mode === "folder"
          ? await open({
              directory: true,
              multiple: false,
            })
          : await open({
              multiple: false,
              filters: [
                {
                  name: "World archive",
                  extensions: ["zip"],
                },
              ],
            });

      if (typeof path === "string") {
        setWorldSetupMode(mode);
        setWorldSource(path);
      }
    },
    [setWorldSource]
  );

  const handleWorldSetupModeChange = useCallback(
    (value: WorldSetupMode) => {
      setWorldSetupMode(value);

      if (value === "generate") {
        setWorldSource("");
        return;
      }

      if (worldSetupModeFromSource(worldSource) !== value) {
        setWorldSource("");
      }
    },
    [setWorldSource, worldSource]
  );

  const serverBasicsItems = useMemo<OptionItemProps[]>(
    () => [
      {
        title: "MOTD",
        description: "Shown in the multiplayer server list.",
        children: renderEditableField(properties.motd, (value) =>
          setProperties((prev) => ({
            ...prev,
            motd: value,
          }))
        ),
      },
      {
        title: "Server port",
        description: "Port used for incoming player connections.",
        children: (
          <NumberInput
            size="sm"
            w={numberInputWidth}
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
        ),
      },
      {
        title: "Max players",
        description: "Maximum number of players allowed online at once.",
        children: (
          <NumberInput
            size="sm"
            w={numberInputWidth}
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
        ),
      },
      {
        title: "Difficulty",
        description: "Default world difficulty for new players and mobs.",
        children: (
          <MenuSelector
            value={properties.difficulty}
            onSelect={(value) =>
              setProperties((prev) => ({
                ...prev,
                difficulty: (value as string) || prev.difficulty,
              }))
            }
            options={["peaceful", "easy", "normal", "hard"].map((value) => ({
              value,
              label: value,
            }))}
            size="md"
            fontSize="sm"
            buttonProps={selectorButtonProps}
          />
        ),
      },
      {
        title: "Gamemode",
        description: "Gameplay rules players spawn into by default.",
        children: (
          <MenuSelector
            value={properties.gamemode}
            onSelect={(value) =>
              setProperties((prev) => ({
                ...prev,
                gamemode: (value as string) || prev.gamemode,
              }))
            }
            options={["survival", "creative", "adventure", "spectator"].map(
              (value) => ({
                value,
                label: value,
              })
            )}
            size="md"
            fontSize="sm"
            buttonProps={selectorButtonProps}
          />
        ),
      },
      {
        title: "Online mode",
        description: "Verify connecting players with Mojang authentication.",
        children: (
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
        ),
      },
      {
        title: "PVP",
        description: "Allow players to damage one another during gameplay.",
        children: (
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
        ),
      },
      {
        title: "Allow flight",
        description: "Permit player flight without automatic kicks.",
        children: (
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
        ),
      },
    ],
    [primaryColor, properties, renderEditableField, setProperties]
  );

  const worldSetupItems = useMemo<OptionItemProps[]>(() => {
    const items: OptionItemProps[] = [
      {
        title: "World source",
        description:
          "Choose whether to generate a new world or import an existing save.",
        children: (
          <MenuSelector
            value={worldSetupMode}
            onSelect={(value) =>
              handleWorldSetupModeChange(
                (value as WorldSetupMode) || "generate"
              )
            }
            options={[
              { value: "generate", label: "Generate new world" },
              { value: "folder", label: "Import world folder" },
              { value: "zip", label: "Import zip archive" },
            ]}
            size="md"
            fontSize="sm"
            buttonProps={selectorButtonProps}
          />
        ),
      },
    ];

    if (worldSetupMode === "generate") {
      items.push(
        {
          title: "Level name",
          description: "The world folder name created inside the server.",
          children: renderEditableField(properties.levelName, (value) =>
            setProperties((prev) => ({
              ...prev,
              levelName: value,
            }))
          ),
        },
        {
          title: "Level seed",
          description: "Optional world seed used for first-time generation.",
          children: renderEditableField(properties.levelSeed, (value) =>
            setProperties((prev) => ({
              ...prev,
              levelSeed: value,
            }))
          ),
        },
        {
          title: "Level type",
          description: "Generator preset, such as default or flat.",
          children: renderEditableField(properties.levelType, (value) =>
            setProperties((prev) => ({
              ...prev,
              levelType: value,
            }))
          ),
        }
      );
    } else {
      items.push(
        {
          title: worldSetupMode === "folder" ? "World folder" : "World archive",
          description: worldSource
            ? worldSource
            : worldSetupMode === "folder"
              ? "Select a world directory to copy into this server."
              : "Select a .zip archive to extract into this server.",
          children: (
            <Button
              size="sm"
              onClick={() =>
                handleWorldSourcePick(
                  worldSetupMode as Extract<WorldSetupMode, "folder" | "zip">
                )
              }
            >
              {worldSource
                ? worldSetupMode === "folder"
                  ? "Change folder"
                  : "Change zip"
                : worldSetupMode === "folder"
                  ? "Choose folder"
                  : "Choose zip"}
            </Button>
          ),
        },
        {
          title: "Imported world name",
          description: "Existing worlds are copied into this folder name.",
          children: renderEditableField(properties.levelName, (value) =>
            setProperties((prev) => ({
              ...prev,
              levelName: value,
            }))
          ),
        }
      );

      if (worldSource) {
        items.push({
          title: "Clear import",
          description: "Remove the selected source while keeping import mode.",
          children: (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setWorldSource("")}
            >
              Clear selection
            </Button>
          ),
        });
      }
    }

    return items;
  }, [
    handleWorldSetupModeChange,
    handleWorldSourcePick,
    properties,
    setProperties,
    setWorldSource,
    worldSetupMode,
    worldSource,
    renderEditableField,
  ]);

  const advancedRuntimeItems = useMemo<OptionItemProps[]>(() => {
    const items: OptionItemProps[] = [
      {
        title: "Java path",
        description: "Binary used to launch the server process.",
        children: renderEditableField(javaPath, setJavaPath, "java"),
      },
      {
        title: "JVM args",
        description: "Extra JVM flags such as heap sizing.",
        children: renderEditableField(jvmArgs, setJvmArgs, "-Xms1G -Xmx2G"),
      },
      {
        title: "Auto-accept EULA",
        description: "Write `eula=true` automatically before first launch.",
        children: (
          <Switch
            colorScheme={primaryColor}
            isChecked={autoAcceptEula}
            onChange={(event) => setAutoAcceptEula(event.target.checked)}
          />
        ),
      },
      {
        title: "Launch handling",
        description:
          "Use the launcher directly or hand process ownership to shell tooling.",
        children: (
          <MenuSelector
            value={launchPreset}
            onSelect={(value) =>
              onLaunchPresetChange((value as LaunchPreset) || "launcher")
            }
            options={[
              { value: "launcher", label: "Launcher managed" },
              { value: "disown", label: "Disown / nohup" },
              { value: "screen", label: "screen" },
              { value: "tmux", label: "tmux" },
              { value: "zellij", label: "zellij" },
              { value: "custom", label: "Custom command" },
            ]}
            size="md"
            fontSize="sm"
            buttonProps={selectorButtonProps}
          />
        ),
      },
    ];

    if (backgroundMode === GameServerBackgroundMode.ExternalCommand) {
      items.push(
        {
          title: "Start command",
          description:
            "Template used to launch the server through your chosen wrapper.",
          children: renderEditableField(
            backgroundCommand,
            setBackgroundCommand,
            "tmux new-session -d -s {{name}} ..."
          ),
        },
        {
          title: "Stop command",
          description:
            "Optional command for stopping externally managed servers.",
          children: renderEditableField(
            stopCommand,
            setStopCommand,
            "tmux kill-session -t {{name}}"
          ),
        },
        {
          title: "Supported placeholders",
          description:
            "{{name}}, {{launch_cmd}}, {{work_dir}}, {{java}}, {{jar}}, {{classpath}}, {{main_class}}, {{jvm_args}}, {{log_file}}",
          children: <Box minW={editableWidth} />,
        }
      );
    }

    return items;
  }, [
    autoAcceptEula,
    backgroundCommand,
    backgroundMode,
    javaPath,
    jvmArgs,
    launchPreset,
    onLaunchPresetChange,
    primaryColor,
    setAutoAcceptEula,
    setBackgroundCommand,
    setJavaPath,
    setJvmArgs,
    setStopCommand,
    stopCommand,
    renderEditableField,
  ]);

  return (
    <>
      <ModalBody>
        <Stack spacing={5} h="100%">
          <Box flex={1} minW={0} overflowY="auto">
            <Stack spacing={5}>
              <Section
                title="Game instance"
                description="Name, icon, description, and storage location."
                isAccordion
                initialIsOpen
                contentProps={sectionContentProps}
              >
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
              </Section>

              <OptionItemGroup
                title="Server basics"
                description="Core gameplay and server rules."
                isAccordion
                initialIsOpen
                withInCard={false}
                contentProps={sectionContentProps}
                items={serverBasicsItems}
                w="100%"
              />

              <OptionItemGroup
                title="World setup"
                description="Choose how the world should be created or imported."
                isAccordion
                initialIsOpen
                withInCard={false}
                contentProps={sectionContentProps}
                items={worldSetupItems}
                w="100%"
              />

              <OptionItemGroup
                title="Advanced runtime"
                description="Java, EULA handling, and external process control."
                isAccordion
                initialIsOpen={false}
                withInCard={false}
                contentProps={sectionContentProps}
                items={advancedRuntimeItems}
                w="100%"
              />
            </Stack>
          </Box>
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
