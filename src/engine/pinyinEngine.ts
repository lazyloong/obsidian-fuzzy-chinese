import { ShuangpinScheme, QueryOptions } from './types';
import DoubleDict from '@/dict/double_pinyin.json';
import FuzzyDefaults from '@/dict/fuzzy-defaults.json';
import { matchSheng } from '@/utils/pinyinUtils';

export class PinyinEngine {
  /** 汉字 → 拼音数组 */
  private _base = new Map<string, readonly string[]>();

  /** 已加载的双拼方案 */
  private schemes: Record<string, ShuangpinScheme> = {};
  /** 当前激活方案名（空串 = 全拼） */
  private _activeScheme = '';

  /** 模糊音规则：from → to 集合 */
  private fuzzyRuleMap = new Map<string, Set<string>>();
  private _fuzzyEnabled = false;
  private _palladiusEnabled = false;

  /** 汉字级缓存 */
  private fuzzyCache = new Map<string, readonly string[]>();
  private shuangpinCache = new Map<string, readonly string[]>();
  private palladiusCache = new Map<string, readonly string[]>();
  private palladiusMap: Record<string, string> = {};

  // ============================================================
  // 加载
  // ============================================================

  /** 加载基础字典（汉字 → 拼音）；接受 Record，内部转为 Map */
  loadBase(data: Record<string, string[]>): void {
    const map = new Map<string, readonly string[]>();
    for (const [k, v] of Object.entries(data)) {
      map.set(k, Object.freeze(v));
    }
    this._base = map;
  }

  /** 注册一套双拼方案 */
  loadScheme(scheme: ShuangpinScheme): void {
    this.schemes[scheme.name] = scheme;
  }

  /** 从 legacy 双拼字典加载所有内置方案 */
  loadLegacySchemes(): void {
    for (const [name, mapping] of Object.entries(DoubleDict)) {
      const sheng: Record<string, string> = {};
      const yun: Record<string, string> = {};

      for (const [spKey, fullForms] of Object.entries(mapping)) {
        for (let i = 0; i < fullForms.length; i++) {
          const form = fullForms[i];
          if (i === 0 || (fullForms.length === 1 && 'aeiou'.includes(form[0]))) {
            sheng[form] = spKey;
          } else {
            yun[form] = spKey;
          }
        }
      }

      this.schemes[name] = { name, sheng, yun };
    }
  }

  /** 切换双拼方案。传空字符串 = 全拼模式 */
  setActiveShuangpin(name: string): void {
    if (name && !this.schemes[name]) return;
    this._activeScheme = name;
    this.shuangpinCache.clear();
  }

  /** 加载默认模糊音规则（20 对双向对称） */
  loadDefaultFuzzyRules(): void {
    for (const [from, toList] of Object.entries(FuzzyDefaults)) {
      for (const to of toList) {
        this.addFuzzyRule(from, to);
      }
    }
  }

  /** 添加一条模糊音规则 */
  addFuzzyRule(from: string, to: string): void {
    let set = this.fuzzyRuleMap.get(from);
    if (!set) {
      set = new Set();
      this.fuzzyRuleMap.set(from, set);
    }
    set.add(to);
    this.fuzzyCache.clear();
  }

  /** 移除一条模糊音规则 */
  removeFuzzyRule(from: string): void {
    this.fuzzyRuleMap.delete(from);
    this.fuzzyCache.clear();
  }

  /** 清除全部模糊音规则 */
  clearFuzzyRules(): void {
    this.fuzzyRuleMap.clear();
    this.fuzzyCache.clear();
  }

  /** 开关模糊音 */
  toggleFuzzy(enabled: boolean): void {
    this._fuzzyEnabled = enabled;
  }

  loadPalladius(data: Record<string, string>): void {
    this.palladiusMap = data;
    this.palladiusCache.clear();
  }
  togglePalladius(enabled: boolean): void {
    this._palladiusEnabled = enabled;
  }
  /** 列出所有已加载的双拼方案名 */
  listSchemes(): string[] {
    return Object.keys(this.schemes);
  }

  // ============================================================
  // 查询
  // ============================================================

