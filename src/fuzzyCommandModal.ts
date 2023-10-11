import { App, Hotkey, Modifier, Platform } from "obsidian";
import FuzzyModal from "./fuzzyModal";
import { PinyinIndex as PI, Pinyin, MatchData } from "./utils";
import FuzzyChinesePinyinPlugin from "./main";

type Item = {
    name: string;
    pinyin: Pinyin<Item>;
    command: any;
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

export default class FuzzyCommandModal extends FuzzyModal<Item> {
    historyCommand: Array<Item>;
    constructor(app: App, plugin: FuzzyChinesePinyinPlugin) {
        super(app, plugin);
        this.index = this.plugin.addChild(new PinyinIndex(this.app, this.plugin));
        this.historyCommand = [];
        this.emptyStateText = "未发现命令。";
        this.setPlaceholder("输入命令……");
        let prompt = [
            {
                command: "↵",
                purpose: "使用",
            },
            {
                command: "esc",
                purpose: "退出",
            },
        ];
        this.setInstructions(prompt);
    }
    onOpen() {
        super.onOpen();
        this.index.update();
    }
    getEmptyInputSuggestions(): MatchData<Item>[] {
        return this.historyCommand
            .concat(this.index.items.filter((p) => !this.historyCommand.includes(p)))
            .slice(0, 100)
            .map((p) => {
                return { item: p, score: 0, range: null };
            });
    }
    onChooseSuggestion(matchData: MatchData<Item>, evt: MouseEvent | KeyboardEvent) {
        this.historyCommand = this.historyCommand.filter((p) => p.command.id != matchData.item.command.id);
        this.historyCommand.unshift(matchData.item);
        app.commands.executeCommand(matchData.item.command);
    }
    renderSuggestion(matchData: MatchData<Item>, el: HTMLElement): void {
        el.addClass("fz-item");
        let range = matchData.range,
            text = matchData.item.name,
            index = 0,
            e_content = el.createEl("span", { cls: "fz-suggestion-content" }),
            e_aux = el.createEl("span", { cls: "fz-suggestion-aux" });

        const customHotkeys = this.app.hotkeyManager.getHotkeys(matchData.item.command.id);
        const defaultHotkeys = this.app.hotkeyManager.getDefaultHotkeys(matchData.item.command.id);
        const hotkeys = customHotkeys || defaultHotkeys || [];

        if (range) {
            for (const r of range) {
                e_content.appendText(text.slice(index, r[0]));
                e_content.createSpan({ cls: "suggestion-highlight", text: text.slice(r[0], r[1] + 1) });
                index = r[1] + 1;
            }
        }
        e_content.appendText(text.slice(index));

        hotkeys.forEach((hotkey) => {
            e_aux.createEl("kbd", {
                cls: "suggestion-command",
                text: generateHotKeyText(hotkey),
            });
        });
    }
}
class PinyinIndex extends PI<Item> {
    constructor(app: App, plugin: FuzzyChinesePinyinPlugin) {
        super(app, plugin);
        this.id = "command";
    }
    initEvent() {}
    initIndex() {
        let commands = app.commands.listCommands();
        this.items = commands.map((command) => {
            let item = {
                name: command.name,
                pinyin: new Pinyin(command.name, this.plugin),
                command: command,
            };
            return item;
        });
    }
    update() {
        let commands = app.commands.listCommands();
        let oldCommandsNames = this.items.map((item) => item.name);
        let newCommandsNames = commands.map((command) => command.name);
        let addedCommands = newCommandsNames.filter((command) => !oldCommandsNames.includes(command));
        let removedCommands = oldCommandsNames.filter((command) => !newCommandsNames.includes(command));
        if (addedCommands.length > 0) {
            // 添加新命令
            this.items.push(
                ...addedCommands.map((command) => {
                    let item = {
                        name: command,
                        pinyin: new Pinyin(command, this.plugin),
                        command: commands.find((p) => p.name == command),
                    };
                    return item;
                })
            );
        }
        if (removedCommands.length > 0) {
            // 删除旧命令
            this.items = this.items.filter((item) => !removedCommands.includes(item.name));
        }
    }
}
