import { App, TFile } from "obsidian";
import FuzzyModal from "./modal";
import { MatchData, Pinyin, runOnLayoutReady, Item as uItem } from "@/utils";
import ThePlugin from "@/main";

interface Item extends uItem {
    file: TFile;
}

export default class TemplatesModal extends FuzzyModal<Item> {
    constructor(app: App, plugin: ThePlugin) {
        super(app, plugin);
        this.index = {} as any;
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
            score: -1,
            range: null,
        }));
    }
    onChooseSuggestion(matchData: MatchData<Item>, evt: MouseEvent | KeyboardEvent): void {
        let plugin = this.getOriginPlugin();
        plugin.insertTemplate(matchData.item.file);
    }
    getOriginPlugin() {
        return this.app.internalPlugins.plugins.templates.instance;
    }
    updateIndex(): void {
        let plugin = this.getOriginPlugin();
        let folder = plugin.options.folder;
        let templateFiles = this.app.vault
            .getFiles()
            .filter((file) => file.path.startsWith(folder) && file.extension === "md");

        this.index.items = templateFiles.map((file: TFile) => ({
            name: file.basename,
            pinyin: new Pinyin(file.basename, this.plugin),
            file,
        }));
    }
}