  /** 查询单个汉字的拼音数组 */
  getCharPinyin(char: string, opts?: QueryOptions): readonly string[] {
    const base = this._base.get(char);
    if (!base) return Object.freeze([char]);

    const useFuzzy = opts?.fuzzy ?? this._fuzzyEnabled;
    const useShuangpin = opts?.shuangpin ?? this._activeScheme;
    const usePalladius = opts?.palladius ?? this._palladiusEnabled;

    let result: readonly string[];
    if (useShuangpin && useFuzzy) {
      const sp = this.getShuangpinCached(char);
      result = this.getFuzzyCached(char, sp);
    } else if (useShuangpin) {
      result = this.getShuangpinCached(char);
    } else if (useFuzzy) {
      result = this.getFuzzyCached(char, base);
    } else {
      result = base;
    }

    if (usePalladius) result = result.concat(this.getPalladiusCached(char, result));
    return result;
  }

  /** 字符串 → 拼音列表 */
  toPinyinList(str: string, opts?: QueryOptions): readonly (readonly string[])[] {
    return Object.freeze(Array.from(str).map((c) => this.getCharPinyin(c, opts)));
  }

  // ============================================================
  // 内部转换
  // ============================================================

  /** 单拼音 → 双拼 */
  toShuangpin(pinyin: string): string {
    const scheme = this.schemes[this._activeScheme];
    if (!scheme) return pinyin;

    const { sheng, yun } = matchSheng(pinyin);
    const spSheng = sheng ? (scheme.sheng[sheng] ?? sheng) : '';
    const spYun = yun ? (scheme.yun[yun] ?? yun) : '';

    return spSheng + spYun;
  }

  /** 单拼音 → 模糊音扩展 */
  toFuzzy(pinyin: string): readonly string[] {
    if (!this._fuzzyEnabled || this.fuzzyRuleMap.size === 0) {
      return Object.freeze([pinyin]);
    }

    const set = new Set<string>();
    set.add(pinyin);

    const queue = [pinyin];
    while (queue.length > 0) {
      const cur = queue.shift()!;
      for (const [from, toSet] of this.fuzzyRuleMap) {
        const { sheng, yun } = matchSheng(cur);
        if (sheng === from || yun === from) {
          for (const to of toSet) {
            const expanded = sheng === from ? to + yun : sheng + to;
            if (!set.has(expanded)) {
              set.add(expanded);
              queue.push(expanded);
            }
          }
        }
      }
    }

    return Object.freeze(Array.from(set));
  }

  // ============================================================
  // 缓存辅助
  // ============================================================

  private getPalladiusCached(char: string, base: readonly string[]): readonly string[] {
    let cached = this.palladiusCache.get(char);
    if (!cached) {
      const out: string[] = [];
      for (const p of base) {
        const cyr = this.palladiusMap[p];
        if (cyr) {
          out.push(...cyr.split(',').map((s) => s.trim()));
        } else {
          out.push(p);
        }
      }
      cached = Object.freeze(out);
      this.palladiusCache.set(char, cached);
    }
    return cached;
  }

  private getShuangpinCached(char: string): readonly string[] {
    let cached = this.shuangpinCache.get(char);
    if (!cached) {
      const base = this._base.get(char);
      if (!base) {
        cached = Object.freeze([char]);
      } else {
        cached = Object.freeze(base.map((p) => this.toShuangpin(p)));
      }
      this.shuangpinCache.set(char, cached);
    }
    return cached;
  }

  private getFuzzyCached(char: string, base: readonly string[]): readonly string[] {
    const cacheKey = `${char}:${this.fuzzyRuleMap.size}`;
    let cached = this.fuzzyCache.get(cacheKey);
    if (!cached) {
      const expanded = new Set<string>();
      for (const p of base) {
        const fuzzy = this.toFuzzy(p);
        for (const f of fuzzy) expanded.add(f);
      }
      cached = Object.freeze(Array.from(expanded));
      this.fuzzyCache.set(cacheKey, cached);
    }
    return cached;
  }
}

/** 全局单例 */
export const pinyinEngine = new PinyinEngine();
