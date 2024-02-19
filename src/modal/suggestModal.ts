import { App } from "obsidian";
import { Item, MatchData, Pinyin } from "@/utils";
import FuzzyChinesePinyinPlugin from "@/main";
import FuzzyModal from "./modal";

export default class fuzzySuggestModal extends FuzzyModal<Item> {
    index: any;
    items: any[];
    constructor(app: App, plugin: FuzzyChinesePinyinPlugin, text_items: string[], items: string[]) {
        super(app, plugin);
        this.items = items;
        this.index = {
            items: text_items.map((p) => ({
                name: p,
                pinyin: new Pinyin(p, plugin),
            })),
        };
    }
    getEmptyInputSuggestions(): MatchData<Item>[] {
        return this.index.items.map((p) => ({ item: p, score: 0, range: null }));
    }
    onChooseSuggestion(matchData: MatchData<Item>, evt: MouseEvent | KeyboardEvent): void {
        let i = this.index.items.indexOf(matchData.item);
        this.resolve(this.items[i]);
    }
}
