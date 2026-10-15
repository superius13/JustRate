import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, ScrollView, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors } from '@/components/colors';
import { PlusIcon, SearchIcon, SortIcon } from '@/components/icons';
import { TAB_EDGES } from '@/components/screen';
import { ShelfRow } from '@/components/shelf-row';
import { Button, ButtonText } from '@/components/ui/button';
import { Heading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';
import { useAuth } from '@/lib/auth';
import { describeAuthError } from '@/lib/auth-errors';
import { fetchShelf, formatScore, SHELF_FILTERS, type ShelfItem, type TitleKind } from '@/lib/library';

type Sort = 'recent' | 'best';

export default function ShelfScreen() {
  const { session } = useAuth();
  const userId = session?.user.id;
  const [items, setItems] = useState<ShelfItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<TitleKind | 'all'>('all');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<Sort>('recent');

  const load = useCallback(async () => {
    if (!userId) return;
    try {
      setItems(await fetchShelf(userId));
      setError(null);
    } catch (e) {
      setError(describeAuthError(e));
    }
  }, [userId]);

  // Reload whenever the shelf comes back into view, e.g. after saving a rating.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function refresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  const visible = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('ru');
    const list = (items ?? []).filter((item) => {
      if (filter !== 'all' && item.title.kind !== filter) return false;
      if (!needle) return true;
      const haystack = [item.title.name, item.title.original_name, item.title.creator, item.title.year]
        .join(' ')
        .toLocaleLowerCase('ru');
      return haystack.includes(needle);
    });
    if (sort === 'best') {
      list.sort((a, b) => b.overall - a.overall || b.created_at.localeCompare(a.created_at));
    } else {
      list.sort((a, b) => b.created_at.localeCompare(a.created_at));
    }
    return list;
  }, [items, filter, query, sort]);

  const total = items?.length ?? 0;
  const average = total > 0 ? (items ?? []).reduce((sum, i) => sum + i.overall, 0) / total : null;

  const header = (
    <View className="gap-4 pb-1 pt-6">
      <View className="gap-0.5">
        <Text className="text-[13px] text-typography-600">
          {total === 0 ? 'Пока пусто' : `${countLabel(total)} · средняя ${formatScore(average)}`}
        </Text>
        <Heading size="3xl">Моя полка</Heading>
      </View>

      <View className="h-[46px] flex-row items-center gap-2.5 rounded-[10px] border border-outline-200 bg-background-0 px-3.5">
        <SearchIcon color={colors.muted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Название, автор, год"
          placeholderTextColor={colors.muted}
          accessibilityLabel="Поиск"
          returnKeyType="search"
          className="flex-1 font-body text-[15px] text-typography-900"
        />
      </View>

      <View className="flex-row items-end justify-between border-b border-outline-200">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-1">
          {SHELF_FILTERS.map((f) => {
            const active = f.value === filter;
            return (
              <Pressable
                key={f.value}
                onPress={() => setFilter(f.value)}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                className={`h-10 justify-center px-3 ${active ? 'border-b-2 border-primary-500' : ''}`}>
                <Text
                  className={`text-sm ${active ? 'font-body-bold text-primary-500' : 'font-body-medium text-typography-700'}`}>
                  {f.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <Pressable
        onPress={() => setSort(sort === 'recent' ? 'best' : 'recent')}
        accessibilityRole="button"
        className="flex-row items-center gap-1.5 self-start py-1 active:opacity-70">
        <SortIcon color={colors.primary} size={16} />
        <Text className="font-body-semibold text-[13px] text-primary-500">
          {sort === 'recent' ? 'Сначала новые' : 'Сначала с высокой оценкой'}
        </Text>
      </Pressable>
    </View>
  );

  return (
    <SafeAreaView className="flex-1 bg-background-50" edges={TAB_EDGES}>
      <FlatList
        data={items === null ? [] : visible}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ShelfRow item={item} onPress={() => router.push(`/rate/${item.title.id}`)} />
        )}
        ListHeaderComponent={header}
        ListEmptyComponent={
          <EmptyState loading={items === null && error === null} error={error} hasItems={total > 0} onRetry={load} />
        }
        contentContainerClassName="px-5 pb-28"
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} colors={[colors.primary]} />}
      />

      <Pressable
        onPress={() => router.push('/add')}
        accessibilityRole="button"
        className="absolute bottom-5 right-5 h-[52px] flex-row items-center gap-2 rounded-full bg-primary-500 px-5 active:bg-primary-700"
        style={{ boxShadow: '0 6px 16px rgba(15, 107, 92, 0.3)' }}>
        <PlusIcon color="#FFFFFF" />
        <Text className="font-body-semibold text-[15px] text-typography-0">Добавить</Text>
      </Pressable>
    </SafeAreaView>
  );
}

function EmptyState({
  loading,
  error,
  hasItems,
  onRetry,
}: {
  loading: boolean;
  error: string | null;
  hasItems: boolean;
  onRetry: () => void;
}) {
  if (loading) {
    return (
      <View className="items-center py-16">
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }
  if (error) {
    return (
      <View className="items-center gap-3 py-12">
        <Text className="text-center text-typography-700">{error}</Text>
        <Button variant="outline" className="rounded-xl border-outline-300" onPress={onRetry}>
          <ButtonText className="font-body-semibold text-typography-900">Повторить</ButtonText>
        </Button>
      </View>
    );
  }
  return (
    <View className="items-center gap-2 px-4 py-12">
      <Text className="text-center font-body-semibold text-typography-900">
        {hasItems ? 'Ничего не нашлось' : 'Полка пока пустая'}
      </Text>
      <Text className="text-center text-typography-600">
        {hasItems
          ? 'Попробуй другой запрос или раздел.'
          : 'Посмотрел фильм или дочитал книгу? Нажми «Добавить» и поставь оценку.'}
      </Text>
    </View>
  );
}

/** "1 тайтл", "3 тайтла", "48 тайтлов". */
function countLabel(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  const word =
    mod10 === 1 && mod100 !== 11 ? 'тайтл' : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14) ? 'тайтла' : 'тайтлов';
  return `${n} ${word}`;
}
