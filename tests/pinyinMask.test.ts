import { describe, it, expect } from 'vitest';
import Pinyin from '@/utils/pinyin';
import { pinyinEngine } from '@/engine/pinyinEngine';

// 回归：字母掩码快速否定必须是「必要非充分」条件，不能误拒真正可命中的查询。
pinyinEngine.loadBase({
  '\u4e2d': ['zhong'], '\u56fd': ['guo'], '\u4eba': ['ren'], '\u6c11': ['min'],
  '\u5927': ['da'], '\u5b66': ['xue'], '\u6570': ['shu'], '\u636e': ['ju'],
  '\u79d1': ['ke'], '\u4e0e': ['yu'], '\u5de5': ['gong'], '\u7a0b': ['cheng'],
  '\u7814': ['yan'], '\u7a76': ['jiu'], '\u6240': ['suo'],
});

describe('letter-mask fast reject correctness', () => {
  it('does not reject valid full pinyin', () => {
    const text = '\u4e2d\u56fd\u4eba\u6c11\u5927\u5b66\u6570\u636e\u79d1\u5b66\u4e0e\u5de5\u7a0b\u7814\u7a76\u6240';
    const q = 'zhongguorenmindaxueshujukexueyugongchengyanjiusuo';
    const py = new Pinyin(text);
    expect(py.couldMatch(q)).toBe(true);
    expect(py.matchAboveStart(text, q)).not.toBeNull();
  });

  it('rejects impossible letters', () => {
    const py = new Pinyin('\u4e2d\u56fd');
    expect(py.couldMatch('zhongguo')).toBe(true);
    expect(py.couldMatch('xyz')).toBe(false);
  });

  it('allows Chinese exact query without ascii letters', () => {
    const text = '\u4e2d\u56fd';
    const py = new Pinyin(text);
    expect(py.couldMatch('\u4e2d')).toBe(true);
    expect(py.matchAboveStart(text, '\u4e2d\u56fd')).toEqual([0, 1]);
  });
});