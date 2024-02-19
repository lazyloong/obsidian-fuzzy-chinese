import FuzzyChinesePinyinPlugin from "@/main";
import { Pinyin, Item, MatchData } from "@/utils";

export function fuzzyPinyinSearch(
    query: string,
    items: string[] | Item[],
    plugin: FuzzyChinesePinyinPlugin
): MatchData<Item>[] {
    if (items.length == 0) return null;
    if (isStringArray(items)) {
        items = stringArray2Items(items, plugin);
    }
    return search(query, items, plugin.settings.global.autoCaseSensitivity);
}

function isStringArray(arr: string[] | Item[]): arr is string[] {
    return typeof arr[0] == "string";
}

function search(query: string, items: Item[], autoCaseSensitivity = true): MatchData<Item>[] {
    if (query == "") {
        return items.map((p) => ({
            item: p,
            score: 0,
            range: [[0, p.name.length - 1]],
        }));
    }

    let matchData: MatchData<Item>[] = [];
    let smathCase = /[A-Z]/.test(query) && autoCaseSensitivity;
    for (let p of items) {
        let d = p.pinyin.match(query, p, smathCase);
        if (d) matchData.push(d);
    }

    matchData = matchData.sort((a, b) => b.score - a.score);
    return matchData;
}

export function stringArray2Items(items: string[], plugin: FuzzyChinesePinyinPlugin): Item[] {
    return items.map((item) => ({
        name: item,
        pinyin: new Pinyin(item, plugin),
    }));
}
