// src/modal/fuzzyPinyinSettingModal.ts — 模糊音设置弹窗，从 settingTab.ts 提取
import { Modal, Setting } from 'obsidian';
import { xor } from 'lodash-es';
import ThePlugin from '@/main';

export default class FuzzyPinyinSettingModal extends Modal {
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
    contentEl.createEl('h1', { text: '模糊音设置' });
    // 模糊音展示规则（精→模）单向映射
    const fuzzyDisplay: Record<string, string> = {
      zh: 'z',
      ch: 'c',
      sh: 's',
      n: 'l',
      h: 'f',
      l: 'r',
      ang: 'an',
      eng: 'en',
      ing: 'in',
      iang: 'ian',
      uang: 'uan',
    };
    Object.entries(fuzzyDisplay).forEach(([key, value]) => {
      new Setting(contentEl).setName(`${value} = ${key}`).addToggle((cb) =>
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
