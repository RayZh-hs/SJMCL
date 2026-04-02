import {
  Box,
  Button,
  Collapse,
  HStack,
  Image,
  Input,
  Link,
  NumberInput,
  NumberInputField,
  Switch,
  Text,
  VStack,
} from "@chakra-ui/react";
import { useRouter } from "next/router";
import { useCallback, useEffect, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { ChakraColorSelectPopover } from "@/components/chakra-color-selector";
import Editable from "@/components/common/editable";
import { MenuSelector } from "@/components/common/menu-selector";
import {
  OptionItemGroup,
  OptionItemGroupProps,
} from "@/components/common/option-item";
import GameSettingsGroups from "@/components/game-settings-groups";
import { InstanceIconSelectorPopover } from "@/components/instance-icon-selector";
import { useLauncherConfig } from "@/contexts/config";
import { useInstanceSharedData } from "@/contexts/instance";
import { useSharedModals } from "@/contexts/shared-modal";
import { useToast } from "@/contexts/toast";
import {
  GameServerBackgroundMode,
  ManagedGameServerConfig,
} from "@/models/game-server";
import { GameServerService } from "@/services/game-server";
import { InstanceService } from "@/services/instance";
import {
  getInstanceIconSrc,
  isInstanceNameInvalid,
  isServerInstance,
} from "@/utils/instance";

const InstanceSettingsPage = () => {
  const router = useRouter();
  const toast = useToast();
  const { t } = useTranslation();
  const { config } = useLauncherConfig();
  const primaryColor = config.appearance.theme.primaryColor;
  const { openGenericConfirmDialog } = useSharedModals();

  const { id } = router.query;
  const instanceId = Array.isArray(id) ? id[0] : id;

  const {
    summary,
    updateSummaryInContext,
    gameConfig: instanceGameConfig,
    handleUpdateInstanceConfig,
    handleRestoreInstanceGameConfig,
  } = useInstanceSharedData();
  const isManagedServer = isServerInstance(summary);
  const useSpecGameConfig = summary?.useSpecGameConfig || false;
  const [serverConfig, setServerConfig] = useState<ManagedGameServerConfig>();

  const handleRenameInstance = useCallback(
    (name: string) => {
      if (!instanceId) return;
      InstanceService.renameInstance(instanceId, name).then((response) => {
        if (response.status === "success") {
          updateSummaryInContext("versionPath", response.data);
          updateSummaryInContext("name", name);
        } else
          toast({
            title: response.message,
            description: response.details,
            status: "error",
          });
      });
    },
    [instanceId, toast, updateSummaryInContext]
  );

  const instanceSpecSettingsGroups: OptionItemGroupProps[] = [
    {
      items: [
        {
          title: t("InstanceSettingsPage.name"),
          children: (
            <Editable
              isTextArea={false}
              value={summary?.name || ""}
              onEditSubmit={handleRenameInstance}
              textProps={{ className: "secondary-text", fontSize: "xs-sm" }}
              inputProps={{ fontSize: "xs-sm" }}
              formErrMsgProps={{ fontSize: "xs-sm" }}
              checkError={isInstanceNameInvalid}
              localeKey="InstanceSettingsPage.errorMessage"
              flex={1}
            />
          ),
        },
        {
          title: t("InstanceSettingsPage.description"),
          children: (
            <Editable
              isTextArea={true}
              value={summary?.description || ""}
              onEditSubmit={(value) => {
                handleUpdateInstanceConfig("description", value);
              }}
              textProps={{ className: "secondary-text", fontSize: "xs-sm" }}
              inputProps={{ fontSize: "xs-sm" }}
              flex={1}
            />
          ),
        },
        {
          title: t("InstanceSettingsPage.icon"),
          children: (
            <HStack>
              <Image
                src={getInstanceIconSrc(summary?.iconSrc, summary?.versionPath)}
                alt={summary?.iconSrc}
                boxSize="28px"
                fallbackSrc="/images/icons/JEIcon_Release.png"
              />
              <InstanceIconSelectorPopover
                value={summary?.iconSrc}
                onIconSelect={(value) => {
                  handleUpdateInstanceConfig("iconSrc", value);
                }}
                versionPath={summary?.versionPath}
                instanceId={summary?.id}
              />
            </HStack>
          ),
        },
        {
          title: t("InstanceSettingsPage.colorTag"),
          children: (
            <ChakraColorSelectPopover
              current={summary?.tag || ""}
              size="xs"
              withUnselectButton
              onColorSelect={(value) => {
                handleUpdateInstanceConfig("tag", value);
              }}
              onUnselect={() => {
                handleUpdateInstanceConfig("tag", null);
              }}
            />
          ),
        },
        {
          title: t("InstanceDetailsLayout.secMenu.star"),
          children: (
            <Switch
              colorScheme={primaryColor}
              isChecked={Boolean(summary?.starred)}
              onChange={(event) => {
                handleUpdateInstanceConfig("starred", event.target.checked);
              }}
            />
          ),
        },
      ],
    },
    {
      items: [
        {
          title: t("InstanceSettingsPage.applySettings"),
          children: (
            <Switch
              colorScheme={primaryColor}
              isChecked={useSpecGameConfig}
              onChange={(event) => {
                handleUpdateInstanceConfig(
                  "useSpecGameConfig",
                  event.target.checked
                );
              }}
            />
          ),
        },
        ...(useSpecGameConfig && instanceGameConfig
          ? [
              {
                title: t("InstanceSettingsPage.restoreSettings"),
                description: t("InstanceSettingsPage.restoreSettingsDesc"),
                children: (
                  <Button
                    colorScheme="red"
                    variant="subtle"
                    size="xs"
                    onClick={() => {
                      openGenericConfirmDialog({
                        title: t("RestoreInstanceConfigConfirmDialog.title"),
                        body: t("RestoreInstanceConfigConfirmDialog.body"),
                        isAlert: true,
                        onOKCallback: handleRestoreInstanceGameConfig,
                        showSuppressBtn: true,
                        suppressKey: "restoreInstanceSpecConfig",
                      });
                    }}
                  >
                    {t("InstanceSettingsPage.restore")}
                  </Button>
                ),
              },
              {
                title: t(
                  "GlobalGameSettingsPage.versionIsolation.settings.title"
                ),
                children: (
                  <Switch
                    colorScheme={primaryColor}
                    isChecked={instanceGameConfig.versionIsolation}
                    onChange={(event) => {
                      handleUpdateInstanceConfig(
                        "specGameConfig.versionIsolation",
                        event.target.checked
                      );
                      // updateSummaryInContext("isVersionIsolated", event.target.checked)
                    }}
                  />
                ),
              },
            ]
          : []),
      ],
    },
  ];

  useEffect(() => {
    if (!instanceId || !isManagedServer) {
      setServerConfig(undefined);
      return;
    }
    GameServerService.retrieveManagedGameServer(instanceId).then((response) => {
      if (response.status === "success") {
        setServerConfig(response.data.config);
      } else {
        toast({
          title: response.message,
          description: response.details,
          status: "error",
        });
      }
    });
  }, [instanceId, isManagedServer, toast]);

  const persistServerConfig = useCallback(
    (nextConfig: ManagedGameServerConfig) => {
      if (!instanceId) return;
      setServerConfig(nextConfig);
      GameServerService.updateManagedGameServer(instanceId, nextConfig).then(
        (response) => {
          if (response.status !== "success") {
            toast({
              title: response.message,
              description: response.details,
              status: "error",
            });
          }
        }
      );
    },
    [instanceId, toast]
  );

  const serverSettingsGroups: OptionItemGroupProps[] = serverConfig
    ? [
        {
          title: "Server runtime",
          items: [
            {
              title: "Auto-sign EULA",
              children: (
                <Switch
                  colorScheme={primaryColor}
                  isChecked={serverConfig.autoAcceptEula}
                  onChange={(event) =>
                    persistServerConfig({
                      ...serverConfig,
                      autoAcceptEula: event.target.checked,
                    })
                  }
                />
              ),
            },
            {
              title: "Java path",
              children: (
                <Input
                  size="xs"
                  maxW="24rem"
                  value={serverConfig.javaPath}
                  onChange={(event) =>
                    setServerConfig({
                      ...serverConfig,
                      javaPath: event.target.value,
                    })
                  }
                  onBlur={() => persistServerConfig(serverConfig)}
                  focusBorderColor={`${primaryColor}.500`}
                />
              ),
            },
            {
              title: "JVM args",
              children: (
                <Input
                  size="xs"
                  maxW="24rem"
                  value={serverConfig.jvmArgs}
                  onChange={(event) =>
                    setServerConfig({
                      ...serverConfig,
                      jvmArgs: event.target.value,
                    })
                  }
                  onBlur={() => persistServerConfig(serverConfig)}
                  focusBorderColor={`${primaryColor}.500`}
                />
              ),
            },
            {
              title: "Launch mode",
              description:
                "Direct mode lets the launcher start and stop the server itself. External mode is for tmux, screen, zellij, or custom wrappers.",
              children: (
                <MenuSelector
                  value={serverConfig.backgroundMode}
                  onSelect={(value) =>
                    persistServerConfig({
                      ...serverConfig,
                      backgroundMode: value as GameServerBackgroundMode,
                    })
                  }
                  options={[
                    {
                      value: GameServerBackgroundMode.Direct,
                      label: "Direct (launcher-managed)",
                    },
                    {
                      value: GameServerBackgroundMode.ExternalCommand,
                      label: "External command",
                    },
                  ]}
                />
              ),
            },
            ...(serverConfig.backgroundMode ===
            GameServerBackgroundMode.ExternalCommand
              ? [
                  {
                    title: "Start command",
                    children: (
                      <Input
                        size="xs"
                        maxW="24rem"
                        value={serverConfig.backgroundCommand}
                        onChange={(event) =>
                          setServerConfig({
                            ...serverConfig,
                            backgroundCommand: event.target.value,
                          })
                        }
                        onBlur={() => persistServerConfig(serverConfig)}
                        focusBorderColor={`${primaryColor}.500`}
                      />
                    ),
                  },
                  {
                    title: "Stop command",
                    children: (
                      <Input
                        size="xs"
                        maxW="24rem"
                        value={serverConfig.stopCommand}
                        onChange={(event) =>
                          setServerConfig({
                            ...serverConfig,
                            stopCommand: event.target.value,
                          })
                        }
                        onBlur={() => persistServerConfig(serverConfig)}
                        focusBorderColor={`${primaryColor}.500`}
                      />
                    ),
                  },
                ]
              : []),
          ],
        },
        {
          title: "Server properties",
          items: [
            {
              title: "MOTD",
              children: (
                <Input
                  size="xs"
                  maxW="24rem"
                  value={serverConfig.properties.motd}
                  onChange={(event) =>
                    setServerConfig({
                      ...serverConfig,
                      properties: {
                        ...serverConfig.properties,
                        motd: event.target.value,
                      },
                    })
                  }
                  onBlur={() => persistServerConfig(serverConfig)}
                  focusBorderColor={`${primaryColor}.500`}
                />
              ),
            },
            {
              title: "Server port",
              children: (
                <NumberInput
                  size="xs"
                  maxW="7rem"
                  value={serverConfig.properties.serverPort}
                  min={1}
                  max={65535}
                  onChange={(_, valueAsNumber) =>
                    setServerConfig({
                      ...serverConfig,
                      properties: {
                        ...serverConfig.properties,
                        serverPort: Number.isFinite(valueAsNumber)
                          ? valueAsNumber
                          : serverConfig.properties.serverPort,
                      },
                    })
                  }
                  onBlur={() => persistServerConfig(serverConfig)}
                >
                  <NumberInputField pr={0} />
                </NumberInput>
              ),
            },
            {
              title: "Max players",
              children: (
                <NumberInput
                  size="xs"
                  maxW="7rem"
                  value={serverConfig.properties.maxPlayers}
                  min={1}
                  max={1000}
                  onChange={(_, valueAsNumber) =>
                    setServerConfig({
                      ...serverConfig,
                      properties: {
                        ...serverConfig.properties,
                        maxPlayers: Number.isFinite(valueAsNumber)
                          ? valueAsNumber
                          : serverConfig.properties.maxPlayers,
                      },
                    })
                  }
                  onBlur={() => persistServerConfig(serverConfig)}
                >
                  <NumberInputField pr={0} />
                </NumberInput>
              ),
            },
            {
              title: "Difficulty",
              children: (
                <MenuSelector
                  value={serverConfig.properties.difficulty}
                  onSelect={(value) =>
                    persistServerConfig({
                      ...serverConfig,
                      properties: {
                        ...serverConfig.properties,
                        difficulty: value as string,
                      },
                    })
                  }
                  options={["peaceful", "easy", "normal", "hard"].map(
                    (value) => ({
                      value,
                      label: value,
                    })
                  )}
                />
              ),
            },
            {
              title: "Gamemode",
              children: (
                <MenuSelector
                  value={serverConfig.properties.gamemode}
                  onSelect={(value) =>
                    persistServerConfig({
                      ...serverConfig,
                      properties: {
                        ...serverConfig.properties,
                        gamemode: value as string,
                      },
                    })
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
              ),
            },
            {
              title: "Online mode",
              children: (
                <Switch
                  colorScheme={primaryColor}
                  isChecked={serverConfig.properties.onlineMode}
                  onChange={(event) =>
                    persistServerConfig({
                      ...serverConfig,
                      properties: {
                        ...serverConfig.properties,
                        onlineMode: event.target.checked,
                      },
                    })
                  }
                />
              ),
            },
            {
              title: "PVP",
              children: (
                <Switch
                  colorScheme={primaryColor}
                  isChecked={serverConfig.properties.pvp}
                  onChange={(event) =>
                    persistServerConfig({
                      ...serverConfig,
                      properties: {
                        ...serverConfig.properties,
                        pvp: event.target.checked,
                      },
                    })
                  }
                />
              ),
            },
            {
              title: "Allow flight",
              children: (
                <Switch
                  colorScheme={primaryColor}
                  isChecked={serverConfig.properties.allowFlight}
                  onChange={(event) =>
                    persistServerConfig({
                      ...serverConfig,
                      properties: {
                        ...serverConfig.properties,
                        allowFlight: event.target.checked,
                      },
                    })
                  }
                />
              ),
            },
            {
              title: "Level name",
              description: "Changing the active world path requires a restart.",
              children: (
                <Input
                  size="xs"
                  maxW="24rem"
                  value={serverConfig.properties.levelName}
                  onChange={(event) =>
                    setServerConfig({
                      ...serverConfig,
                      properties: {
                        ...serverConfig.properties,
                        levelName: event.target.value,
                      },
                    })
                  }
                  onBlur={() => persistServerConfig(serverConfig)}
                  focusBorderColor={`${primaryColor}.500`}
                />
              ),
            },
            {
              title: "Level seed",
              children: (
                <Input
                  size="xs"
                  maxW="24rem"
                  value={serverConfig.properties.levelSeed}
                  onChange={(event) =>
                    setServerConfig({
                      ...serverConfig,
                      properties: {
                        ...serverConfig.properties,
                        levelSeed: event.target.value,
                      },
                    })
                  }
                  onBlur={() => persistServerConfig(serverConfig)}
                  focusBorderColor={`${primaryColor}.500`}
                />
              ),
            },
            {
              title: "Level type",
              children: (
                <Input
                  size="xs"
                  maxW="24rem"
                  value={serverConfig.properties.levelType}
                  onChange={(event) =>
                    setServerConfig({
                      ...serverConfig,
                      properties: {
                        ...serverConfig.properties,
                        levelType: event.target.value,
                      },
                    })
                  }
                  onBlur={() => persistServerConfig(serverConfig)}
                  focusBorderColor={`${primaryColor}.500`}
                />
              ),
            },
          ],
        },
      ]
    : [];

  return (
    <Box height="100%" overflowY="auto">
      <VStack overflow="auto" align="stretch" spacing={4} flex="1">
        {instanceSpecSettingsGroups.map((group, index) => (
          <OptionItemGroup
            title={group.title}
            items={group.items}
            key={index}
          />
        ))}
        {!isManagedServer && !useSpecGameConfig && (
          <Text className="secondary-text" fontSize="xs-sm" textAlign="center">
            <Trans
              i18nKey="InstanceSettingsPage.tipsToGlobal.content"
              components={{
                terms: (
                  <Link
                    color={`${primaryColor}.500`}
                    onClick={() => {
                      router.push("/settings/global-game");
                    }}
                  />
                ),
              }}
            />
          </Text>
        )}
        {isManagedServer &&
          serverSettingsGroups.map((group, index) => (
            <OptionItemGroup
              title={group.title}
              items={group.items}
              key={`server-${index}`}
            />
          ))}
        {isManagedServer && (
          <Text className="secondary-text" fontSize="xs-sm" textAlign="center">
            Server property updates are written immediately and usually need a
            server restart to take effect.
          </Text>
        )}
      </VStack>
      <Box h={4} />
      <Collapse in={!isManagedServer && useSpecGameConfig} animateOpacity>
        {!isManagedServer && useSpecGameConfig && instanceGameConfig && (
          <GameSettingsGroups
            gameConfig={instanceGameConfig}
            updateGameConfig={(key: string, value: any) => {
              handleUpdateInstanceConfig(`specGameConfig.${key}`, value);
            }}
          />
        )}
      </Collapse>
    </Box>
  );
};

export default InstanceSettingsPage;
