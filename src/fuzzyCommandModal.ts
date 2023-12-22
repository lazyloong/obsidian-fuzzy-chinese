import { App, Hotkey, Modifier, Platform, getIcon } from "obsidian";
import FuzzyModal from "./fuzzyModal";
import { PinyinIndex as PI, Pinyin, MatchData } from "./utils";
import FuzzyChinesePinyinPlugin from "./main";

type Item = {
    name: string;
    pinyin: Pinyin;
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
    historyCommands: Array<Item>;
    constructor(app: App, plugin: FuzzyChinesePinyinPlugin) {
        super(app, plugin);
        this.index = this.plugin.addChild(new PinyinIndex(this.app, this.plugin));
        this.historyCommands = [];
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
        let pinnedCommands: MatchData<Item>[] = this.plugin.settings.command.pinnedCommands.map(
                (p) => ({
                    item: this.index.items.find((q) => q.name == p),
                    score: -2,
                    range: null,
                })
            ),
            historyCommands: MatchData<Item>[] = this.historyCommands
                .filter((p) => !this.plugin.settings.command.pinnedCommands.includes(p.name))
                .map((p) => ({
                    item: this.index.items.find((q) => q.name == p.name),
                    score: -1,
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
                    score: 0,
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
                e_content.createSpan({
                    cls: "suggestion-highlight",
                    text: text.slice(r[0], r[1] + 1),
                });
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

        let e_flair = el.createEl("span", {
            cls: "suggestion-flair",
        });
        if (matchData.score == -2) e_flair.appendChild(getIcon("pin"));
        else if (matchData.score == -1) e_flair.appendChild(getIcon("history"));
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
        this.items = commands.map((command) => ({
            name: command.name,
            pinyin: new Pinyin(command.name, this.plugin),
            command: command,
        }));
    }
    update() {
        let commands = app.commands.listCommands();
        let oldCommandsNames = this.items.map((item) => item.name);
        let newCommandsNames = commands.map((command) => command.name);
        let addedCommands = newCommandsNames.filter(
            (command) => !oldCommandsNames.includes(command)
        );
        let removedCommands = oldCommandsNames.filter(
            (command) => !newCommandsNames.includes(command)
        );
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
