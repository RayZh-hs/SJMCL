import {
  Box,
  Button,
  HStack,
  Icon,
  IconButton,
  Menu,
  MenuButton,
  MenuItemOption,
  MenuList,
  MenuOptionGroup,
  Text,
  Tooltip,
} from "@chakra-ui/react";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  LuArrowDown01,
  LuArrowDown10,
  LuArrowDownAZ,
  LuLayoutGrid,
  LuLayoutList,
  LuListFilter,
  LuPlay,
  LuPlus,
  LuServer,
  LuSquare,
} from "react-icons/lu";
import { CommonIconButton } from "@/components/common/common-icon-button";
import { Section } from "@/components/common/section";
import SegmentedControl from "@/components/common/segmented";
import InstancesView from "@/components/instances-view";
import { useLauncherConfig } from "@/contexts/config";
import { useGlobalData } from "@/contexts/global-data";
import { useSharedModals } from "@/contexts/shared-modal";
import { useToast } from "@/contexts/toast";
import { InstanceSummary } from "@/models/instance/misc";
import { GameServerService } from "@/services/game-server";
import { getGameDirName } from "@/utils/instance";
import { isServerInstance } from "@/utils/instance";

const getQueryString = (value: string | string[] | undefined): string => {
  if (Array.isArray(value)) return value[0] || "";
  return value || "";
};

