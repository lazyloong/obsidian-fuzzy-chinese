import ThePlugin from "@/main";
import { usePlugin } from "./helpers";
import FuzzyDefaults from "@/dict/fuzzy-defaults.json";

type DoublePinyinDict = Record<string, string[]>;

// ============================================================
// 切分声母韵母
// ============================================================

/** 声母列表（长度优先：zh/ch/sh 优先于 z/c/s） */
export const SHENG_LIST = [
    "zh", "ch", "sh",
    "b", "p", "m", "f",
    "d", "t", "n", "l",
    "g", "k", "h",
    "j", "q", "x",
    "r", "z", "c", "s",
    "y", "w",
];

/**
 * 按长度优先匹配切分拼音为声母+韵母
 * 如 "zhong" → { sheng: "zh", yun: "ong" }
 */
export function matchSheng(pinyin: string): { sheng: string; yun: string } {
    for (const s of SHENG_LIST) {
        if (pinyin.startsWith(s)) {
            return { sheng: s, yun: pinyin.slice(s.length) };
        }
    }
    return { sheng: "", yun: pinyin };
}

/** @deprecated 使用 matchSheng 替代 */
export function splitPinyin(pinyin: string): [string, string] {
    const { sheng, yun } = matchSheng(pinyin);
    return [sheng, yun];
}

// ============================================================
// 双拼转换
// ============================================================

export function fullPinyin2doublePinyin(
    fullPinyin: string,
    doublePinyinDict: DoublePinyinDict
): string {
    let doublePinyin: string;
    let [shengmu, yunmu] = splitPinyin(fullPinyin);
    const findKeys = (pinyin: string, dict: DoublePinyinDict) => {
        return Object.keys(dict).find((key) => dict[key].includes(pinyin));
    };
    if (shengmu != "") shengmu = findKeys(shengmu, doublePinyinDict);
    if (yunmu != "") yunmu = findKeys(yunmu, doublePinyinDict);
    doublePinyin = shengmu + yunmu;

    // 小鹤双拼的字典里没有 er，会拆成 e 和 r
    if (!yunmu && fullPinyin == "er") doublePinyin = "er";

    return doublePinyin;
}

// ============================================================
// 模糊音
// ============================================================

/** 旧版模糊音字典（保留兼容） */
export const FuzzyPinyinDict: Record<string, string> = {
    zh: "z",
    ch: "c",
    sh: "s",
    n: "l",
    h: "f",
    l: "r",
    ang: "an",
    eng: "en",
    ing: "in",
    iang: "ian",
    uang: "uan",
};

/** 新版模糊音规则（双向对称，来自 fuzzy-defaults.json） */
export const FuzzyPinyinRules: Record<string, string[]> = FuzzyDefaults;

export function fullPinyin2fuzzyPinyin(pinyin: string): string[] {
    const { fuzzyPinyinSetting } = usePlugin().settings.global;
    const dict: Record<string, string> = {};
    for (const key of fuzzyPinyinSetting) {
        if (FuzzyPinyinDict[key]) {
            dict[key] = FuzzyPinyinDict[key];
        }
    }
    const [shengmu, yunmu] = splitPinyin(pinyin);
    const fuzzyShengmu = dict[shengmu];
    const fuzzyYunmu = dict[yunmu];
    if (fuzzyShengmu && fuzzyYunmu)
        return [shengmu + fuzzyYunmu, fuzzyShengmu + yunmu, fuzzyShengmu + fuzzyYunmu];
    else if (fuzzyShengmu) return [fuzzyShengmu + yunmu];
    else if (fuzzyYunmu) return [shengmu + fuzzyYunmu];
    return [];
}
