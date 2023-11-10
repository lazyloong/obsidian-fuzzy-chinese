import { App } from "obsidian";
import FuzzyModal from "./fuzzyModal";
import { Item, MatchData, Pinyin } from "./utils";
import FuzzyChinesePinyinPlugin from "./main";

export default class fuzzySuggestModal extends FuzzyModal<Item> {
    index: any;
    items: any[];
    resolve: (value?: string) => void;
    constructor(app: App, plugin: FuzzyChinesePinyinPlugin, text_items: string[], items: string[]) {
        super(app, plugin);
        this.items = items;
        this.index = {
            items: text_items.map((p) => {
                return { name: p, pinyin: new Pinyin(p, plugin) };
            }),
        };
    }
    getEmptyInputSuggestions(): MatchData<Item>[] {
        return this.index.items.map((p) => {
            return { item: p, score: 0, range: null };
        });
    }
    onChooseSuggestion(matchData: MatchData<Item>, evt: MouseEvent | KeyboardEvent): void {
        let i = this.index.items.indexOf(matchData.item);
        this.resolve(this.items[i]);
    }
    async openAndGetValue(resolve: (value?: string) => void, reject: (reason?: any) => void): Promise<void> {
        this.resolve = resolve;
        this.open();
    }
}
