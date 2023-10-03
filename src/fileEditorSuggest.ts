import { App, Editor, EditorPosition, EditorSuggest, EditorSuggestContext, EditorSuggestTriggerInfo, TFile } from "obsidian";
import { MatchData, Item } from "./fuzzyFileModal";
import { PinyinIndex, Pinyin } from "./utils";
import FuzzyChinesePinyinPlugin from "./main";
import { runOnLayoutReady } from "./utils";

export default class FileEditorSuggest extends EditorSuggest<MatchData> {
    plugin: FuzzyChinesePinyinPlugin;
    index: PinyinIndex<Item>;
    tempItems: Item[] = [];
    originEditorSuggest: EditorSuggest<any>;
    originEditorSuggestCache: any;
    constructor(app: App, plugin: FuzzyChinesePinyinPlugin) {
        super(app);
        this.originEditorSuggest = app.workspace.editorSuggest.suggests[0];
        this.plugin = plugin;
        this.index = this.plugin.fileModal.index;
        runOnLayoutReady(() => {
            this.originEditorSuggestCache = this.originEditorSuggest.getSuggestions(<EditorSuggestContext>{ query: "" });
        });
        let prompt = [
            {
                command: "输入 #",
                purpose: "可以链接到标题",
            },
            {
                command: "输入 ^",
                purpose: "链接文本块",
            },
            {
                command: "输入 |",
                purpose: "指定显示的文本",
            },
        ];
        this.setInstructions(prompt);
    }
    onTrigger(cursor: EditorPosition, editor: Editor, file: TFile): EditorSuggestTriggerInfo {
        const cursorLine = cursor.line;
        const lineText = editor.getLine(cursorLine).substr(0, cursor.ch);

        const openBracketIndex = lineText.lastIndexOf("[[");
        const closeBracketIndex = lineText.lastIndexOf("]]");

        if (openBracketIndex !== -1 && closeBracketIndex < openBracketIndex) {
            return {
                start: {
                    line: cursorLine,
                    ch: openBracketIndex + 2,
                },
                end: {
                    line: cursorLine,
                    ch: cursor.ch,
                },
                query: lineText.substr(openBracketIndex + 2),
            };
        } else {
            return null;
        }
    }
    getSuggestions(context: EditorSuggestContext): MatchData[] | Promise<MatchData[]> {
        this.context = context;
        let e = this.originEditorSuggest;
        let query = context.query,
            matchData: MatchData[] | Promise<MatchData[]>;
        switch (this.findLastChar(query)) {
            case "|": {
                matchData = this.getFileAliases(query);
                break;
            }
            case "#": {
                e.context = context;
                matchData = (e.getSuggestions(context) as any).then((items) => {
                    return this.getHeadings(query, items);
                });
                break;
            }
            case "^": {
                this.close();
                break;
            }
            default: {
                matchData = this.plugin.fileModal.getSuggestions(query);
            }
        }
        return matchData;
    }
    getFileAliases(query: string) {
        let [name, q] = query.split("|");
        let items = this.index.items.filter((p) => p.type == "alias" && p.file.basename == name);
        return this.match(q, items);
    }
    getHeadings(query: string, items: Item[] | any) {
        let [_, q] = query.split("#");
        if (q == "")
            this.tempItems = items.map(
                (p) =>
                    <Item & { originData: any }>{
                        file: p.file,
                        type: "heading",
                        name: p.heading,
                        pinyin: new Pinyin(p.heading, this.plugin),
                        path: p.file.basename,
                        originData: p,
                    }
            );
        return this.match(q, this.tempItems);
    }
    match(query: string, items: Item[]) {
        if (query == "") return items.map((p) => <MatchData>{ item: p, score: -1, range: null, usePath: false });
        query = query.toLocaleLowerCase();
        let matchData: MatchData[] = [];
        for (let p of items) {
            let d = p.pinyin.match(query, p);
            if (d) matchData.push(d as MatchData);
        }
        matchData = matchData.sort((a, b) => b.score - a.score);
        return matchData;
    }
    findLastChar(str: string) {
        let index1 = str.lastIndexOf("#");
        let index2 = str.lastIndexOf("|");
        let index3 = str.lastIndexOf("^");

        let maxIndex = Math.max(index1, index2, index3);

        switch (maxIndex) {
            case -1:
                return "";
            case index1:
                return "#";
            case index2:
                return "|";
            case index3:
                return "^";
        }
    }

    renderSuggestion(matchData: MatchData, el: HTMLElement) {
        el.addClass("fz-item");
        let range = matchData.range,
            text: string,
            e_content = el.createEl("div", { cls: "fz-suggestion-content" }),
            e_title = e_content.createEl("div", { cls: "fz-suggestion-title" }),
            e_note = e_content.createEl("div", { cls: "fz-suggestion-note" }),
            toHighlightEl: HTMLDivElement;

        if (matchData.usePath) {
            e_title.innerText = matchData.item.name;
            toHighlightEl = e_note;
            text = matchData.item.path;
        } else {
            e_note.innerText = matchData.score == -1 ? matchData.item.file.basename : matchData.item.path;
            toHighlightEl = e_title;
            text = matchData.item.name;
        }

        let index = 0;
        if (range) {
            for (const r of range) {
                toHighlightEl.appendText(text.slice(index, r[0]));
                toHighlightEl.createSpan({ cls: "suggestion-highlight", text: text.slice(r[0], r[1] + 1) });
                index = r[1] + 1;
            }
        }
        toHighlightEl.appendText(text.slice(index));

        if (this.plugin.settings.showTags && !(matchData.item.type == "heading")) {
            let tags: string | Array<string> =
                    app.metadataCache.getFileCache(matchData.item.file)?.frontmatter?.tags ||
                    app.metadataCache.getFileCache(matchData.item.file)?.frontmatter?.tag,
                tagArray: string[];
            if (tags) {
                tagArray = Array.isArray(tags) ? tags : String(tags).split(/, ?/);
                let tagEl = e_title.createDiv({ cls: "fz-suggestion-tags" });
                tagArray.forEach((p) => tagEl.createEl("a", { cls: "tag", text: p }));
            }
        }

        if (matchData.item.type == "alias") {
            let e_flair = el.createEl("span", {
                cls: "fz-suggestion-flair",
            });
            e_flair.innerHTML +=
                '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon lucide-forward"><polyline points="15 17 20 12 15 7"></polyline><path d="M4 18v-2a4 4 0 0 1 4-4h12"></path></svg>';
            e_flair.style.top = "9px";
            e_note.style.width = "calc(100% - 30px)";
        }
    }
    selectSuggestion(matchData: MatchData, evt: MouseEvent | KeyboardEvent): void {
        if (matchData.item.type == "heading") {
            this.originEditorSuggest.selectSuggestion((<Item & { originData: any }>matchData.item).originData, evt);
        } else {
            this.originEditorSuggest.context = this.context;
            this.originEditorSuggestCache.then((matchDatas) => {
                let matchData_ = matchDatas.find((p) => {
                    if (p.type == matchData.item.type && p.file == matchData.item.file) {
                        if (p.type == "alias") return p.alias == matchData.item.name;
                        else return true;
                    } else return false;
                });
                this.originEditorSuggest.selectSuggestion(matchData_, evt);
            });
        }
    }
}
