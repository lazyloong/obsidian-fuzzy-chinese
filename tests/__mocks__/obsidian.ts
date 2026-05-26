// Mock for obsidian package — 提供 vitest 测试所需的最小导出
export class Notice {
    constructor(_message: string, _timeout?: number) {}
    hide() {}
}

export class TFile {
    path: string;
    name: string;
    basename: string;
    extension: string;
    constructor(opts?: Partial<TFile>) {
        this.path = opts?.path ?? "";
        this.name = opts?.name ?? "";
        this.basename = opts?.basename ?? "";
        this.extension = opts?.extension ?? "";
    }
}

export class TAbstractFile {
    path: string;
    name: string;
    constructor(opts?: Partial<TAbstractFile>) {
        this.path = opts?.path ?? "";
        this.name = opts?.name ?? "";
    }
}

export class TFolder extends TAbstractFile {
    children: TAbstractFile[];
    constructor(opts?: Partial<TFolder>) {
        super(opts);
        this.children = opts?.children ?? [];
    }
}

export class View {
    getViewType(): string {
        return "empty";
    }
}

export class MarkdownView extends View {
    getViewType(): string {
        return "markdown";
    }
}

export class Plugin {}
export class App {}
export class MetadataCache {}
export class Vault {}
export class WorkspaceLeaf {}
export class Component {}
export class Scope {}
export class Setting {}

export class SuggestModal<T> {
    app: any;
    scope: Scope;
    inputEl: HTMLInputElement;
    chooser: any;
    containerEl: HTMLElement;
    contentEl: HTMLElement;
    limit: number;
    emptyStateText: string;
    modalEl: HTMLElement;
    constructor(_app: any) {
        this.scope = new Scope();
        this.inputEl = { value: "", focus: () => {}, trigger: () => {} } as any;
        this.containerEl = { addClass: () => {} } as any;
        this.contentEl = { empty: () => {} } as any;
        this.modalEl = { querySelector: () => null } as any;
    }
    open() {}
    close() {}
    onOpen() {}
    onClose() {}
    setPlaceholder(_text: string) {}
    setInstructions(_instructions: any[]) {}
    addCommand(_cmd: any) {}
    register(_fn: () => void) {}
    registerEvent(_evt: any) {}
    registerDomEvent(_el: any, _type: string, _fn: Function) {}
}

export class EditorSuggest<T> {
    app: any;
    scope: Scope;
    context: any;
    suggestions: any;
    constructor(_app: any) {
        this.scope = new Scope();
        this.suggestions = { useSelectedItem: () => {} };
    }
    close() {}
    setInstructions(_instructions: any[]) {}
}

export class TextComponent {
    inputEl: HTMLInputElement;
    disabled: boolean;
    constructor(inputEl: HTMLInputElement | HTMLTextAreaElement) {
        this.inputEl = inputEl as HTMLInputElement;
        this.disabled = false;
    }
    setValue(_value: string): this { return this; }
    getValue(): string { return ""; }
    onChange(_callback: (value: string) => any): this { return this; }
    setDisabled(_disabled: boolean): this { return this; }
    onChanged(): void {}
}

export class Menu {
    addItem(_cb: (item: any) => any): this { return this; }
}

export class Modal {
    app: any;
    contentEl: HTMLElement;
    constructor(_app: any) {
        this.contentEl = { empty: () => {}, createEl: () => ({}) } as any;
    }
    open() {}
    close() {}
}

export class PluginSettingTab {
    app: App;
    containerEl: HTMLElement;
    constructor(_app: App, _plugin: Plugin) {
        this.app = _app;
        this.containerEl = {
            empty: () => {},
            createEl: () => ({}),
        } as any as HTMLElement;
    }
    display(): void {}
}

export const Platform = {
    isMacOS: false,
    isMobile: false,
    isDesktop: true,
};

export class Hotkey {}

export class Command {}

export class Modifier {}

export type { };