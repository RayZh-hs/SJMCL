import {
  Center,
  HStack,
  Image,
  Tag,
  TagLabel,
  Text,
  useDisclosure,
} from "@chakra-ui/react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { openPath } from "@tauri-apps/plugin-opener";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { LuCheck, LuX } from "react-icons/lu";
import { BeatLoader } from "react-spinners";
import { CommonIconButton } from "@/components/common/common-icon-button";
import CountTag from "@/components/common/count-tag";
import Empty from "@/components/common/empty";
import { OptionItem, OptionItemGroup } from "@/components/common/option-item";
import { Section } from "@/components/common/section";
import AddGameServerModal from "@/components/modals/add-game-server-modal";
import WorldLevelDataModal from "@/components/modals/world-level-data-modal";
import { useLauncherConfig } from "@/contexts/config";
import { useInstanceSharedData } from "@/contexts/instance";
import { useSharedModals } from "@/contexts/shared-modal";
import { useToast } from "@/contexts/toast";
import { InstanceSubdirType } from "@/enums/instance";
import { OtherResourceType } from "@/enums/resource";
import { GetStateFlag } from "@/hooks/get-state";
import { GameServerInfo } from "@/models/instance/misc";
import { WorldInfo } from "@/models/instance/world";
import { GameServerService } from "@/services/game-server";
import { InstanceService } from "@/services/instance";
import { UNIXToISOString, formatRelativeTime } from "@/utils/datetime";
import { isServerInstance } from "@/utils/instance";
import { base64ImgSrc } from "@/utils/string";

