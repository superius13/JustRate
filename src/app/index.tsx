import { Screen } from '@/components/screen';
import { Button, ButtonText } from '@/components/ui/button';
import { Heading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { useAuth } from '@/lib/auth';

export default function HomeScreen() {
  const { profile, session, signOut } = useAuth();

  return (
    <Screen>
      <VStack className="flex-1 justify-between gap-8">
        <VStack className="gap-2 pt-6">
          <Text className="text-typography-600">{session?.user.email}</Text>
          <Heading size="3xl">Привет, {profile?.display_name}</Heading>
          <Text className="text-typography-700">
            Здесь появится твоя полка с фильмами, сериалами и книгами.
          </Text>
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
