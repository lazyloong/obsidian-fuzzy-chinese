import {
    App,
    Editor,
    EditorPosition,
    EditorSuggest,
    EditorSuggestContext,
    EditorSuggestTriggerInfo,
    TAbstractFile,
    TFile,
    TFolder,
} from "obsidian";
import { PinyinIndex as PI, HistoryMatchDataNode, Pinyin, MatchData, Item } from "./fuzzyModal";
import Fuzyy_chinese from "./main";

export class TagEditorSuggest extends EditorSuggest<MatchData<Item>> {
    plugin: Fuzyy_chinese;
    index: PinyinIndex;
    historyMatchData: HistoryMatchDataNode<Item>;
    constructor(app: App, plugin: Fuzyy_chinese) {
        super(app);
        this.plugin = plugin;
        this.index = this.plugin.addChild(new PinyinIndex(app, this.plugin));
    }
    onTrigger(cursor: EditorPosition, editor: Editor, file: TFile): EditorSuggestTriggerInfo {
        var lineIndex = cursor.line,
            lineContent = editor.getLine(lineIndex),
            o = lineContent.substr(0, cursor.ch);
        if (
            o.match(/(^|\s)#[^\u2000-\u206F\u2E00-\u2E7F'!"#$%&()*+,.:;<=>?@^`{|}~\[\]\\\s]*$/g) &&
            "#" !== lineContent.substr(cursor.ch, 1)
        ) {
            var a = o.lastIndexOf("#"),
                s = o.substr(a + 1);
            return {
                start: {
                    line: lineIndex,
                    ch: a,
                },
                end: {
                    line: lineIndex,
                    ch: cursor.ch,
                },
                query: s,
            };
        }
        return null;
    }
    getSuggestions(content: EditorSuggestContext): MatchData<Item>[] {
        let query = content.query;
        if (query == "") {
            this.historyMatchData = new HistoryMatchDataNode("\0");
        }

        let matchData: MatchData<Item>[] = [];
        let node = this.historyMatchData,
            lastNode: HistoryMatchDataNode<Item>,
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
        let smathCase = /[A-Z]/.test(query),
            indexNode = this.historyMatchData.index(index - 1),
            toMatchData = indexNode.itemIndex.length == 0 ? this.index.items : indexNode.itemIndex;
        for (let p of toMatchData) {
            let d = p.pinyin.match(query, p, smathCase);
            if (d) matchData.push(d as MatchData<Item>);
        }

        matchData = matchData.sort((a, b) => b.score - a.score);
        // 记录数据以便下次匹配可以使用
        if (!lastNode) lastNode = this.historyMatchData;
        lastNode.itemIndex = matchData.map((p) => p.item);
        return matchData;
    }
    renderSuggestion(matchData: MatchData<Item>, el: HTMLElement) {
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
    selectSuggestion(matchData: MatchData<Item>): void {
        var context = this.context;
        if (context) {
            var editor = context.editor,
                start = context.start,
                end = context.end;
            editor.transaction({
                changes: [
                    {
                        from: start,
                        to: end,
                        text: "#" + matchData.item.name + " ",
                    },
                ],
            });
        }
    }
}

class PinyinIndex extends PI<Item> {
    constructor(app: App, plugin: Fuzyy_chinese) {
        super(app, plugin);
        this.id = "tag";
    }
    initIndex() {
        let tags: string[] = Object.keys(app.metadataCache.getTags()).map((p) => p.slice(1));
        this.items = tags.map((tag) => {
            let item = {
                name: tag,
                pinyin: new Pinyin(tag, this.plugin),
            };
            return item;
        });
    }
    initEvent() {}
    update() {
        let tags: string[] = Object.keys(app.metadataCache.getTags()).map((p) => p.slice(1));
        let oldTags = this.items.map((item) => item.name);
        let newTags = tags;
        let addedTags = newTags.filter((tag) => !oldTags.includes(tag));
        let removedTags = oldTags.filter((tag) => !newTags.includes(tag));
        if (addedTags.length > 0) {
            // 添加新命令
            this.items.push(
                ...addedTags.map((tag) => {
                    let item = {
                        name: tag,
                        pinyin: new Pinyin(tag, this.plugin),
                    };
                    return item;
                })
            );
        }
        if (removedTags.length > 0) {
            // 删除旧命令
            this.items = this.items.filter((item) => !removedTags.includes(item.name));
        }
    }
}
