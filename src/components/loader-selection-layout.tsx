import {
  Center,
  HStack,
  RadioGroup,
  StackProps,
  VStack,
} from "@chakra-ui/react";
import { useEffect, useRef } from "react";
import { BeatLoader } from "react-spinners";
import Empty from "@/components/common/empty";
import {
  OptionItemProps,
  VirtualOptionItemGroup,
} from "@/components/common/option-item-virtual";
import { Section } from "@/components/common/section";
import SelectableCard, {
  SelectableCardProps,
} from "@/components/common/selectable-card";

interface LoaderSelectionLayoutProps extends Omit<StackProps, "children"> {
  cards: SelectableCardProps[];
  options?: OptionItemProps[];
  isLoading?: boolean;
  selectedId?: string;
  onSelectedIdChange?: (value: string) => void;
  emptyState?: React.ReactNode;
  panelContent?: React.ReactNode;
  selectedCardKey?: string;
}

export const LoaderSelectionLayout: React.FC<LoaderSelectionLayoutProps> = ({
  cards,
  options = [],
  isLoading = false,
  selectedId = "",
  onSelectedIdChange,
  emptyState,
  panelContent,
  selectedCardKey,
  ...props
}) => {
  const selectableCardListRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const list = selectableCardListRef.current;
    if (!list) return;

    const selectedCard = list.querySelector<HTMLElement>(
      '[data-loader-selected="true"]'
    );
    if (!selectedCard) return;

    const frame = requestAnimationFrame(() => {
      selectedCard.scrollIntoView({
        block: "nearest",
        inline: "nearest",
      });
    });

    return () => cancelAnimationFrame(frame);
  }, [cards.length, selectedCardKey]);

  return (
    <HStack
      w="100%"
      h="100%"
      spacing={4}
      overflow="hidden"
      align="stretch"
      {...props}
    >
      <VStack
        spacing={3.5}
        h="100%"
        overflowY="auto"
        overflowX="hidden"
        flexShrink={0}
        align="stretch"
        justify="flex-start"
        ref={selectableCardListRef}
      >
        {cards.map((card, index) => (
          <SelectableCard
            key={`${card.title}-${index}`}
            {...card}
            minW="3xs"
            w="100%"
            data-loader-selected={card.isSelected ? "true" : undefined}
          />
        ))}
      </VStack>
      <Section overflow="auto" flexGrow={1} w="100%" h="100%">
        {panelContent ? (
          panelContent
        ) : isLoading ? (
          <Center h="100%">
            <BeatLoader size={16} color="gray" />
          </Center>
        ) : options.length === 0 ? (
          <Center h="100%">
            {emptyState || <Empty withIcon={false} size="sm" />}
          </Center>
        ) : (
          <RadioGroup value={selectedId} onChange={onSelectedIdChange} h="100%">
            <VirtualOptionItemGroup h="100%" items={options} />
          </RadioGroup>
        )}
      </Section>
    </HStack>
  );
};
