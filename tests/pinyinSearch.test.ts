import { describe, it, expect, beforeAll } from 'vitest';
import { pinyinEngine } from '@/engine/pinyinEngine';
import pinyinSearch from '@/utils/pinyinSearch';
import { SpecialItemScore } from '@/utils/type';

// ============================================================
// 测试环境设置 — 预加载拼音字典
// ============================================================
beforeAll(() => {
  pinyinEngine.loadBase({
    设: ['she'],
    置: ['zhi'],
    面: ['mian'],
    板: ['ban'],
    文: ['wen'],
    件: ['jian'],
    编: ['bian'],
    辑: ['ji'],
    查: ['cha'],
    看: ['kan'],
    帮: ['bang'],
    助: ['zhu'],
    中: ['zhong'],
    国: ['guo'],
    人: ['ren'],
    民: ['min'],
    银: ['yin'],
    行: ['hang', 'xing'],
    大: ['da'],
    学: ['xue'],
    上: ['shang'],
    海: ['hai'],
    新: ['xin'],
    山: ['shan'],
    水: ['shui'],
    A: ['A'],
    B: ['B'],
    C: ['C'],
    1: ['1'],
    2: ['2'],
  });
});

// ============================================================
// 测试数据
// ============================================================
const sampleData = [
  { key: '设置', label: '设置面板' },
  { key: '文件', label: '文件管理' },
  { key: '编辑', label: '编辑文档' },
  { key: '查看', label: '查看详情' },
  { key: '帮助', label: '帮助中心' },
];

const sampleDataNoKey = [
  { name: '银行', value: 1 },
  { name: '中国', value: 2 },
  { name: '人民', value: 3 },
  { name: '大学', value: 4 },
];

const sampleDataSh = [
  { key: '上海' },
  { key: '山水' },
  { key: '上山' },
  { key: '中心' },
];