const InstanceWorldsPage = () => {
  const { t } = useTranslation();
  const { config, update } = useLauncherConfig();
  const {
    instanceId,
    summary,
    openInstanceSubdir,
    handleImportResource,
    getWorldList,
    isWorldListLoading: isLoading,
  } = useInstanceSharedData();
  const isManagedServer = isServerInstance(summary);
  const accordionStates = config.states.instanceWorldsPage.accordionStates;
  const toast = useToast();
  const { openSharedModal, openGenericConfirmDialog } = useSharedModals();
  const [worlds, setWorlds] = useState<WorldInfo[]>([]);
  const [selectedWorldName, setSelectedWorldName] = useState<string>();
  const [gameServers, setGameServers] = useState<GameServerInfo[]>([]);

  const {
    isOpen: isAddGameServerModalOpen,
    onOpen: onAddGameServerModalOpen,
    onClose: onAddGameServerModalClose,
  } = useDisclosure();

  const {
    isOpen: isWorldLevelDataModalOpen,
    onOpen: onWorldLevelDataModallOpen,
    onClose: onWorldLevelDataModalClose,
  } = useDisclosure();

  const getWorldListWrapper = useCallback(
    (sync?: boolean) => {
      getWorldList(sync)
        .then((data) => {
          if (data === GetStateFlag.Cancelled) return;
          setWorlds(data || []);
        })
        .catch((e) => setWorlds([]));
    },
    [getWorldList]
  );

  useEffect(() => {
    getWorldListWrapper();
  }, [getWorldListWrapper]);

  const handleRetrieveGameServerList = useCallback(
    (queryOnline: boolean) => {
      if (instanceId !== undefined) {
        InstanceService.retrieveGameServerList(instanceId, queryOnline).then(
          (response) => {
            if (response.status === "success") {
              setGameServers(response.data);
            } else if (!queryOnline) {
              toast({
                title: response.message,
                description: response.details,
                status: "error",
              });
            }
          }
        );
      }
    },
    [toast, instanceId]
  );

  // First fetch from local nbt (queryOnline=false) for instant feedback,
  // then query online status to avoid long wait harming UX.
  const refreshGameServerList = useCallback(() => {
    handleRetrieveGameServerList(false);
    handleRetrieveGameServerList(true);
  }, [handleRetrieveGameServerList]);

  useEffect(() => {
    if (isManagedServer) return;
    refreshGameServerList();
    // refresh every minute to query server info
    const intervalId = setInterval(async () => {
      handleRetrieveGameServerList(true);
    }, 60000);
    return () => clearInterval(intervalId);
  }, [handleRetrieveGameServerList, isManagedServer, refreshGameServerList]);

  const handleDeleteServer = useCallback(
    (server: GameServerInfo) => {
      if (!instanceId) return;
      InstanceService.deleteGameServer(instanceId, server.ip).then(
        (response) => {
          if (response.status === "success") {
            toast({
              title: response.message,
              status: "success",
            });
            refreshGameServerList();
          } else {
            toast({
              title: response.message,
              description: response.details,
              status: "error",
            });
          }
        }
      );
    },
    [instanceId, toast, refreshGameServerList]
  );

  const worldSecMenuOperations = [
    {
      icon: "openFolder",
      onClick: () => {
        openInstanceSubdir(
          isManagedServer ? InstanceSubdirType.Root : InstanceSubdirType.Saves
        );
      },
    },
    ...(!isManagedServer
      ? [
          {
            icon: "download",
            onClick: () => {
              openSharedModal("download-resource", {
                initialResourceType: OtherResourceType.World,
              });
            },
          },
        ]
      : []),
    {
      icon: "add",
      onClick: async () => {
        if (!instanceId) return;
        if (isManagedServer) {
          const selectedPath = await open({
            multiple: false,
            filters: [
              {
                name: "World archive",
                extensions: ["zip"],
              },
            ],
          });
          if (typeof selectedPath !== "string") return;
          const response = await GameServerService.importManagedGameServerWorld(
            instanceId,
            selectedPath
          );
          if (response.status === "success") {
            getWorldListWrapper(true);
          } else {
            toast({
              title: response.message,
              description: response.details,
              status: "error",
            });
          }
          return;
        }
        handleImportResource({
          filterName: t("InstanceDetailsLayout.instanceTabList.worlds"),
          filterExt: ["zip"],
          tgtDirType: InstanceSubdirType.Saves,
          decompress: true,
          onSuccessCallback: () => getWorldListWrapper(true),
        });
      },
    },
    {
      icon: "refresh",
      onClick: () => {
        getWorldListWrapper(true);
        setSelectedWorldName("");
      },
    },
  ];

  const serverSecMenuOperations = isManagedServer
    ? [
        {
          icon: "refresh",
          onClick: () => {
            getWorldListWrapper(true);
          },
        },
      ]
    : [
        {
          icon: "add",
          onClick: () => {
            onAddGameServerModalOpen();
          },
        },
        {
          icon: "refresh",
          onClick: () => {
            refreshGameServerList();
          },
        },
      ];

  const worldItemMenuOperations = (save: WorldInfo) => [
    {
      label: "",
      icon: "copyOrMove",
      onClick: () => {
        openSharedModal("copy-or-move", {
          srcResName: save.name,
          srcFilePath: save.dirPath,
        });
      },
    },
    {
      label: "",
      icon: "revealFile",
      onClick: async () => await openPath(save.dirPath),
    },
    {
      label: t("InstanceWorldsPage.worldList.viewLevelData"),
      icon: "info",
      onClick: () => {
        setSelectedWorldName(save.name);
        onWorldLevelDataModallOpen();
      },
    },
    ...(!isManagedServer && summary?.supportQuickPlay
      ? [
          {
            label: t("InstanceWorldsPage.worldList.launch"),
            icon: "launch",
            onClick: () => {
              openSharedModal("launch", {
                instanceId: instanceId,
                quickPlaySingleplayer: save.name,
              });
            },
          },
        ]
      : []),
  ];

  const serverItemMenuOperations = (server: GameServerInfo) => [
    {
      icon: "delete",
      danger: true,
      onClick: () => {
        openGenericConfirmDialog({
          title: t("DeleteGameServerAlertDialog.title"),
          body: t("DeleteGameServerAlertDialog.content", {
            name: server.name,
            addr: server.ip,
          }),
          btnOK: t("General.delete"),
          isAlert: true,
          onOKCallback: () => {
            handleDeleteServer(server);
          },
          showSuppressBtn: true,
          suppressKey: "deleteGameServerAlert",
        });
      },
    },
    {
      icon: "launch",
      label: t("InstanceWorldsPage.serverList.launch"),
      danger: false,
      onClick: () => {
        openSharedModal("launch", {
          instanceId: instanceId,
          quickPlayMultiplayer: server.ip,
        });
      },
    },
  ];

  return (
    <>
      <Section
        isAccordion
        title={t("InstanceWorldsPage.worldList.title")}
        initialIsOpen={accordionStates[0]}
        titleExtra={<CountTag count={worlds.length} />}
        onAccordionToggle={(isOpen) => {
          update(
            "states.instanceWorldsPage.accordionStates",
            accordionStates.toSpliced(0, 1, isOpen)
          );
        }}
        headExtra={
          <HStack spacing={2}>
            {worldSecMenuOperations.map((btn, index) => (
              <CommonIconButton
                key={index}
                icon={btn.icon}
                onClick={btn.onClick}
                size="xs"
                fontSize="sm"
                h={21}
              />
            ))}
          </HStack>
        }
      >
        {isLoading ? (
          <Center mt={4}>
            <BeatLoader size={16} color="gray" />
          </Center>
        ) : worlds.length > 0 ? (
          <OptionItemGroup
            items={worlds.map((world) => {
              const gamemode = t(
                `InstanceWorldsPage.worldList.gamemode.${world.gamemode}`
              );

              const description = [
                `${t("InstanceWorldsPage.worldList.lastPlayedAt")} ${formatRelativeTime(UNIXToISOString(world.lastPlayedAt), t)}`,
                t("InstanceWorldsPage.worldList.gamemodeDesc", { gamemode }),
                world.difficulty &&
                  t("InstanceWorldsPage.worldList.difficultyDesc", {
                    difficulty: t(
                      `InstanceWorldsPage.worldList.difficulty.${world.difficulty}`
                    ),
                  }),
              ]
                .filter(Boolean)
                .join("");

              return (
                <OptionItem
                  key={world.name}
                  title={world.name}
                  description={description}
                  prefixElement={
                    <Image
                      src={convertFileSrc(world.iconSrc)}
                      fallbackSrc="/images/icons/UnknownWorld.webp"
                      alt={world.name}
                      boxSize="28px"
                      style={{ borderRadius: "4px" }}
                    />
                  }
                >
                  <HStack spacing={0}>
                    {worldItemMenuOperations(world).map((item, index) => (
                      <CommonIconButton
                        key={index}
                        icon={item.icon}
                        label={item.label}
                        onClick={item.onClick}
                      />
                    ))}
                  </HStack>
                </OptionItem>
              );
            })}
          />
        ) : (
          <Empty withIcon={false} size="sm" />
        )}
      </Section>

      <WorldLevelDataModal
        instanceId={instanceId}
        worldName={selectedWorldName || ""}
        isOpen={isWorldLevelDataModalOpen}
        onClose={onWorldLevelDataModalClose}
      />

      <Section
        isAccordion
        title={
          isManagedServer
            ? "World Setup"
            : t("InstanceWorldsPage.serverList.title")
        }
        initialIsOpen={accordionStates[1]}
        titleExtra={
          <CountTag
            count={isManagedServer ? worlds.length : gameServers.length}
          />
        }
        onAccordionToggle={(isOpen) => {
          update(
            "states.instanceWorldsPage.accordionStates",
            accordionStates.toSpliced(1, 1, isOpen)
          );
        }}
        headExtra={
          <HStack spacing={2}>
            {serverSecMenuOperations.map((btn, index) => (
              <CommonIconButton
                key={index}
                icon={btn.icon}
                onClick={btn.onClick}
                size="xs"
                fontSize="sm"
                h={21}
              />
            ))}
          </HStack>
        }
      >
        {isManagedServer ? (
          <Center minH={16}>
            <Text fontSize="sm" className="secondary-text">
              Import a zipped world to replace the active server world, or leave
              the configured level name untouched and let the server generate a
              fresh one on next restart.
            </Text>
          </Center>
        ) : gameServers.length > 0 ? (
          <OptionItemGroup
            items={gameServers.map((server) => (
              <OptionItem
                key={server.name}
                title={server.name}
                description={server.ip}
                prefixElement={
                  <Image
                    src={
                      server.isQueried
                        ? server.iconSrc
                        : base64ImgSrc(server.iconSrc)
                    }
                    fallbackSrc="/images/icons/UnknownWorld.webp"
                    alt={server.name}
                    boxSize="28px"
                    style={{ borderRadius: "4px" }}
                  />
                }
              >
                <HStack>
                  {!server.isQueried && <BeatLoader size={6} color="gray" />}
                  {server.isQueried && server.online && (
                    <Text fontSize="xs-sm" color="gray.500">
                      {server.playersOnline === 0 && server.playersMax === 0
                        ? "???"
                        : `${server.playersOnline} / ${server.playersMax} ${t("InstanceWorldsPage.serverList.players")}`}
                    </Text>
                  )}
                  {server.isQueried && (
                    <Tag
                      colorScheme={
                        server.online
                          ? (server.latency || 0) < 300
                            ? "green"
                            : "yellow"
                          : "red"
                      }
                    >
                      <HStack spacing={0.5}>
                        {server.online ? (
                          <>
                            <LuCheck />
                            <TagLabel>
                              {server.latency != null
                                ? `${server.latency} ms`
                                : t("InstanceWorldsPage.serverList.tag.online")}
                            </TagLabel>
                          </>
                        ) : (
                          <>
                            <LuX />
                            <TagLabel>
                              {t("InstanceWorldsPage.serverList.tag.offline")}
                            </TagLabel>
                          </>
                        )}
                      </HStack>
                    </Tag>
                  )}
                  <HStack spacing={0}>
                    {serverItemMenuOperations(server).map((item, index) => (
                      <CommonIconButton
                        key={index}
                        icon={item.icon}
                        label={item.label}
                        colorScheme={item.danger ? "red" : "gray"}
                        onClick={item.onClick}
                      />
                    ))}
                  </HStack>
                </HStack>
              </OptionItem>
            ))}
          />
        ) : (
          <Empty withIcon={false} size="sm" />
        )}
      </Section>
      {!isManagedServer && instanceId && (
        <AddGameServerModal
          instanceId={instanceId}
          isOpen={isAddGameServerModalOpen}
          onClose={() => {
            onAddGameServerModalClose();
            refreshGameServerList();
          }}
        />
      )}
    </>
  );
};

export default InstanceWorldsPage;
