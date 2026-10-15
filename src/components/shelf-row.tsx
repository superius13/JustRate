import { Pressable, View } from 'react-native';

import { Poster } from '@/components/poster';
import { Text } from '@/components/ui/text';
import { formatScore, titleMeta, type ShelfItem } from '@/lib/library';

export function ShelfRow({ item, onPress }: { item: ShelfItem; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${item.title.name}, оценка ${formatScore(item.overall)}`}
      className="flex-row items-center gap-3.5 border-b border-outline-100 py-3 active:opacity-70">
      <Poster id={item.title.id} url={item.title.poster_url} />
      <View className="min-w-0 flex-1 gap-1">
        <Text className="font-heading-semibold text-[17px] leading-[22px] text-typography-900" numberOfLines={2}>
          {item.title.name}
        </Text>
        <Text className="text-[13px] text-typography-600" numberOfLines={1}>
          {titleMeta(item.title)}
        </Text>
      </View>
      <View className="h-12 w-12 items-center justify-center rounded-[10px] bg-primary-50">
        <Text className="font-body-bold text-xl text-primary-500">{formatScore(item.overall)}</Text>
      </View>
    </Pressable>
  );
}
