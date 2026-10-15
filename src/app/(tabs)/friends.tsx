import { colors } from '@/components/colors';
import { FriendsIcon } from '@/components/icons';
import { Screen, TAB_EDGES } from '@/components/screen';
import { Heading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';

export default function FriendsScreen() {
  return (
    <Screen edges={TAB_EDGES}>
      <VStack className="gap-6">
        <Heading size="3xl">Друзья</Heading>
        <VStack className="items-center gap-3 rounded-[14px] border border-outline-200 bg-background-0 px-6 py-10">
          <FriendsIcon color={colors.muted} size={36} />
          <Text className="text-center font-body-semibold text-typography-900">Скоро здесь</Text>
          <Text className="text-center text-typography-600">
            Позже тут можно будет собрать группу с друзьями и видеть их оценки.
          </Text>
        </VStack>
      </VStack>
    </Screen>
  );
}
