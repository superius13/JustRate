import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { BackHeader } from '@/components/back-header';
import { ChoiceChips } from '@/components/choice-chips';
import { Screen } from '@/components/screen';
import { Button, ButtonText } from '@/components/ui/button';
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
import { isTitleKind, KIND_LABELS, type TitleKind } from '@/lib/library';

const KIND_OPTIONS = (Object.keys(KIND_LABELS) as TitleKind[]).map((value) => ({
  value,
  label: KIND_LABELS[value],
}));

const CREATOR_LABELS: Record<TitleKind, string> = {
  movie: 'Режиссёр',
  series: 'Создатель или режиссёр',
  cartoon: 'Режиссёр или студия',
  book: 'Автор',
};

const MIN_YEAR = 1800;
const MAX_YEAR = new Date().getFullYear() + 1;

export default function AddManualScreen() {
  // The search screen passes what was already typed there.
  const params = useLocalSearchParams<{ kind?: string; name?: string }>();
  const [kind, setKind] = useState<TitleKind>(isTitleKind(params.kind) ? params.kind : 'movie');
  const [name, setName] = useState(params.name ?? '');
  const [year, setYear] = useState('');
  const [creator, setCreator] = useState('');

  const trimmedYear = year.trim();
  const yearNumber = Number(trimmedYear);
  const yearInvalid =
    trimmedYear.length > 0 &&
    (!/^\d{4}$/.test(trimmedYear) || yearNumber < MIN_YEAR || yearNumber > MAX_YEAR);
  const canContinue = name.trim().length > 0 && !yearInvalid;

  function next() {
    // The title is saved together with the first rating, so backing out leaves nothing behind.
    router.push({
      pathname: '/rate/[titleId]',
      params: { titleId: 'new', kind, name: name.trim(), year: trimmedYear, creator: creator.trim() },
    });
  }

  return (
    <Screen>
      <VStack className="gap-7">
        <BackHeader label="Поиск" />
        <VStack className="gap-2">
          <Heading size="2xl">Добавить вручную</Heading>
          <Text className="text-typography-700">
            Для того, чего нет в каталоге. Обложки не будет, зато всё остальное как обычно.
          </Text>
        </VStack>

        <VStack className="gap-3">
          <Text className="font-body-medium text-typography-900">Что это</Text>
          <ChoiceChips options={KIND_OPTIONS} value={kind} onChange={setKind} />
        </VStack>

        <FormControl isRequired>
          <FormControlLabel>
            <FormControlLabelText className="font-body-medium">Название</FormControlLabelText>
          </FormControlLabel>
          <Input size="xl" className="rounded-[10px] border-outline-200 bg-background-0">
            <InputField
              value={name}
              onChangeText={setName}
              placeholder={kind === 'book' ? 'Мастер и Маргарита' : 'Интерстеллар'}
              maxLength={300}
              autoFocus
              className="font-body"
            />
          </Input>
        </FormControl>

        <FormControl isInvalid={yearInvalid}>
          <FormControlLabel>
            <FormControlLabelText className="font-body-medium">Год (необязательно)</FormControlLabelText>
          </FormControlLabel>
          <Input size="xl" className="rounded-[10px] border-outline-200 bg-background-0">
            <InputField
              value={year}
              onChangeText={setYear}
              placeholder={kind === 'book' ? '1967' : '2014'}
              keyboardType="number-pad"
              maxLength={4}
              className="font-body"
            />
          </Input>
          <FormControlError>
            <FormControlErrorText>
              Год из четырёх цифр, от {MIN_YEAR} до {MAX_YEAR}.
            </FormControlErrorText>
          </FormControlError>
        </FormControl>

        <FormControl>
          <FormControlLabel>
            <FormControlLabelText className="font-body-medium">
              {CREATOR_LABELS[kind]} (необязательно)
            </FormControlLabelText>
          </FormControlLabel>
          <Input size="xl" className="rounded-[10px] border-outline-200 bg-background-0">
            <InputField
              value={creator}
              onChangeText={setCreator}
              placeholder={kind === 'book' ? 'Михаил Булгаков' : 'Кристофер Нолан'}
              maxLength={200}
              autoCapitalize="words"
              className="font-body"
            />
          </Input>
        </FormControl>

        <Button size="xl" className="h-[52px] rounded-xl" onPress={next} isDisabled={!canContinue}>
          <ButtonText className="font-body-semibold">Дальше: оценка</ButtonText>
        </Button>
      </VStack>
    </Screen>
  );
}
