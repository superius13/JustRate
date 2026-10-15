import { Pressable, View } from 'react-native';

import { Text } from '@/components/ui/text';

/** A row of pill buttons where exactly one option is picked. */
export function ChoiceChips<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <View className="flex-row flex-wrap gap-2" accessibilityRole="radiogroup">
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            accessibilityRole="radio"
            accessibilityState={{ checked: active }}
            className={`h-10 justify-center rounded-full border px-4 ${
              active ? 'border-primary-500 bg-primary-500' : 'border-outline-200 bg-background-0'
            }`}>
            <Text className={`font-body-semibold text-sm ${active ? 'text-typography-0' : 'text-typography-700'}`}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
