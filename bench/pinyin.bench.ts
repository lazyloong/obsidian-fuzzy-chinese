// tests/bench/pinyin.bench.ts
import { bench, describe } from 'vitest';
import Pinyin from '@/utils/pinyin';
import { initBenchmarkEnv } from './setup';

initBenchmarkEnv();

// ============================================================
// 预构建 Pinyin 实例（避免构造开销污染 benchmark）
// ============================================================
const names = {
  short: '中国',
  medium: '中国人民大学',
  long: '中国人民大学数据科学与工程研究所',
  mixed: 'ABC中国人民大学2024报告',
};

const pyMap: Record<string, Pinyin> = {};
for (const [k, v] of Object.entries(names)) {
  pyMap[k] = new Pinyin(v);
}

describe('matchAboveStart — 不同文本长度', () => {
  bench('2 字文本 · 全拼匹配 zhongguo', () => {
    pyMap.short.matchAboveStart('中国', 'zhongguo');
  });

  bench('6 字文本 · 全拼匹配 zhongguorenmindaxue', () => {
    pyMap.medium.matchAboveStart('中国人民大学', 'zhongguorenmindaxue');
  });

  bench('14 字文本 · 全拼匹配', () => {
    pyMap.long.matchAboveStart(
      '中国人民大学数据科学与工程研究所',
      'zhongguorenmindaxueshujukexueyugongchengyanjiusuo'
    );
  });

  bench('混合文本 · 全拼匹配（含英文数字）', () => {
    pyMap.mixed.matchAboveStart(
      'ABC中国人民大学2024报告',
      'abcguorenmindaxue2024baogao'
    );
  });
});

describe('matchAboveStart — 不同查询长度', () => {
  bench('1 字符查询 · 首字母 z', () => {
    pyMap.long.matchAboveStart(
      '中国人民大学数据科学与工程研究所',
      'z'
    );
  });

  bench('2 字符查询 · 首字母 zr', () => {
    pyMap.long.matchAboveStart(
      '中国人民大学数据科学与工程研究所',
      'zr'
    );
  });

  bench('4 字符查询 · 首字母 zrmd', () => {
    pyMap.long.matchAboveStart(
      '中国人民大学数据科学与工程研究所',
      'zrmd'
    );
  });

  bench('8 字符查询 · 混合全拼+首字母', () => {
    pyMap.long.matchAboveStart(
      '中国人民大学数据科学与工程研究所',
      'zrmdsxkg'
    );
  });
});

describe('matchAboveStart — 不同匹配策略', () => {
  bench('策略1 · 精确字符匹配 A', () => {
    pyMap.mixed.matchAboveStart('ABC中国人民大学2024报告', 'A');
  });

  bench('策略2 · 末音节前缀匹配 zhon', () => {
    pyMap.short.matchAboveStart('中国', 'zhon');
  });

  bench('策略3 · 单首字母匹配', () => {
    pyMap.medium.matchAboveStart('中国人民大学', 'z');
  });

  bench('策略3b · 双字符声母 zh', () => {
    pyMap.short.matchAboveStart('中国', 'zhg');
  });

  bench('策略3b · 双字符声母 sh', () => {
    const py = new Pinyin('上海');
    py.matchAboveStart('上海', 'shh');
  });

  bench('策略4 · 完整拼音匹配 zhong', () => {
    pyMap.short.matchAboveStart('中国', 'zhong');
  });
});

describe('matchAboveStart — 不匹配场景（最坏情况）', () => {
  bench('完全不匹配 · 英文查询 xyz', () => {
    pyMap.long.matchAboveStart(
      '中国人民大学数据科学与工程研究所',
      'xyz'
    );
  });

  bench('完全不匹配 · 长查询 xyzabc123', () => {
    pyMap.long.matchAboveStart(
      '中国人民大学数据科学与工程研究所',
      'xyzabc123'
    );
  });

  bench('跳跃匹配 · 只匹配最后字', () => {
    pyMap.medium.matchAboveStart('中国人民大学', 'daxue');
  });
});

describe('Pinyin.match — 完整管线', () => {
  bench('match() 全拼匹配', () => {
    pyMap.short.match('zhongguo', { name: '中国', pinyin: pyMap.short });
  });

  bench('match() 首字母匹配', () => {
    pyMap.medium.match('zrmd', { name: '中国人民大学', pinyin: pyMap.medium });
  });
});

describe('Pinyin 构造', () => {
  bench('构造函数 · 2 字', () => {
    new Pinyin('中国');
  });

  bench('构造函数 · 6 字', () => {
    new Pinyin('中国人民大学');
  });

  bench('构造函数 · 14 字（含英文数字）', () => {
    new Pinyin('ABC中国人民大学2024报告');
  });
});
