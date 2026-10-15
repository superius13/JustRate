import { Pressable, View } from 'react-native';

import { colors } from '@/components/colors';
import { BackIcon, ChevronRightIcon, MinusIcon, PlusIcon } from '@/components/icons';
import { Text } from '@/components/ui/text';
import { compareMonths, currentMonth, monthLabel, shiftMonth, type MonthValue } from '@/lib/library';

function RoundButton({
  label,
  disabled,
  onPress,
  children,
}: {
  label: string;
  disabled?: boolean;
  onPress: () => void;
  children: React.ReactNode;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      hitSlop={6}
      className={`h-11 w-11 items-center justify-center rounded-full border border-outline-200 bg-background-50 active:bg-outline-100 ${
        disabled ? 'opacity-40' : ''
      }`}>
      {children}
    </Pressable>
  );
}

/** Big overall score from 1 to 10 with minus and plus buttons. */
export function OverallStepper({
  value,
  onChange,
  hint,
}: {
  value: number;
  onChange: (value: number) => void;
  hint: string;
}) {
  return (
    <View className="items-center gap-3.5 rounded-[14px] border border-outline-200 bg-background-0 px-4 py-5">
      <Text className="font-body-semibold text-sm uppercase tracking-[0.6px] text-typography-600">
        Общая оценка
      </Text>
      <View className="flex-row items-center gap-5">
        <RoundButton label="Уменьшить" disabled={value <= 1} onPress={() => onChange(value - 1)}>
          <MinusIcon color={colors.ink} />
        </RoundButton>
        <Text
          accessibilityRole="adjustable"
          accessibilityValue={{ min: 1, max: 10, now: value }}
          className="min-w-[70px] text-center font-heading text-[56px] leading-[64px] text-primary-500">
          {value}
        </Text>
        <RoundButton label="Увеличить" disabled={value >= 10} onPress={() => onChange(value + 1)}>
          <PlusIcon color={colors.ink} />
        </RoundButton>
      </View>
      <Text className="text-[13px] text-typography-600">{hint}</Text>
    </View>
  );
}

/** Ten tappable segments; tapping the current score again clears it. */
export function CriterionBar({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | undefined;
  onChange: (value: number | undefined) => void;
}) {
  return (
    <View className="gap-2">
      <View className="flex-row justify-between">
        <Text className="text-[15px] text-typography-900">{label}</Text>
        <Text className={`font-body-bold text-[15px] ${value ? 'text-primary-500' : 'text-typography-600'}`}>
          {value ?? '—'}
        </Text>
      </View>
      <View className="flex-row gap-1" accessibilityLabel={label}>
        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
          <Pressable
            key={n}
            onPress={() => onChange(n === value ? undefined : n)}
            accessibilityRole="button"
            accessibilityLabel={`${label}: ${n}`}
            hitSlop={{ top: 10, bottom: 10 }}
            className="flex-1 py-1">
            <View
              className="h-2.5 rounded-[3px]"
              style={{ backgroundColor: value !== undefined && n <= value ? colors.primary : colors.border }}
            />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

/** Month the title was watched or read, or "not remembered". */
export function MonthPicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: MonthValue | null;
  onChange: (value: MonthValue | null) => void;
}) {
  const atLatest = value !== null && compareMonths(value, currentMonth()) >= 0;

  return (
    <View className="gap-2">
      <View className="flex-row items-center justify-between">
        <Text className="text-sm text-typography-600">{label}</Text>
        {value === null ? (
          <Pressable onPress={() => onChange(currentMonth())} accessibilityRole="button" hitSlop={8}>
            <Text className="font-body-semibold text-sm text-primary-500">Указать месяц</Text>
          </Pressable>
        ) : (
          <View className="flex-row items-center gap-1">
            <Pressable
              onPress={() => onChange(shiftMonth(value, -1))}
              accessibilityRole="button"
              accessibilityLabel="Месяцем раньше"
              hitSlop={8}
              className="h-9 w-9 items-center justify-center active:opacity-60">
              <BackIcon color={colors.ink} size={18} />
            </Pressable>
            <Text className="min-w-[118px] text-center font-body-semibold text-sm text-typography-900">
              {monthLabel(value)}
            </Text>
            <Pressable
              onPress={() => onChange(shiftMonth(value, 1))}
              disabled={atLatest}
              accessibilityRole="button"
              accessibilityLabel="Месяцем позже"
              hitSlop={8}
              className={`h-9 w-9 items-center justify-center active:opacity-60 ${atLatest ? 'opacity-30' : ''}`}>
              <ChevronRightIcon color={colors.ink} size={18} />
            </Pressable>
          </View>
        )}
      </View>
      {value !== null && (
        <Pressable onPress={() => onChange(null)} accessibilityRole="button" hitSlop={6} className="self-end">
          <Text className="text-[13px] text-typography-600">Не помню</Text>
        </Pressable>
      )}
    </View>
  );
}
