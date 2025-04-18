import { App, Command, Hotkey, Modifier, Platform } from "obsidian";
import ThePlugin from "@/main";
import {
    PinyinIndex as PI,
    Pinyin,
    MatchData,
    SuggestionRenderer,
    incrementalUpdate,
    copy,
} from "@/utils";
import FuzzyModal from "./modal";

type Item = {
    name: string;
    pinyin: Pinyin;
    command: Command;
};

const BASIC_MODIFIER_ICONS = {
    Mod: "Ctrl +",
    Ctrl: "Ctrl +",
    Meta: "Win +",
    Alt: "Alt +",
    Shift: "Shift +",
    Hyper: "Caps +",
};

const MAC_MODIFIER_ICONS = {
    Mod: "⌘",
    Ctrl: "^",
    Meta: "⌘",
    Alt: "⌥",
    Shift: "⇧",
    Hyper: "⇪",
};

const SPECIAL_KEYS: Record<string, string> = {
    TAB: "↹",
    ENTER: "↵",
    ARROWLEFT: "←",
    ARROWRIGHT: "→",
    ARROWUP: "↑",
    ARROWDOWN: "↓",
    BACKSPACE: "⌫",
    ESC: "Esc",
};

enum SpecialItemScore {
    pinned = 0,
    history = -1,
    common = -2,
}

function generateHotKeyText(hotkey: Hotkey): string {
    let modifierIcons = Platform.isMacOS ? MAC_MODIFIER_ICONS : BASIC_MODIFIER_ICONS;
    const hotKeyStrings: string[] = [];

    hotkey.modifiers.forEach((mod: Modifier) => {
        hotKeyStrings.push(modifierIcons[mod]);
    });

    const key = hotkey.key.toUpperCase();
    hotKeyStrings.push(SPECIAL_KEYS[key] || key);

    return hotKeyStrings.join(" ");
}

export default class CommandModal extends FuzzyModal<Item> {
    historyCommands: Array<Item>;
    constructor(app: App, plugin: ThePlugin) {
        super(app, plugin);
        this.index = this.plugin.addChild(new PinyinIndex(this.app, this.plugin));
        this.historyCommands = [];
        this.emptyStateText = "未发现命令。";
        this.setPlaceholder("输入命令……");
        this.scope.register(["Alt"], "N", async (e) => {
            let command = this.getChoosenItem().command;
            copy(command.name);
        });
        this.scope.register(["Alt"], "I", async (e) => {
            let command = this.getChoosenItem().command;
            copy(command.id);
        });
        this.scope.register(["Mod"], "O", async (e) => {
            app.setting.open();
            let settingTab = app.setting.openTabById("hotkeys");
            let command = this.getChoosenItem().command;
            settingTab.setQuery(command.name);
        });
        let prompt = [
            {
                command: "alt n",
                purpose: "复制名字",
            },
            {
                command: "alt i",
                purpose: "复制 ID",
            },
            {
                command: "ctrl o",
                purpose: "打开快捷键设置",
            },
        ];
        this.setInstructions(prompt);
    }
    onOpen() {
        super.onOpen();
        this.index.update();
    }
    getEmptyInputSuggestions(): MatchData<Item>[] {
        let pinnedCommands: MatchData<Item>[] = this.plugin.settings.command.pinnedCommands.map(
                (p) => ({
                    item: this.index.items.find((q) => q.name == p),
                    score: SpecialItemScore.pinned,
                    range: null,
                })
            ),
            historyCommands: MatchData<Item>[] = this.historyCommands
                .filter((p) => !this.plugin.settings.command.pinnedCommands.includes(p.name))
                .map((p) => ({
                    item: this.index.items.find((q) => q.name == p.name),
                    score: SpecialItemScore.history,
                    range: null,
                })),
            commonCommands: MatchData<Item>[] = this.index.items
                .filter(
                    (p) =>
                        !this.plugin.settings.command.pinnedCommands.includes(p.name) &&
                        !this.historyCommands.includes(p)
                )
                .map((p) => ({
                    item: p,
                    score: SpecialItemScore.common,
                    range: null,
                }));
        return pinnedCommands
            .concat(historyCommands)
            .concat(commonCommands)
            .filter((p) => p.item)
            .slice(0, 100);
    }
    onChooseSuggestion(matchData: MatchData<Item>, evt: MouseEvent | KeyboardEvent) {
        this.historyCommands = this.historyCommands.filter(
            (p) => p.command.id != matchData.item.command.id
        );
        this.historyCommands.unshift(matchData.item);
        this.app.commands.executeCommand(matchData.item.command);
    }
    renderSuggestion(matchData: MatchData<Item>, el: HTMLElement): void {
        let renderer = new SuggestionRenderer(el);
        renderer.render(matchData);

        let auxEl = el.createEl("span", { cls: "fz-suggestion-aux" });
        const customHotkeys = this.app.hotkeyManager.getHotkeys(matchData.item.command.id);
        const defaultHotkeys = this.app.hotkeyManager.getDefaultHotkeys(matchData.item.command.id);
        const hotkeys = customHotkeys || defaultHotkeys || [];
        hotkeys.forEach((hotkey: Hotkey) => {
            auxEl.createEl("kbd", {
                cls: "suggestion-command",
                text: generateHotKeyText(hotkey),
            });
        });

        if (matchData.score == SpecialItemScore.pinned) renderer.addIcon("pin");
        else if (matchData.score == SpecialItemScore.history) renderer.addIcon("history");
        if (renderer.hasIcon) renderer.flairEl.style.marginLeft = "10px";
    }
}

class PinyinIndex extends PI<Item> {
    constructor(app: App, plugin: ThePlugin) {
        super(app, plugin);
        this.id = "command";
    }
    initEvent() {}
    initIndex() {
        let commands: Command[] = this.app.commands.listCommands();
        this.items = commands.map((command) => ({
            name: command.name,
            pinyin: new Pinyin(command.name, this.plugin),
            command: command,
        }));
    }
    update() {
        let commands: Command[] = this.app.commands.listCommands();
        this.items = incrementalUpdate(
            this.items,
            () => commands.map((command) => command.name),
            (name) => ({
                name,
                pinyin: new Pinyin(name, this.plugin),
                command: commands.find((p) => p.name == name),
            })
        );
    }
}
