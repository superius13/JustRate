import { Image } from 'expo-image';
import { useState } from 'react';

import { Screen } from '@/components/screen';
import { Button, ButtonSpinner, ButtonText } from '@/components/ui/button';
import {
  FormControl,
  FormControlError,
  FormControlErrorText,
  FormControlHelper,
  FormControlHelperText,
  FormControlLabel,
  FormControlLabelText,
} from '@/components/ui/form-control';
import { Heading } from '@/components/ui/heading';
import { Input, InputField } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { useAuth } from '@/lib/auth';
import { describeAuthError } from '@/lib/auth-errors';
import { isSupabaseConfigured } from '@/lib/supabase';

type Mode = 'sign-in' | 'sign-up';

const MIN_PASSWORD_LENGTH = 6;

export default function SignInScreen() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<Mode>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isSignUp = mode === 'sign-up';
  const canSubmit = email.trim().length > 3 && password.length >= MIN_PASSWORD_LENGTH && !busy;

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      if (isSignUp) await signUp(email.trim(), password);
      else await signIn(email.trim(), password);
    } catch (e) {
      setError(describeAuthError(e));
    } finally {
      setBusy(false);
    }
  }

  function switchMode() {
    setMode(isSignUp ? 'sign-in' : 'sign-up');
    setError(null);
  }

  return (
    <Screen>
      <VStack className="flex-1 justify-center gap-8">
        <VStack className="gap-2">
          <Image
            source={require('@/assets/images/splash-icon.png')}
            style={{ width: 88, height: 88, marginLeft: -12, marginBottom: 4 }}
            accessibilityIgnoresInvertColors
          />
          <Text className="text-typography-600">Фильмы, сериалы и книги</Text>
          <Heading size="3xl">JustRate</Heading>
          <Text className="text-typography-700">
            {isSignUp
              ? 'Создай аккаунт, чтобы вести свою полку и видеть оценки друзей.'
              : 'Войди, чтобы открыть свою полку.'}
          </Text>
        </VStack>

        {!isSupabaseConfigured && (
          <Text className="rounded-lg bg-background-warning p-3 text-typography-900">
            Приложение ещё не подключено к базе данных. Войти пока не получится.
          </Text>
        )}

        <VStack className="gap-5">
          <FormControl>
            <FormControlLabel>
              <FormControlLabelText className="font-body-medium">Почта</FormControlLabelText>
            </FormControlLabel>
            <Input size="xl" className="rounded-[10px] border-outline-200 bg-background-0">
              <InputField
                value={email}
                onChangeText={setEmail}
                placeholder="name@example.com"
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                textContentType="emailAddress"
                className="font-body"
              />
            </Input>
          </FormControl>

          <FormControl isInvalid={error !== null}>
            <FormControlLabel>
              <FormControlLabelText className="font-body-medium">Пароль</FormControlLabelText>
            </FormControlLabel>
            <Input size="xl" className="rounded-[10px] border-outline-200 bg-background-0">
              <InputField
                value={password}
                onChangeText={setPassword}
                placeholder="Не меньше 6 символов"
                secureTextEntry
                autoCapitalize="none"
                autoComplete={isSignUp ? 'new-password' : 'current-password'}
                textContentType={isSignUp ? 'newPassword' : 'password'}
                onSubmitEditing={canSubmit ? submit : undefined}
                className="font-body"
              />
            </Input>
            {isSignUp && error === null && (
              <FormControlHelper>
                <FormControlHelperText>Запомни его: восстановить по почте пока нельзя.</FormControlHelperText>
              </FormControlHelper>
            )}
            <FormControlError>
              <FormControlErrorText>{error}</FormControlErrorText>
            </FormControlError>
          </FormControl>

          <Button size="xl" className="h-[52px] rounded-xl" onPress={submit} isDisabled={!canSubmit}>
            {busy && <ButtonSpinner color="white" />}
            <ButtonText className="font-body-semibold">
              {isSignUp ? 'Создать аккаунт' : 'Войти'}
            </ButtonText>
          </Button>

          <Button variant="link" onPress={switchMode} isDisabled={busy}>
            <ButtonText className="font-body-medium text-primary-500">
              {isSignUp ? 'Уже есть аккаунт? Войти' : 'Нет аккаунта? Создать'}
            </ButtonText>
          </Button>
        </VStack>
      </VStack>
    </Screen>
  );
}
