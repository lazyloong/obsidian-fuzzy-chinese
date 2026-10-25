import { describe, it, expect, beforeAll } from 'vitest';
import Pinyin from '@/utils/pinyin';
import { pinyinEngine } from '@/engine/pinyinEngine';

beforeAll(() => {
  pinyinEngine.loadBase({
    '\u4e2d':['zhong'],'\u56fd':['guo'],'\u4eba':['ren'],'\u6c11':['min'],'\u5927':['da'],'\u5b66':['xue'],
    '\u6570':['shu'],'\u636e':['ju'],'\u79d1':['ke'],'\u5de5':['gong'],'\u7a0b':['cheng'],'\u7814':['yan'],
    '\u7a76':['jiu'],'\u6240':['suo'],'\u8bbe':['she'],'\u7f6e':['zhi'],'\u6587':['wen'],'\u4ef6':['jian'],
  });
});

interface Cell { len: number; index: number; prev: Cell | null }
const SENT: any = { len: 0, index: -1, prev: null };
function recon(c: Cell) { const a: number[] = []; let x: any = c; while (x && x.len > 0) { a.push(x.index); x = x.prev; } a.reverse(); return a; }

// 优化前的参考实现（用于随机对拍）
function referenceMatch(py: any, text: string, query: string): number[] | null {
  const n = text.length, m = query.length;
  let prev: any[] = new Array(m + 1).fill(null); prev[0] = SENT;
  for (let i = 1; i <= n; i++) {
    const cur: any[] = new Array(m + 1).fill(null); cur[0] = SENT;
    for (let j = 1; j <= m; j++) cur[j - 1] = prev[j - 1];
    const entry = py[i - 1]; if (!entry) { prev = cur; continue; }
    const pinyins: string[] = entry.pinyin; const ch = text[i - 1];
    for (let j = 1; j <= m; j++) {
      const p = prev[j - 1]; if (p === null) continue; if (j !== 1 && p.len === 0) continue;
      const qj = query[j - 1];
      if (ch === qj) { const c = { len: p.len + 1, index: i - 1, prev: p }; if (cur[j] === null || c.len > cur[j].len) cur[j] = c; if (j === m) return recon(cur[j]); }
      if (m - j <= 6) { const last = pinyins.some((x) => x.startsWith(query.slice(j - 1, m))); if (last) { const c = { len: p.len + 1, index: i - 1, prev: p }; return recon(c); } }
      if (pinyins.some((x) => x[0] === qj)) { const c = { len: p.len + 1, index: i - 1, prev: p }; if (cur[j] === null || c.len > cur[j].len) cur[j] = c; }
      if (m - j >= 1) { const i2 = query.slice(j - 1, j + 1); if ((i2 === 'zh' || i2 === 'ch' || i2 === 'sh') && pinyins.some((x) => x.startsWith(i2))) { const c = { len: p.len + 1, index: i - 1, prev: p }; if (cur[j + 1] === null || c.len > cur[j + 1].len) cur[j + 1] = c; } }
      for (const x of pinyins) { if (query.startsWith(x, j - 1)) { const c = { len: p.len + 1, index: i - 1, prev: p }; const e = j - 1 + x.length; if (cur[e] === null || c.len > cur[e].len) cur[e] = c; } }
    }
    prev = cur;
  }
  return null;
}

function mulberry32(seed: number) { let s = seed; return () => { s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

const CJK = ['\u4e2d','\u56fd','\u4eba','\u6c11','\u5927','\u5b66','\u6570','\u636e','\u79d1','\u5de5','\u7a0b','\u7814','\u7a76','\u6240','\u8bbe','\u7f6e','\u6587','\u4ef6'];
const ASCII = 'abcdefghijklmnopqrstuvwxyz0123456789./'.split('');

describe('matchAboveStart 随机对拍（优化 vs 参考实现）', () => {
  it('随机文本/查询结果一致', () => {
    const rnd = mulberry32(20240909);
    const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)];
    let checked = 0;
    for (let t = 0; t < 4000; t++) {
      const len = 1 + Math.floor(rnd() * 10);
      let text = '';
      for (let i = 0; i < len; i++) text += rnd() < 0.8 ? pick(CJK) : pick(ASCII);
      const qlen = 1 + Math.floor(rnd() * 6);
      let query = '';
      for (let i = 0; i < qlen; i++) query += rnd() < 0.35 ? pick(ASCII) : pick(CJK);
      const py = new Pinyin(text);
      const got = py.matchAboveStart(text, query);
      const want = referenceMatch(py, text, query);
      if (JSON.stringify(got) !== JSON.stringify(want)) {
        throw new Error('mismatch text=' + text + ' query=' + query + ' got=' + JSON.stringify(got) + ' want=' + JSON.stringify(want));
      }
      checked++;
    }
    expect(checked).toBe(4000);
  });
});