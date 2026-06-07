import { SuggestModal, App } from 'obsidian';
import ThePlugin from '@/main';
import {
  HistoryMatchDataNode,
  PinyinIndex,
  MatchData,
  Item,
  SuggestionRenderer,
  SpecialItemScore,
  normalizeText,
  normalizeQuery,
  toRanges,
} from '@/utils';

export { SpecialItemScore } from '@/utils';

/** 轻量索引接口，用于不需要 Obsidian 事件监听的简单场景 */
export interface ISimpleIndex<T> {
  items: T[];
}

export default abstract class FuzzyModal<T extends Item> extends SuggestModal<MatchData<T>> {
  historyMatchData: HistoryMatchDataNode<T>;
  protected currentNode: HistoryMatchDataNode<T>;
  index: PinyinIndex<T> | ISimpleIndex<T>;
  plugin: ThePlugin;
  useInput: boolean;
  resolve: (value?: Item) => void;
  isPromiseCall: boolean = false;
  constructor(app: App, plugin: ThePlugin) {
    super(app);
    this.useInput = false;
    this.plugin = plugin;
    this.historyMatchData = new HistoryMatchDataNode('\0');
    this.containerEl.addClass('fz-modal');

    this.scope.register([], 'Backspace', async (e) => {
      if (this.plugin.settings.global.closeWithBackspace && this.inputEl.value === '') {
        this.close();
      }
    });
    this.scope.register(['Mod'], 'N', async (e) => {
      if (this.chooser.selectedItem != this.chooser.values.length - 1)
        this.chooser.setSelectedItem(this.chooser.selectedItem + 1, e);
      else this.chooser.setSelectedItem(0, e);
    });
    this.scope.register(['Mod'], 'P', async (e) => {
      if (this.chooser.selectedItem !== 0) {
        this.chooser.setSelectedItem(this.chooser.selectedItem - 1, e);
      } else this.chooser.setSelectedItem(this.chooser.values.length - 1, e);
    });
  }
  onOpen() {
    this.inputEl.value = '';
    this.inputEl.focus();
    this.onInput(); // 无输入时触发历史记录
  }
  abstract getEmptyInputSuggestions(): MatchData<T>[];
  getFirstInputSuggestions(query: string[1], items?: T[]): MatchData<T>[] {
    const lowerQuery = query.toLowerCase();
    // 优先使用首字符倒排索引缩小候选集
    if (items === undefined) {
      const idx = this.index as PinyinIndex<T>;
      if (idx.firstCharIndex) {
        items = idx.firstCharIndex.get(lowerQuery) ?? idx.items;
      } else {
        items = idx.items;
      }
    }
    const matchData: MatchData<T>[] = [];
    for (const item of items!) {
      const index = item.pinyin.findIndex(
        (p) => p.pinyin.some((q) => q.startsWith(lowerQuery)) || p.character === lowerQuery
      );
      if (index != -1)
        matchData.push({
          item,
          score: item.pinyin.getScore([[index, index]]),
          range: [[index, index]],
        });
    }
    return matchData;
  }
  getNormalInputSuggestions(query: string, items: T[]): MatchData<T>[] {
    const matchData: MatchData<T>[] = [];
    // 预归一化查询（循环外只做一次）
    const smartCase = /[A-Z]/.test(query) && this.plugin.settings.global.autoCaseSensitivity;
    const finalQuery = smartCase ? normalizeQuery(query) : normalizeQuery(query).toLocaleLowerCase();
    for (const p of items) {
      const finalText = normalizeText(p.name, smartCase);
      const range = p.pinyin.matchAboveStart(finalText, finalQuery);
      if (range) {
        const r = toRanges(range);
        matchData.push({ item: p, score: p.pinyin.getScore(r), range: r });
      }
    }
    return matchData;
  }

  getSuggestions(query: string): MatchData<T>[] {
    let matchData: MatchData<T>[];
    if (query.length == 0) {
      this.historyMatchData = new HistoryMatchDataNode('\0');
      matchData = this.getEmptyInputSuggestions();
    } else if (query.length == 1) {
      matchData = this.getFirstInputSuggestions(query);
      this.historyMatchData.init(query);
      this.historyMatchData.itemIndex = matchData.map((p) => p.item);
    } else {
      const toMatchItem = this.getHistoryData(query);
      matchData = this.getNormalInputSuggestions(query, toMatchItem);
      this.currentNode.itemIndex = matchData.map((p) => p.item);
    }
    matchData.sort((a, b) => b.score - a.score);
    return matchData;
  }
  removeDuplicates(
    matchData: MatchData<T>[],
    getValue: (p: MatchData<T>) => string = (p: MatchData<T>) => p.item.name
  ): MatchData<T>[] {
    const result = matchData.reduce(
      ({ arr, cache }, cur) => {
        const value = getValue(cur);
        if (Object.hasOwn(cache, value)) {
          const index = cache[value];
          if (cur.score > arr[index].score) {
            arr[index] = cur; // 替换为更高分数的项
          }
        } else {
          cache[value] = arr.length;
          arr.push(cur);
        }
        return { arr, cache };
      },
      { arr: [], cache: Object.create(null) }
    ).arr;
    return result;
  }
  getHistoryData(query: string): T[] {
    this.currentNode = this.historyMatchData.walk(query).currentNode;
    const toMatchItem =
      this.currentNode.itemIndex.length === 0 ? this.index.items : this.currentNode.itemIndex;
    return toMatchItem;
  }

  renderSuggestion(matchData: MatchData<T>, el: HTMLElement) {
    new SuggestionRenderer(el).render(matchData);
  }
  onNoSuggestion(value?: MatchData<T>): void {
    this.chooser.setSuggestions(null);
    if (this.useInput) {
      value = value ?? {
        item: { name: this.inputEl.value, pinyin: null } as T,
        score: SpecialItemScore.noFoundToCreate,
        range: null,
      };
      this.chooser.setSuggestions([value]);
    }
    this.chooser.addMessage(this.emptyStateText);
  }
  abstract onChooseSuggestion(matchData: MatchData<T>, evt: MouseEvent | KeyboardEvent): void;
  onClose() {
    this.contentEl.empty();
  }
  getChoosenMatchData(): MatchData<T> {
    return this.chooser.values[this.chooser.selectedItem];
  }
  getChoosenItem(): T {
    return this.chooser.values[this.chooser.selectedItem].item;
  }
  async openAndGetValue(): Promise<T> {
    return await new Promise((resolve) => {
      this.resolve = resolve;
      this.isPromiseCall = true;
      this.open();
    }).then((v: T) => {
      this.resolve = null;
      this.isPromiseCall = false;
      return v;
    });
  }
}
