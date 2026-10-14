import { useState } from 'react';

import { Screen } from '@/components/screen';
import { Button, ButtonSpinner, ButtonText } from '@/components/ui/button';
import {
  FormControl,
  FormControlError,
  FormControlErrorText,
  FormControlLabel,
  FormControlLabelText,
} from '@/components/ui/form-control';
import { Heading } from '@/components/ui/heading';
import { Input, InputField } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { useAuth } from '@/lib/auth';
import { describeAuthError } from '@/lib/auth-errors';

const MAX_NAME_LENGTH = 40;

export default function ProfileSetupScreen() {
  const { saveDisplayName, signOut } = useAuth();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmed = name.trim();
  const canSubmit = trimmed.length > 0 && !busy;

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await saveDisplayName(trimmed);
    } catch (e) {
      setError(describeAuthError(e));
      setBusy(false);
    }
  }

  return (
    <Screen>
      <VStack className="flex-1 justify-center gap-8">
        <VStack className="gap-2">
          <Heading size="2xl">Как тебя зовут?</Heading>
          <Text className="text-typography-700">
            Это имя друзья увидят рядом с твоими оценками. Его можно будет поменять.
          </Text>
        </VStack>

        <FormControl isInvalid={error !== null}>
          <FormControlLabel>
            <FormControlLabelText className="font-body-medium">Имя</FormControlLabelText>
          </FormControlLabel>
          <Input size="xl" className="rounded-[10px] border-outline-200 bg-background-0">
            <InputField
              value={name}
              onChangeText={setName}
              placeholder="Например, Женя"
              maxLength={MAX_NAME_LENGTH}
              autoComplete="name"
              textContentType="givenName"
              onSubmitEditing={canSubmit ? submit : undefined}
              className="font-body"
            />
          </Input>
          <FormControlError>
            <FormControlErrorText>{error}</FormControlErrorText>
          </FormControlError>
        </FormControl>

        <VStack className="gap-3">
          <Button size="xl" className="h-[52px] rounded-xl" onPress={submit} isDisabled={!canSubmit}>
            {busy && <ButtonSpinner color="white" />}
            <ButtonText className="font-body-semibold">Продолжить</ButtonText>
          </Button>
          <Button variant="link" onPress={signOut} isDisabled={busy}>
            <ButtonText className="font-body-medium text-typography-600">Выйти</ButtonText>
          </Button>
        </VStack>
      </VStack>
    </Screen>
  );
}
