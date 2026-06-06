import { Item, MatchData } from './type';
import { usePlugin } from './helpers';
import { pinyinEngine } from '@/engine/pinyinEngine';

/** 拼音最长音节长度（用于末音节前缀匹配判断） */
const MAX_PINYIN_LENGTH = 6;

/** 双字符声母集合 */
const SHUANG_SHENG = ['zh', 'ch', 'sh'];

/** DP 单元格：存储匹配状态及 O(1) 回溯指针，替代数组拷贝 */
interface DPCell {
    /** 已匹配的文本字符数 */
    len: number;
    /** 当前匹配的文本字符索引（即 words[i-1] 的 i-1） */
    index: number;
    /** 回溯：前一个匹配所在的 dp 行 */
    prevI: number;
    /** 回溯：前一个匹配所在的 dp 列 */
    prevJ: number;
}

/** 哨兵：表示「尚未匹配任何字符」但可作为起点的合法状态 */
const SENTINEL: DPCell = Object.freeze({ len: 0, index: -1, prevI: -1, prevJ: -1 });

/**
 * 沿 dp 回溯链重建匹配索引数组（倒序收集后反转）
 * @param cell  终端 DPCell
 * @param dp    dp 矩阵（用于沿 prevI/prevJ 向上查找）
 * @returns 有序匹配索引数组，如 [0, 2, 5]
 */
function reconstructPath(cell: DPCell, dp: (DPCell | null)[][]): number[] {
    const indices: number[] = [];
    let cur: DPCell | null = cell;
    while (cur !== null && cur.len > 0) {
        indices.push(cur.index);
        cur = (cur.prevI >= 0 && cur.prevJ >= 0)
            ? dp[cur.prevI][cur.prevJ]
            : null;
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
        pinyin: Array.from(pinyin) as string[],
      });
    });
  }
  getScore(range: Array<[number, number]>) {
    const coverage = range.reduce((p, c) => p + c[1] - c[0] + 1, 0) / this.text.length;
    let score = 0;
    score += coverage < 0.5 ? 150 * coverage : 50 * coverage + 50; // 使用线性函数计算覆盖度
    score += 20 / (range[0][0] + 1); // 靠前加分
    score += 30 / range.length; // 分割越少分越高
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
  // The following two functions are based on the work of zh-lx (https://github.com/zh-lx).
  // Original code: https://github.com/zh-lx/pinyin-pro/blob/main/lib/core/match/index.ts.
  match_(query: string): number[] | null {
    const smartCase = /[A-Z]/.test(query) && usePlugin().settings.global.autoCaseSensitivity;
    query = query.replace(/\s/g, '');

    // NFKD 归一化防止土耳其语 İ 等特殊字符转小写后长度变化
    const normalizedText = this.text.normalize('NFKD');
    const normalizedQuery = query.normalize('NFKD');

    const normalizeCase = (str: string) => (smartCase ? str : str.toLocaleLowerCase());
    const result = this.matchAboveStart(
      normalizeCase(normalizedText),
      normalizeCase(normalizedQuery)
    );
    return result;
  }

  matchAboveStart(text: string, query: string): number[] | null {
    const words = text.split('');

    // dp[i][j]：null = 死路/未计算，DPCell = 可继续匹配的合法状态
    // i = 文本字符索引(1-based)，j = 查询字符串索引(1-based)
    const dp: (DPCell | null)[][] = Array(words.length + 1);
    for (let i = 0; i < dp.length; i++) {
      dp[i] = Array(query.length + 1).fill(null);
      dp[i][0] = SENTINEL;
    }
    for (let j = 0; j <= query.length; j++) {
      dp[0][j] = SENTINEL;
    }

    // 动态规划匹配
    for (let i = 1; i < dp.length; i++) {
      // 允许跳过第 i 个字（不参与匹配），将上一行状态水平传递
      for (let j = 1; j <= query.length; j++) {
        dp[i][j - 1] = dp[i - 1][j - 1];
      }

      // 第 i 个字参与匹配
      for (let j = 1; j <= query.length; j++) {
        const prev = dp[i - 1][j - 1];
        if (prev === null) {
          // 第 i - 1 已经匹配失败，停止向后匹配
          continue;
        }
        if (j !== 1 && prev.len === 0) {
          // 非开头且前面的字符未匹配完成，停止向后匹配
          continue;
        }

        const pinyins = this[i - 1].pinyin;

        // 策略1：精确字符匹配（非中文、数字等直接按字符匹配）
        if (text[i - 1] === query[j - 1]) {
          const cell: DPCell = { len: prev.len + 1, index: i - 1, prevI: i - 1, prevJ: j - 1 };
          if (dp[i][j] === null || cell.len > dp[i][j]!.len) {
            dp[i][j] = cell;
          }
          if (j === query.length) {
            return reconstructPath(dp[i][j]!, dp);
          }
        }

        // 策略2：末音节前缀匹配（查询剩余 ≤6 字符时，有可能是最后一个拼音的前缀）
        if (query.length - j <= MAX_PINYIN_LENGTH) {
          const last = pinyins.some((p) =>
            p.startsWith(query.slice(j - 1, query.length))
          );
          if (last) {
            const cell: DPCell = { len: prev.len + 1, index: i - 1, prevI: i - 1, prevJ: j - 1 };
            return reconstructPath(cell, dp);
          }
        }

        // 策略3：首字母匹配
        if (pinyins.some((p) => p[0] === query[j - 1])) {
          const cell: DPCell = { len: prev.len + 1, index: i - 1, prevI: i - 1, prevJ: j - 1 };
          if (dp[i][j] === null || cell.len > dp[i][j]!.len) {
            dp[i][j] = cell;
          }
        }

        // 策略4：完整拼音匹配
        const completePinyin = pinyins.find(
          (p: string) => p === query.slice(j - 1, j - 1 + p.length)
        );
        if (completePinyin) {
          const cell: DPCell = { len: prev.len + 1, index: i - 1, prevI: i - 1, prevJ: j - 1 };
          const endIndex = j - 1 + completePinyin.length;
          if (dp[i][endIndex] === null || cell.len > dp[i][endIndex]!.len) {
            dp[i][endIndex] = cell;
          }
        }
      }
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
