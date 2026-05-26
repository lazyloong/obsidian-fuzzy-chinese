import { Item as uItem, MatchData, Pinyin } from "@/utils";
import { SpecialItemScore } from "@/utils";

type Item = uItem<{ data: any }>;

export default function pinyinSearch(
    query: string,
    data: any[],
    getKey: (p: any) => string = (p) => p.key
): MatchData<Item>[] {
    if (data.length === 0) return [];
    if (query === "") {
        return data.map((d) => ({
            item: d,
            score: SpecialItemScore.emptyInput,
            range: null,
        }));
    }

    const matchData: MatchData<Item>[] = [];
    const items = data.map((d) => ({
        name: getKey(d),
        pinyin: new Pinyin(getKey(d)),
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
