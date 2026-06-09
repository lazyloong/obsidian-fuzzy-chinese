import { describe, it, expect } from 'vitest';
import {
  canSwitchDoublePinyin,
  canEnableFuzzyPinyin,
  canEnablePalladius,
} from '@/settingValidation';

describe('canSwitchDoublePinyin', () => {
  it('允许切换到全拼（即使模糊音和俄语都开启）', () => {
    expect(canSwitchDoublePinyin(true, true, '全拼').ok).toBe(true);
  });

  it('模糊音开启时拒绝切换双拼', () => {
    const r = canSwitchDoublePinyin(true, false, '微软双拼');
    expect(r.ok).toBe(false);
    expect(r.reason).toContain('模糊音');
  });

  it('俄语拼音开启时拒绝切换双拼', () => {
    const r = canSwitchDoublePinyin(false, true, '微软双拼');
    expect(r.ok).toBe(false);
    expect(r.reason).toContain('俄文');
  });

  it('无冲突时允许切换', () => {
    expect(canSwitchDoublePinyin(false, false, '微软双拼').ok).toBe(true);
  });
});

describe('canEnableFuzzyPinyin', () => {
  it('全拼模式下允许', () => {
    expect(canEnableFuzzyPinyin('全拼').ok).toBe(true);
  });

  it('双拼模式下拒绝', () => {
    const r = canEnableFuzzyPinyin('微软双拼');
    expect(r.ok).toBe(false);
    expect(r.reason).toContain('全拼');
  });
});

describe('canEnablePalladius', () => {
  it('全拼模式下允许', () => {
    expect(canEnablePalladius('全拼').ok).toBe(true);
  });

  it('双拼模式下拒绝', () => {
    const r = canEnablePalladius('微软双拼');
    expect(r.ok).toBe(false);
    expect(r.reason).toContain('全拼');
  });
});
