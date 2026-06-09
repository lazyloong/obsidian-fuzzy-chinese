// src/settingFactory.ts — 设置项工厂函数，消除重复的 Setting 模板代码
import { Setting } from 'obsidian';
import ThePlugin from '@/main';

/**
 * 创建一个简单的 toggle 设置项。
 * 
 * @param onChanged 可选的额外回调（在 saveSettings 之后执行），
 * 如 loadPinyinDict / refresh / display 等。
 */
export function createToggle(
  containerEl: HTMLElement,
  name: string,
  desc: string | undefined,
  getValue: (() => boolean),
  setValue: ((value: boolean) => void),
  plugin: ThePlugin,
  onChanged?: (value: boolean) => void,
): Setting {
  const setting = new Setting(containerEl).setName(name);
  if (desc) setting.setDesc(desc);
  return setting.addToggle((cb) =>
    cb.setValue(getValue()).onChange(async (value) => {
      setValue(value);
      await plugin.saveSettings();
      onChanged?.(value);
    })
  );
}

/**
 * 创建一个简单的 dropdown 设置项。
 */
export function createDropdown(
  containerEl: HTMLElement,
  name: string,
  options: Record<string, string>,
  getValue: (() => string),
  setValue: ((value: string) => void),
  plugin: ThePlugin,
  onChanged?: (value: string) => void,
): Setting {
  return new Setting(containerEl)
    .setName(name)
    .addDropdown((cb) =>
      cb.addOptions(options)
        .setValue(getValue())
        .onChange(async (value: string) => {
          if (getValue() === value) return;
          setValue(value);
          await plugin.saveSettings();
          onChanged?.(value);
        })
    );
}
