import { Item, MatchData } from './type';
import { usePlugin } from './helpers';
import { pinyinEngine } from '@/engine/pinyinEngine';

/** 拼音最长音节长度（用于末音节前缀匹配判断） */
const MAX_PINYIN_LENGTH = 6;

/** 双字符声母集合 */
const SHUANG_SHENG = ['zh', 'ch', 'sh'];

/** DP 单元格：存储匹配状态及 O(1) 回溯指针 */
interface DPCell {
    /** 已匹配的文本字符数 */
    len: number;
    /** 当前匹配的文本字符索引 */
    index: number;
    /** 回溯：前一个匹配的 DPCell（直接指针，不再需要矩阵坐标） */
    prev: DPCell | null;
}

/** 哨兵：表示「尚未匹配任何字符」但可作为起点的合法状态 */
const SENTINEL: DPCell = Object.freeze({ len: 0, index: -1, prev: null });

/** 将查询字符串归一化：去空格、NFKD 分解 */
export function normalizeQuery(query: string): string {
  return query.replace(/\s/g, '').normalize('NFKD');
}

/** 将文本做大小写归一化（含土耳其语 İ 特殊处理） */
export function normalizeText(text: string, smartCase: boolean): string {
  if (smartCase) return text;
  const locale: string | undefined = text.includes('İ') ? 'tr' : undefined;
  return text.toLocaleLowerCase(locale);
}

/**
 * 沿 DP 回溯链重建匹配索引数组（倒序收集后反转）
 * @param cell  终端 DPCell
 * @returns 有序匹配索引数组，如 [0, 2, 5]
 */
function reconstructPath(cell: DPCell): number[] {
    const indices: number[] = [];
    let cur: DPCell | null = cell;
    while (cur !== null && cur.len > 0) {
        indices.push(cur.index);
        cur = cur.prev;
    }
    indices.reverse();
    return indices;
}

export default class Pinyin extends Array<PinyinChild> {
  text: string;
  constructor(query: string) {
    super();
    this.text = query;
    this.text.split('').forEach((p) => {
      const pinyin = pinyinEngine.getCharPinyin(p);
      this.push({
        character: p,
        pinyin: Array.from(pinyin, (s) => s.toLowerCase()) as string[],
      });
    });
  }
  getScore(range: Array<[number, number]>) {
    const textLen = this.text.length;
    const coverage = range.reduce((p, c) => p + c[1] - c[0] + 1, 0) / textLen;

    let score = 0;

    // 覆盖率：平方函数使高覆盖率获得超线性奖励（全匹配远比部分匹配值钱）
    score += 100 * coverage * coverage;

    // 靠前加分：反平方根衰减，比 1/(x+1) 更平滑地奖励靠前匹配
    score += 15 / Math.sqrt(range[0][0] + 1);

    // 连续段数越少越好
    score += 25 / range.length;

    // 长连续段加分：每段长度 > 1 时额外奖励
    for (const [start, end] of range) {
      const segLen = end - start + 1;
      if (segLen > 1) {
        score += 5 * (segLen - 1);
      }
    }

    return score;
  }
  match<T extends Item>(query: string, item: T): MatchData<T> {
    const range_ = this.match_(query);
    const range = range_ ? toRanges(range_) : false;
    if (!range) return;
    return {
      item: item,
      score: this.getScore(range),
      range,
    };
  }
  concat(pinyin: Pinyin): Pinyin {
    const result = new Pinyin('');
    result.text = this.text + pinyin.text;
    result.push(...this, ...pinyin);
    return result;
  }

  match_(query: string): number[] | null {
    const smartCase = /[A-Z]/.test(query) && usePlugin().settings.global.autoCaseSensitivity;
    const finalQuery = smartCase ? normalizeQuery(query) : normalizeQuery(query).toLocaleLowerCase();
    const finalText = normalizeText(this.text, smartCase);
    return this.matchAboveStart(finalText, finalQuery);
  }

