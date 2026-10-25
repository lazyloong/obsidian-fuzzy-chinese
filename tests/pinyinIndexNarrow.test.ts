import { describe, it, expect, beforeAll } from 'vitest';
import Pinyin from '@/utils/pinyin';
import PinyinIndex from '@/utils/pinyinIndex';
import { pinyinEngine } from '@/engine/pinyinEngine';

beforeAll(() => {
  pinyinEngine.loadBase({ '\u4e2d':['zhong'], '\u56fd':['guo'], '\u4eba':['ren'], '\u6c11':['min'] });
  (globalThis as any).app = { workspace: { layoutReady: true } };
});

class TestIndex extends PinyinIndex<any> {
  initIndex() {}
  initEvent() {}
  update() {}
}

describe('PinyinIndex 首字符候选索引', () => {
  it('startCharIndex / narrowByFirstChar', () => {
    const idx = new TestIndex({ vault: {}, metadataCache: {} } as any, {} as any);
    const a = { name: '\u4e2d\u56fd', pinyin: new Pinyin('\u4e2d\u56fd') };
    const b = { name: '\u4eba\u6c11', pinyin: new Pinyin('\u4eba\u6c11') };
    idx.items = [a, b];

    expect(idx.startCharIndex.get('z')).toContain(a);
    expect(idx.startCharIndex.get('r')).toContain(b);
    expect(idx.narrowByFirstChar(idx.items, 'z')).toEqual([a]);
    expect(idx.narrowByFirstChar(idx.items, 'x')).toEqual([]);
  });

  it('保守保留不在索引中的条目（pathItem）', () => {
    const idx = new TestIndex({ vault: {}, metadataCache: {} } as any, {} as any);
    const a = { name: '\u4e2d\u56fd', pinyin: new Pinyin('\u4e2d\u56fd') };
    const pathItem = { name: 'x/y.md', pinyin: new Pinyin('x/y.md') };
    idx.items = [a];
    expect(idx.narrowByFirstChar([a, pathItem], 'z')).toEqual([a, pathItem]);
  });
});