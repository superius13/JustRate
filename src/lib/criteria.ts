import type { TitleKind } from '@/lib/library';

export type Criterion = { key: string; label: string };

const SCREEN_CRITERIA: Criterion[] = [
  { key: 'plot', label: 'Сюжет' },
  { key: 'characters', label: 'Персонажи и актёры' },
  { key: 'visuals', label: 'Визуал' },
  { key: 'sound', label: 'Музыка и звук' },
  { key: 'atmosphere', label: 'Атмосфера' },
];

const BOOK_CRITERIA: Criterion[] = [
  { key: 'plot', label: 'Сюжет' },
  { key: 'characters', label: 'Персонажи' },
  { key: 'style', label: 'Язык и стиль' },
  { key: 'atmosphere', label: 'Атмосфера' },
  { key: 'pageturner', label: 'Не мог оторваться' },
];

export function criteriaFor(kind: TitleKind): Criterion[] {
  return kind === 'book' ? BOOK_CRITERIA : SCREEN_CRITERIA;
}

/** Per-criterion scores from 1 to 10; a missing key means the criterion was skipped. */
export type CriteriaScores = Record<string, number>;

/** Keeps only known keys with whole scores from 1 to 10. */
export function cleanScores(kind: TitleKind, raw: unknown): CriteriaScores {
  const source = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const result: CriteriaScores = {};
  for (const { key } of criteriaFor(kind)) {
    const value = source[key];
    if (typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 10) {
      result[key] = value;
    }
  }
  return result;
}

export function averageScore(scores: CriteriaScores): number | null {
  const values = Object.values(scores);
  if (values.length === 0) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}
