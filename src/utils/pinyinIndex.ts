import ThePlugin from '@/main';
import { Component, Vault, MetadataCache, App } from 'obsidian';
import { runOnLayoutReady } from './helpers';
import { Item } from './type';

export default abstract class PinyinIndex<T extends Item> extends Component {
  vault: Vault;
  metadataCache: MetadataCache;
  private _items: T[];
  public get items(): T[] {
    return this._items;
  }
  public set items(value: T[]) {
    this._items = value;
    this._firstCharDirty = true;
    this._startCharDirty = true;
  }
  id: string;
  plugin: ThePlugin;
  app: App;

  /** 首字符倒排索引：拼音首字母 → 条目列表（dirty 时懒重建） */
  protected _firstCharDirty = true;
  protected _firstCharIndex: Map<string, T[]> = new Map();

  get firstCharIndex(): Map<string, T[]> {
    if (this._firstCharDirty) {
      this._firstCharIndex.clear();
      for (const item of this.items) {
        const first = item.pinyin[0];
        if (!first) continue;
        for (const py of first.pinyin) {
          const key = py[0];
          if (!this._firstCharIndex.has(key)) this._firstCharIndex.set(key, []);
          this._firstCharIndex.get(key)!.push(item);
        }
      }
      this._firstCharDirty = false;
    }
    return this._firstCharIndex;
  }

  /**
   * 首字符候选索引：匹配起点只能是「某个文本字符」或「某个字拼音的首字母」。
   * 多字符查询时先用它缩小候选集，避免对全部条目跑 DP。
   */
  protected _startCharDirty = true;
  protected _startCharIndex: Map<string, T[]> = new Map();

  get startCharIndex(): Map<string, T[]> {
    if (this._startCharDirty) {
      this._startCharIndex.clear();
      for (const item of this.items) {
        const seen = new Set<string>();
        for (const child of item.pinyin) {
          this.addStartKey(seen, child.character, item);
          for (const py of child.pinyin) {
            if (py) this.addStartKey(seen, py[0], item);
          }
        }
      }
      this._startCharDirty = false;
    }
    return this._startCharIndex;
  }

  private addStartKey(seen: Set<string>, key: string, item: T): void {
    if (seen.has(key)) return;
    seen.add(key);
    let arr = this._startCharIndex.get(key);
    if (!arr) {
      arr = [];
      this._startCharIndex.set(key, arr);
    }
    arr.push(item);
  }

  /**
   * 按查询首字符缩小候选集。
   * - items 就是 this.items 时直接返回候选数组；
   * - 否则保守过滤：只剔除「确定在索引中且不可能以该字符开头」的条目，
   *   不在索引中的条目（如文件搜索的 pathItem）保留，避免误删。
   */
  narrowByFirstChar(items: T[], query: string): T[] {
    if (items.length === 0) return items;
    const q0 = query[0];
    if (q0 === undefined) return items;
    const cand = this.startCharIndex.get(q0);
    if (items === this.items) return cand ?? [];
    const candSet = new Set(cand ?? []);
    const known = new Set(this.items);
    return items.filter((it) => !known.has(it) || candSet.has(it));
  }

  protected markFirstCharDirty(): void {
    this._firstCharDirty = true;
    this._startCharDirty = true;
  }

  constructor(app: App, plugin: ThePlugin) {
    super();
    this.app = app;
    this.plugin = plugin;
    this.vault = app.vault;
    this.metadataCache = app.metadataCache;
    this.items = [];
    runOnLayoutReady(() => {
      this.initEvent();
    });
  }
  abstract initIndex(): void;
  abstract initEvent(): void;
  abstract update(...args: any[]): void;
  has(query: string): boolean {
    return Boolean(this.items.find((p) => p.name === query));
  }
}