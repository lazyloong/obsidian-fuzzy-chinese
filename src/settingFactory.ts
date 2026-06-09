// src/settingFactory.ts — 设置项工厂函数，消除重复的 Setting 模板代码
import { Notice, Setting } from 'obsidian';
import ThePlugin from '@/main';

/** validate 返回的校验结果 */
export interface ValidationResult {
  ok: boolean;
  reason?: string;
}

/**
 * 创建一个 toggle 设置项。
 *
 * @param validate 可选校验函数，返回 { ok, reason }。
 *  若校验不通过则自动回退 toggle 状态并展示 Notice。
 * @param onChanged 可选副作用回调（在 saveSettings 之后执行）。
 */
export function createToggle(
  containerEl: HTMLElement,
  name: string,
  desc: string | undefined,
  getValue: () => boolean,
  setValue: (value: boolean) => void,
  plugin: ThePlugin,
  options?: {
    onChanged?: (value: boolean) => void;
    validate?: (value: boolean) => ValidationResult;
  },
): Setting {
  const setting = new Setting(containerEl).setName(name);
  if (desc) setting.setDesc(desc);
  return setting.addToggle((cb) =>
    cb.setValue(getValue()).onChange(async (value) => {
      if (options?.validate) {
        const r = options.validate(value);
        if (!r.ok) {
          new Notice(r.reason ?? '不允许此操作');
          cb.setValue(!value);
          return;
        }
      }
      setValue(value);
      await plugin.saveSettings();
      options?.onChanged?.(value);
    })
  );
}

/**
 * 创建一个 dropdown 设置项。
 */
export function createDropdown(
  containerEl: HTMLElement,
  name: string,
  options: Record<string, string>,
  getValue: () => string,
  setValue: (value: string) => void,
  plugin: ThePlugin,
  opts?: {
    onChanged?: (value: string) => void;
    validate?: (value: string) => ValidationResult;
  },
): Setting {
  return new Setting(containerEl)
    .setName(name)
    .addDropdown((cb) =>
      cb.addOptions(options)
        .setValue(getValue())
        .onChange(async (value: string) => {
          if (getValue() === value) return;
          if (opts?.validate) {
            const r = opts.validate(value);
            if (!r.ok) {
              new Notice(r.reason ?? '不允许此操作');
              cb.setValue(getValue());
              return;
            }
          }
          setValue(value);
          await plugin.saveSettings();
          opts?.onChanged?.(value);
        })
    );
}

/** 将 string 数组转为下拉选项 Record */
export function arrayToOptions(arr: readonly string[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (const k of arr) result[k] = k;
  return result;
}
