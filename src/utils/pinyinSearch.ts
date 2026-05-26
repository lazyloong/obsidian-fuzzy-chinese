import type { Item as uItem, MatchData } from '@/utils/type';
import { SpecialItemScore } from '@/utils/type';
import Pinyin from '@/utils/pinyin';

type SearchItem<T> = uItem<{ data: T }>;

export default function pinyinSearch<T>(
  query: string,
  data: T[],
  getKey?: (p: T) => string
): MatchData<SearchItem<T>>[] {
  if (data.length === 0) return [];
  if (query === '') {
    return data.map((d) => ({
      item: d as unknown as SearchItem<T>,
      score: SpecialItemScore.emptyInput,
      range: null,
    }));
  }

  const _getKey = getKey ?? ((p: any) => (p as { key: string }).key);
  const matchData: MatchData<SearchItem<T>>[] = [];
  const items: SearchItem<T>[] = data.map((d) => ({
    name: _getKey(d),
    pinyin: new Pinyin(_getKey(d)),
    data: d,
  }));
  for (const item of items) {
    const result = item.pinyin.match(query, item);
    if (result) {
      matchData.push(result);
    }
  }
  matchData.sort((a, b) => b.score - a.score);
  return matchData;
}
