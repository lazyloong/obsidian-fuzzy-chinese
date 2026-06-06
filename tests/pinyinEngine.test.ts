import { describe, it, expect, beforeEach } from 'vitest';
import { PinyinEngine } from '@/engine/pinyinEngine';
import Palladius from '@/dict/palladius.json';

function createEngine() {
  const engine = new PinyinEngine();
  engine.loadBase({
    中: ['zhong', 'zhong'],
    国: ['guo'],
    拼: ['pin'],
    音: ['yin'],
    行: ['hang', 'xing'],
    长: ['chang', 'zhang'],
    重: ['zhong', 'chong'],
    一: ['yi'],
    二: ['er'],
    儿: ['er'],
  });
  engine.loadBuiltinSchemes();
  engine.loadDefaultFuzzyRules();
  engine.loadPalladius(Palladius);
  return engine;
}

describe('PinyinEngine', () => {
  let engine: PinyinEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  describe('getCharPinyin (全拼)', () => {
    it('单音字', () => {
      expect(engine.getCharPinyin('国')).toEqual(['guo']);
    });
    it('多音字', () => {
      expect(engine.getCharPinyin('行')).toEqual(['hang', 'xing']);
    });
    it('非汉字返回字符本身', () => {
      expect(engine.getCharPinyin('A')).toEqual(['A']);
    });
  });

  describe('getCharPinyin (模糊音)', () => {
    beforeEach(() => {
      engine.toggleFuzzy(true);
    });
    it('zh ↔ z', () => {
      const r = engine.getCharPinyin('中', { fuzzy: true });
      expect(r).toContain('zong');
      expect(r).toContain('zhong');
    });
    it('in ↔ ing', () => {
      const r = engine.getCharPinyin('音', { fuzzy: true });
      expect(r).toContain('ying');
      expect(r).toContain('yin');
    });
  });

  describe('getCharPinyin (双拼)', () => {
    beforeEach(() => {
      engine.setActiveShuangpin('小鹤双拼');
    });
    it('单音字转双拼', () => {
      expect(engine.getCharPinyin('国')).toEqual(['go']);
      expect(engine.getCharPinyin('拼')).toEqual(['pb']);
    });
    it('多音字转双拼', () => {
      expect(engine.getCharPinyin('行')).toEqual(['hh', 'xk']);
    });
    it('zh/ch/sh 双拼', () => {
      expect(engine.getCharPinyin('中')).toEqual(['vs', 'vs']);
    });
  });

  describe('toShuangpin', () => {
    beforeEach(() => {
      engine.setActiveShuangpin('小鹤双拼');
    });
    it('基础转换', () => {
      expect(engine.toShuangpin('pin')).toBe('pb');
      expect(engine.toShuangpin('guo')).toBe('go');
      expect(engine.toShuangpin('zhong')).toBe('vs');
    });
  });

  describe('toFuzzy', () => {
    beforeEach(() => {
      engine.toggleFuzzy(true);
    });
    it('zh ↔ z', () => {
      const r = engine.toFuzzy('zhong');
      expect(r).toContain('zhong');
      expect(r).toContain('zong');
    });
    it('禁用时不扩展', () => {
      engine.toggleFuzzy(false);
      expect(engine.toFuzzy('yin')).toEqual(['yin']);
    });
  });

  describe('Palladius', () => {
    it('拼音转俄语', () => {
      const r = engine.getCharPinyin('中', { palladius: true });
      expect(r).toContain('zhong');
      expect(r).toContain('чжун');
    });
    it('多音字', () => {
      const r = engine.getCharPinyin('行', { palladius: true });
      expect(r).toContain('xing');
      expect(r).toContain('hang');
      expect(r).toContain('хан');
      expect(r).toContain('син');
    });
    it('fuzzy + palladius', () => {
      engine.toggleFuzzy(true);
      const r = engine.getCharPinyin('音', { fuzzy: true, palladius: true });
      expect(r).toContain('yin');
      expect(r).toContain('ying');
      expect(r).toContain('инь');
      expect(r).toContain('ин');
    });
    it('togglePalladius 全局', () => {
      engine.togglePalladius(true);
      expect(engine.getCharPinyin('拼')).toContain('pin');
      expect(engine.getCharPinyin('拼')).toContain('пинь');
      engine.togglePalladius(false);
      expect(engine.getCharPinyin('拼')).toEqual(['pin']);
    });
  });

  describe('缓存', () => {
    it('双拼结果被缓存', () => {
      engine.setActiveShuangpin('小鹤双拼');
      const a = engine.getCharPinyin('中');
      const b = engine.getCharPinyin('中');
      expect(a).toBe(b);
    });
    it('切换方案清空缓存', () => {
      engine.setActiveShuangpin('小鹤双拼');
      const a = engine.getCharPinyin('中');
      engine.setActiveShuangpin('自然码');
      const b = engine.getCharPinyin('中');
      expect(a).not.toBe(b);
    });
  });
});
