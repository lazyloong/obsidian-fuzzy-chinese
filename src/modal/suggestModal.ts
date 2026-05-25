import { App } from "obsidian";
import { Item as uItem, MatchData, Pinyin } from "@/utils";
import ThePlugin from "@/main";
import FuzzyModal, { SpecialItemScore } from "./modal";

type Item = uItem<{ data: any }>;

export default class SuggestModal extends FuzzyModal<Item> {
    // @ts-ignore
    index: { items: Item[] } = { items: [] };
    constructor(
        app: App,
        plugin: ThePlugin,
        data: any[],
        getKey: (p: any) => string = (p) => p.key
    ) {
        super(app, plugin);
        this.index.items = data.map((p) => ({
            name: getKey(p),
            pinyin: new Pinyin(getKey(p)),
            data: p,
        }));
    }
    getEmptyInputSuggestions(): MatchData<Item>[] {
        return this.index.items.map((p) => ({
            item: p,
            score: SpecialItemScore.emptyInput,
            range: null,
        }));
    }
    onChooseSuggestion(matchData: MatchData<Item>, evt: MouseEvent | KeyboardEvent): void {
        this.resolve(matchData.item);
    }
}
