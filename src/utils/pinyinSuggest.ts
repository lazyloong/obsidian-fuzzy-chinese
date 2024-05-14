import ThePlugin from "@/main";
import { TextInputSuggest } from "templater/src/settings/suggesters/suggest";
import { SuggestionRenderer } from "./suggestionRenderer";
import { MatchData, Item } from "./type";

export class PinyinSuggest extends TextInputSuggest<MatchData<Item>> {
    getItemFunction: (query: string) => MatchData<Item>[];
    plugin: ThePlugin;
    constructor(inputEl: HTMLInputElement | HTMLTextAreaElement, plugin: ThePlugin) {
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
