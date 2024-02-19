import { App, TFile } from "obsidian";
import FuzzyChinesePinyinPlugin from "@/main";
import { MatchData, Pinyin, SuggestionRenderer, Item as uItem } from "@/utils";
import FuzzyModal from "./modal";

interface Item extends uItem {
    level: number;
}

export default class FuzzyHeadingModal extends FuzzyModal<Item> {
    file: TFile;
    constructor(app: App, plugin: FuzzyChinesePinyinPlugin) {
        super(app, plugin);
        this.index = {} as any;
    }
    setFile(file: TFile) {
        this.file = file;
        let heading = app.metadataCache.getFileCache(file)?.headings;
        if (!heading) return;
        if (!this.plugin.settings.heading.showFirstLevelHeading)
            heading = heading.filter((h) => h.level > 1);
        this.index.items = heading.map((h) => ({
            name: h.heading,
            pinyin: new Pinyin(h.heading, this.plugin),
            level: h.level,
        })) as Item[];
    }
    getEmptyInputSuggestions(): MatchData<Item>[] {
        return this.index.items.map((p) => ({
            item: p,
            score: -1,
            range: null,
        }));
    }
    onChooseSuggestion(matchData: MatchData<Item>, evt: KeyboardEvent | MouseEvent): void {
        const leaf = app.workspace.getMostRecentLeaf();
        leaf.openLinkText("#" + matchData.item.name, this.file.path);
    }
    renderSuggestion(matchData: MatchData<Item>, el: HTMLElement): void {
        let renderer = new SuggestionRenderer(el);
        renderer.render(matchData);
        renderer.addIcon("heading-" + matchData.item.level);
        if (this.plugin.settings.heading.headingIndent) {
            let indent = this.plugin.settings.heading.showFirstLevelHeading
                ? matchData.item.level - 1
                : matchData.item.level - 2;
            indent *= 15;
            renderer.titleEl.style.marginLeft = indent + "px";
        }
    }
}
