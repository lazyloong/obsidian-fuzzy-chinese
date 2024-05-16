import NavboxManager from "./src/manager";

declare module "obsidian" {
    interface MarkdownView {
        navboxManager: NavboxManager;
    }
    interface WorkspaceLeaf {
        openLinkText(
            linktext: string,
            sourcePath: string,
            openViewState?: OpenViewState
        ): Promise<void>;
        parent: WorkspaceParent;
    }
    interface Workspace {
        handleLinkContextMenu: (
            menu: Menu,
            path: string,
            currentPath: string,
            unknown = undefined
        ) => void;
        editorSuggest: {
            currentSuggest: EditorSuggest<any> | null;
            suggests: EditorSuggest<any>[];
            removeSuggest(suggest: EditorSuggest<any>): void;
        };
        createLeafInTabGroup(root: WorkspaceParent): WorkspaceLeaf;
        getRecentFiles(): string[];
    }
    interface App {
        hotkeyManager: {
            printHotkeyForCommand(command_id: string): string;
            getHotkeys(command_id: string);
            getDefaultHotkeys(command_id: string);
        };
        dom: any;
        plugins: {
            plugins: Plugin[];
        };
        commands: {
            registerCommand(command: string, callback: () => void): void;
            executeCommand(command: Command);
            listCommands(): Command[];
        };
        setting: {
            open(): void;
            openTabById(id: string): { setQuery(query: string): void };
        };
    }
    interface DataAdapter {
        getBasePath: () => string;
    }
    interface Menu {
        addSections: (sections: string[]) => this;
        setParentElement: (element: HTMLElement) => this;
    }
    interface MetadataCache {
        getTags(): { [k: `#${string}`]: number };
        userIgnoreFilterCache: { [k: string]: boolean };
    }
    interface WorkspaceParent {
        id: string;
    }
    interface Scope {
        keys: any[];
    }
    interface SuggestModal<T> {
        chooser: {
            values: T[];
            suggestions: HTMLElement;
            selectedItem: number;
            addMessage(emptyStateText: string): unknown;
            setSuggestions(arg0: T[]): void;
            setSelectedItem(index: number, e: KeyboardEvent): void;
        };
    }
    interface EditorSuggest<T> {
        suggestions: {
            chooser: this;
            containerEl: HTMLDivElement;
            selectedItem: number;
            suggestions: Array<HTMLDivElement>;
            values: T[];
            useSelectedItem(e: KeyboardEvent): boolean;
        };
    }
}
