import {
  Box,
  Button,
  Card,
  Center,
  HStack,
  IconButton,
  IconButtonProps,
  Popover,
  PopoverBody,
  PopoverContent,
  PopoverTrigger,
  Switch,
  Text,
  Tooltip,
  VStack,
  useColorModeValue,
  useDisclosure,
} from "@chakra-ui/react";
import { useRouter } from "next/router";
import { cloneElement, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  LuArrowLeftRight,
  LuPlay,
  LuPlus,
  LuServer,
  LuSettings,
  LuSquare,
} from "react-icons/lu";
import { CommonIconButton } from "@/components/common/common-icon-button";
import { CompactButtonGroup } from "@/components/common/compact-button-group";
import SegmentedControl from "@/components/common/segmented";
import InstancesView from "@/components/instances-view";
import PlayerAvatar from "@/components/player-avatar";
import PlayersView from "@/components/players-view";
import { useLauncherConfig } from "@/contexts/config";
import { useGlobalData } from "@/contexts/global-data";
import { useSharedModals } from "@/contexts/shared-modal";
import { useToast } from "@/contexts/toast";
import { PlayerType } from "@/enums/account";
import { Player } from "@/models/account";
import { InstanceSummary } from "@/models/instance/misc";
import { GameServerService } from "@/services/game-server";
import cardStyles from "@/styles/card.module.css";
import styles from "@/styles/launch.module.css";
import { isServerInstance } from "@/utils/instance";

interface CustomButtonProps extends Omit<IconButtonProps, "onClick"> {
  tooltip: string;
  onClick: () => void;
  popoverContent: React.ReactElement;
  showAdd?: boolean;
  onAddClick?: () => void;
}

const ButtonWithPopover: React.FC<CustomButtonProps> = ({
  tooltip,
  popoverContent,
  onClick,
  showAdd = false,
  onAddClick,
  ...props
}) => {
  const { config } = useLauncherConfig();
  const quickSwitch = config.general.functionality.launchPageQuickSwitch;
  const { isOpen, onToggle, onClose } = useDisclosure();

  const [tooltipDisabled, setTooltipDisabled] = useState(false);

  // To use Popover and Tooltip together, refer to: https://github.com/chakra-ui/chakra-ui/issues/2843
  // However, when the Popover is closed, the Tooltip will wrongly show again.
  // To prevent this, we temporarily disable the Tooltip using a timeout.
  const handleClose = () => {
    setTooltipDisabled(true);
    onClose();
    setTimeout(() => setTooltipDisabled(false), 200);
  };

  return (
    <Popover
      isOpen={showAdd ? false : isOpen}
      onClose={handleClose}
      placement="top-end"
      gutter={12} // add more gutter to show clear space from the launch button's shadow
    >
      <Tooltip label={tooltip} placement="top-end" isDisabled={tooltipDisabled}>
        <Box lineHeight={0}>
          {/* anchor for Tooltip */}
          <PopoverTrigger>
            <IconButton
              size="xs"
              icon={showAdd ? <LuPlus /> : <LuArrowLeftRight />}
              {...props}
              onClick={() => {
                if (showAdd) return (onAddClick ?? onClick)();
                quickSwitch ? onToggle() : onClick();
              }}
            />
          </PopoverTrigger>
        </Box>
      </Tooltip>

      {!showAdd && (
        <PopoverContent maxH="3xs" overflow="auto">
          <PopoverBody p={0}>
            {cloneElement(popoverContent, {
              // Delay close after selecting an item for better UX.
              onSelectCallback: () => setTimeout(handleClose, 100),
            })}
          </PopoverBody>
        </PopoverContent>
      )}
    </Popover>
  );
};

