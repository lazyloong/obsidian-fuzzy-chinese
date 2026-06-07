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
        for (const py of item.pinyin[0].pinyin) {
          const key = py[0];
          if (!this._firstCharIndex.has(key)) this._firstCharIndex.set(key, []);
          this._firstCharIndex.get(key)!.push(item);
        }
      }
      this._firstCharDirty = false;
    }
    return this._firstCharIndex;
  }

  protected markFirstCharDirty(): void {
    this._firstCharDirty = true;
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
