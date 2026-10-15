import { Screen, TAB_EDGES } from '@/components/screen';
import { Button, ButtonText } from '@/components/ui/button';
import { Heading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { useAuth } from '@/lib/auth';

export default function ProfileScreen() {
  const { profile, session, signOut } = useAuth();

  return (
    <Screen edges={TAB_EDGES}>
      <VStack className="flex-1 justify-between gap-8">
        <VStack className="gap-6">
          <Heading size="3xl">Профиль</Heading>
          <VStack className="gap-1 rounded-[14px] border border-outline-200 bg-background-0 p-4">
            <Text className="text-sm text-typography-600">Имя</Text>
            <Text className="font-body-semibold text-lg text-typography-900">
              {profile?.display_name}
            </Text>
            <Text className="mt-3 text-sm text-typography-600">Почта</Text>
            <Text className="text-typography-900">{session?.user.email}</Text>
          </VStack>
        </VStack>

        <Button
          variant="outline"
          size="xl"
          className="h-[52px] rounded-xl border-outline-300"
          onPress={signOut}>
          <ButtonText className="font-body-semibold text-typography-900">Выйти</ButtonText>
        </Button>
      </VStack>
    </Screen>
  );
}