const InstanceListPage = () => {
  const router = useRouter();
  const { t } = useTranslation();
  const { config, update } = useLauncherConfig();
  const primaryColor = config.appearance.theme.primaryColor;
  const selectedViewType = config.states.allInstancesPage.viewType;
  const selectedSortByType = config.states.allInstancesPage.sortBy;
  const toast = useToast();
  const dir = getQueryString(router.query.dir);
  const tag = getQueryString(router.query.tag);

  const { openSharedModal } = useSharedModals();
  const { selectedInstance, getInstanceList } = useGlobalData();
  const [instanceList, setInstanceList] = useState<InstanceSummary[]>([]);
  const [instanceCategory, setInstanceCategory] = useState<"client" | "server">(
    "client"
  );

  const filterInstances = useMemo(
    () => (all: InstanceSummary[]) => {
      if (tag) return all.filter((inst) => inst.tag === tag);
      if (dir) return all.filter((inst) => inst.id.startsWith(`${dir}:`));
      return all;
    },
    [dir, tag]
  );

  useEffect(() => {
    if (!router.isReady) return;
    setInstanceList(filterInstances(getInstanceList() || []));
  }, [filterInstances, getInstanceList, router.isReady]);

  useEffect(() => {
    if (selectedInstance) {
      setInstanceCategory(
        isServerInstance(selectedInstance) ? "server" : "client"
      );
    }
  }, [selectedInstance]);

  const visibleInstances = useMemo(
    () =>
      instanceList.filter((instance) =>
        instanceCategory === "server"
          ? isServerInstance(instance)
          : !isServerInstance(instance)
      ),
    [instanceCategory, instanceList]
  );

  const selectedVisibleInstance =
    selectedInstance &&
    visibleInstances.some((instance) => instance.id === selectedInstance.id)
      ? selectedInstance
      : visibleInstances[0];

  const title = useMemo(() => {
    if (tag) return t(`Enums.chakraColors.${tag}`);
    if (dir) return getGameDirName(dir);
    return t("AllInstancesPage.title");
  }, [dir, tag, t]);

  const viewTypeList = [
    {
      key: "grid",
      icon: LuLayoutGrid,
      tooltip: t("AllInstancesPage.viewTypeList.grid"),
    },
    {
      key: "list",
      icon: LuLayoutList,
      tooltip: t("AllInstancesPage.viewTypeList.list"),
    },
  ];

  const sortByTypeList = [
    {
      key: "versionAsc",
      icon: <LuArrowDown01 />,
    },
    {
      key: "versionDesc",
      icon: <LuArrowDown10 />,
    },
    {
      key: "name",
      icon: <LuArrowDownAZ />,
    },
  ];

  const FilterAndSortMenu = () => (
    <Menu>
      <Tooltip label={t("AllInstancesPage.button.sortAndFilter")}>
        <MenuButton
          as={IconButton}
          size="xs"
          fontSize="sm"
          variant="ghost"
          icon={<LuListFilter />}
        ></MenuButton>
      </Tooltip>
      <MenuList>
        <MenuOptionGroup
          title={t("AllInstancesPage.sortBy")}
          type="radio"
          value={selectedSortByType}
          onChange={(s) => {
            update("states.allInstancesPage.sortBy", s as string);
            getInstanceList(true);
          }}
        >
          {sortByTypeList.map((item) => (
            <MenuItemOption key={item.key} value={item.key} fontSize="xs">
              <HStack spacing={2}>
                {item.icon}
                <Text>{t(`AllInstancesPage.sortByTypeList.${item.key}`)}</Text>
              </HStack>
            </MenuItemOption>
          ))}
        </MenuOptionGroup>
      </MenuList>
    </Menu>
  );

  return (
    <Section
      display="flex"
      flexDirection="column"
      height="100%"
      title={title}
      headExtra={
        <HStack spacing={2}>
          <CommonIconButton
            icon="refresh"
            size="xs"
            fontSize="sm"
            onClick={() => {
              setInstanceList(filterInstances(getInstanceList(true) || []));
            }}
          />
          <FilterAndSortMenu />
          <SegmentedControl
            selected={instanceCategory}
            onSelectItem={(value) =>
              setInstanceCategory(value as "client" | "server")
            }
            size="xs"
            items={[
              {
                value: "client",
                label: (
                  <HStack spacing={1}>
                    <LuPlay />
                    <Text fontSize="xs">Clients</Text>
                  </HStack>
                ),
              },
              {
                value: "server",
                label: (
                  <HStack spacing={1}>
                    <LuServer />
                    <Text fontSize="xs">Servers</Text>
                  </HStack>
                ),
              },
            ]}
          />
          <SegmentedControl
            selected={selectedViewType}
            onSelectItem={(s) => {
              update("states.allInstancesPage.viewType", s as string);
            }}
            size="2xs"
            ml={1}
            items={viewTypeList.map((item) => ({
              ...item,
              value: item.key,
              label: <Icon as={item.icon} />,
            }))}
            withTooltip
          />
          <Button
            leftIcon={<LuPlus />}
            size="xs"
            colorScheme={primaryColor}
            variant={primaryColor === "gray" ? "subtle" : "outline"}
            onClick={() => {
              router.push("/instances/add-import");
            }}
          >
            {t("AllInstancesPage.button.addAndImport")}
          </Button>
          <Button
            leftIcon={instanceCategory === "server" ? <LuSquare /> : <LuPlay />}
            size="xs"
            colorScheme={primaryColor}
            isDisabled={!selectedVisibleInstance}
            onClick={async () => {
              if (!selectedVisibleInstance) return;
              if (instanceCategory === "server") {
                const status =
                  await GameServerService.retrieveManagedGameServer(
                    selectedVisibleInstance.id
                  );
                if (status.status !== "success") {
                  toast({
                    title: status.message,
                    description: status.details,
                    status: "error",
                  });
                  return;
                }
                const response = status.data.running
                  ? await GameServerService.stopManagedGameServer(
                      selectedVisibleInstance.id
                    )
                  : await GameServerService.startManagedGameServer(
                      selectedVisibleInstance.id
                    );
                if (response.status !== "success") {
                  toast({
                    title: response.message,
                    description: response.details,
                    status: "error",
                  });
                }
              } else {
                openSharedModal("launch", {
                  instanceId: selectedVisibleInstance.id,
                });
              }
            }}
          >
            {instanceCategory === "server"
              ? "Power"
              : t("AllInstancesPage.button.launch")}
          </Button>
        </HStack>
      }
    >
      <Box overflow="auto" flexGrow={1} rounded="md">
        <InstancesView
          instances={visibleInstances}
          selectedInstance={selectedVisibleInstance}
          viewType={selectedViewType}
        />
      </Box>
    </Section>
  );
};

export default InstanceListPage;
