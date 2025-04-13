import ThePlugin from "@/main";
import { Component, Vault, MetadataCache, App } from "obsidian";
import { runOnLayoutReady } from "./helpers";
import { Item } from "./type";

export abstract class PinyinIndex<T extends Item> extends Component {
    vault: Vault;
    metadataCache: MetadataCache;
    items: Array<T>;
    protected id: string;
    plugin: ThePlugin;
    app: App;
    constructor(app: App, plugin: ThePlugin) {
        super();
        this.app = app;
        this.plugin = plugin;
        this.vault = app.vault;
        this.metadataCache = app.metadataCache;
        this.items = [];
        runOnLayoutReady(() => {
            this.initEvent();
        });
    }
    abstract initIndex(): void;
    abstract initEvent(): void;
    abstract update(...args: any[]): void;
    has(query: string): boolean {
        return Boolean(this.items.find((p) => p.name == query));
    }
}
