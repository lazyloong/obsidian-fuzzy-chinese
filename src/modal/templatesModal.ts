import { App, TFile } from "obsidian";
import FuzzyModal, { SpecialItemScore } from "./modal";
import { MatchData, Pinyin, runOnLayoutReady, Item as uItem } from "@/utils";
import ThePlugin from "@/main";

type Item = uItem<{ file: TFile }>;

export default class TemplatesModal extends FuzzyModal<Item> {
    index: { items: Item[] } = { items: [] };
    constructor(app: App, plugin: ThePlugin) {
        super(app, plugin);
        runOnLayoutReady(() => {
            this.updateIndex();
        });
    }
    onOpen(): void {
        super.onOpen();
        this.updateIndex();
    }
    getEmptyInputSuggestions(): MatchData<Item>[] {
        return this.index.items.map((p) => ({
            item: p,
            score: SpecialItemScore.emptyInput,
            range: null,
        }));
    }
    onChooseSuggestion(matchData: MatchData<Item>, evt: MouseEvent | KeyboardEvent): void {
        this.getOriginPlugin().insertTemplate(matchData.item.file);
    }
    getOriginPlugin() {
        return this.app.internalPlugins.plugins.templates.instance;
    }
    updateIndex(): void {
        const folder = this.getOriginPlugin().options.folder;
        const templateFiles = this.app.vault
            .getFiles()
            .filter((file) => file.path.startsWith(folder) && file.extension === "md");

        this.index.items = templateFiles.map((file: TFile) => ({
            name: file.basename,
            pinyin: new Pinyin(file.basename),
            file,
        }));
    }
}
