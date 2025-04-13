import { App, Modal, Notice, PluginSettingTab, Setting } from "obsidian";
import { xor } from "lodash";
import DoubleDict from "@/dict/double_pinyin";
import ThePlugin from "@/main";
import { FuzzyPinyinDict, PinyinSuggest, arraymove, fullPinyin2doublePinyin } from "@/utils";
import { openFileKeyMap } from "./modal/fileModal";

export default class SettingTab extends PluginSettingTab {
    plugin: ThePlugin;
    constructor(app: App, plugin: ThePlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }
    display(): void {
        this.containerEl.empty();
        this.containerEl.createEl("h1", { text: "设置" });
        this.addGlobalSetting();
        this.addFileSetting();
        this.addHeadingSetting();
        this.addCommandSettings();
        this.addOtherSetting();
    }
    addGlobalSetting() {
        this.containerEl.createEl("h2", { text: "全局" });
        new Setting(this.containerEl)
            .setName("Backspace 关闭搜索")
            .setDesc("当输入框为空时按下 Backspace 关闭搜索")
            .addToggle((cb) =>
                cb
                    .setValue(this.plugin.settings.global.closeWithBackspace)
                    .onChange(async (value) => {
                        this.plugin.settings.global.closeWithBackspace = value;
                        await this.plugin.saveSettings();
                    })
            );
        new Setting(this.containerEl).setName("繁体支持").addToggle((cb) => {
            cb.setValue(this.plugin.settings.global.traditionalChineseSupport).onChange(
                async (value) => {
                    this.plugin.settings.global.traditionalChineseSupport = value;
                    await this.plugin.saveSettings();
                    this.plugin.loadPinyinDict();
                }
            );
        });
        const doublePinyinOptions = Object.keys(DoubleDict).reduce(
            (acc, cur) => {
                acc[cur] = cur;
                return acc;
            },
            {
                全拼: "全拼",
            }
        );
        new Setting(this.containerEl).setName("双拼方案").addDropdown((cb) =>
            cb
                .addOptions(doublePinyinOptions)
                .setValue(this.plugin.settings.global.doublePinyin)
                .onChange(async (value: keyof typeof DoubleDict | "全拼") => {
                    if (this.plugin.settings.global.doublePinyin == value) return;
                    if (this.plugin.settings.global.fuzzyPinyin && value != "全拼") {
                        new Notice("模糊音搜索已开启，无法切换双拼方案");
                        cb.setValue("全拼");
                        return;
                    }
                    this.plugin.settings.global.doublePinyin = value;
                    this.plugin.pinyinDict.keys =
                        value == "全拼"
                            ? this.plugin.pinyinDict.originalKeys
                            : this.plugin.pinyinDict.originalKeys.map((p) =>
                                  fullPinyin2doublePinyin(p, DoubleDict[value])
                              );
                    this.plugin.indexManager.refresh();
                    new Notice("双拼方案切换为：" + value, 4000);
                    await this.plugin.saveSettings();
                })
        );
        new Setting(this.containerEl).setName("模糊音").addToggle((cb) =>
            cb.setValue(this.plugin.settings.global.fuzzyPinyin).onChange(async (value) => {
                if (this.plugin.settings.global.fuzzyPinyin == value) return;
                if (this.plugin.settings.global.doublePinyin != "全拼" && value) {
                    new Notice("双拼方案不支持模糊音，无法开启模糊音搜索");
                    cb.setValue(false);
                    return;
                }
                this.plugin.settings.global.fuzzyPinyin = value;
                await this.plugin.saveSettings();
                if (this.plugin.settings.global.fuzzyPinyinSetting.length != 0)
                    this.plugin.indexManager.refresh();
                this.display();
            })
        );
        if (this.plugin.settings.global.fuzzyPinyin)
            new Setting(this.containerEl).setName("模糊音设置").addButton((cb) =>
                cb.setIcon("settings").onClick(() => {
                    new FuzzyPinyinSettingModal(this.plugin).open();
                })
            );
        new Setting(this.containerEl).setName("自动大小写敏感").addToggle((cb) =>
            cb.setValue(this.plugin.settings.global.autoCaseSensitivity).onChange(async (value) => {
                this.plugin.settings.global.autoCaseSensitivity = value;
                await this.plugin.saveSettings();
            })
        );
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
        new Setting(this.containerEl).setName("显示未完成链接").addToggle((cb) =>
            cb.setValue(this.plugin.settings.file.showUnresolvedLink).onChange(async (value) => {
                this.plugin.settings.file.showUnresolvedLink = value;
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
                cb
                    .setValue(this.plugin.settings.file.useFileEditorSuggest)
                    .onChange(async (value) => {
                        this.plugin.settings.file.useFileEditorSuggest = value;
                        if (value) {
                            this.app.workspace.editorSuggest.suggests.unshift(
                                this.plugin.fileEditorSuggest
                            );
                        } else {
                            this.app.workspace.editorSuggest.removeSuggest(
                                this.plugin.fileEditorSuggest
                            );
                        }
                        await this.plugin.saveSettings();
                    })
            );
        new Setting(this.containerEl).setName("附带标签搜索").addToggle((cb) =>
            cb
                .setValue(this.plugin.settings.file.searchWithTag)
                .onChange(async (value: boolean) => {
                    this.plugin.settings.file.searchWithTag = value;
                    if (value) this.plugin.fileModal.tagInput.show();
                    else this.plugin.fileModal.tagInput.hide();
                    await this.plugin.saveSettings();
                })
        );
        new Setting(this.containerEl)
            .setName("快速选择历史文件")
            .setDesc("输入栏为空时，空格加 asdf... 或 1234... 快速选择历史文件")
            .addToggle((cb) => {
                cb.setValue(this.plugin.settings.file.quicklySelectHistoryFiles).onChange(
                    async (value) => {
                        this.plugin.settings.file.quicklySelectHistoryFiles = value;
                        await this.plugin.saveSettings();
                        this.display();
                    }
                );
            });
        if (this.plugin.settings.file.quicklySelectHistoryFiles)
            new Setting(this.containerEl).setName("快速选择历史文件提示").addDropdown((cb) => {
                cb.addOptions({
                    asdfjklgh: "asdfjklgh",
                    "1234567890": "1234567890",
                })
                    .setValue(this.plugin.settings.file.quicklySelectHistoryFilesHint)
                    .onChange(async (value) => {
                        this.plugin.settings.file.quicklySelectHistoryFilesHint = value;
                        await this.plugin.saveSettings();
                    });
            });
        new Setting(this.containerEl)
            .setName("附件后缀")
            .setDesc("只显示这些后缀的附件")
            .addTextArea((cb) => {
                cb.inputEl.addClass("fuzzy-chinese-attachment-extensions");
                cb.setValue(this.plugin.settings.file.attachmentExtensions.join("\n")).onChange(
                    async (value) => {
                        this.plugin.settings.file.attachmentExtensions = value
                            .trim()
                            .split("\n")
                            .map((x) => x.trim());
                        await this.plugin.saveSettings();
                    }
                );
            });

        this.containerEl.createEl("h3", { text: "快捷键功能" });
        const keys = ["keyEnter", "keyCtrlEnter", "keyAltEnter", "keyCtrlAltEnter"];
        const g = Object.keys(openFileKeyMap);
        keys.forEach((key) => {
            new Setting(this.containerEl)
                .setName(
                    `${key
                        .slice(3)
                        .replace(/([A-Z])/g, " $1")
                        .trim()} 功能`
                )
                .addDropdown((cb) =>
                    cb
                        .addOptions(
                            g.reduce((a, c) => {
                                a[c] = c;
                                return a;
                            }, {})
                        )
                        .setValue(this.plugin.settings.file[key])
                        .onChange(async (value) => {
                            this.plugin.settings.file[key] = value;
                            await this.plugin.saveSettings();
                        })
                );
        });
        new Setting(this.containerEl).setName("重置快捷键功能").addButton((cb) =>
            cb.setIcon("refresh-ccw").onClick(async () => {
                keys.forEach((key, i) => {
                    this.plugin.settings.file[key] = g[i];
                });
                await this.plugin.saveSettings();
                this.display();
            })
        );
    }
    addHeadingSetting() {
        this.containerEl.createEl("h2", { text: "标题搜索" });
        new Setting(this.containerEl).setName("显示第一级标题").addToggle((cb) =>
            cb
                .setValue(this.plugin.settings.heading.showFirstLevelHeading)
                .onChange(async (value) => {
                    this.plugin.settings.heading.showFirstLevelHeading = value;
                    await this.plugin.saveSettings();
                })
        );
        new Setting(this.containerEl).setName("搜索结果缩进").addToggle((cb) =>
            cb.setValue(this.plugin.settings.heading.headingIndent).onChange(async (value) => {
                this.plugin.settings.heading.headingIndent = value;
                await this.plugin.saveSettings();
            })
        );
    }
    addCommandSettings() {
        this.containerEl.createEl("h2", { text: "命令" });
        this.addPinnedCommands();
        new Setting(this.containerEl)
            .setName("新的置顶命令")
            .setDesc("在你未进行检索时，置顶命令将优先出现在命令面板的顶端。")
            .addSearch((cb) => {
                let commandSuggest = new PinyinSuggest(cb.inputEl, this.plugin);
                commandSuggest.getItemFunction = (query) =>
                    this.plugin.commandModal.getSuggestions(query);
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
        const { pinnedCommands } = this.plugin.settings.command;
        if (pinnedCommands.length === 0) {
            new Setting(this.containerEl).setName("没有置顶命令");
            return;
        }
        pinnedCommands.forEach((command, index) => {
            new Setting(this.containerEl)
                .setName(command)
                .addExtraButton((cb) =>
                    cb
                        .setIcon("x")
                        .setTooltip("删除")
                        .onClick(() => {
                            this.plugin.settings.command.pinnedCommands =
                                this.plugin.settings.command.pinnedCommands.filter(
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
                            arraymove(
                                this.plugin.settings.command.pinnedCommands,
                                index,
                                index - 1
                            );
                            this.plugin.saveSettings();
                            this.display();
                        });
                })
                .addExtraButton((cb) => {
                    cb.setIcon("down-chevron-glyph")
                        .setTooltip("Move down")
                        .onClick(() => {
                            arraymove(
                                this.plugin.settings.command.pinnedCommands,
                                index,
                                index + 1
                            );
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
                cb
                    .setValue(this.plugin.settings.other.useTagEditorSuggest)
                    .onChange(async (value) => {
                        this.plugin.settings.other.useTagEditorSuggest = value;
                        if (value) {
                            this.app.workspace.editorSuggest.suggests.unshift(
                                this.plugin.tagEditorSuggest
                            );
                        } else {
                            this.app.workspace.editorSuggest.removeSuggest(
                                this.plugin.tagEditorSuggest
                            );
                        }
                        await this.plugin.saveSettings();
                    })
            );
        new Setting(this.containerEl).setName("重建索引").addButton((cb) =>
            cb.setButtonText("重建").onClick(async () => {
                this.plugin.indexManager.refresh();
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

export interface TheSettings {
    global: {
        traditionalChineseSupport: boolean;
        doublePinyin: keyof typeof DoubleDict | "全拼";
        fuzzyPinyin: boolean;
        fuzzyPinyinSetting: string[];
        closeWithBackspace: boolean;
        autoCaseSensitivity: boolean;
    };
    file: {
        showAllFileTypes: boolean;
        showAttachments: boolean;
        showUnresolvedLink: boolean;
        attachmentExtensions: Array<string>;
        usePathToSearch: boolean;
        useFileEditorSuggest: boolean;
        showTags: boolean;
        searchWithTag: boolean;
        quicklySelectHistoryFiles: boolean;
        quicklySelectHistoryFilesHint: string;
        keyEnter: keyof typeof openFileKeyMap;
        keyCtrlEnter: keyof typeof openFileKeyMap;
        keyAltEnter: keyof typeof openFileKeyMap;
        keyCtrlAltEnter: keyof typeof openFileKeyMap;
    };
    heading: {
        showFirstLevelHeading: boolean;
        headingIndent: boolean;
    };
    command: {
        pinnedCommands: Array<string>;
    };
    other: {
        useTagEditorSuggest: boolean;
        devMode: boolean;
    };
}

export const DEFAULT_SETTINGS: TheSettings = {
    global: {
        traditionalChineseSupport: false,
        doublePinyin: "全拼",
        fuzzyPinyin: false,
        fuzzyPinyinSetting: [],
        closeWithBackspace: false,
        autoCaseSensitivity: true,
    },
    file: {
        showAttachments: false,
        showAllFileTypes: false,
        showUnresolvedLink: false,
        quicklySelectHistoryFiles: false,
        quicklySelectHistoryFilesHint: "asdfjklgh",
        attachmentExtensions: [
            "bmp",
            "png",
            "jpg",
            "jpeg",
            "gif",
            "svg",
            "webp",
            "mp3",
            "wav",
            "m4a",
            "3gp",
            "flac",
            "ogg",
            "oga",
            "opus",
            "mp4",
            "webm",
            "ogv",
            "mov",
            "mkv",
            "pdf",
        ],
        usePathToSearch: false,
        useFileEditorSuggest: true,
        showTags: false,
        searchWithTag: true,
        keyEnter: "打开",
        keyCtrlEnter: "打开到新标签页",
        keyAltEnter: "打开到其他面板",
        keyCtrlAltEnter: "打开到新面板",
    },
    heading: {
        showFirstLevelHeading: true,
        headingIndent: true,
    },
    command: {
        pinnedCommands: [],
    },
    other: {
        useTagEditorSuggest: true,
        devMode: false,
    },
};

class FuzzyPinyinSettingModal extends Modal {
    tempSetting: string[] = [];
    constructor(public plugin: ThePlugin) {
        super(plugin.app);
        this.tempSetting = [...this.plugin.settings.global.fuzzyPinyinSetting];
    }
    onOpen() {
        this.display();
    }
    display() {
        const { contentEl } = this;
        let { fuzzyPinyinSetting } = this.plugin.settings.global;
        contentEl.empty();
        contentEl.createEl("h1", { text: "模糊音设置" });
        Object.entries(FuzzyPinyinDict).forEach(([key, value]) => {
            new Setting(contentEl).setName(`${value} => ${key}`).addToggle((cb) =>
                cb.setValue(fuzzyPinyinSetting.includes(key)).onChange(async (value) => {
                    if (value) {
                        if (!fuzzyPinyinSetting.includes(key)) fuzzyPinyinSetting.push(key);
                    } else fuzzyPinyinSetting = fuzzyPinyinSetting.filter((x) => x != key);
                    this.plugin.settings.global.fuzzyPinyinSetting = fuzzyPinyinSetting;
                    await this.plugin.saveSettings();
                })
            );
        });
    }
    onClose(): void {
        if (xor(this.tempSetting, this.plugin.settings.global.fuzzyPinyinSetting).length != 0)
            this.plugin.indexManager.refresh();
    }
}
