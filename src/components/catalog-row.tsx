import { ActivityIndicator, Pressable, View } from 'react-native';

import { colors } from '@/components/colors';
import { Poster } from '@/components/poster';
import { Text } from '@/components/ui/text';
import type { CatalogItem } from '@/lib/catalog';
import { KIND_LABELS } from '@/lib/library';

export function CatalogRow({
  item,
  busy,
  disabled,
  onPress,
}: {
  item: CatalogItem;
  busy: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  const meta = [KIND_LABELS[item.kind], item.creator ?? item.original_name, item.year]
    .filter(Boolean)
    .join(' · ');

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={`${item.name}, ${meta}`}
      className="flex-row items-center gap-3.5 border-b border-outline-100 py-3 active:opacity-70">
      <Poster id={`${item.source}:${item.external_id}`} url={item.poster_url} />
      <View className="min-w-0 flex-1 gap-1">
        <Text className="font-heading-semibold text-[17px] leading-[22px] text-typography-900" numberOfLines={2}>
          {item.name}
        </Text>
        <Text className="text-[13px] text-typography-600" numberOfLines={2}>
          {meta}
        </Text>
      </View>
      {busy && <ActivityIndicator color={colors.primary} />}
    </Pressable>
  );
}
