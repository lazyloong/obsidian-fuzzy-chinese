import { Item, MatchData } from './type';
import { usePlugin } from './helpers';
import { pinyinEngine } from '@/engine/pinyinEngine';

/** 拼音最长音节长度（用于末音节前缀匹配判断） */
const MAX_PINYIN_LENGTH = 6;

/** 把字符串中的 ASCII 字母（大小写统一）累加进 26 位掩码 */
function addLetterBits(mask: number, s: string): number {
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    let k = -1;
    if (c >= 97 && c <= 122) k = c - 97;
    else if (c >= 65 && c <= 90) k = c - 65;
    if (k >= 0) mask |= 1 << k;
  }
  return mask;
}

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
  // 仅土耳其语 İ 需要 locale 处理；其余用更快的 toLowerCase
  if (text.includes('İ')) return text.toLocaleLowerCase('tr');
  return text.toLowerCase();
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
  /**
   * 让 map/filter/slice 等派生操作返回普通数组。
   * 默认行为下 Array 子类会用 `new Pinyin(length)` 派生实例，
   * 构造函数收到 number 后在 `this.text.split('')` 抛 TypeError，
   * 使任何 `pinyin.map(...)` 调用直接失败。
   */
  static get [Symbol.species](): ArrayConstructor {
    return Array;
  }
  text: string;
  /** 文本字符 + 所有候选拼音中出现过的 a-z 字母掩码 */
  letterMask: number = 0;
  /** 能作为匹配起点的 a-z 字母掩码（文本字符或任一字拼音首字母） */
  startMask: number = 0;
  constructor(query: string) {
    super();
    this.text = query;
    let letterMask = 0;
    let startMask = 0;
    this.text.split('').forEach((p) => {
      const pinyin = Array.from(pinyinEngine.getCharPinyin(p), (s) => s.toLowerCase());
      this.push({ character: p, pinyin });
      letterMask = addLetterBits(letterMask, p);
      startMask = addLetterBits(startMask, p);
      for (const py of pinyin) {
        letterMask = addLetterBits(letterMask, py);
        startMask = addLetterBits(startMask, py[0] ?? '');
      }
    });
    this.letterMask = letterMask;
    this.startMask = startMask;
  }

  /**
   * 快速否定（必要非充分）：查询中的 a-z 字母是否都可能在本文本中匹配。
   * 仅当传入 text 与 this.text 一致时使用，避免对任意 text 误判。
   */
  couldMatch(query: string): boolean {
    let required = 0;
    for (let i = 0; i < query.length; i++) {
      const c = query.charCodeAt(i);
      let k = -1;
      if (c >= 97 && c <= 122) k = c - 97;
      else if (c >= 65 && c <= 90) k = c - 65;
      if (k >= 0) required |= 1 << k;
    }
    if ((required & ~this.letterMask) !== 0) return false;
    // 首字符必须等于某个文本字符，或某个字符拼音的首字母
    const c0 = query.charCodeAt(0);
    if (c0 >= 97 && c0 <= 122) return (this.startMask & (1 << (c0 - 97))) !== 0;
    if (c0 >= 65 && c0 <= 90) return (this.startMask & (1 << (c0 - 65))) !== 0;
    return true;
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
    result.letterMask = this.letterMask | pinyin.letterMask;
    result.startMask = this.startMask | pinyin.startMask;
    return result;
  }

  match_(query: string): number[] | null {
    const smartCase = /[A-Z]/.test(query) && usePlugin().settings.global.autoCaseSensitivity;
    const finalQuery = smartCase ? normalizeQuery(query) : normalizeQuery(query).toLowerCase();
    const finalText = normalizeText(this.text, smartCase);
    return this.matchAboveStart(finalText, finalQuery);
  }

  // Original matchAboveStart based on the work of zh-lx (https://github.com/zh-lx).
  // 优化版：预计算查询尾部、复用两行 DP 数组、显式循环、字母掩码快速否定、活跃列裁剪。
  matchAboveStart(text: string, query: string): number[] | null {
    const n = text.length;
    const m = query.length;
    if (m === 0) return null;

    // 快速否定：省掉整趟 DP（仅当 text 与自身文本一致时掩码才可靠）
    if (text === this.text && !this.couldMatch(query)) return null;

    // 策略2 需要 query.slice(j-1)；只在剩余长度 ≤ MAX_PINYIN_LENGTH 时使用，
    // 预先算好这些尾部串，避免在 O(n*m) 内层循环里反复分配子串。
    const tails: string[] = new Array(m);
    for (let idx = Math.max(0, m - 1 - MAX_PINYIN_LENGTH); idx < m; idx++) {
      tails[idx] = query.slice(idx, m);
    }

    // 两行轮转；复用两个数组，避免每个字符都 new Array(m+1)。
    let prevRow: (DPCell | null)[] = new Array(m + 1).fill(null);
    let currRow: (DPCell | null)[] = new Array(m + 1).fill(null);
    prevRow[0] = SENTINEL;
    // prevMax = prevRow 中最高非空列；更高列的 prevRow 必为 null，可整段跳过。
    let prevMax = 0;

    for (let i = 1; i <= n; i++) {
      // 复用数组：本行 0..m-1 由上一行覆盖，末列单独清空。
      currRow[0] = SENTINEL;
      for (let j = 1; j <= m; j++) currRow[j - 1] = prevRow[j - 1];
      currRow[m] = null;

      // 跳过传播后，本行最高非空列不会超过 min(prevMax, m-1)
      let nextMax = prevMax < m ? prevMax : m - 1;

      const entry = this[i - 1];
      if (!entry) {
        const tmp = prevRow;
        prevRow = currRow;
        currRow = tmp;
        prevMax = nextMax;
        continue;
      }

      const pinyins = entry.pinyin;
      const pn = pinyins.length;
      const ch = text[i - 1];

      // 只有 j-1 <= prevMax 时 prevRow[j-1] 才可能非空
      const jEnd = prevMax + 1 < m ? prevMax + 1 : m;
      for (let j = 1; j <= jEnd; j++) {
        const prev = prevRow[j - 1];
        if (prev === null) continue;
        if (j !== 1 && prev.len === 0) continue;

        const qj = query[j - 1];

        // 策略1：精确字符匹配
        if (ch === qj) {
          const cell: DPCell = { len: prev.len + 1, index: i - 1, prev };
          const cur = currRow[j];
          if (cur === null || cell.len > cur.len) currRow[j] = cell;
          if (j > nextMax) nextMax = j;
          if (j === m) return reconstructPath(currRow[j]!);
        }

        const rem = m - j;

        // 策略2：末音节前缀匹配
        if (rem <= MAX_PINYIN_LENGTH) {
          const tail = tails[j - 1];
          let last = false;
          for (let k = 0; k < pn; k++) {
            if (pinyins[k].startsWith(tail)) {
              last = true;
              break;
            }
          }
          if (last) {
            const cell: DPCell = { len: prev.len + 1, index: i - 1, prev };
            return reconstructPath(cell);
          }
        }

        // 策略3：首字母匹配
        let initial = false;
        for (let k = 0; k < pn; k++) {
          if (pinyins[k][0] === qj) {
            initial = true;
            break;
          }
        }
        if (initial) {
          const cell: DPCell = { len: prev.len + 1, index: i - 1, prev };
          const cur = currRow[j];
          if (cur === null || cell.len > cur.len) currRow[j] = cell;
          if (j > nextMax) nextMax = j;
        }

        // 策略3b：双字符声母 zh / ch / sh
        if (rem >= 1) {
          const qj1 = query[j];
          if ((qj === 'z' || qj === 'c' || qj === 's') && qj1 === 'h') {
            const c0 = qj.charCodeAt(0);
            const c1 = qj1.charCodeAt(0);
            let shuang = false;
            for (let k = 0; k < pn; k++) {
              const p = pinyins[k];
              if (p.length >= 2 && p.charCodeAt(0) === c0 && p.charCodeAt(1) === c1) {
                shuang = true;
                break;
              }
            }
            if (shuang) {
              const cell: DPCell = { len: prev.len + 1, index: i - 1, prev };
              const cur = currRow[j + 1];
              if (cur === null || cell.len > cur.len) currRow[j + 1] = cell;
              if (j + 1 > nextMax) nextMax = j + 1;
            }
          }
        }

        // 策略4：完整拼音匹配
        for (let k = 0; k < pn; k++) {
          const p = pinyins[k];
          if (query.startsWith(p, j - 1)) {
            const cell: DPCell = { len: prev.len + 1, index: i - 1, prev };
            const endIndex = j - 1 + p.length;
            const cur = currRow[endIndex];
            if (cur === null || cell.len > cur.len) currRow[endIndex] = cell;
            if (endIndex > nextMax) nextMax = endIndex;
          }
        }
      }

      const tmp = prevRow;
      prevRow = currRow;
      currRow = tmp;
      prevMax = nextMax;
    }
    return null;
  }
}

