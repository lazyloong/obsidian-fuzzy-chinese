import Pinyin from './pinyin';

export type MatchData<T extends Item<object> = Item> = {
  item: T;
  score: number;
  range: Array<[number, number]>;
};

export type Item<D extends object = {}> = {
  name: string;
  pinyin: Pinyin;
} & D;

/**
 * 搜索排序专用分数常量
 * - emptyInput / pinned: 空输入显示 / 置顶项
 * - noFoundToCreate / history: 无匹配创建 / 历史记录
 * - common: 普通命令
 */
export enum SpecialItemScore {
  emptyInput = 0,
  pinned = 0,
  noFoundToCreate = -1,
  history = -1,
  common = -2,
}
