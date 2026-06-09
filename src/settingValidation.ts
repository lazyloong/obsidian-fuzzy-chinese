// src/settingValidation.ts — 设置项之间的互斥校验逻辑，纯函数，可独立测试

export interface ValidationResult {
  ok: boolean;
  reason?: string;
}

/**
 * 检查是否可以切换到指定双拼方案。
 * 模糊音和俄语拼音仅在「全拼」模式下可用。
 */
export function canSwitchDoublePinyin(
  fuzzyPinyin: boolean,
  palladius: boolean,
  newScheme: string,
): ValidationResult {
  if (newScheme === '全拼') return { ok: true };
  if (fuzzyPinyin) return { ok: false, reason: '模糊音搜索已开启，无法切换双拼方案' };
  if (palladius) return { ok: false, reason: '俄文转拼音已开启，无法切换双拼方案' };
  return { ok: true };
}

/**
 * 检查是否可以开启模糊音。
 * 仅在「全拼」模式下允许。
 */
export function canEnableFuzzyPinyin(doublePinyin: string): ValidationResult {
  if (doublePinyin !== '全拼') {
    return { ok: false, reason: '请将双拼模式设置为全拼模式，否则将无法使用模糊音。' };
  }
  return { ok: true };
}

/**
 * 检查是否可以开启俄语拼音。
 * 仅在「全拼」模式下允许。
 */
export function canEnablePalladius(doublePinyin: string): ValidationResult {
  if (doublePinyin !== '全拼') {
    return { ok: false, reason: '请将双拼模式设置为全拼，否则无法使用俄语拼音。' };
  }
  return { ok: true };
}
