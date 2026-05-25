import Pinyin from "./pinyin";

export type MatchData<T extends Item<object> = Item> = {
    item: T;
    score: number;
    range: Array<[number, number]>;
};

export type Item<D extends object = {}> = {
    name: string;
    pinyin: Pinyin;
} & D;