  // Original matchAboveStart based on the work of zh-lx (https://github.com/zh-lx).
  // Original code: https://github.com/zh-lx/pinyin-pro/blob/main/lib/core/match/index.ts.
  matchAboveStart(text: string, query: string): number[] | null {
    const n = text.length;
    const m = query.length;

    // 两行轮转：prevRow = dp[i-1]，currRow = dp[i]
    let prevRow: (DPCell | null)[] = new Array(m + 1).fill(null);
    prevRow[0] = SENTINEL;

    for (let i = 1; i <= n; i++) {
      const currRow: (DPCell | null)[] = new Array(m + 1).fill(null);
      currRow[0] = SENTINEL;
      const ch = text[i - 1];
      const pinyins = this[i - 1].pinyin;

      // 允许跳过第 i 个字（不参与匹配），将上一行状态水平传递
      for (let j = 1; j <= m; j++) {
        currRow[j - 1] = prevRow[j - 1];
      }

      // 第 i 个字参与匹配
      for (let j = 1; j <= m; j++) {
        const prev = prevRow[j - 1];
        if (prev === null) {
          continue;
        }
        if (j !== 1 && prev.len === 0) {
          continue;
        }

        const qj = query[j - 1]; // 缓存 query[j-1]

        // 策略1：精确字符匹配（非中文、数字等直接按字符匹配）
        if (ch === qj) {
          const cell: DPCell = { len: prev.len + 1, index: i - 1, prev };
          if (currRow[j] === null || cell.len > currRow[j]!.len) {
            currRow[j] = cell;
          }
          if (j === m) {
            return reconstructPath(currRow[j]!);
          }
        }

        // 策略2：末音节前缀匹配（查询剩余 ≤6 字符时，有可能是最后一个拼音的前缀）
        if (m - j <= MAX_PINYIN_LENGTH) {
          const last = pinyins.some((p) =>
            p.startsWith(query.slice(j - 1, m))
          );
          if (last) {
            const cell: DPCell = { len: prev.len + 1, index: i - 1, prev };
            return reconstructPath(cell);
          }
        }

        // 策略3：首字母匹配
        if (pinyins.some((p) => p[0] === qj)) {
          const cell: DPCell = { len: prev.len + 1, index: i - 1, prev };
          if (currRow[j] === null || cell.len > currRow[j]!.len) {
            currRow[j] = cell;
          }
        }

        // 策略3b：双字符声母匹配（zh/ch/sh）
        if (m - j >= 1) {
          const initial2 = query.slice(j - 1, j + 1);
          if (SHUANG_SHENG.includes(initial2) && pinyins.some((p) => p.startsWith(initial2))) {
            const cell: DPCell = { len: prev.len + 1, index: i - 1, prev };
            const targetCol = j + 1;
            if (currRow[targetCol] === null || cell.len > currRow[targetCol]!.len) {
              currRow[targetCol] = cell;
            }
          }
        }

        // 策略4：完整拼音匹配
        for (const p of pinyins) {
          if (query.startsWith(p, j - 1)) {
            const cell: DPCell = { len: prev.len + 1, index: i - 1, prev };
            const endIndex = j - 1 + p.length;
            if (currRow[endIndex] === null || cell.len > currRow[endIndex]!.len) {
              currRow[endIndex] = cell;
            }
          }
        }
      }
      prevRow = currRow;
    }
    return null;
  }
}

type PinyinChild = {
  character: string[1];
  pinyin: string[];
};

/**
 * 将一个有序的数字数组转换为由连续数字区间组成的数组
 * @example
 * toRanges([1, 2, 3, 5, 7, 8])
 * // 输出: [[1,3],[5,5],[7,8]]
 */
export function toRanges(arr: Array<number>): Array<[number, number]> {
  const result = [];
  let start = arr[0];
  let end = arr[0];
  for (let i = 1; i < arr.length; i++) {
    if (arr[i] === end + 1) {
      end = arr[i];
    } else {
      result.push([start, end]);
      start = arr[i];
      end = arr[i];
    }
  }
  result.push([start, end]);
  return result;
}