const LaunchPage = () => {
  const { t } = useTranslation();
  const router = useRouter();
  const { openSharedModal } = useSharedModals();
  const toast = useToast();

  const { selectedPlayer, getPlayerList, getInstanceList, selectedInstance } =
    useGlobalData();

  const [playerList, setPlayerList] = useState<Player[]>([]);
  const [instanceList, setInstanceList] = useState<InstanceSummary[]>([]);
  const [launchTarget, setLaunchTarget] = useState<"client" | "server">(
    "client"
  );
  const [serverStatus, setServerStatus] = useState<{
    running: boolean;
    canStop: boolean;
    eulaAccepted: boolean;
    autoAcceptEula: boolean;
  }>();
  const [isServerActionLoading, setIsServerActionLoading] = useState(false);

  useEffect(() => {
    setPlayerList(getPlayerList() || []);
  }, [getPlayerList]);

  useEffect(() => {
    setInstanceList(getInstanceList() || []);
  }, [getInstanceList]);

  const clientInstances = useMemo(
    () => instanceList.filter((instance) => !isServerInstance(instance)),
    [instanceList]
  );
  const serverInstances = useMemo(
    () => instanceList.filter((instance) => isServerInstance(instance)),
    [instanceList]
  );

  useEffect(() => {
    if (selectedInstance) {
      setLaunchTarget(isServerInstance(selectedInstance) ? "server" : "client");
      return;
    }
    if (clientInstances.length > 0) {
      setLaunchTarget("client");
    } else if (serverInstances.length > 0) {
      setLaunchTarget("server");
    }
  }, [clientInstances.length, selectedInstance, serverInstances.length]);

  const selectedLaunchInstance = useMemo(() => {
    const filtered =
      launchTarget === "server" ? serverInstances : clientInstances;
    if (
      selectedInstance &&
      filtered.some((item) => item.id === selectedInstance.id)
    ) {
      return selectedInstance;
    }
    return filtered[0];
  }, [clientInstances, launchTarget, selectedInstance, serverInstances]);

  useEffect(() => {
    if (
      launchTarget !== "server" ||
      !selectedLaunchInstance ||
      !isServerInstance(selectedLaunchInstance)
    ) {
      setServerStatus(undefined);
      return;
    }

    GameServerService.retrieveManagedGameServer(selectedLaunchInstance.id).then(
      (response) => {
        if (response.status === "success") {
          setServerStatus({
            running: response.data.running,
            canStop: response.data.canStop,
            eulaAccepted: response.data.eulaAccepted,
            autoAcceptEula: response.data.config.autoAcceptEula,
          });
        } else {
          setServerStatus(undefined);
          toast({
            title: response.message,
            description: response.details,
            status: "error",
          });
        }
      }
    );
  }, [launchTarget, selectedLaunchInstance, toast]);

  const hasPlayers = playerList.length > 0;
  const visibleInstances =
    launchTarget === "server" ? serverInstances : clientInstances;
  const hasInstances = visibleInstances.length > 0;

  const refreshServerStatus = () => {
    if (!selectedLaunchInstance || !isServerInstance(selectedLaunchInstance))
      return;
    GameServerService.retrieveManagedGameServer(selectedLaunchInstance.id).then(
      (response) => {
        if (response.status === "success") {
          setServerStatus({
            running: response.data.running,
            canStop: response.data.canStop,
            eulaAccepted: response.data.eulaAccepted,
            autoAcceptEula: response.data.config.autoAcceptEula,
          });
        }
      }
    );
  };

  const handleServerPowerAction = async () => {
    if (!selectedLaunchInstance || !isServerInstance(selectedLaunchInstance))
      return;

    setIsServerActionLoading(true);
    const response = !serverStatus?.eulaAccepted
      ? await GameServerService.setManagedGameServerEula(
          selectedLaunchInstance.id,
          true,
          serverStatus?.autoAcceptEula
        )
      : serverStatus?.running
        ? await GameServerService.stopManagedGameServer(
            selectedLaunchInstance.id
          )
        : await GameServerService.startManagedGameServer(
            selectedLaunchInstance.id
          );
    setIsServerActionLoading(false);

    if (response.status === "success") {
      refreshServerStatus();
    } else {
      toast({
        title: response.message,
        description: response.details,
        status: "error",
      });
    }
  };

  return (
    <HStack position="absolute" bottom={7} right={7} spacing={4}>
      {launchTarget === "client" ? (
        <Card
          className={
            styles["selected-user-card"] + " " + cardStyles["card-back"]
          }
        >
          <Box position="absolute" top={1} right={1}>
            <ButtonWithPopover
              tooltip={t(
                `LaunchPage.SwitchButton.tooltip.${hasPlayers ? "switchPlayer" : "addPlayer"}`
              )}
              aria-label="player"
              variant="subtle"
              popoverContent={
                <PlayersView
                  players={playerList}
                  selectedPlayer={selectedPlayer}
                  viewType="list"
                  withMenu={false}
                />
              }
              onClick={() => router.push("/accounts")}
              showAdd={!hasPlayers}
              onAddClick={() => router.push("/accounts?add=true")}
            />
          </Box>

          <HStack spacing={2.5} h="100%" w="100%">
            {selectedPlayer ? (
              <>
                <PlayerAvatar
                  boxSize="32px"
                  objectFit="cover"
                  avatar={selectedPlayer.avatar}
                />
                <VStack spacing={0} align="left" mt={-2} minW={0}>
                  <Text
                    fontSize="xs-sm"
                    fontWeight="bold"
                    maxW="100%"
                    mt={2}
                    isTruncated
                  >
                    {selectedPlayer.name}
                  </Text>
                  <Text fontSize="2xs" className="secondary-text">
                    {t(
                      `Enums.playerTypes.${selectedPlayer.playerType === PlayerType.ThirdParty ? "3rdpartyShort" : selectedPlayer.playerType}`
                    )}
                  </Text>
                  <Text fontSize="2xs" className="secondary-text">
                    {selectedPlayer.playerType === PlayerType.ThirdParty &&
                      selectedPlayer.authServer?.name}
                  </Text>
                </VStack>
              </>
            ) : (
              <Center w="100%" h="100%">
                <Text fontSize="sm" className="secondary-text">
                  {t("LaunchPage.Text.noSelectedPlayer")}
                </Text>
              </Center>
            )}
          </HStack>
        </Card>
      ) : (
        <Card
          className={
            styles["selected-user-card"] + " " + cardStyles["card-back"]
          }
        >
          <VStack align="stretch" spacing={1.5} h="100%" justify="center">
            <HStack spacing={2}>
              <LuServer />
              <Text fontSize="sm" fontWeight="bold" isTruncated>
                {selectedLaunchInstance?.name || "No selected server"}
              </Text>
            </HStack>
            <Text fontSize="xs" className="secondary-text">
              {serverStatus?.running
                ? "Server is running"
                : serverStatus?.eulaAccepted
                  ? "Ready to start"
                  : "EULA agreement required"}
            </Text>
            <HStack justify="space-between" pt={1}>
              <Text fontSize="2xs" className="secondary-text">
                Auto-sign EULA
              </Text>
              <Switch
                size="sm"
                isChecked={serverStatus?.autoAcceptEula || false}
                onChange={async (event) => {
                  if (
                    !selectedLaunchInstance ||
                    !isServerInstance(selectedLaunchInstance)
                  ) {
                    return;
                  }
                  const response =
                    await GameServerService.setManagedGameServerEula(
                      selectedLaunchInstance.id,
                      serverStatus?.eulaAccepted || false,
                      event.target.checked
                    );
                  if (response.status === "success") {
                    setServerStatus((prev) =>
                      prev
                        ? { ...prev, autoAcceptEula: event.target.checked }
                        : prev
                    );
                  }
                }}
              />
            </HStack>
          </VStack>
        </Card>
      )}

      <Box position="relative">
        <Button
          id="main-launch-button"
          colorScheme="blackAlpha"
          className={styles["launch-button"]}
          onClick={() => {
            if (launchTarget === "client" && selectedLaunchInstance) {
              openSharedModal("launch", {
                instanceId: selectedLaunchInstance.id,
              });
            } else if (launchTarget === "server") {
              handleServerPowerAction();
            }
          }}
          isLoading={isServerActionLoading}
          isDisabled={!selectedLaunchInstance}
        >
          <VStack spacing={1.5} w="100%" color="white">
            <Text fontSize="lg" fontWeight="bold">
              {launchTarget === "client"
                ? t("LaunchPage.button.launch")
                : !serverStatus?.eulaAccepted
                  ? "Agree to EULA"
                  : serverStatus?.running
                    ? "Stop Server"
                    : "Start Server"}
            </Text>
            <Text fontSize="sm" className="ellipsis-text">
              {selectedLaunchInstance
                ? selectedLaunchInstance.name
                : launchTarget === "client"
                  ? t("LaunchPage.Text.noSelectedGame")
                  : "No selected server"}
            </Text>
          </VStack>
        </Button>

        <Box position="absolute" top={1} right={1}>
          <CompactButtonGroup
            colorScheme={useColorModeValue("blackAlpha", "gray")}
            size="xs"
          >
            {selectedLaunchInstance && hasInstances && (
              <CommonIconButton
                icon={launchTarget === "client" ? LuSettings : LuServer}
                label={
                  launchTarget === "client"
                    ? t("LaunchPage.button.instanceSettings")
                    : "Server settings"
                }
                tooltipPlacement="top"
                onClick={() =>
                  router.push(
                    `/instances/details/${encodeURIComponent(
                      selectedLaunchInstance.id
                    )}/${launchTarget === "client" ? "settings" : "settings"}`
                  )
                }
              />
            )}

            <ButtonWithPopover
              tooltip={t(
                `LaunchPage.SwitchButton.tooltip.${hasInstances ? "switchInstance" : "addInstance"}`
              )}
              aria-label="instance"
              popoverContent={
                <InstancesView
                  instances={visibleInstances}
                  selectedInstance={selectedLaunchInstance}
                  viewType="list"
                  withMenu={false}
                />
              }
              onClick={() => router.push("/instances/list")}
              showAdd={!hasInstances}
              onAddClick={() => router.push("/instances/add-import")}
            />
          </CompactButtonGroup>
        </Box>
        <Box position="absolute" top={1} left={1}>
          <SegmentedControl
            size="2xs"
            colorScheme={useColorModeValue("blackAlpha", "gray")}
            selected={launchTarget}
            onSelectItem={(value) =>
              setLaunchTarget(value as "client" | "server")
            }
            items={[
              {
                value: "client",
                label: <LuPlay />,
                tooltip: "Client instances",
              },
              {
                value: "server",
                label: <LuSquare />,
                tooltip: "Managed servers",
              },
            ]}
            withTooltip
          />
        </Box>
      </Box>
    </HStack>
  );
};

export default LaunchPage;
