import { SuggestModal, App, CachedMetadata, Component, MetadataCache, TAbstractFile, Vault } from "obsidian";
import Fuzyy_chinese from "./main";

export type MatchData<T> = {
    item: T;
    score: number;
    range: Array<[number, number]>;
};

export type Item = {
    name: string;
    pinyin: Pinyin<Item>;
};

export abstract class FuzzyModal<T extends Item> extends SuggestModal<MatchData<T>> {
    historyMatchData: HistoryMatchDataNode<T>;
    chooser: any;
    index: PinyinIndex<T>;
    plugin: Fuzyy_chinese;
    constructor(app: App, plugin: Fuzyy_chinese) {
        super(app);
        this.plugin = plugin;
        this.historyMatchData = new HistoryMatchDataNode("\0");
    }
    onOpen() {
        this.onInput(); // 无输入时触发历史记录
    }
    abstract getEmptyInputSuggestions(): MatchData<T>[];
    getSuggestions(query: string): MatchData<T>[] {
        if (query == "") {
            this.historyMatchData = new HistoryMatchDataNode("\0");
            return this.getEmptyInputSuggestions();
        }

        let matchData: MatchData<T>[] = [];
        let node = this.historyMatchData,
            lastNode: HistoryMatchDataNode<T>,
            index = 0,
            _f = true;
        for (let i of query) {
            if (node) {
                if (i != node.query) {
                    node.init(i);
                    _f = false;
                }
            } else {
                node = lastNode.push(i);
            }
            lastNode = node;
            node = node.next;
            if (_f) index++;
        }
        let query_ = new Query(query.toLocaleLowerCase()),
            indexNode = this.historyMatchData.index(index - 1),
            toMatchData = indexNode.itemIndex.length == 0 ? this.index.items : indexNode.itemIndex;
        for (let p of toMatchData) {
            let d = p.pinyin.match(query_, p);
            if (d) matchData.push(d as MatchData<T>);
        }

        matchData = matchData.sort((a, b) => b.score - a.score);
        // 记录数据以便下次匹配可以使用
        if (!lastNode) lastNode = this.historyMatchData;
        lastNode.itemIndex = matchData.map((p) => p.item);
        return matchData;
    }

    renderSuggestion(matchData: MatchData<T>, el: HTMLElement) {
        el.addClass("fz-item");
        let range = matchData.range,
            text = matchData.item.name,
            index = 0;
        if (range) {
            for (const r of range) {
                el.appendText(text.slice(index, r[0]));
                el.createSpan({ cls: "suggestion-highlight", text: text.slice(r[0], r[1] + 1) });
                index = r[1] + 1;
            }
        }
        el.appendText(text.slice(index));
    }
    onNoSuggestion(): void {
        this.chooser.addMessage(this.emptyStateText);
    }
    abstract onChooseSuggestion(matchData: MatchData<T>, evt: MouseEvent | KeyboardEvent): void;
    onClose() {
        this.inputEl.value = "";
        this.onInput();
        this.contentEl.empty();
    }
    getChoosenItem() {
        return this.chooser.values[this.chooser.selectedItem];
    }
}

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

export class Pinyin<T extends Item> extends Array<PinyinChild> {
    query: string;
    constructor(query: string, plugin: Fuzyy_chinese) {
        super();
        let pinyinDict = plugin?.pinyinDict;
        this.query = query.toLowerCase();
        this.query.split("").forEach((p) => {
            let index = pinyinDict.values.map((q, i) => (q.includes(p) ? i : null)).filter((p) => p);
            this.push({
                type: index.length == 0 ? "other" : "pinyin",
                character: p,
                pinyin: index.length == 0 ? p : pinyinDict.keys.filter((_, i) => index.includes(i)),
            });
        });
    }
    getScore(range: Array<[number, number]>) {
        let score = 0;
        score += 40 / (this.query.length - range.reduce((p, i) => p + i[1] - i[0] + 1, 0)); //覆盖越广分越高
        if (range[0][0] == 0) score += 8; //顶头加分
        score += 20 / range.length; //分割越少分越高
        return score;
    }
    getRange(query: Query): Array<[number, number]> | false {
        let index = 0,
            list: Array<number> = [],
            currentStr: string = query[index].query;
        for (let i = 0; i < this.length; i++) {
            let el = this[i],
                type = query[index].type;
            switch (type) {
                case "pinyin": {
                    if (el.type == "pinyin") {
                        let f = (<Array<string>>el.pinyin).map((pinyin) => currentStr.startsWith(pinyin) || pinyin.startsWith(currentStr));
                        if (f.some((p) => p)) {
                            list.push(i);
                            currentStr = currentStr.substring(el.pinyin[f.findIndex((p) => p)].length);
                        } else if ((<Array<string>>el.pinyin).some((pinyin) => pinyin.startsWith(currentStr[0]))) {
                            list.push(i);
                            currentStr = currentStr.substring(1);
                        }
                    } else if (el.character == currentStr[0]) {
                        list.push(i);
                        currentStr = currentStr.substring(1);
                    }
                    break;
                }
                case "chinese":
                case "punctuation": {
                    if (el.character == currentStr[0]) {
                        list.push(i);
                        currentStr = currentStr.substring(1);
                    }
                    break;
                }
            }
            if (currentStr.length == 0) {
                if (index == query.length - 1) break;
                index++;
                currentStr = query[index].query;
            }
        }
        return list.length == 0 || index != query.length - 1 || currentStr.length != 0 ? false : toRanges(list);
    }
    match(query: Query, item: T): MatchData<T> | false {
        let range = this.getRange(query);
        if (!range) return false;
        let data: MatchData<T> = {
            item: item,
            score: this.getScore(range),
            range: range,
        };
        return data;
    }
    concat(pinyin: Pinyin<T>) {
        let result = new Pinyin<T>("", null);
        result.query = this.query + pinyin.query;
        for (let i of this) {
            result.push(i);
        }
        for (let i of pinyin) {
            result.push(i);
        }
        return result;
    }
}

