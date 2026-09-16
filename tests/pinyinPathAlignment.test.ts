import { describe, it, expect, beforeAll } from 'vitest';
import { pinyinEngine } from '@/engine/pinyinEngine';
import Pinyin, { pathPinyinFor } from '@/utils/pinyin';

// ============================================================
// 回归测试：输入多个汉字搜不到笔记（弹窗直接没有结果）
//
// 根因链：
//   TFile2Item 用「不含扩展名的 basename」构造 pathItem.pinyin，
//   而 pathItem.name 是含扩展名的完整路径 file.path
//   → Pinyin.length < text.length
//   → matchAboveStart 取 this[i - 1].pinyin 越界抛 TypeError
//   → getSuggestions 整体失败，弹窗无结果（单字符查询走另一条
//     getFirstInputSuggestions 路径，不调用 matchAboveStart，所以正常）
// ============================================================

beforeAll(() => {
  pinyinEngine.loadBase({
    中: ['zhong'],
    文: ['wen'],
    笔: ['bi'],
    记: ['ji'],
    研: ['yan'],
    究: ['jiu'],
    国: ['guo'],
  });
});

describe('matchAboveStart - 纯汉字多字符查询', () => {
  it('连续汉字命中', () => {
    const py = new Pinyin('中文笔记');
    expect(py.matchAboveStart('中文笔记', '中文')).toEqual([0, 1]);
    expect(py.matchAboveStart('中文笔记', '中文笔')).toEqual([0, 1, 2]);
    expect(py.matchAboveStart('中文笔记', '中文笔记')).toEqual([0, 1, 2, 3]);
  });

  it('不相邻汉字命中', () => {
    const py = new Pinyin('笔记中文');
    expect(py.matchAboveStart('笔记中文', '中文')).toEqual([2, 3]);
  });

  it('无匹配返回 null', () => {
    const py = new Pinyin('中文笔记');
    expect(py.matchAboveStart('中文笔记', '德国')).toBeNull();
  });

  it('拼音查询行为不变', () => {
    const py = new Pinyin('中文笔记');
    expect(py.matchAboveStart('中文笔记', 'wen')).toEqual([1]);
    expect(py.matchAboveStart('中文笔记', 'zhongwen')).toEqual([0, 1]);
  });
});

describe('matchAboveStart - 字符拼音表短于 text 时的兜底', () => {
  it('text 比 Pinyin 长时不抛异常，且已有字符仍能匹配', () => {
    const py = new Pinyin('中文'); // 字符表只有 2 个字符
    expect(() => py.matchAboveStart('中文.md', '中文')).not.toThrow();
    expect(py.matchAboveStart('中文.md', '中文')).toEqual([0, 1]);
  });

  it('单字符 Pinyin 也能安全处理更长的 text', () => {
    const py = new Pinyin('中');
    expect(py.matchAboveStart('中文笔', '中')).toEqual([0]);
  });

  it('修复前的崩溃形态：路径拼音少了扩展名', () => {
    const pathPinyin = new Pinyin('中文笔记'); // 4 个字符
    const path = '中文笔记.md'; // 7 个字符
    expect(() => pathPinyin.matchAboveStart(path, '中文')).not.toThrow();
    expect(pathPinyin.matchAboveStart(path, '中文')).toEqual([0, 1]);
  });
});

describe('pathPinyinFor - pathItem 的 name 与 pinyin 必须逐字符对齐', () => {
  it('根目录 md 笔记：路径拼音与含扩展名的路径等长', () => {
    const fileNamePinyin = new Pinyin('中文笔记'); // 即 file.basename
    const pathPinyin = pathPinyinFor('中文笔记.md', fileNamePinyin);

    expect(pathPinyin.text).toBe('中文笔记.md');
    expect(pathPinyin.length).toBe('中文笔记.md'.length);
    expect(pathPinyin.matchAboveStart('中文笔记.md', '中文')).toEqual([0, 1]);
  });

  it('子目录 md 笔记：路径拼音同样与 file.path 对齐', () => {
    const pathPinyin = pathPinyinFor('研究/中文笔记.md', new Pinyin('中文笔记'));

    expect(pathPinyin.text).toBe('研究/中文笔记.md');
    expect(pathPinyin.length).toBe('研究/中文笔记.md'.length);
    expect(pathPinyin.matchAboveStart('研究/中文笔记.md', '中文')).toEqual([3, 4]);
  });

  it('非 md 文件：name 就是 file.path，复用同一实例', () => {
    const fileNamePinyin = new Pinyin('doc.pdf');
    expect(pathPinyinFor('doc.pdf', fileNamePinyin)).toBe(fileNamePinyin);
  });
});

describe('Pinyin 派生操作返回普通数组（Symbol.species）', () => {
  it('map 不再触发 new Pinyin(length)', () => {
    const py = new Pinyin('中文');
    const chars = py.map((c) => c.character);

    expect(chars).toEqual(['中', '文']);
    expect(Array.isArray(chars)).toBe(true);
    expect((chars as unknown as { text?: string }).text).toBeUndefined();
  });

  it('filter / slice 同样安全且长度正确', () => {
    const py = new Pinyin('中文笔记');
    const sliced = py.slice(1);

    expect(Array.isArray(py.filter(() => true))).toBe(true);
    expect(Array.isArray(sliced)).toBe(true);
    expect(sliced.length).toBe(3);
  });

  it('concat 仍返回 Pinyin 实例（自身语义不受影响）', () => {
    const result = new Pinyin('中文').concat(new Pinyin('笔记'));

    expect(result).toBeInstanceOf(Pinyin);
    expect(result.text).toBe('中文笔记');
    expect(result.length).toBe(4);
  });
});
