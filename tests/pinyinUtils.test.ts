import { describe, it, expect } from 'vitest';
import { matchSheng, FuzzyPinyinRules, fullPinyin2doublePinyin } from '@/utils/pinyinUtils';

describe('pinyinUtils', () => {
  describe('matchSheng', () => {
    it('普通声母', () => {
      expect(matchSheng('pin')).toEqual({ sheng: 'p', yun: 'in' });
      expect(matchSheng('guo')).toEqual({ sheng: 'g', yun: 'uo' });
      expect(matchSheng('da')).toEqual({ sheng: 'd', yun: 'a' });
    });

    it('双字母声母 zh/ch/sh 优先', () => {
      expect(matchSheng('zhong')).toEqual({ sheng: 'zh', yun: 'ong' });
      expect(matchSheng('chang')).toEqual({ sheng: 'ch', yun: 'ang' });
      expect(matchSheng('shang')).toEqual({ sheng: 'sh', yun: 'ang' });
    });

    it('长度优先：zh 优先于 z', () => {
      expect(matchSheng('zhao').sheng).toBe('zh');
      expect(matchSheng('chao').sheng).toBe('ch');
      expect(matchSheng('shao').sheng).toBe('sh');
    });

    it('零声母', () => {
      expect(matchSheng('er')).toEqual({ sheng: '', yun: 'er' });
      expect(matchSheng('an')).toEqual({ sheng: '', yun: 'an' });
      expect(matchSheng('ang')).toEqual({ sheng: '', yun: 'ang' });
    });
  });

  describe('FuzzyPinyinRules', () => {
    it('双向对称', () => {
      expect(FuzzyPinyinRules['z']).toContain('zh');
      expect(FuzzyPinyinRules['zh']).toContain('z');
      expect(FuzzyPinyinRules['in']).toContain('ing');
      expect(FuzzyPinyinRules['ing']).toContain('in');
    });

    it('包含声母和韵母规则', () => {
      expect(FuzzyPinyinRules['n']).toContain('l');
      expect(FuzzyPinyinRules['an']).toContain('ang');
      expect(FuzzyPinyinRules['en']).toContain('eng');
    });
  });

  describe('fullPinyin2doublePinyin', () => {
    // 小鹤双拼方案：双拼键 → 对应的全拼形式数组
    const xiaoheDict: Record<string, string[]> = {
      b: ['b', 'in'],
      p: ['p', 'ie'],
      m: ['m', 'ian'],
      f: ['f', 'en'],
      d: ['d', 'ai'],
      t: ['t', 'ue', 've'],
      n: ['n'],
      l: ['l', 'uang'],
      g: ['g', 'eng'],
      k: ['k', 'ing', 'uai'],
      h: ['h', 'ang'],
      j: ['j', 'an'],
      q: ['q', 'iu'],
      x: ['x', 'ia', 'ua'],
      r: ['r', 'uan'],
      z: ['z', 'ou'],
      c: ['c', 'ao'],
      s: ['s', 'ong', 'iong'],
      y: ['y', 'un'],
      w: ['w', 'ei'],
      v: ['zh', 'ui'],
      i: ['ch'],
      u: ['sh'],
      o: ['uo', 'o'],
      a: ['a'],
      e: ['e'],
    };

    const dict = xiaoheDict;

    it('普通拼音转双拼', () => {
      expect(fullPinyin2doublePinyin('pin', dict)).toBe('pb');
      expect(fullPinyin2doublePinyin('guo', dict)).toBe('go');
      expect(fullPinyin2doublePinyin('zhong', dict)).toBe('vs');
    });

    it('零声母拼音', () => {
      expect(fullPinyin2doublePinyin('an', dict)).toBe('j');
      expect(fullPinyin2doublePinyin('er', dict)).toBe('er');
    });

    it('双拼声母+韵母组合', () => {
      // 小鹤: "zh" → v, "ong" → s → vs
      expect(fullPinyin2doublePinyin('guo', dict)).toBe('go');
    });
  });
});
