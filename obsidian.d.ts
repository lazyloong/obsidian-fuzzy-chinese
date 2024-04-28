import { EditorSuggest } from "obsidian";

declare module "obsidian" {
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
            executeCommand(command: Command);
            listCommands(): Command[];
        };
        setting: {
            open(): void;
            openTabById(id: string): { setQuery(query: string): void };
        };
    }
    interface MetadataCache {
        getTags(): { [k: `#${string}`]: number };
        userIgnoreFilterCache: { [k: string]: boolean };
    }
    interface Workspace {
        editorSuggest: {
            currentSuggest: EditorSuggest<any> | null;
            suggests: EditorSuggest<any>[];
            removeSuggest(suggest: EditorSuggest<any>): void;
        };
        createLeafInTabGroup(root: WorkspaceParent): WorkspaceLeaf;
    }
    interface WorkspaceLeaf {
        parent: WorkspaceParent;
        openLinkText(linktext: string, source: string): void;
    }
    interface WorkspaceParent {
        id: string;
    }
    interface Scope {
        keys: any[];
    }
}
