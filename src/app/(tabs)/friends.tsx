import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Share, View } from 'react-native';

import { colors } from '@/components/colors';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { FriendsIcon } from '@/components/icons';
import { Screen, TAB_EDGES } from '@/components/screen';
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
import {
  createGroup,
  fetchGroupMembers,
  fetchMyGroup,
  InvalidInviteCodeError,
  joinGroup,
  leaveGroup,
  type Group,
  type GroupMember,
} from '@/lib/friends';

const MAX_GROUP_NAME_LENGTH = 60;
const INVITE_CODE_LENGTH = 6;

type Loaded = { group: Group | null; members: GroupMember[] };

export default function FriendsScreen() {
  const { session } = useAuth();
  const userId = session?.user.id;
  const [state, setState] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!userId) return;
    try {
      const group = await fetchMyGroup(userId);
      const members = group ? await fetchGroupMembers(group.id) : [];
      setState({ group, members });
      setError(null);
    } catch (e) {
      setError(describeAuthError(e));
    }
  }, [userId]);

  // Reload on every visit so a friend who just joined shows up.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  let body;
  if (state === null) {
    body = error ? (
      <VStack className="items-center gap-3 py-10">
        <Text className="text-center text-typography-700">{error}</Text>
        <Button variant="link" onPress={load}>
          <ButtonText className="font-body-semibold text-primary-500">Повторить</ButtonText>
        </Button>
      </VStack>
    ) : (
      <View className="items-center py-16">
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  } else if (state.group && userId) {
    body = <GroupView group={state.group} members={state.members} userId={userId} onLeft={load} />;
  } else {
    body = <NoGroup onJoined={load} />;
  }

  return (
    <Screen edges={TAB_EDGES}>
      <VStack className="gap-6">
        <Heading size="3xl">Друзья</Heading>
        {body}
      </VStack>
    </Screen>
  );
}

function NoGroup({ onJoined }: { onJoined: () => Promise<void> }) {
  const [mode, setMode] = useState<'create' | 'join' | null>(null);
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmed = value.trim();
  const canSubmit =
    !busy && (mode === 'join' ? trimmed.length === INVITE_CODE_LENGTH : trimmed.length > 0);

  function open(next: 'create' | 'join') {
    setMode(next);
    setValue('');
    setError(null);
  }

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      if (mode === 'create') await createGroup(trimmed);
      else await joinGroup(trimmed);
      await onJoined();
    } catch (e) {
      setError(
        e instanceof InvalidInviteCodeError
          ? 'Нет группы с таким кодом. Проверь буквы и цифры.'
          : describeAuthError(e),
      );
      setBusy(false);
    }
  }

  return (
    <VStack className="gap-6">
      <VStack className="items-center gap-3 rounded-[14px] border border-outline-200 bg-background-0 px-6 py-8">
        <FriendsIcon color={colors.muted} size={36} />
        <Text className="text-center font-body-semibold text-typography-900">Ты пока не в группе</Text>
        <Text className="text-center text-typography-600">
          Создай группу и отправь код друзьям, или войди в группу по коду от друга. В группе вы видите
          оценки друг друга.
        </Text>
      </VStack>

      {mode === null ? (
        <VStack className="gap-3">
          <Button size="xl" className="h-[52px] rounded-xl" onPress={() => open('create')}>
            <ButtonText className="font-body-semibold">Создать группу</ButtonText>
          </Button>
          <Button
            variant="outline"
            size="xl"
            className="h-[52px] rounded-xl border-outline-300"
            onPress={() => open('join')}>
            <ButtonText className="font-body-semibold text-typography-900">Войти по коду</ButtonText>
          </Button>
        </VStack>
      ) : (
        <VStack className="gap-5">
          <FormControl isInvalid={error !== null}>
            <FormControlLabel>
              <FormControlLabelText className="font-body-medium">
                {mode === 'create' ? 'Название группы' : 'Код приглашения'}
              </FormControlLabelText>
            </FormControlLabel>
            <Input size="xl" className="rounded-[10px] border-outline-200 bg-background-0">
              {mode === 'create' ? (
                <InputField
                  value={value}
                  onChangeText={setValue}
                  placeholder="Например, Киноклуб"
                  maxLength={MAX_GROUP_NAME_LENGTH}
                  autoFocus
                  onSubmitEditing={canSubmit ? submit : undefined}
                  className="font-body"
                />
              ) : (
                <InputField
                  value={value}
                  onChangeText={(text) => setValue(text.toUpperCase().replace(/[^0-9A-Z]/g, ''))}
                  placeholder="6 знаков, например A1B2C3"
                  maxLength={INVITE_CODE_LENGTH}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  autoFocus
                  onSubmitEditing={canSubmit ? submit : undefined}
                  className="font-body tracking-widest"
                />
              )}
            </Input>
            <FormControlError>
              <FormControlErrorText>{error}</FormControlErrorText>
            </FormControlError>
          </FormControl>

          <VStack className="gap-2">
            <Button size="xl" className="h-[52px] rounded-xl" onPress={submit} isDisabled={!canSubmit}>
              {busy && <ButtonSpinner color="white" />}
              <ButtonText className="font-body-semibold">
                {mode === 'create' ? 'Создать' : 'Войти'}
              </ButtonText>
            </Button>
            <Button variant="link" onPress={() => setMode(null)} isDisabled={busy}>
              <ButtonText className="font-body-medium text-typography-600">Отмена</ButtonText>
            </Button>
          </VStack>
        </VStack>
      )}
    </VStack>
  );
}

