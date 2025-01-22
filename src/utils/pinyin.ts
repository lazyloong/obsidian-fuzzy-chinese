import ThePlugin from "@/main";
import { fullPinyin2fuzzyPinyin } from "./pinyinUtils";
import { Item, MatchData } from "./type";

export class Pinyin extends Array<PinyinChild> {
    text: string;
    constructor(query: string, plugin: ThePlugin) {
        super();
        let pinyinDict = plugin?.pinyinDict;
        this.text = query;
        this.text.split("").forEach((p) => {
            let index = pinyinDict.values
                .map((q, i) => (q.includes(p) ? i : null))
                .filter((p) => p);
            let pinyin =
                index.length == 0 ? [p] : pinyinDict.keys.filter((_, i) => index.includes(i));
            if (plugin.settings.global.fuzzyPinyin) {
                let fuzzyPinyin = fullPinyin2fuzzyPinyin(pinyin[0], plugin);
                if (typeof fuzzyPinyin === "string") pinyin.push(fuzzyPinyin);
                else if (Array.isArray(fuzzyPinyin)) pinyin.push(...fuzzyPinyin);
            }
            this.push({
                character: p,
                pinyin,
            });
        });
    }
    getScore(range: Array<[number, number]>) {
        let score = 0;
        let coverage = range.reduce((p, c) => p + c[1] - c[0] + 1, 0);
        coverage = coverage / this.text.length;
        score += coverage < 0.5 ? 150 * coverage : 50 * coverage + 50; // 使用线性函数计算覆盖度
        score += 20 / (range[0][0] + 1); // 靠前加分
        score += 30 / range.length; // 分割越少分越高
        return score;
    }
    match<T extends Item>(query: string, item: T, smathCase = false): MatchData<T> {
        const range_ = this.match_(query, smathCase);
        const range = range_ ? toRanges(range_) : false;
        if (!range) return;
        return {
            item: item,
            score: this.getScore(range),
            range: range,
        };
    }
    concat(pinyin: Pinyin) {
        let result = new Pinyin("", null);
        result.text = this.text + pinyin.text;
        for (let i of this) {
            result.push(i);
        }
        for (let i of pinyin) {
            result.push(i);
        }
        return result;
    }
    // The following two functions are based on the work of zh-lx (https://github.com/zh-lx).
    // Original code: https://github.com/zh-lx/pinyin-pro/blob/main/lib/core/match/index.ts.
    match_(pinyin: string, smathCase: boolean): number[] | null {
        pinyin = pinyin.replace(/\s/g, "");
        const f = (str: string) => (smathCase ? str : str.toLocaleLowerCase());
        let result: number[];
        try {
            result = this.matchAboveStart(f(this.text), f(pinyin));
        } catch (e) {
            // 土耳其字符 "İ" 转小写后变成两个字符（"i"和附加的点下加符号 "̇"）导致长度对不上
            if (this.text.includes("İ")) {
                const f = (str: string) => (smathCase ? str : str.toLocaleLowerCase("tr"));
                result = this.matchAboveStart(f(this.text), f(pinyin));
            } else {
                console.log(this.text, this);
                console.error(e);
                result = this.matchAboveStart(this.text, pinyin);
            }
        }
        return result;
    }

    matchAboveStart(text: string, pinyin: string): number[] | null {
        const words = text.split("");

        // 二维数组 dp[i][j]，i 表示遍历到的 text 索引+1, j 表示遍历到的 pinyin 的索引+1
        const dp = Array(words.length + 1);
        // 使用哨兵初始化 dp
        for (let i = 0; i < dp.length; i++) {
            dp[i] = Array(pinyin.length + 1);
            dp[i][0] = [];
        }
        for (let i = 0; i < dp[0].length; i++) {
            dp[0][i] = [];
        }

        // 动态规划匹配
        for (let i = 1; i < dp.length; i++) {
            // options.continuous 为 false 或 options.space 为 ignore 且当前为空格时，第 i 个字可以不参与匹配
            for (let j = 1; j <= pinyin.length; j++) {
                dp[i][j - 1] = dp[i - 1][j - 1];
            }
            // 第 i 个字参与匹配
            for (let j = 1; j <= pinyin.length; j++) {
                if (!dp[i - 1][j - 1]) {
                    // 第 i - 1 已经匹配失败，停止向后匹配
                    continue;
                } else if (j !== 1 && !dp[i - 1][j - 1].length) {
                    // 非开头且前面的字符未匹配完成，停止向后匹配
                    continue;
                } else {
                    const muls = this[i - 1].pinyin;
                    // 非中文匹配
                    if (text[i - 1] === pinyin[j - 1]) {
                        const matches = [...dp[i - 1][j - 1], i - 1];
                        // 记录最长的可匹配下标数组
                        if (!dp[i][j] || matches.length > dp[i][j].length) {
                            dp[i][j] = matches;
                        }
                        // pinyin 参数完全匹配完成，记录结果
                        if (j === pinyin.length) {
                            return dp[i][j];
                        }
                    }

                    // 剩余长度小于等于 MAX_PINYIN_LENGTH(6) 时，有可能是最后一个拼音了
                    if (pinyin.length - j <= 6) {
                        // lastPrecision 参数处理
                        const last = muls.some((py) => {
                            return py.startsWith(pinyin.slice(j - 1, pinyin.length));
                        });
                        if (last) {
                            return [...dp[i - 1][j - 1], i - 1];
                        }
                    }

                    if (muls.some((py) => py[0] === pinyin[j - 1])) {
                        const matches = [...dp[i - 1][j - 1], i - 1];
                        // 记录最长的可匹配下标数组
                        if (!dp[i][j] || matches.length > dp[i][j].length) {
                            dp[i][j] = matches;
                        }
                    }

                    // 匹配当前汉字的完整拼音
                    const completeMatch = muls.find(
                        (py: string) => py === pinyin.slice(j - 1, j - 1 + py.length)
                    );
                    if (completeMatch) {
                        const matches = [...dp[i - 1][j - 1], i - 1];
                        const endIndex = j - 1 + completeMatch.length;
                        // 记录最长的可匹配下标数组
                        if (!dp[i][endIndex] || matches.length > dp[i][endIndex].length) {
                            dp[i][endIndex] = matches;
                        }
                    }
                }
            }
        }
        return null;
    }
}

type PinyinChild = {
    character: string[1];
    pinyin: string[];
};

// 将一个有序的数字数组转换为一个由连续数字区间组成的数组
// console.log(toRanges([1, 2, 3, 5, 7, 8]));
// 输出: [[1,3],[5,5],[7,8]]
function toRanges(arr: Array<number>): Array<[number, number]> {
    const result = [];
    let start = arr[0];
    let end = arr[0];
    for (let i = 1; i < arr.length; i++) {
        if (arr[i] === end + 1) {
            end = arr[i];
        } else {
            result.push([start, end]);
            start = arr[i];
            end = arr[i];
        }
    }
    result.push([start, end]);
    return result;
}
