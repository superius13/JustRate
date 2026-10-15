import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Platform, View } from 'react-native';

import { BackHeader } from '@/components/back-header';
import { colors } from '@/components/colors';
import { Poster } from '@/components/poster';
import { CriterionBar, MonthPicker, OverallStepper } from '@/components/rating-controls';
import { Screen } from '@/components/screen';
import { Button, ButtonSpinner, ButtonText } from '@/components/ui/button';
import { Heading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';
import { Textarea, TextareaInput } from '@/components/ui/textarea';
import { VStack } from '@/components/ui/vstack';
import { useAuth } from '@/lib/auth';
import { describeAuthError } from '@/lib/auth-errors';
import { averageScore, cleanScores, criteriaFor, type CriteriaScores } from '@/lib/criteria';
import {
  createTitle,
  currentMonth,
  deleteRating,
  fetchMyRating,
  fetchTitle,
  formatMonthValue,
  formatScore,
  isTitleKind,
  parseMonth,
  saveRating,
  titleMeta,
  type MonthValue,
  type Title,
} from '@/lib/library';

const DEFAULT_OVERALL = 7;
const MAX_REVIEW_LENGTH = 5000;

type Params = { titleId: string; kind?: string; name?: string; year?: string; creator?: string };

/** A title that is either already in the database or still a draft from the add screen. */
type LoadedTitle = Omit<Title, 'id'> & { id: string | null };

export default function RateScreen() {
  const params = useLocalSearchParams<Params>();
  const { session } = useAuth();
  const userId = session?.user.id;
  const isNew = params.titleId === 'new';

  const [title, setTitle] = useState<LoadedTitle | null>(() => (isNew ? draftFromParams(params) : null));
  const [hasRating, setHasRating] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [overall, setOverall] = useState(DEFAULT_OVERALL);
  const [scores, setScores] = useState<CriteriaScores>({});
  const [review, setReview] = useState('');
  const [watched, setWatched] = useState<MonthValue | null>(() => (isNew ? currentMonth() : null));

  const [busy, setBusy] = useState<'save' | 'delete' | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isNew || !userId) return;
    let active = true;
    Promise.all([fetchTitle(params.titleId), fetchMyRating(userId, params.titleId)])
      .then(([loaded, rating]) => {
        if (!active) return;
        if (!loaded) {
          setLoadError('Не нашли этот тайтл. Возможно, его удалили.');
          return;
        }
        setTitle(loaded);
        if (rating) {
          setHasRating(true);
          setOverall(rating.overall);
          setScores(cleanScores(loaded.kind, rating.criteria));
          setReview(rating.review ?? '');
          setWatched(parseMonth(rating.watched_on));
        } else {
          setWatched(currentMonth());
        }
      })
      .catch((e) => active && setLoadError(describeAuthError(e)));
    return () => {
      active = false;
    };
  }, [isNew, params.titleId, userId]);

  if (!title) {
    return (
      <Screen>
        <VStack className="gap-6">
          <BackHeader label="Полка" />
          {loadError ? (
            <Text className="text-center text-typography-700">{loadError}</Text>
          ) : (
            <View className="items-center py-16">
              <ActivityIndicator color={colors.primary} />
            </View>
          )}
        </VStack>
      </Screen>
    );
  }

  const isBook = title.kind === 'book';
  const criteria = criteriaFor(title.kind);
  const average = averageScore(scores);

  async function save() {
    if (!userId || !title) return;
    setBusy('save');
    setError(null);
    try {
      let titleId = title.id;
      if (titleId === null) {
        const { id: _draftId, ...draft } = title;
        const created = await createTitle({ ...draft, source: 'manual' });
        titleId = created.id;
        // A retry after a failed rating save must not create the title twice.
        setTitle(created);
      }
      await saveRating(userId, titleId, {
        overall,
        criteria: scores,
        review: review.trim() || null,
        watched_on: watched ? formatMonthValue(watched) : null,
      });
      router.dismissTo('/');
    } catch (e) {
      setError(describeAuthError(e));
      setBusy(null);
    }
  }

  async function remove() {
    if (!userId || !title?.id) return;
    setBusy('delete');
    setError(null);
    try {
      await deleteRating(userId, title.id);
      router.dismissTo('/');
    } catch (e) {
      setError(describeAuthError(e));
      setBusy(null);
    }
  }

  function confirmRemove() {
    const question = `Убрать «${title?.name}» с полки? Оценка и заметка удалятся.`;
    if (Platform.OS === 'web') {
      if (window.confirm(question)) remove();
      return;
    }
    Alert.alert('Убрать с полки?', question, [
      { text: 'Отмена', style: 'cancel' },
      { text: 'Убрать', style: 'destructive', onPress: remove },
    ]);
  }

  return (
    <Screen>
      <VStack className="gap-6">
        <BackHeader label={isNew ? 'Назад' : 'Полка'} />

        <VStack className="items-center gap-2.5">
          <Poster id={title.id ?? title.name} url={title.poster_url} size="lg" />
          <Heading size="2xl" className="mt-1.5 text-center leading-8">
            {title.name}
          </Heading>
          <Text className="text-center text-sm text-typography-600">{titleMeta(title)}</Text>
        </VStack>

        <OverallStepper
          value={overall}
          onChange={setOverall}
          hint={average === null ? 'из 10' : `из 10 · среднее по пунктам ${formatScore(average)}`}
        />

        <VStack className="gap-4">
          <VStack className="gap-1">
            <Heading size="lg" className="font-heading-semibold">По пунктам</Heading>
            <Text className="text-[13px] text-typography-600">
              Необязательно. Нажми ещё раз на ту же оценку, чтобы убрать её.
            </Text>
          </VStack>
          {criteria.map((c) => (
            <CriterionBar
              key={c.key}
              label={c.label}
              value={scores[c.key]}
              onChange={(value) =>
                setScores((prev) => {
                  const next = { ...prev };
                  if (value === undefined) delete next[c.key];
                  else next[c.key] = value;
                  return next;
                })
              }
            />
          ))}
        </VStack>

        <VStack className="gap-3">
          <Heading size="lg" className="font-heading-semibold">Заметка</Heading>
          <Textarea size="lg" className="h-28 rounded-[10px] border-outline-200 bg-background-0">
            <TextareaInput
              value={review}
              onChangeText={setReview}
              placeholder={isBook ? 'Что запомнилось из книги' : 'Что запомнилось'}
              maxLength={MAX_REVIEW_LENGTH}
              className="font-body text-[15px]"
            />
          </Textarea>
          <MonthPicker label={isBook ? 'Прочитано' : 'Посмотрено'} value={watched} onChange={setWatched} />
        </VStack>

        {error && <Text className="text-center text-error-600">{error}</Text>}

        <VStack className="gap-2">
          <Button size="xl" className="h-[52px] rounded-xl" onPress={save} isDisabled={busy !== null}>
            {busy === 'save' && <ButtonSpinner color="white" />}
            <ButtonText className="font-body-semibold">Сохранить</ButtonText>
          </Button>
          {hasRating && (
            <Button variant="link" onPress={confirmRemove} isDisabled={busy !== null}>
              {busy === 'delete' && <ButtonSpinner color={colors.muted} />}
              <ButtonText className="font-body-medium text-error-600">Убрать с полки</ButtonText>
            </Button>
          )}
        </VStack>
      </VStack>
    </Screen>
  );
}

function draftFromParams(params: Params): LoadedTitle | null {
  const name = params.name?.trim();
  if (!isTitleKind(params.kind) || !name) return null;
  const year = Number(params.year);
  return {
    id: null,
    kind: params.kind,
    name,
    original_name: null,
    year: Number.isInteger(year) && year > 0 ? year : null,
    creator: params.creator?.trim() || null,
    poster_url: null,
  };
}
