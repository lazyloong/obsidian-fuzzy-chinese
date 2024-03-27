import { EditorSuggest } from "obsidian";

declare module "obsidian" {
    interface App {
        hotkeyManager: {
            printHotkeyForCommand(command: string): string;
        };
        dom: any;
        plugins: {
            plugins: Plugin[];
        };
        commands: {
            listCommands(): Command[];
        };
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
