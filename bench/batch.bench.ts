// tests/bench/batch.bench.ts
import { bench, describe } from 'vitest';
import Pinyin from '@/utils/pinyin';
import pinyinSearch from '@/utils/pinyinSearch';
import { initBenchmarkEnv, DATASETS } from './setup';

initBenchmarkEnv();

// ============================================================
// 预构建 Pinyin 对象数组
// ============================================================
function buildItems(names: string[]) {
  return names.map((name) => ({
    name,
    pinyin: new Pinyin(name),
  }));
}

const datasets = {
  small: buildItems(DATASETS.small),     // 100
  medium: buildItems(DATASETS.medium),   // 500
  large: buildItems(DATASETS.large),     // 1000
  xlarge: buildItems(DATASETS.xlarge),   // 5000
  xxlarge: buildItems(DATASETS.xxlarge), // 10000
  huge: buildItems(DATASETS.huge),       // 50000
};

// ============================================================
// pinyinSearch — 对外 API
// ============================================================
describe('pinyinSearch — 不同数据规模', () => {
  bench('100 条 · 全拼 2 字', () => {
    pinyinSearch('shezhi', datasets.small as any, (p: any) => p.name);
  });

  bench('500 条 · 全拼 2 字', () => {
    pinyinSearch('shezhi', datasets.medium as any, (p: any) => p.name);
  });

  bench('1000 条 · 全拼 2 字', () => {
    pinyinSearch('shezhi', datasets.large as any, (p: any) => p.name);
  });

  bench('5000 条 · 全拼 2 字', () => {
    pinyinSearch('shezhi', datasets.xlarge as any, (p: any) => p.name);
  });

  bench('10000 条 · 全拼 2 字', () => {
    pinyinSearch('shezhi', datasets.xxlarge as any, (p: any) => p.name);
  });

  bench('50000 条 · 全拼 2 字', () => {
    pinyinSearch('shezhi', datasets.huge as any, (p: any) => p.name);
  });
});

describe('pinyinSearch — 不同查询模式 (10000 条)', () => {
  const data = datasets.xxlarge;

  bench('1 字符首字母', () => {
    pinyinSearch('s', data as any, (p: any) => p.name);
  });

  bench('2 字符首字母', () => {
    pinyinSearch('sz', data as any, (p: any) => p.name);
  });

  bench('4 字符首字母', () => {
    pinyinSearch('szmb', data as any, (p: any) => p.name);
  });

  bench('全拼 2 字', () => {
    pinyinSearch('shezhi', data as any, (p: any) => p.name);
  });

  bench('全拼 4 字', () => {
    pinyinSearch('shezhimianban', data as any, (p: any) => p.name);
  });

  bench('双字符声母 + 首字母 shh', () => {
    pinyinSearch('shh', data as any, (p: any) => p.name);
  });

  bench('空查询（返回所有）', () => {
    pinyinSearch('', data as any, (p: any) => p.name);
  });
});

// ============================================================
// 模拟 modal.ts getFirstInputSuggestions — 首字符快速扫描
// ============================================================
describe('getFirstInputSuggestions — 首字符扫描', () => {
  bench('100 条 · 首字符', () => {
    const items = datasets.small;
    const query = 's';
    for (const item of items) {
      item.pinyin.findIndex(
        (p) => p.pinyin.some((q: string) => q.toLowerCase().startsWith(query)) || p.character === query
      );
    }
  });

  bench('1000 条 · 首字符', () => {
    const items = datasets.large;
    const query = 's';
    for (const item of items) {
      item.pinyin.findIndex(
        (p) => p.pinyin.some((q: string) => q.toLowerCase().startsWith(query)) || p.character === query
      );
    }
  });

  bench('10000 条 · 首字符', () => {
    const items = datasets.xxlarge;
    const query = 's';
    for (const item of items) {
      item.pinyin.findIndex(
        (p) => p.pinyin.some((q: string) => q.toLowerCase().startsWith(query)) || p.character === query
      );
    }
  });

  bench('50000 条 · 首字符', () => {
    const items = datasets.huge;
    const query = 's';
    for (const item of items) {
      item.pinyin.findIndex(
        (p) => p.pinyin.some((q: string) => q.toLowerCase().startsWith(query)) || p.character === query
      );
    }
  });
});

// ============================================================
// 模拟 modal.ts getNormalInputSuggestions — 逐条 DP 匹配
// ============================================================
describe('getNormalInputSuggestions — 逐条 DP 匹配', () => {
  bench('100 条 · 全拼 2 字', () => {
    const query = 'shezhi';
    const items = datasets.small;
    for (const item of items) {
      item.pinyin.match(query, item);
    }
  });

  bench('1000 条 · 全拼 2 字', () => {
    const query = 'shezhi';
    const items = datasets.large;
    for (const item of items) {
      item.pinyin.match(query, item);
    }
  });

  bench('5000 条 · 全拼 2 字', () => {
    const query = 'shezhi';
    const items = datasets.xlarge;
    for (const item of items) {
      item.pinyin.match(query, item);
    }
  });

  bench('10000 条 · 全拼 2 字', () => {
    const query = 'shezhi';
    const items = datasets.xxlarge;
    for (const item of items) {
      item.pinyin.match(query, item);
    }
  });

  bench('50000 条 · 全拼 2 字', () => {
    const query = 'shezhi';
    const items = datasets.huge;
    for (const item of items) {
      item.pinyin.match(query, item);
    }
  });
});
