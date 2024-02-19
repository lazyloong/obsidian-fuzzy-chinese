import { Component, Vault, MetadataCache, App, getIcon, TFile, Notice } from "obsidian";
import { TextInputSuggest } from "templater/src/settings/suggesters/suggest";
import FuzzyChinesePinyinPlugin from "@/main";

export type MatchData<T> = {
    item: T;
    score: number;
    range: Array<[number, number]>;
};

export type Item = {
    name: string;
    pinyin: Pinyin;
};

export class HistoryMatchDataNode<T> {
    query: string[1];
    next: HistoryMatchDataNode<T>;
    itemIndex: Array<T>;
    itemIndexByPath: Array<T>;
    constructor(query: string[1]) {
        this.init(query);
    }
    push(query: string[1]) {
        let node = new HistoryMatchDataNode<T>(query);
        this.next = node;
        return node;
    }
    index(index: number) {
        let node: HistoryMatchDataNode<T> = this;
        for (let i = 0; i < index; i++) {
            if (node.next) node = node.next;
            else return;
        }
        return node;
    }
    init(query: string[1]) {
        this.query = query;
        this.next = null;
        this.itemIndex = [];
        this.itemIndexByPath = [];
    }
}

export class Pinyin extends Array<PinyinChild> {
    text: string;
    constructor(query: string, plugin: FuzzyChinesePinyinPlugin) {
        super();
        let pinyinDict = plugin?.pinyinDict;
        this.text = query;
        this.text.split("").forEach((p) => {
            let index = pinyinDict.values
                .map((q, i) => (q.includes(p) ? i : null))
                .filter((p) => p);
            this.push({
                character: p,
                pinyin:
                    index.length == 0 ? [p] : pinyinDict.keys.filter((_, i) => index.includes(i)),
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
    match<T extends Item>(query: string, item: T, smathCase = false): MatchData<T> | false {
        let range = this.match_(query, smathCase);
        range = range ? toRanges(range) : false;
        if (!range) return false;
        let data: MatchData<T> = {
            item: item,
            score: this.getScore(range),
            range: range,
        };
        return data;
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
    match_(pinyin: string, smathCase: boolean) {
        pinyin = pinyin.replace(/\s/g, "");
        let f = (str: string) => (smathCase ? str : str.toLocaleLowerCase());
        const result = this.matchAboveStart(f(this.text), f(pinyin));
        return result;
    }

    matchAboveStart(text: string, pinyin: string) {
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

export abstract class PinyinIndex<T extends Item> extends Component {
    vault: Vault;
    metadataCache: MetadataCache;
    items: Array<T>;
    id: string;
    plugin: FuzzyChinesePinyinPlugin;
    app: App;
    constructor(app: App, plugin: FuzzyChinesePinyinPlugin) {
        super();
        this.app = app;
        this.plugin = plugin;
        this.vault = app.vault;
        this.metadataCache = app.metadataCache;
        this.items = [];
        runOnLayoutReady(() => {
            this.initEvent();
        });
    }
    abstract initIndex(): void;
    abstract initEvent(): void;
    abstract update(...args: any[]): void;
    has(query: string): boolean {
        return Boolean(this.items.find((p) => p.name == query));
    }
}

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

export function runOnLayoutReady(calback: Function) {
    if (app.workspace.layoutReady) {
        calback();
    } else {
        app.workspace.onLayoutReady(async () => {
            calback();
        });
    }
}

export function fullPinyin2doublePinyin(fullPinyin: string, doublePinyinDict): string {
    let doublePinyin = "";
    let findKeys = (obj, condition) => {
        return Object.keys(obj).find((key) => condition(obj[key]));
    };
    if (["sh", "ch", "zh"].some((p) => fullPinyin.startsWith(p))) {
        doublePinyin += findKeys(doublePinyinDict, (p) => p.includes(fullPinyin.slice(0, 2)));
        fullPinyin = fullPinyin.slice(2);
    } else {
        doublePinyin += fullPinyin[0];
        fullPinyin = fullPinyin.slice(1);
    }
    if (fullPinyin.length != 0)
        doublePinyin += findKeys(doublePinyinDict, (p) => p.includes(fullPinyin));
    return doublePinyin;
}

export function arraymove<T>(arr: T[], fromIndex: number, toIndex: number): void {
    if (toIndex < 0 || toIndex === arr.length) {
        return;
    }
    const element = arr[fromIndex];
    arr[fromIndex] = arr[toIndex];
    arr[toIndex] = element;
}

export class SuggestionRenderer {
    containerEl: HTMLElement;
    contentEl: HTMLElement;
    flairEl: HTMLElement;
    noteEl: HTMLElement;
    titleEl: HTMLElement;
    toHighlightEl: HTMLElement;
    title: string = "";
    note: string = "";
    hasIcon: boolean = false;
    constructor(containerEl: HTMLElement) {
        containerEl.addClass("fz-item");
        this.containerEl = containerEl;
        this.contentEl = this.containerEl.createEl("div", { cls: "fz-suggestion-content" });
        this.titleEl = this.contentEl.createEl("div", { cls: "fz-suggestion-title" });
        this.noteEl = this.contentEl.createEl("div", {
            cls: "fz-suggestion-note",
        });
        this.toHighlightEl = this.titleEl;
    }
    setToHighlightEl(name: "title" | "note") {
        this.toHighlightEl = this[`${name}El`];
    }
    render(matchData: MatchData<any>) {
        let range = matchData.range,
            text: string,
            index = 0;
        if (this.title == "") this.setTitle(matchData.item.name);
        if (this.toHighlightEl == this.titleEl) {
            text = this.title;
            this.noteEl.innerText = this.note;
        } else {
            text = this.note;
            this.titleEl.innerText = this.title;
        }
        if (range) {
            for (const r of range) {
                this.toHighlightEl.appendText(text.slice(index, r[0]));
                this.toHighlightEl.createSpan({
                    cls: "suggestion-highlight",
                    text: text.slice(r[0], r[1] + 1),
                });
                index = r[1] + 1;
            }
        }
        this.toHighlightEl.appendText(text.slice(index));
    }
    setTitle(text: string) {
        this.title = text;
    }
    setNote(text: string) {
        this.note = text;
    }
    addIcon(icon: string) {
        if (!this.flairEl)
            this.flairEl = this.containerEl.createEl("span", {
                cls: "suggestion-flair",
            });
        this.flairEl.appendChild(getIcon(icon));
        this.hasIcon = true;
    }
}

export async function createFile(name: string): Promise<TFile> {
    return await app.vault.create(
        app.fileManager.getNewFileParent("").path + "/" + name + ".md",
        ""
    );
}

export function incrementalUpdate<T extends Item>(
    items: T[],
    getAllItems: () => string[],
    text2Item: (name: string) => T
) {
    let oldItems = items.map((p) => p.name);
    let newItems = getAllItems();

    let addItems = newItems.filter((p) => !oldItems.includes(p));
    let removeItems = oldItems.filter((p) => !newItems.includes(p));

    if (addItems.length > 0) items.push(...addItems.map((p) => text2Item(p)));
    if (removeItems.length > 0) items = items.filter((item) => !removeItems.includes(item.name));
    return items;
}

export class PinyinSuggest extends TextInputSuggest<MatchData<Item>> {
    getItemFunction: (query: string) => MatchData<Item>[];
    plugin: FuzzyChinesePinyinPlugin;
    constructor(inputEl: HTMLInputElement | HTMLTextAreaElement, plugin: FuzzyChinesePinyinPlugin) {
        super(inputEl);
        this.plugin = plugin;
    }
    getSuggestions(inputStr: string): MatchData<Item>[] {
        if (this.getItemFunction === undefined) return [];
        return this.getItemFunction(inputStr);
    }
    renderSuggestion(matchData: MatchData<Item>, el: HTMLElement): void {
        el.addClass("fz-item");
        new SuggestionRenderer(el).render(matchData);
    }
    selectSuggestion(matchData: MatchData<Item>): void {
        this.inputEl.value = matchData.item.name;
        this.inputEl.trigger("input");
        this.close();
    }
}

export function copy(text: string) {
    navigator.clipboard.writeText(text).then(
        () => new Notice("已复制到剪贴板：" + text),
        () => new Notice("复制失败：" + text)
    );
}
