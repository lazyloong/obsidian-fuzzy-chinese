import { usePlugin } from "./helpers";
import { matchSheng, FuzzyPinyinRules } from "./pinyinCore";

// 纯函数从 pinyinCore 重新导出
export { SHENG_LIST, matchSheng, FuzzyPinyinRules } from "./pinyinCore";

type DoublePinyinDict = Record<string, string[]>;

// ============================================================
// 双拼转换（依赖 Obsidian legacy 双拼字典格式）
// ============================================================

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

// ============================================================
// 模糊音（依赖 Obsidian Plugin settings）
// ============================================================

export function fullPinyin2fuzzyPinyin(pinyin: string): string[] {
    const { fuzzyPinyinSetting } = usePlugin().settings.global;
    const dict: Record<string, string> = {};
    for (const key of fuzzyPinyinSetting) {
        const targets = FuzzyPinyinRules[key];
        if (targets) {
            for (const t of targets) dict[t] = key;
        }
    }
    const { sheng, yun } = matchSheng(pinyin);
    const fuzzyShengmu = dict[sheng];
    const fuzzyYunmu = dict[yun];
    if (fuzzyShengmu && fuzzyYunmu)
        return [sheng + fuzzyYunmu, fuzzyShengmu + yun, fuzzyShengmu + fuzzyYunmu];
    else if (fuzzyShengmu) return [fuzzyShengmu + yun];
    else if (fuzzyYunmu) return [sheng + fuzzyYunmu];
    return [];
}
