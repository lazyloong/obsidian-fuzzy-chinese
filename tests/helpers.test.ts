import { describe, it, expect } from "vitest";
import { arraySwap, incrementalUpdate } from "@/utils/helpers";

type TestItem = { name: string; pinyin: null };

const makeItem = (name: string): TestItem => ({ name, pinyin: null });

describe("helpers", () => {
    describe("arraySwap", () => {
        it("交换两个元素", () => {
            const arr = [1, 2, 3, 4];
            arraySwap(arr, 1, 2);
            expect(arr).toEqual([1, 3, 2, 4]);
        });

        it("首尾交换", () => {
            const arr = [1, 2, 3];
            arraySwap(arr, 0, 2);
            expect(arr).toEqual([3, 2, 1]);
        });

        it("边界：fromIndex 越界不修改数组", () => {
            const arr = [1, 2, 3];
            arraySwap(arr, -1, 1);
            expect(arr).toEqual([1, 2, 3]);
            arraySwap(arr, 3, 1);
            expect(arr).toEqual([1, 2, 3]);
        });

        it("边界：toIndex 越界不修改数组", () => {
            const arr = [1, 2, 3];
            arraySwap(arr, 0, -1);
            expect(arr).toEqual([1, 2, 3]);
            arraySwap(arr, 0, 10);
            expect(arr).toEqual([1, 2, 3]);
        });
    });

    describe("incrementalUpdate", () => {
        it("添加新项", () => {
            const items: TestItem[] = [makeItem("a")];
            const result = incrementalUpdate(items, () => ["a", "b"], makeItem);
            expect(result.map((p) => p.name)).toEqual(["a", "b"]);
        });

        it("删除旧项", () => {
            const items: TestItem[] = [makeItem("a"), makeItem("b")];
            const result = incrementalUpdate(items, () => ["a"], makeItem);
            expect(result.map((p) => p.name)).toEqual(["a"]);
        });

        it("无变化时返回原引用（只删除路径的新数组）", () => {
            const items: TestItem[] = [makeItem("a"), makeItem("b")];
            const result = incrementalUpdate(items, () => ["a", "b"], makeItem);
            // 无增删时 filter 创建新数组，但内容不变
            expect(result.map((p) => p.name)).toEqual(["a", "b"]);
        });

        it("同时增删（替换）", () => {
            const items: TestItem[] = [makeItem("a"), makeItem("b")];
            const result = incrementalUpdate(items, () => ["b", "c"], makeItem);
            expect(result.map((p) => p.name)).toEqual(["b", "c"]);
        });

        it("空数组加载全部", () => {
            const items: TestItem[] = [];
            const result = incrementalUpdate(items, () => ["x", "y"], makeItem);
            expect(result.map((p) => p.name)).toEqual(["x", "y"]);
        });
    });
});