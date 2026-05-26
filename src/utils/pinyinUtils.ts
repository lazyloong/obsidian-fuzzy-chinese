import FuzzyDefaults from "@/dict/fuzzy-defaults.json";

/** 声母列表（长度优先：zh/ch/sh 优先于 z/c/s） */
export const SHENG_LIST = [
    "zh",
    "ch",
    "sh",
    "b",
    "p",
    "m",
    "f",
    "d",
    "t",
    "n",
    "l",
    "g",
    "k",
    "h",
    "j",
    "q",
    "x",
    "r",
    "z",
    "c",
    "s",
    "y",
    "w",
];

/** 按长度优先匹配切分拼音为声母+韵母 */
export function matchSheng(pinyin: string): { sheng: string; yun: string } {
    for (const s of SHENG_LIST) {
        if (pinyin.startsWith(s)) {
            return { sheng: s, yun: pinyin.slice(s.length) };
        }
    }
    return { sheng: "", yun: pinyin };
}

/** 新版模糊音规则（双向对称，来自 fuzzy-defaults.json） */
export const FuzzyPinyinRules: Record<string, string[]> = FuzzyDefaults;

type DoublePinyinDict = Record<string, string[]>;

// 双拼转换
export function fullPinyin2doublePinyin(
    fullPinyin: string,
    doublePinyinDict: DoublePinyinDict
): string {
    let doublePinyin: string;
    const { sheng, yun } = matchSheng(fullPinyin);
    let shengmu = sheng;
    let yunmu = yun;
    const findKeys = (pinyin: string, dict: DoublePinyinDict) => {
        return Object.keys(dict).find((key) => dict[key].includes(pinyin));
    };
    if (shengmu != "") shengmu = findKeys(shengmu, doublePinyinDict);
    if (yunmu != "") yunmu = findKeys(yunmu, doublePinyinDict);
    doublePinyin = shengmu + yunmu;

    if (!yunmu && fullPinyin == "er") doublePinyin = "er";

    return doublePinyin;
}