type PinyinChild = {
    type: "pinyin" | "other";
    character: string[1];
    pinyin: string | string[]; // pinyin: pinyin of Chinese characters, only for cc type nodes. For ot, it is itself.
};

// 将一个有序的数字数组转换为一个由连续数字区间组成的数组
// console.log(toRanges([2, 3, 5, 7, 8]));
// 输出: [[2,3],[5,5],[7,8]]
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

export class Query extends Array<QueryChild> {
    constructor(query: string) {
        super();
        this.splitQuery(query);
    }
    splitQuery(s: string) {
        let result = [];
        let types = [];
        let currentStr = "";
        for (let i = 0; i < s.length; i++) {
            let char = s[i];
            if (char === " ") {
                if (currentStr) {
                    this.push({ type: this.getType(currentStr), query: currentStr });
                    currentStr = "";
                }
            } else if (this.isPunctuation(char)) {
                if (currentStr) {
                    this.push({ type: this.getType(currentStr), query: currentStr });
                    currentStr = "";
                }
                result.push(char);
                types.push("punctuation");
            } else if (i > 0 && this.isChinese(char) !== this.isChinese(s[i - 1])) {
                if (currentStr) {
                    this.push({ type: this.getType(currentStr), query: currentStr });
                    currentStr = "";
                }
                currentStr += char;
            } else {
                currentStr += char;
            }
        }
        if (currentStr) {
            this.push({ type: this.getType(currentStr), query: currentStr });
        }
    }

    getType(s: string) {
        if (this.isChinese(s[0])) return "chinese";
        else return "pinyin";
        // } else if (this.isFullPinyin(s)) {
        //     return "full";
        // } else {
        //     return "first";
        // }
    }

    isChinese(char: string) {
        return /[\u4e00-\u9fa5]/.test(char);
    }

    isPunctuation(char: string) {
        return /[，。？！：；‘’“”【】（）《》,.?!:;"'(){}\[\]<>]/.test(char);
    }

    // isFullPinyin(s: string): boolean {
    //     if (s.length === 0) {
    //         return true;
    //     }
    //     for (let pinyin of PinyinKeys) {
    //         if (s.startsWith(pinyin)) {
    //             if (this.isFullPinyin(s.slice(pinyin.length))) {
    //                 return true;
    //             }
    //         }
    //     }
    //     if (PinyinKeys.some((p) => p.startsWith(s))) {
    //         return true;
    //     } else {
    //         return false;
    //     }
    // }
}

type QueryChild = {
    type: "chinese" | "pinyin" | "punctuation";
    query: string;
};

export abstract class PinyinIndex<T> extends Component {
    vault: Vault;
    metadataCache: MetadataCache;
    items: Array<T>;
    plugin: Fuzyy_chinese;
    constructor(app: App, plugin: Fuzyy_chinese) {
        super();
        this.plugin = plugin;
        this.vault = app.vault;
        this.metadataCache = app.metadataCache;
        this.items = [];
        this.initEvent();
        if (app.workspace.layoutReady) {
            this.initIndex();
        } else {
            app.workspace.onLayoutReady(async () => {
                this.initIndex();
            });
        }
    }
    abstract initIndex(): void;
    abstract initEvent(): void;
    abstract update(...args: any[]): void;
}
