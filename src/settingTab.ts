import { App, Notice, PluginSettingTab, Setting } from 'obsidian';
import { pinyinEngine } from '@/engine/pinyinEngine';
import ThePlugin from '@/main';
import { PinyinSuggest, arraySwap } from '@/utils';
import { createToggle, createDropdown, arrayToOptions } from '@/settingFactory';
import { OPEN_FILE_KEY_NAMES } from '@/constants';
import {
  canSwitchDoublePinyin,
  canEnableFuzzyPinyin,
  canEnablePalladius,
} from '@/settingValidation';
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
      this.containerEl, 'Backspace 关闭搜索',
      '当输入框为空时按下 Backspace 关闭搜索',
      () => global.closeWithBackspace,
      (v) => { global.closeWithBackspace = v; },
      this.plugin,
    );

    createToggle(
      this.containerEl, '繁体支持', undefined,
      () => global.traditionalChineseSupport,
      (v) => { global.traditionalChineseSupport = v; },
      this.plugin,
      { onChanged: () => this.plugin.loadPinyinDict() },
    );

    createDropdown(
      this.containerEl, '双拼方案',
      { 全拼: '全拼', ...arrayToOptions(pinyinEngine.listSchemes()) },
      () => global.doublePinyin,
      (v) => { global.doublePinyin = v; },
      this.plugin,
      {
        validate: (v) => canSwitchDoublePinyin(global.fuzzyPinyin, global.palladius, v),
        onChanged: () => {
          this.plugin.loadPinyinDict();
          this.plugin.indexManager.refresh();
          new Notice('双拼方案切换为：' + global.doublePinyin, 4000);
        },
      },
    );

    createToggle(
      this.containerEl, '模糊音', undefined,
      () => global.fuzzyPinyin,
      (v) => { global.fuzzyPinyin = v; },
      this.plugin,
      {
        validate: (v) => (v ? canEnableFuzzyPinyin(global.doublePinyin) : { ok: true }),
        onChanged: () => {
          if (global.fuzzyPinyinSetting.length !== 0) this.plugin.indexManager.refresh();
          this.display();
        },
      },
    );

    if (global.fuzzyPinyin)
      new Setting(this.containerEl).setName('模糊音设置').addButton((cb) =>
        cb.setIcon('settings').onClick(() => {
          new FuzzyPinyinSettingModal(this.plugin).open();
        })
      );

    createToggle(
      this.containerEl, '俄语拼音', undefined,
      () => global.palladius,
      (v) => { global.palladius = v; },
      this.plugin,
      {
        validate: (v) => (v ? canEnablePalladius(global.doublePinyin) : { ok: true }),
        onChanged: () => {
          this.plugin.loadPinyinDict();
          this.plugin.indexManager.refresh();
        },
      },
    );

    createToggle(
      this.containerEl, '自动大小写敏感', undefined,
      () => global.autoCaseSensitivity,
      (v) => { global.autoCaseSensitivity = v; },
      this.plugin,
    );
  }

  addFileSetting() {
    this.containerEl.createEl('h2', { text: '文件搜索' });
    const { file } = this.plugin.settings;

    createToggle(
      this.containerEl, '显示附件',
      '显示如图片、视频、PDF等附件文件。',
      () => file.showAttachments,
      (v) => { file.showAttachments = v; },
      this.plugin,
    );
    createToggle(
      this.containerEl, '显示所有类型文件', undefined,
      () => file.showAllFileTypes,
      (v) => { file.showAllFileTypes = v; },
      this.plugin,
    );
    createToggle(
      this.containerEl, '显示未完成链接', undefined,
      () => file.showUnresolvedLink,
      (v) => { file.showUnresolvedLink = v; },
      this.plugin,
    );
    createToggle(
      this.containerEl, '使用路径搜索',
      '当搜索结果少于10个时搜索路径',
      () => file.usePathToSearch,
      (v) => { file.usePathToSearch = v; },
      this.plugin,
    );
    createToggle(
      this.containerEl, '显示 Tag', undefined,
      () => file.showTags,
      (v) => { file.showTags = v; },
      this.plugin,
    );

    this.addEditorSuggestToggle(
      '使用双链建议',
      '输入[[的时候文件连接能支持中文拼音搜索（实验性功能）',
      () => file.useFileEditorSuggest,
      (v) => { file.useFileEditorSuggest = v; },
      this.plugin.fileEditorSuggest,
    );

    new Setting(this.containerEl).setName('附带标签搜索').addToggle((cb) =>
      cb.setValue(file.searchWithTag).onChange(async (value: boolean) => {
        file.searchWithTag = value;
        if (value) this.plugin.fileModal.tagInput.show();
        else this.plugin.fileModal.tagInput.hide();
        await this.plugin.saveSettings();
      })
    );

    createToggle(
      this.containerEl, '快速选择历史文件',
      '输入栏为空时，空格加 asdf... 或 1234... 快速选择历史文件',
      () => file.quicklySelectHistoryFiles,
      (v) => { file.quicklySelectHistoryFiles = v; },
      this.plugin,
      { onChanged: () => this.display() },
    );

    if (file.quicklySelectHistoryFiles)
      createDropdown(
        this.containerEl, '快速选择历史文件提示',
        { asdfjklgh: 'asdfjklgh', '1234567890': '1234567890' },
        () => file.quicklySelectHistoryFilesHint,
        (v) => { file.quicklySelectHistoryFilesHint = v; },
        this.plugin,
      );

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
    keys.forEach((key) => {
      createDropdown(
        this.containerEl,
        shortcutKeyLabel(key),
        arrayToOptions(OPEN_FILE_KEY_NAMES),
        () => file[key],
        (v) => { file[key] = v; },
        this.plugin,
      );
    });

    new Setting(this.containerEl).setName('重置快捷键功能').addButton((cb) =>
      cb.setIcon('refresh-ccw').onClick(async () => {
        const defaults = OPEN_FILE_KEY_NAMES;
        keys.forEach((key, i) => { file[key] = defaults[i]; });
        await this.plugin.saveSettings();
        this.display();
      })
    );
  }

  addHeadingSetting() {
    this.containerEl.createEl('h2', { text: '标题搜索' });
    const { heading } = this.plugin.settings;
    createToggle(
      this.containerEl, '显示第一级标题', undefined,
      () => heading.showFirstLevelHeading,
      (v) => { heading.showFirstLevelHeading = v; },
      this.plugin,
    );
    createToggle(
      this.containerEl, '搜索结果缩进', undefined,
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
      const setting = new Setting(this.containerEl).setName(commandStr);
      this.addDeleteButton(setting, () => {
        command.pinnedCommands = command.pinnedCommands.filter((x) => x !== commandStr);
        this.plugin.saveSettings();
        this.display();
      });
      this.addReorderButtons(setting, pinnedCommands, index);
    });
  }

  addOtherSetting() {
    this.containerEl.createEl('h2', { text: '其他' });
    const { other } = this.plugin.settings;

    this.addEditorSuggestToggle(
      '使用标签建议',
      '实验性功能',
      () => other.useTagEditorSuggest,
      (v) => { other.useTagEditorSuggest = v; },
      this.plugin.tagEditorSuggest,
    );

    new Setting(this.containerEl).setName('重建索引').addButton((cb) =>
      cb.setButtonText('重建').onClick(async () => {
        this.plugin.indexManager.refresh();
      })
    );

    createToggle(
      this.containerEl, 'dev 模式',
      '将索引存储到 global 以便重启时不重建索引',
      () => other.devMode,
      (v) => { other.devMode = v; },
      this.plugin,
    );
  }

  // ── 可复用工具方法 ──

  /** 创建一个注册/移除 editorSuggest 的 toggle */
  private addEditorSuggestToggle(
    name: string,
    desc: string,
    getValue: () => boolean,
    setValue: (v: boolean) => void,
    suggest: any,
  ) {
    new Setting(this.containerEl)
      .setName(name)
      .setDesc(desc)
      .addToggle((cb) =>
        cb.setValue(getValue()).onChange(async (value) => {
          setValue(value);
          if (value) this.app.workspace.editorSuggest.suggests.unshift(suggest);
          else this.app.workspace.editorSuggest.removeSuggest(suggest);
          await this.plugin.saveSettings();
        })
      );
  }

  /** 为 setting 添加删除按钮 */
  private addDeleteButton(setting: Setting, onClick: () => void) {
    setting.addExtraButton((cb) => cb.setIcon('x').setTooltip('删除').onClick(onClick));
  }

  /** 为 setting 添加上/下移动按钮 */
  private addReorderButtons(setting: Setting, arr: string[], index: number) {
    setting.addExtraButton((cb) =>
      cb.setIcon('up-chevron-glyph').setTooltip('Move up').onClick(() => {
        arraySwap(arr, index, index - 1);
        this.plugin.saveSettings();
        this.display();
      })
    );
    setting.addExtraButton((cb) =>
      cb.setIcon('down-chevron-glyph').setTooltip('Move down').onClick(() => {
        arraySwap(arr, index, index + 1);
        this.plugin.saveSettings();
        this.display();
      })
    );
  }
}

/** 将 'keyCtrlEnter' 格式化为 'Ctrl Enter 功能' */
function shortcutKeyLabel(key: string): string {
  return key.replace(/^key/, '').replace(/([A-Z])/g, ' $1').trim() + ' 功能';
}
