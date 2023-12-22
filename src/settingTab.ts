import { App, Notice, PluginSettingTab, Setting } from "obsidian";
import DoublePinyinDict from "./double_pinyin";
import FuzzyChinesePinyinPlugin from "./main";
import { Item, MatchData, arraymove, fullPinyin2doublePinyin } from "./utils";
import { TextInputSuggest } from "templater/src/settings/suggesters/suggest";

export default class SettingTab extends PluginSettingTab {
    plugin: FuzzyChinesePinyinPlugin;
    constructor(app: App, plugin: FuzzyChinesePinyinPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }
    display(): void {
        this.containerEl.empty();
        this.containerEl.createEl("h1", { text: "设置" });
        this.addGlobalSetting();
        this.addFileSetting();
        this.addCommandSettings();
        this.addOtherSetting();
    }
    addGlobalSetting() {
        this.containerEl.createEl("h2", { text: "全局" });
        new Setting(this.containerEl)
            .setName("Backspace 关闭搜索")
            .setDesc("当输入框为空时按下 Backspace 关闭搜索")
            .addToggle((cb) =>
                cb.setValue(this.plugin.settings.global.closeWithBackspace).onChange(async (value) => {
                    this.plugin.settings.global.closeWithBackspace = value;
                    await this.plugin.saveSettings();
                })
            );
        new Setting(this.containerEl).setName("繁体支持").addToggle((cb) => {
            cb.setValue(this.plugin.settings.global.traditionalChineseSupport).onChange(async (value) => {
                this.plugin.settings.global.traditionalChineseSupport = value;
                await this.plugin.saveSettings();
                this.plugin.loadPinyinDict();
            });
        });
        new Setting(this.containerEl).setName("双拼方案").addDropdown((cb) =>
            cb
                .addOptions({
                    全拼: "全拼",
                    智能ABC: "智能ABC",
                    小鹤双拼: "小鹤双拼",
                    微软双拼: "微软双拼",
                })
                .setValue(this.plugin.settings.global.doublePinyin)
                .onChange(async (value: string) => {
                    this.plugin.settings.global.doublePinyin = value;
                    this.plugin.pinyinDict.keys =
                        value == "全拼"
                            ? this.plugin.pinyinDict.originalKeys
                            : this.plugin.pinyinDict.originalKeys.map((p) => fullPinyin2doublePinyin(p, DoublePinyinDict[value]));
                    this.plugin.fileModal.index.initIndex();
                    new Notice("双拼方案切换为：" + value, 4000);
                    await this.plugin.saveSettings();
                })
        );
        new Setting(this.containerEl).setName("自动大小写敏感").addToggle((cb) => {
            cb.setValue(this.plugin.settings.global.autoCaseSensitivity).onChange(async (value) => {
                this.plugin.settings.global.autoCaseSensitivity = value;
                await this.plugin.saveSettings();
            });
        });
    }
    addFileSetting() {
        this.containerEl.createEl("h2", { text: "文件搜索" });
        new Setting(this.containerEl)
            .setName("显示附件")
            .setDesc("显示如图片、视频、PDF等附件文件。")
            .addToggle((cb) =>
                cb.setValue(this.plugin.settings.file.showAttachments).onChange(async (value) => {
                    this.plugin.settings.file.showAttachments = value;
                    await this.plugin.saveSettings();
                })
            );
        new Setting(this.containerEl).setName("显示所有类型文件").addToggle((cb) =>
            cb.setValue(this.plugin.settings.file.showAllFileTypes).onChange(async (value) => {
                this.plugin.settings.file.showAllFileTypes = value;
                await this.plugin.saveSettings();
            })
        );
        new Setting(this.containerEl)
            .setName("使用路径搜索")
            .setDesc("当搜索结果少于10个时搜索路径")
            .addToggle((cb) =>
                cb.setValue(this.plugin.settings.file.usePathToSearch).onChange(async (value) => {
                    this.plugin.settings.file.usePathToSearch = value;
                    await this.plugin.saveSettings();
                })
            );
        new Setting(this.containerEl).setName("显示路径").addToggle((cb) =>
            cb.setValue(this.plugin.settings.file.showPath).onChange(async (value) => {
                this.plugin.settings.file.showPath = value;
                await this.plugin.saveSettings();
            })
        );
        new Setting(this.containerEl).setName("显示 Tag").addToggle((cb) =>
            cb.setValue(this.plugin.settings.file.showTags).onChange(async (value) => {
                this.plugin.settings.file.showTags = value;
                await this.plugin.saveSettings();
            })
        );
        new Setting(this.containerEl)
            .setName("使用双链建议")
            .setDesc("输入[[的时候文件连接能支持中文拼音搜索（实验性功能）")
            .addToggle((cb) =>
                cb.setValue(this.plugin.settings.file.useFileEditorSuggest).onChange(async (value) => {
                    this.plugin.settings.file.useFileEditorSuggest = value;
                    if (value) {
                        this.app.workspace.editorSuggest.suggests.unshift(this.plugin.fileEditorSuggest);
                    } else {
                        this.app.workspace.editorSuggest.removeSuggest(this.plugin.fileEditorSuggest);
                    }
                    await this.plugin.saveSettings();
                })
            );
        new Setting(this.containerEl).setName("历史记录").addDropdown((cb) =>
            cb
                .addOptions({
                    使用完整路径: "使用完整路径",
                    仅使用文件名: "仅使用文件名",
                })
                .setValue(this.plugin.settings.file.historyDisplay)
                .onChange(async (value: string) => {
                    this.plugin.settings.file.historyDisplay = value;
                    await this.plugin.saveSettings();
                })
        );
        new Setting(this.containerEl)
            .setName("附件后缀")
            .setDesc("只显示这些后缀的附件")
            .addTextArea((cb) => {
                cb.inputEl.addClass("fuzzy-chinese-attachment-extensions");
                cb.setValue(this.plugin.settings.file.attachmentExtensions.join("\n")).onChange(async (value) => {
                    this.plugin.settings.file.attachmentExtensions = value
                        .trim()
                        .split("\n")
                        .map((x) => x.trim());
                    await this.plugin.saveSettings();
                });
            });
    }
    addCommandSettings() {
        this.containerEl.createEl("h2", { text: "命令" });
        this.addPinnedCommands();
        new Setting(this.containerEl)
            .setName("新的置顶命令")
            .setDesc("在你未进行检索时，置顶命令将优先出现在命令面板的顶端。")
            .addSearch((cb) => {
                new CommandSuggest(cb.inputEl, this.plugin);
                cb.setPlaceholder("输入命令……").onChange(async (value) => {
                    let commands = this.app.commands.listCommands().map((p) => p.name);
                    if (!commands.includes(value)) return;
                    this.plugin.settings.command.pinnedCommands.push(value);
                    await this.plugin.saveSettings();
                    this.display();
                });
            });
    }
    addPinnedCommands() {
        this.plugin.settings.command.pinnedCommands.forEach((command, index) => {
            new Setting(this.containerEl)
                .setName(command)
                .addExtraButton((cb) =>
                    cb
                        .setIcon("x")
                        .setTooltip("删除")
                        .onClick(() => {
                            this.plugin.settings.command.pinnedCommands = this.plugin.settings.command.pinnedCommands.filter(
                                (x) => x !== command
                            );
                            this.plugin.saveSettings();
                            this.display();
                        })
                )
                .addExtraButton((cb) => {
                    cb.setIcon("up-chevron-glyph")
                        .setTooltip("Move up")
                        .onClick(() => {
                            arraymove(this.plugin.settings.command.pinnedCommands, index, index - 1);
                            this.plugin.saveSettings();
                            this.display();
                        });
                })
                .addExtraButton((cb) => {
                    cb.setIcon("down-chevron-glyph")
                        .setTooltip("Move down")
                        .onClick(() => {
                            arraymove(this.plugin.settings.command.pinnedCommands, index, index + 1);
                            this.plugin.saveSettings();
                            this.display();
                        });
                });
        });
    }
    addOtherSetting() {
        this.containerEl.createEl("h2", { text: "其他" });
        new Setting(this.containerEl)
            .setName("使用标签建议")
            .setDesc("实验性功能")
            .addToggle((cb) =>
                cb.setValue(this.plugin.settings.other.useTagEditorSuggest).onChange(async (value) => {
                    this.plugin.settings.other.useTagEditorSuggest = value;
                    if (value) {
                        this.app.workspace.editorSuggest.suggests.unshift(this.plugin.tagEditorSuggest);
                    } else {
                        this.app.workspace.editorSuggest.removeSuggest(this.plugin.tagEditorSuggest);
                    }
                    await this.plugin.saveSettings();
                })
            );
        new Setting(this.containerEl)
            .setName("dev 模式")
            .setDesc("将索引存储到 global 以便重启时不重建索引")
            .addToggle((cb) =>
                cb.setValue(this.plugin.settings.other.devMode).onChange(async (value) => {
                    this.plugin.settings.other.devMode = value;
                    await this.plugin.saveSettings();
                })
            );
    }
}

export class CommandSuggest extends TextInputSuggest<MatchData<Item>> {
    plugin: FuzzyChinesePinyinPlugin;
    constructor(inputEl: HTMLInputElement | HTMLTextAreaElement, plugin: FuzzyChinesePinyinPlugin) {
        super(inputEl);
        this.plugin = plugin;
    }
    getSuggestions(inputStr: string): MatchData<Item>[] {
        return this.plugin.commandModal.getSuggestions(inputStr);
    }

    renderSuggestion(matchData: MatchData<Item>, el: HTMLElement): void {
        el.setText(matchData.item.name);
    }

    selectSuggestion(matchData: MatchData<Item>): void {
        this.inputEl.value = matchData.item.name;
        this.inputEl.trigger("input");
        this.close();
    }
}
