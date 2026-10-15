import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

import { colors } from '@/components/colors';
import { BackIcon } from '@/components/icons';
import { Text } from '@/components/ui/text';

/** Back arrow with the name of the screen it returns to, as on the mockups. */
export function BackHeader({ label }: { label: string }) {
  return (
    <View className="-ml-3 -mt-2 flex-row items-center">
      <Pressable
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        accessibilityRole="button"
        accessibilityLabel="Назад"
        hitSlop={8}
        className="h-11 flex-row items-center gap-1 pl-2 pr-3 active:opacity-60">
        <BackIcon color={colors.ink} />
        <Text className="text-sm text-typography-600">{label}</Text>
      </Pressable>
    </View>
  );
}
