import {
    App,
    Editor,
    EditorPosition,
    EditorSuggest,
    EditorSuggestContext,
    EditorSuggestTriggerInfo,
    TFile,
} from "obsidian";
import {
    PinyinIndex as PI,
    HistoryMatchDataNode,
    Pinyin,
    MatchData as uMatchData,
    Item,
    SuggestionRenderer,
    incrementalUpdate,
} from "@/utils";
import ThePlugin from "@/main";
import { SpecialItemScore } from "@/modal/modal";

interface MatchData extends uMatchData<Item> {}

export default class TagEditorSuggest extends EditorSuggest<MatchData> {
    plugin: ThePlugin;
    index: PinyinIndex;
    historyMatchData: HistoryMatchDataNode<Item>;
    isYaml: boolean;
    constructor(app: App, plugin: ThePlugin) {
        super(app);
        this.plugin = plugin;
        this.index = this.plugin.addChild(new PinyinIndex(app, this.plugin));
        this.historyMatchData = new HistoryMatchDataNode("\0");
    }
    onTrigger(cursor: EditorPosition, editor: Editor, file: TFile): EditorSuggestTriggerInfo {
        var lineIndex = cursor.line,
            lineContent = editor.getLine(lineIndex),
            sub = lineContent.substr(0, cursor.ch);
        if (
            sub.match(
                /(^|\s)#[^\u2000-\u206F\u2E00-\u2E7F'!"#$%&()*+,.:;<=>?@^`{|}~\[\]\\\s]*$/g
            ) &&
            "#" !== lineContent.substr(cursor.ch, 1)
        ) {
            this.isYaml = false;
            var a = sub.lastIndexOf("#"),
                s = sub.substr(a + 1);
            return {
                start: {
                    line: lineIndex,
                    ch: a,
                },
                end: cursor,
                query: s,
            };
        }
        if (!file) return null;
        let frontmatterPosition = (app.metadataCache.getFileCache(file) as any)
                ?.frontmatterPosition,
            start = frontmatterPosition?.start.line || 0,
            end = frontmatterPosition?.end.line || 0;

        if (frontmatterPosition && lineIndex > start && lineIndex < end) {
            this.isYaml = true;

            if (sub.match(/^tags?: /)) {
                let match = sub.match(/(\S+)$/)?.[1] ?? "";
                if (this.index.has(match)) return null;
                return {
                    end: cursor,
                    start: {
                        ch: sub.lastIndexOf(match),
                        line: cursor.line,
                    },
                    query: match,
                };
            }

            let content = editor
                .getValue()
                .split("\n")
                .slice(start + 1, end);
            let yaml = [];
            content.forEach((p, i) => {
                if (p.match(/^\w+:/)) yaml.push([i + 1 + start, p.split(":")[0]]);
            });

            if (
                lineContent.match(/^ *- /) &&
                yaml[yaml.findLastIndex((p) => lineIndex > p[0])]?.[1]?.match(/^tags?/)
            ) {
                let match = lineContent.match(/^ *- (.+)$/)?.[1] ?? "";
                if (this.index.has(match)) return null;
                return {
                    end: {
                        ch: lineContent.length,
                        line: lineIndex,
                    },
                    start: {
                        ch: lineContent.lastIndexOf(match),
                        line: lineIndex,
                    },
                    query: match,
                };
            }
        }
        return null;
    }

    getSuggestionsByString(query: string) {
        return this.getSuggestions({ query } as EditorSuggestContext);
    }

    getEmptyInputSuggestions(): MatchData[] {
        return this.index.items.map((p) => {
            return { item: p, score: SpecialItemScore.emptyInput, range: null };
        });
    }

    getNormalInputSuggestions(query: string): MatchData[] {
        const smathCase = /[A-Z]/.test(query) && this.plugin.settings.global.autoCaseSensitivity;
        const { toMatchItem, currentNode } = this.getItemFromHistoryTree(query);
        const matchData: MatchData[] = [];
        for (let p of toMatchItem) {
            let d = p.pinyin.match(query, p, smathCase);
            if (d) matchData.push(d);
        }
        currentNode.itemIndex = matchData.map((p) => p.item);
        return matchData;
    }

    getSuggestions(content: EditorSuggestContext): MatchData[] {
        this.index.update();
        const query = content.query;
        let matchData: MatchData[];
        if (query.length == 0) {
            this.historyMatchData = new HistoryMatchDataNode("\0");
            matchData = this.getEmptyInputSuggestions();
        } else {
            matchData = this.getNormalInputSuggestions(query);
        }

        matchData = matchData.sort((a, b) => b.score - a.score);
        return matchData;
    }

    getItemFromHistoryTree(query: string) {
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
        const currentNode = this.historyMatchData.index(index - 1),
            toMatchItem =
                currentNode.itemIndex.length == 0 ? this.index.items : currentNode.itemIndex;
        return { toMatchItem, currentNode };
    }

    renderSuggestion(matchData: MatchData, el: HTMLElement) {
        new SuggestionRenderer(el).render(matchData);
    }
    selectSuggestion(matchData: MatchData): void {
        var context = this.context;
        if (context) {
            var editor = context.editor,
                start = context.start,
                end = context.end,
                text = this.isYaml ? matchData.item.name : "#" + matchData.item.name + " ";
            editor.transaction({
                changes: [
                    {
                        from: start,
                        to: end,
                        text,
                    },
                ],
            });
            editor.setCursor({ line: start.line, ch: start.ch + text.length });
        }
    }
}

class PinyinIndex extends PI<Item> {
    constructor(app: App, plugin: ThePlugin) {
        super(app, plugin);
        this.id = "tag";
    }
    initIndex() {
        let tags: string[] = Object.keys(this.app.metadataCache.getTags()).map((p) => p.slice(1));
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
        this.items = incrementalUpdate(
            this.items,
            () => Object.keys(this.app.metadataCache.getTags()).map((p) => p.slice(1)),
            (name) => ({
                name,
                pinyin: new Pinyin(name, this.plugin),
            })
        );
    }
}
