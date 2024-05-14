import ThePlugin from "@/main";

type DoublePinyinDict = Record<string, string[]>;

export function fullPinyin2doublePinyin(
    fullPinyin: string,
    doublePinyinDict: DoublePinyinDict
): string {
    let doublePinyin: string;
    let [shengmu, yunmu] = splitPinyin(fullPinyin);
    let findKeys = (pinyin: string, dict: DoublePinyinDict) => {
        return Object.keys(dict).find((key) => dict[key].includes(pinyin));
    };
    if (shengmu != "") shengmu = findKeys(shengmu, doublePinyinDict);
    if (yunmu != "") yunmu = findKeys(yunmu, doublePinyinDict);
    doublePinyin = shengmu + yunmu;

    // 小鹤双拼的字典里没有 er，会拆成 e 和 r
    if (!yunmu && fullPinyin == "er") doublePinyin = "er";

    return doublePinyin;
}

const SHENG_MU: string[] = [
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
    "zh",
    "ch",
    "sh",
    "r",
    "z",
    "c",
    "s",
    "y",
    "w",
];

export function splitPinyin(pinyin: string): [string, string] {
    const matchedShengmu = SHENG_MU.find((sm) => pinyin.startsWith(sm));

    // 如果没有找到匹配的声母，可能意味着是零声母的韵母，或者输入不正确
    if (matchedShengmu) return [matchedShengmu, pinyin.slice(matchedShengmu.length)];
    else return ["", pinyin];
}

//模糊音
export const FuzzyPinyinDict = {
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

export function fullPinyin2fuzzyPinyin(pinyin: string, plugin: ThePlugin): string | string[] {
    const { fuzzyPinyinSetting } = plugin.settings.global;
    const dict = fuzzyPinyinSetting.reduce((acc, key) => {
        acc[key] = FuzzyPinyinDict[key];
        return acc;
    }, {});
    const [shengmu, yunmu] = splitPinyin(pinyin);
    let fuzzyShengmu = dict[shengmu];
    let fuzzyYunmu = dict[yunmu];
    if (fuzzyShengmu && fuzzyYunmu)
        return [shengmu + fuzzyYunmu, fuzzyShengmu + yunmu, fuzzyShengmu + fuzzyYunmu];
    else if (fuzzyShengmu) return fuzzyShengmu + yunmu;
    else if (fuzzyYunmu) return shengmu + fuzzyYunmu;
}