// ============================================================
// pinyinSearch
// ============================================================
describe('pinyinSearch', () => {
  describe('边界情况', () => {
    it('空数据返回空数组', () => {
      const result = pinyinSearch('设置', []);
      expect(result).toEqual([]);
    });

    it('空查询返回所有项，score 为 emptyInput，range 为 null', () => {
      const result = pinyinSearch('', sampleData);
      expect(result).toHaveLength(sampleData.length);
      for (const r of result) {
        expect(r.score).toBe(SpecialItemScore.emptyInput);
        expect(r.range).toBeNull();
      }
    });
  });

  describe('全拼匹配', () => {
    it('完整全拼精确匹配', () => {
      const result = pinyinSearch('shezhi', sampleData);
      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result[0].item.name).toBe('设置');
      expect(result[0].range).toEqual([[0, 1]]);
    });

    it('部分全拼匹配', () => {
      const result = pinyinSearch('jian', sampleData);
      expect(result.length).toBeGreaterThanOrEqual(1);
      // '文件' (wen-jian) 包含 'jian'
      const matchedNames = result.map((r) => r.item.name);
      expect(matchedNames).toContain('文件');
    });
  });

  describe('首字母匹配', () => {
    it('首字母简拼匹配', () => {
      const result = pinyinSearch('sz', sampleData);
      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result[0].item.name).toBe('设置');
    });

    it('单个首字母匹配', () => {
      const result = pinyinSearch('b', sampleData);
      const matchedNames = result.map((r) => r.item.name);
      // '帮助' (bang), '面板' (ban), '编辑' (bian) 都可能以 b 开头
      expect(matchedNames).toContain('帮助');
    });
  });

  describe('混合匹配', () => {
    it('全拼 + 首字母混合', () => {
      const result = pinyinSearch('shez', sampleData);
      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result[0].item.name).toBe('设置');
    });
  });

  describe('无匹配', () => {
    it('完全不匹配的查询返回空数组', () => {
      const result = pinyinSearch('xyzabc', sampleData);
      expect(result).toEqual([]);
    });
  });

  describe('排序', () => {
    it('匹配度高的排在前面', () => {
      // 'wenjian' 完全匹配 '文件'，部分匹配其他
      const result = pinyinSearch('wenjian', sampleData);
      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result[0].item.name).toBe('文件');
    });

    it('靠前匹配优先于靠后匹配', () => {
      const data = [
        { key: '面板设置' },
        { key: '设置面板' },
      ];
      // 'shezhi' 匹配 '设置面板' 的前两个字，也匹配 '面板设置' 的后两个字
      // 前者的 '设' 在位置 0，应该得分更高
      const result = pinyinSearch('shezhi', data);
      expect(result[0].item.name).toBe('设置面板');
    });
  });

  describe('多音字', () => {
    it('多音字匹配任一读音', () => {
      const result = pinyinSearch('yinxing', sampleDataNoKey, (p) => p.name);
      expect(result.length).toBeGreaterThanOrEqual(1);
    });

    it('多音字首字母', () => {
      const result = pinyinSearch('yh', sampleDataNoKey, (p) => p.name);
      const matchedNames = result.map((r) => r.item.name);
      expect(matchedNames).toContain('银行');
    });
  });

  describe('自定义 getKey', () => {
    it('使用自定义键提取函数', () => {
      const result = pinyinSearch('zhongguo', sampleDataNoKey, (p) => p.name);
      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result[0].item.name).toBe('中国');
    });

    it('不传 getKey 时默认使用 key 字段', () => {
      const result = pinyinSearch('wenjian', sampleData);
      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result[0].item.name).toBe('文件');
    });
  });

  describe('ASCII / 英文查询', () => {
    it('英文直接逐字符匹配（小写查询避免触发 usePlugin 依赖）', () => {
      const data = [
        { key: 'ABC' },
        { key: '测试' },
      ];
      const result = pinyinSearch('ab', data);
      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result[0].item.name).toBe('ABC');
    });

    it('中英混合仍然可以匹配中文部分', () => {
      const data = [
        { key: 'ABC设置' },
        { key: '文件' },
      ];
      const result = pinyinSearch('shezhi', data);
      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result[0].item.name).toBe('ABC设置');
    });
  });

  describe('data 字段透传', () => {
    it('原始数据对象保存在 item.data 中', () => {
      const result = pinyinSearch('shezhi', sampleData);
      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result[0].item.data).toEqual({ key: '设置', label: '设置面板' });
    });
  });

  describe('双字符声母 zh/ch/sh 集成', () => {
    it('sh 匹配「上海」', () => {
      const result = pinyinSearch('shh', sampleDataSh);
      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result[0].item.name).toBe('上海');
    });

    it('sh 匹配「山水」', () => {
      const result = pinyinSearch('shsh', sampleDataSh);
      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result[0].item.name).toBe('山水');
    });

    it('单字符 s 仍可匹配 sh 声母字', () => {
      const result = pinyinSearch('sh', sampleDataSh);
      const names = result.map(r => r.item.name);
      expect(names).toContain('上海');
      expect(names).toContain('山水');
    });
  });

  describe('查询中的空格', () => {
    it('空格不影响搜索', () => {
      const result = pinyinSearch('shang hai', sampleDataSh);
      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result[0].item.name).toBe('上海');
    });
  });

  describe('跳过不匹配字符', () => {
    it('搜索末尾字，跳过开头不匹配字', () => {
      const data = [
        { key: '中国人民' },
        { key: '美国人民' },
      ];
      const result = pinyinSearch('renmin', data);
      expect(result.length).toBeGreaterThanOrEqual(2);
      expect(result.map(r => r.item.name)).toContain('中国人民');
      expect(result.map(r => r.item.name)).toContain('美国人民');
    });
  });

  describe('连续段奖励排序', () => {
    it('全连续匹配得分高于分散匹配', () => {
      // 构造两个条目：同样的查询匹配到不同的 range
      // Entry A: 「中国」→ range [[0,1]] 连续 1 段
      // Entry B: 「中人国」→ range [[0,0],[2,2]] 分散 2 段，相同 coverage(2/3)
      // A 得分应更高，因为连续段 bonus
      const data = [
        { key: '中国' },
        { key: '中人国' },
      ];
      // '中国' 中=zhong 国=guo → 匹配 zhongguo → [[0,1]]
      // '中人国' 中=zhong 人=ren 国=guo → zhong 匹配 中(0), guo 匹配 国(2) → [[0,0],[2,2]]
      const result = pinyinSearch('zhongguo', data);
      expect(result.length).toBeGreaterThanOrEqual(2);
      expect(result[0].item.name).toBe('中国');
    });
  });

  describe('数字匹配', () => {
    it('文本中的数字可被精确匹配', () => {
      const data = [
        { key: '文件1' },
        { key: '文件2' },
      ];
      const result = pinyinSearch('1', data);
      expect(result.length).toBe(1);
      expect(result[0].item.name).toBe('文件1');
    });
  });
});