type PinyinChild = {
  character: string[1];
  pinyin: string[];
};

/**
 * 计算 pathItem 的路径拼音。
 *
 * pathItem.name 是文件的完整路径（file.path），而 Pinyin 的字符表来自构造时的字符串；
 * 二者一旦不一致（例如用不含扩展名的 basename 构造路径拼音），
 * matchAboveStart 里取 `this[i - 1].pinyin` 就会越界，使整个查询抛异常。
 * 这里保证路径拼音与传入路径逐字符对齐；两者相同时复用原实例，避免重复构造。
 */
const PINYIN_CACHE_LIMIT = 2000;
const pinyinCache = new Map<string, Pinyin>();

/** 带容量上限的 Pinyin 缓存：复用相同文本的拼音（文件夹路径、扩展名等） */
export function getCachedPinyin(text: string): Pinyin {
  const cached = pinyinCache.get(text);
  if (cached) return cached;
  const result = new Pinyin(text);
  if (pinyinCache.size >= PINYIN_CACHE_LIMIT) pinyinCache.clear();
  pinyinCache.set(text, result);
  return result;
}

export function pathPinyinFor(filePath: string, fileNamePinyin: Pinyin): Pinyin {
  if (fileNamePinyin.text === filePath) return fileNamePinyin;
  const idx = filePath.indexOf(fileNamePinyin.text);
  if (idx >= 0) {
    const prefix = filePath.slice(0, idx);
    const suffix = filePath.slice(idx + fileNamePinyin.text.length);
    let result = prefix ? getCachedPinyin(prefix).concat(fileNamePinyin) : fileNamePinyin;
    if (suffix) result = result.concat(getCachedPinyin(suffix));
    return result;
  }
  return getCachedPinyin(filePath);
}

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
