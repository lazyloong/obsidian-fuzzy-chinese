import { App, Notice, PluginSettingTab, Setting } from 'obsidian';
import { pinyinEngine } from '@/engine/pinyinEngine';
import ThePlugin from '@/main';
import { TheSettings } from '@/settings';
import { PinyinSuggest, arraySwap } from '@/utils';
import { createToggle } from '@/settingFactory';
import { openFileKeyMap } from './modal/fileModal';
import FuzzyPinyinSettingModal from '@/modal/fuzzyPinyinSettingModal';

export default class SettingTab extends PluginSettingTab {
  plugin: ThePlugin;
  constructor(app: App, plugin: ThePlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display(): void {
    this.containerEl.empty();
    this.containerEl.createEl('h1', { text: '设置' });
    this.addGlobalSetting();
    this.addFileSetting();
    this.addHeadingSetting();
    this.addCommandSettings();
    this.addOtherSetting();
  }
  addGlobalSetting() {
    this.containerEl.createEl('h2', { text: '全局' });
    const { global } = this.plugin.settings;
    createToggle(
      this.containerEl,
      'Backspace 关闭搜索',
      '当输入框为空时按下 Backspace 关闭搜索',
      () => global.closeWithBackspace,
      (v) => { global.closeWithBackspace = v; },
      this.plugin,
    );
    createToggle(
      this.containerEl,
      '繁体支持',
      undefined,
      () => global.traditionalChineseSupport,
      (v) => { global.traditionalChineseSupport = v; },
      this.plugin,
      () => this.plugin.loadPinyinDict(),
    );
    const doublePinyinOptions = pinyinEngine.listSchemes().reduce(
      (acc, cur) => {
        acc[cur] = cur;
        return acc;
      },
      {
        全拼: '全拼',
      }
    );
    new Setting(this.containerEl).setName('双拼方案').addDropdown((cb) =>
      cb
        .addOptions(doublePinyinOptions)
        .setValue(global.doublePinyin)
        .onChange(async (value: string) => {
          if (global.doublePinyin == value) return;
          if (global.fuzzyPinyin && value != '全拼') {
            new Notice('模糊音搜索已开启，无法切换双拼方案');
            cb.setValue('全拼');
            return;
          }
          if (global.palladius && value !== '全拼') {
            new Notice('俄文转拼音已开启，无法切换双拼方案');
            cb.setValue('全拼');
            return;
          }
          global.doublePinyin = value;
          this.plugin.loadPinyinDict();
          this.plugin.indexManager.refresh();
          new Notice('双拼方案切换为：' + value, 4000);
          await this.plugin.saveSettings();
        })
    );
    new Setting(this.containerEl).setName('模糊音').addToggle((cb) =>
      cb.setValue(global.fuzzyPinyin).onChange(async (value) => {
        if (global.fuzzyPinyin == value) return;
        if (global.doublePinyin != '全拼' && value) {
          new Notice('请将双拼模式设置为全拼模式，否则将无法使用模糊音。');
          cb.setValue(false);
          return;
        }
        global.fuzzyPinyin = value;
        await this.plugin.saveSettings();
        if (global.fuzzyPinyinSetting.length != 0) this.plugin.indexManager.refresh();
        this.display();
      })
    );
    if (global.fuzzyPinyin)
      new Setting(this.containerEl).setName('模糊音设置').addButton((cb) =>
        cb.setIcon('settings').onClick(() => {
          new FuzzyPinyinSettingModal(this.plugin).open();
        })
      );
    createToggle(
      this.containerEl,
      '俄语拼音',
      undefined,
      () => global.palladius,
      (v) => {
        if (global.doublePinyin !== '全拼' && v) {
          new Notice('请将双拼模式设置为全拼，否则无法使用俄语拼音。');
        }
        global.palladius = v;
      },
      this.plugin,
      () => {
        this.plugin.loadPinyinDict();
        this.plugin.indexManager.refresh();
      },
    );
    createToggle(
      this.containerEl,
      '自动大小写敏感',
      undefined,
      () => global.autoCaseSensitivity,
      (v) => { global.autoCaseSensitivity = v; },
      this.plugin,
    );
  }
  addFileSetting() {
    this.containerEl.createEl('h2', { text: '文件搜索' });
    const { file } = this.plugin.settings;
    createToggle(
      this.containerEl,
      '显示附件',
      '显示如图片、视频、PDF等附件文件。',
      () => file.showAttachments,
      (v) => { file.showAttachments = v; },
      this.plugin,
    );
    createToggle(
      this.containerEl,
      '显示所有类型文件',
      undefined,
      () => file.showAllFileTypes,
      (v) => { file.showAllFileTypes = v; },
      this.plugin,
    );
    createToggle(
      this.containerEl,
      '显示未完成链接',
      undefined,
      () => file.showUnresolvedLink,
      (v) => { file.showUnresolvedLink = v; },
      this.plugin,
    );
    createToggle(
      this.containerEl,
      '使用路径搜索',
      '当搜索结果少于10个时搜索路径',
      () => file.usePathToSearch,
      (v) => { file.usePathToSearch = v; },
      this.plugin,
    );
    createToggle(
      this.containerEl,
      '显示 Tag',
      undefined,
      () => file.showTags,
      (v) => { file.showTags = v; },
      this.plugin,
    );
    new Setting(this.containerEl)
      .setName('使用双链建议')
      .setDesc('输入[[的时候文件连接能支持中文拼音搜索（实验性功能）')
      .addToggle((cb) =>
        cb.setValue(file.useFileEditorSuggest).onChange(async (value) => {
          file.useFileEditorSuggest = value;
          if (value) {
            this.app.workspace.editorSuggest.suggests.unshift(this.plugin.fileEditorSuggest);
          } else {
            this.app.workspace.editorSuggest.removeSuggest(this.plugin.fileEditorSuggest);
          }
          await this.plugin.saveSettings();
        })
      );
    new Setting(this.containerEl).setName('附带标签搜索').addToggle((cb) =>
      cb.setValue(file.searchWithTag).onChange(async (value: boolean) => {
        file.searchWithTag = value;
        if (value) this.plugin.fileModal.tagInput.show();
        else this.plugin.fileModal.tagInput.hide();
        await this.plugin.saveSettings();
      })
    );
    new Setting(this.containerEl)
      .setName('快速选择历史文件')
      .setDesc('输入栏为空时，空格加 asdf... 或 1234... 快速选择历史文件')
      .addToggle((cb) => {
        cb.setValue(file.quicklySelectHistoryFiles).onChange(async (value) => {
          file.quicklySelectHistoryFiles = value;
          await this.plugin.saveSettings();
          this.display();
        });
      });
    if (file.quicklySelectHistoryFiles)
      new Setting(this.containerEl).setName('快速选择历史文件提示').addDropdown((cb) => {
        cb.addOptions({
          asdfjklgh: 'asdfjklgh',
          '1234567890': '1234567890',
        })
          .setValue(file.quicklySelectHistoryFilesHint)
          .onChange(async (value) => {
            file.quicklySelectHistoryFilesHint = value;
            await this.plugin.saveSettings();
          });
      });
    new Setting(this.containerEl)
      .setName('附件后缀')
      .setDesc('只显示这些后缀的附件')
      .addTextArea((cb) => {
        cb.inputEl.addClass('fuzzy-chinese-attachment-extensions');
        cb.setValue(file.attachmentExtensions.join('\n')).onChange(async (value) => {
          file.attachmentExtensions = value
            .trim()
            .split('\n')
            .map((x) => x.trim());
          await this.plugin.saveSettings();
        });
      });

    this.containerEl.createEl('h3', { text: '快捷键功能' });
    const keys = ['keyEnter', 'keyCtrlEnter', 'keyAltEnter', 'keyCtrlAltEnter'];
    const g = Object.keys(openFileKeyMap);
    keys.forEach((key) => {
      new Setting(this.containerEl)
        .setName(
          `${key
            .slice(3)
            .replace(/([A-Z])/g, ' $1')
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
            .setValue(file[key])
            .onChange(async (value) => {
              file[key] = value;
              await this.plugin.saveSettings();
            })
        );
    });
    new Setting(this.containerEl).setName('重置快捷键功能').addButton((cb) =>
      cb.setIcon('refresh-ccw').onClick(async () => {
        keys.forEach((key, i) => {
          file[key] = g[i];
        });
        await this.plugin.saveSettings();
        this.display();
      })
    );
  }
  addHeadingSetting() {
    this.containerEl.createEl('h2', { text: '标题搜索' });
    const { heading } = this.plugin.settings;
    createToggle(
      this.containerEl,
      '显示第一级标题',
      undefined,
      () => heading.showFirstLevelHeading,
      (v) => { heading.showFirstLevelHeading = v; },
      this.plugin,
    );
    createToggle(
      this.containerEl,
      '搜索结果缩进',
      undefined,
      () => heading.headingIndent,
      (v) => { heading.headingIndent = v; },
      this.plugin,
    );
  }
  addCommandSettings() {
    this.containerEl.createEl('h2', { text: '命令' });
    const { command } = this.plugin.settings;
    this.addPinnedCommands();
    new Setting(this.containerEl)
      .setName('新的置顶命令')
      .setDesc('在你未进行检索时，置顶命令将优先出现在命令面板的顶端。')
      .addSearch((cb) => {
        let commandSuggest = new PinyinSuggest(cb.inputEl, this.plugin);
        commandSuggest.getItemFunction = (query) => this.plugin.commandModal.getSuggestions(query);
        cb.setPlaceholder('输入命令……').onChange(async (value) => {
          let commands = this.app.commands.listCommands().map((p) => p.name);
          if (!commands.includes(value)) return;
          command.pinnedCommands.push(value);
          await this.plugin.saveSettings();
          this.display();
        });
      });
  }
  addPinnedCommands() {
    const { command } = this.plugin.settings;
    const { pinnedCommands } = command;
    if (pinnedCommands.length === 0) {
      new Setting(this.containerEl).setName('没有置顶命令');
      return;
    }
    pinnedCommands.forEach((commandStr, index) => {
      new Setting(this.containerEl)
        .setName(commandStr)
        .addExtraButton((cb) =>
          cb
            .setIcon('x')
            .setTooltip('删除')
            .onClick(() => {
              command.pinnedCommands = command.pinnedCommands.filter((x) => x !== commandStr);
              this.plugin.saveSettings();
              this.display();
            })
        )
        .addExtraButton((cb) => {
          cb.setIcon('up-chevron-glyph')
            .setTooltip('Move up')
            .onClick(() => {
              arraySwap(command.pinnedCommands, index, index - 1);
              this.plugin.saveSettings();
              this.display();
            });
        })
        .addExtraButton((cb) => {
          cb.setIcon('down-chevron-glyph')
            .setTooltip('Move down')
            .onClick(() => {
              arraySwap(command.pinnedCommands, index, index + 1);
              this.plugin.saveSettings();
              this.display();
            });
        });
    });
  }
  addOtherSetting() {
    this.containerEl.createEl('h2', { text: '其他' });
    const { other } = this.plugin.settings;
    new Setting(this.containerEl)
      .setName('使用标签建议')
      .setDesc('实验性功能')
      .addToggle((cb) =>
        cb.setValue(other.useTagEditorSuggest).onChange(async (value) => {
          other.useTagEditorSuggest = value;
          if (value) {
            this.app.workspace.editorSuggest.suggests.unshift(this.plugin.tagEditorSuggest);
          } else {
            this.app.workspace.editorSuggest.removeSuggest(this.plugin.tagEditorSuggest);
          }
          await this.plugin.saveSettings();
        })
      );
    new Setting(this.containerEl).setName('重建索引').addButton((cb) =>
      cb.setButtonText('重建').onClick(async () => {
        this.plugin.indexManager.refresh();
      })
    );
    createToggle(
      this.containerEl,
      'dev 模式',
      '将索引存储到 global 以便重启时不重建索引',
      () => other.devMode,
      (v) => { other.devMode = v; },
      this.plugin,
    );
  }
}
