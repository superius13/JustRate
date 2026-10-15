import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, TextInput, View } from 'react-native';

import { BackHeader } from '@/components/back-header';
import { CatalogRow } from '@/components/catalog-row';
import { ChoiceChips } from '@/components/choice-chips';
import { colors } from '@/components/colors';
import { SearchIcon } from '@/components/icons';
import { Screen } from '@/components/screen';
import { Heading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { describeAuthError } from '@/lib/auth-errors';
import {
  CatalogError,
  describeCatalogError,
  ensureCatalogTitle,
  searchCatalog,
  type CatalogItem,
  type CatalogSearch,
  type CatalogShelf,
} from '@/lib/catalog';

const SHELF_OPTIONS: { value: CatalogShelf; label: string }[] = [
  { value: 'video', label: 'Фильмы и сериалы' },
  { value: 'book', label: 'Книги' },
];

const MIN_QUERY_LENGTH = 2;
// Wait for a pause in typing: the film catalog allows a limited number of requests per day.
const SEARCH_DELAY_MS = 600;

type SearchState =
  | { status: 'idle' }
  | { status: 'loading' }
  | ({ status: 'done' } & CatalogSearch)
  | { status: 'error'; message: string };

/** The latest answer from the catalog and the search it answers. */
type Answer = { key: string } & ({ search: CatalogSearch } | { message: string });

export default function AddTitleScreen() {
  const [shelf, setShelf] = useState<CatalogShelf>('video');
  const [query, setQuery] = useState('');
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [picking, setPicking] = useState<string | null>(null);
  const [pickError, setPickError] = useState<string | null>(null);

  const trimmed = query.trim();
  const searchKey = trimmed.length >= MIN_QUERY_LENGTH ? `${shelf}:${trimmed}` : null;

  useEffect(() => {
    if (searchKey === null) return;
    let active = true;
    const timer = setTimeout(() => {
      searchCatalog(shelf, trimmed)
        .then((search) => active && setAnswer({ key: searchKey, search }))
        .catch((e) => active && setAnswer({ key: searchKey, message: describeCatalogError(e) }));
    }, SEARCH_DELAY_MS);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [searchKey, shelf, trimmed]);

  const search: SearchState =
    searchKey === null
      ? { status: 'idle' }
      : answer?.key !== searchKey
        ? { status: 'loading' }
        : 'search' in answer
          ? { status: 'done', ...answer.search }
          : { status: 'error', message: answer.message };

  async function pick(item: CatalogItem) {
    const key = `${item.source}:${item.external_id}`;
    setPicking(key);
    setPickError(null);
    try {
      const title = await ensureCatalogTitle(item);
      router.push(`/rate/${title.id}`);
    } catch (e) {
      setPickError(e instanceof CatalogError ? describeCatalogError(e) : describeAuthError(e));
    } finally {
      setPicking(null);
    }
  }

  function addManually() {
    router.push({
      pathname: '/add-manual',
      params: { kind: shelf === 'book' ? 'book' : 'movie', name: trimmed },
    });
  }

  return (
    <Screen>
      <VStack className="gap-5">
        <BackHeader label="Полка" />
        <Heading size="2xl">Что добавим?</Heading>

        <ChoiceChips options={SHELF_OPTIONS} value={shelf} onChange={setShelf} />

        <View className="h-[46px] flex-row items-center gap-2.5 rounded-[10px] border border-outline-200 bg-background-0 px-3.5">
          <SearchIcon color={colors.muted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={shelf === 'book' ? 'Название книги или автор' : 'Название фильма или сериала'}
            placeholderTextColor={colors.muted}
            accessibilityLabel="Поиск по каталогу"
            autoFocus
            returnKeyType="search"
            className="flex-1 font-body text-[15px] text-typography-900"
          />
        </View>

        {pickError && <Text className="text-error-600">{pickError}</Text>}

        <SearchResults state={search} picking={picking} onPick={pick} />

        <Pressable
          onPress={addManually}
          accessibilityRole="button"
          className="items-center rounded-[14px] border border-dashed border-outline-300 px-4 py-4 active:opacity-70">
          <Text className="font-body-semibold text-primary-500">Нет в каталоге? Добавить вручную</Text>
        </Pressable>
      </VStack>
    </Screen>
  );
}

function SearchResults({
  state,
  picking,
  onPick,
}: {
  state: SearchState;
  picking: string | null;
  onPick: (item: CatalogItem) => void;
}) {
  if (state.status === 'idle') {
    return (
      <Text className="text-typography-600">
        Начни вводить название. Обложка и год подтянутся из каталога.
      </Text>
    );
  }
  if (state.status === 'loading') {
    return (
      <View className="items-center py-8">
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }
  if (state.status === 'error') {
    return <Text className="text-typography-700">{state.message}</Text>;
  }
  // Shown when Google Books was down, so a thinner list of books does not look like a bug.
  const fallbackNote = state.fromFallback ? (
    <Text className="text-[13px] text-typography-600">
      Google Книги сейчас недоступны, показаны книги из Open Library. Русских изданий там меньше.
    </Text>
  ) : null;
  if (state.results.length === 0) {
    return (
      <View className="gap-2">
        {fallbackNote}
        <Text className="text-typography-700">Ничего не нашлось. Попробуй другое написание.</Text>
      </View>
    );
  }
  return (
    <View className="gap-2">
      {fallbackNote}
      <View>
        {state.results.map((item) => {
          const key = `${item.source}:${item.external_id}`;
          return (
            <CatalogRow
              key={key}
              item={item}
              busy={picking === key}
              disabled={picking !== null}
              onPress={() => onPick(item)}
            />
          );
        })}
      </View>
    </View>
  );
}