function GroupView({
  group,
  members,
  userId,
  onLeft,
}: {
  group: Group;
  members: GroupMember[];
  userId: string;
  onLeft: () => Promise<void>;
}) {
  const [leaving, setLeaving] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function share() {
    Share.share({
      message: `Заходи в мою группу «${group.name}» в JustRate, чтобы видеть оценки друг друга. Код приглашения: ${group.invite_code}`,
    }).catch(() => {});
  }

  async function leave() {
    setConfirming(false);
    setLeaving(true);
    setError(null);
    try {
      await leaveGroup(userId, group.id);
      await onLeft();
    } catch (e) {
      setError(describeAuthError(e));
      setLeaving(false);
    }
  }

  return (
    <VStack className="gap-6">
      <VStack className="gap-4 rounded-[14px] border border-outline-200 bg-background-0 p-4">
        <VStack className="gap-0.5">
          <Text className="text-sm text-typography-600">Группа</Text>
          <Heading size="xl">{group.name}</Heading>
        </VStack>
        <VStack className="gap-1">
          <Text className="text-sm text-typography-600">Код приглашения</Text>
          <Text selectable className="font-body-bold text-2xl tracking-[4px] text-typography-900">
            {group.invite_code}
          </Text>
          <Text className="text-[13px] text-typography-600">
            Друг вводит этот код во вкладке «Друзья» → «Войти по коду».
          </Text>
        </VStack>
        <Button size="lg" className="h-12 rounded-xl" onPress={share}>
          <ButtonText className="font-body-semibold">Поделиться кодом</ButtonText>
        </Button>
      </VStack>

      <VStack className="gap-3">
        <Heading size="lg" className="font-heading-semibold">
          Участники · {members.length}
        </Heading>
        <VStack className="rounded-[14px] border border-outline-200 bg-background-0">
          {members.map((member, index) => (
            <View
              key={member.user_id}
              className={`flex-row items-center gap-3 px-4 py-3 ${index > 0 ? 'border-t border-outline-100' : ''}`}>
              <View className="h-9 w-9 items-center justify-center rounded-full bg-primary-50">
                <Text className="font-body-bold text-primary-500">
                  {member.display_name.slice(0, 1).toUpperCase()}
                </Text>
              </View>
              <Text className="flex-1 font-body-medium text-typography-900">
                {member.display_name}
                {member.user_id === userId ? <Text className="text-typography-600"> (ты)</Text> : null}
              </Text>
            </View>
          ))}
        </VStack>
        {members.length === 1 && (
          <Text className="text-[13px] text-typography-600">
            Пока ты здесь один. Отправь код друзьям, и они появятся в списке.
          </Text>
        )}
      </VStack>

      {error && <Text className="text-center text-error-600">{error}</Text>}

      <Button variant="link" onPress={() => setConfirming(true)} isDisabled={leaving}>
        {leaving && <ButtonSpinner color={colors.muted} />}
        <ButtonText className="font-body-medium text-error-600">Выйти из группы</ButtonText>
      </Button>

      <ConfirmDialog
        visible={confirming}
        title="Выйти из группы?"
        message={`Ты выйдешь из группы «${group.name}» и перестанешь видеть оценки друзей, а они твои. Вернуться можно по коду.`}
        confirmLabel="Выйти"
        onConfirm={leave}
        onCancel={() => setConfirming(false)}
      />
    </VStack>
  );
}
