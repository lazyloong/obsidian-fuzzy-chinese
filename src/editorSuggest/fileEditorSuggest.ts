import {
    App,
    Editor,
    EditorPosition,
    EditorSuggest,
    EditorSuggestContext,
    EditorSuggestTriggerInfo,
    TFile,
} from "obsidian";
import { MatchData as fMatchData, Item as fItem, LinkItem } from "@/modal/fileModal";
import { PinyinIndex, Pinyin } from "@/utils";
import ThePlugin from "@/main";

type ResultType = "alias" | "file" | "linktext" | "heading";
type Result<T extends ResultType> = {
    matches: [number, number][];
    path: string;
    score: number;
    type: T;
};
interface AliasResult extends Result<"alias"> {
    alias: string;
    file: TFile;
}
interface FileResult extends Result<"file"> {
    file: TFile;
}
interface LinktextResult extends Result<"linktext"> {}
interface HeadingResult extends Result<"heading"> {
    subpath: `#${string}`;
    heading: string;
    level: number;
    file: TFile;
}
type OriginEditorSuggestResult = AliasResult | FileResult | LinktextResult | HeadingResult;

type Item = Omit<fItem, "type"> & {
    type: fItem["type"] | "heading";
};

type MatchData = fMatchData<Item>;

export default class FileEditorSuggest extends EditorSuggest<MatchData> {
    plugin: ThePlugin;
    index: PinyinIndex<fItem>;
    tempItems: Item[] = [];
    originEditorSuggest: EditorSuggest<OriginEditorSuggestResult>;
    constructor(app: App, plugin: ThePlugin) {
        super(app);
        this.originEditorSuggest = app.workspace.editorSuggest.suggests.find(
            (p: any) => p?.suggestManager
        );
        this.plugin = plugin;
        this.index = this.plugin.fileModal.index;
        this.scope.register([], "Tab", (e) => {
            e.preventDefault();
            if (this.app.vault.getConfig("useMarkdownLinks")) {
                this.app.vault.setConfig("useMarkdownLinks", false);
                this.suggestions.useSelectedItem(e);
                this.app.vault.setConfig("useMarkdownLinks", true);
            } else this.suggestions.useSelectedItem(e);
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
            {
                command: "tab",
                purpose: "使用标准md链接时，仅输入wiki链接，不转换为md链接",
            },
        ];
        this.setInstructions(prompt);
    }
    onTrigger(cursor: EditorPosition, editor: Editor, file: TFile): EditorSuggestTriggerInfo {
        const cursorLine = cursor.line;
        const lineText = editor.getLine(cursorLine).substr(0, cursor.ch);

        const openBracketIndex = lineText.lastIndexOf("[[");
        const closeBracketIndex = lineText.lastIndexOf("]]");

        if (this.findLastSymbol(lineText.slice(openBracketIndex)) == "^") return;
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
    async getSuggestions(context: EditorSuggestContext): Promise<MatchData[]> {
        this.context = context;
        let e = this.originEditorSuggest;
        let query = context.query,
            matchData: MatchData[];
        switch (this.findLastSymbol(query)) {
            case "|": {
                matchData = this.getFileAliases(query);
                break;
            }
            case "#": {
                e.context = context;
                let result = (await e.getSuggestions(context)) as HeadingResult[];
                matchData = this.getHeadings(query, result);
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
    getHeadings(query: string, items: HeadingResult[]) {
        let [_, q] = query.split("#");
        if (q == "") {
            this.tempItems = items.map((p) => ({
                type: "heading",
                file: p.file,
                name: p.heading,
                pinyin: new Pinyin(p.heading, this.plugin),
                path: p.file.basename,
                pinyinOfPath: null,
            }));
        }
        return this.match(q, this.tempItems);
    }
    match(query: string, items: Item[]) {
        if (query == "")
            return items.map((p) => ({ item: p, score: -1, range: null, usePath: false }));
        query = query.toLocaleLowerCase();
        let matchData: MatchData[] = [];
        for (let p of items) {
            let d = p.pinyin.match(query, p);
            if (d) matchData.push(d as MatchData);
        }
        matchData = matchData.sort((a, b) => b.score - a.score);
        return matchData;
    }
    findLastSymbol(str: string): "" | "#" | "|" | "^" {
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
        this.plugin.fileModal.renderSuggestion(matchData as fMatchData, el);
    }
    selectSuggestion(matchData: MatchData, evt: MouseEvent | KeyboardEvent): void {
        let item = matchData.item;
        let result: OriginEditorSuggestResult;
        let file = app.workspace.getActiveFile();
        switch (item.type) {
            case "heading":
            case "link":
                result = {
                    heading: isLinkItem(item) ? item.link : item.name,
                    type: "heading",
                    path: item.file == file ? "" : item.file.basename,
                    file: item.file,
                    subpath: `#${isLinkItem(item) ? item.link : item.name}`,
                    level: 1,
                    matches: null,
                    score: 0,
                };
                break;
            case "alias":
                result = {
                    type: "alias",
                    alias: item.name,
                    path: item.path,
                    file: item.file,
                    matches: null,
                    score: 0,
                };
                break;
            case "file":
                result = {
                    type: "file",
                    path: item.path,
                    file: item.file,
                    matches: null,
                    score: 0,
                };
                break;
            case "unresolvedLink":
                result = {
                    type: "linktext",
                    path: item.name,
                    matches: null,
                    score: 0,
                };
                break;
        }
        this.originEditorSuggest.context = this.context;
        this.originEditorSuggest.selectSuggestion(result, evt);
    }
}

function isLinkItem(item: Item): item is LinkItem {
    return item.type === "link";
}
