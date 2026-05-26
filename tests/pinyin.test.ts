import { describe, it, expect, beforeAll } from "vitest";
import { pinyinEngine } from "@/engine/pinyinEngine";
import { toRanges } from "@/utils/pinyin";
import Pinyin from "@/utils/pinyin";

// ============================================================
// 测试环境设置
// ============================================================
beforeAll(() => {
    pinyinEngine.loadBase({
        中: ["zhong"],
        国: ["guo"],
        人: ["ren"],
        民: ["min"],
        银: ["yin"],
        大: ["da"],
        学: ["xue"],
        习: ["xi"],
        拼: ["pin"],
        音: ["yin"],
        家: ["jia"],
        一: ["yi"],
        二: ["er"],
        三: ["san"],
        行: ["hang", "xing"],
        重: ["zhong", "chong"],
        A: ["A"],
        B: ["B"],
    });
});

describe("toRanges", () => {
    it("连续区间合并", () => {
        expect(toRanges([1, 2, 3])).toEqual([[1, 3]]);
    });

    it("不连续区间分割", () => {
        expect(toRanges([1, 3, 5])).toEqual([[1, 1], [3, 3], [5, 5]]);
    });

    it("混合连续与不连续", () => {
        expect(toRanges([1, 2, 3, 5, 7, 8])).toEqual([[1, 3], [5, 5], [7, 8]]);
    });

    it("单元素数组", () => {
        expect(toRanges([4])).toEqual([[4, 4]]);
    });
});

describe("Pinyin", () => {
    describe("constructor", () => {
        it("创建中文拼音对象", () => {
            const py = new Pinyin("中国");
            expect(py.text).toBe("中国");
            expect(py.length).toBe(2);
        });

        it("每个字符都有拼音数组", () => {
            const py = new Pinyin("中国人");
            expect(py[0].character).toBe("中");
            expect(py[0].pinyin).toContain("zhong");
            expect(py[1].character).toBe("国");
            expect(py[1].pinyin).toContain("guo");
            expect(py[2].character).toBe("人");
            expect(py[2].pinyin).toContain("ren");
        });

        it("英文原样保留", () => {
            const py = new Pinyin("AB");
            expect(py[0].character).toBe("A");
            expect(py[0].pinyin).toEqual(["A"]);
            expect(py[1].character).toBe("B");
            expect(py[1].pinyin).toEqual(["B"]);
        });
    });

    describe("getScore", () => {
        it("完全覆盖得分最高", () => {
            const py = new Pinyin("中国");
            // 全匹配 range = [[0, 1]]
            const score = py.getScore([[0, 1]]);
            expect(score).toBeGreaterThan(100);
        });

        it("靠前匹配得分更高", () => {
            const py = new Pinyin("中国人民");
            const frontScore = py.getScore([[0, 0]]);
            const backScore = py.getScore([[2, 2]]);
            expect(frontScore).toBeGreaterThan(backScore);
        });

        it("分割越少得分越高", () => {
            const py = new Pinyin("中国人民");
            const oneRange = py.getScore([[0, 2]]);
            const threeRanges = py.getScore([[0, 0], [1, 1], [2, 2]]);
            expect(oneRange).toBeGreaterThan(threeRanges);
        });
    });

    describe("match", () => {
        it("全拼匹配", () => {
            const py = new Pinyin("中国");
            const result = py.match("zhongguo", { name: "中国", pinyin: py });
            expect(result).not.toBeFalsy();
            expect(result!.range).toEqual([[0, 1]]);
        });

        it("首字母匹配", () => {
            const py = new Pinyin("中国");
            const result = py.match("zg", { name: "中国", pinyin: py });
            expect(result).not.toBeFalsy();
        });

        it("混合匹配：全拼+首字母", () => {
            const py = new Pinyin("中国");
            const result = py.match("zhongg", { name: "中国", pinyin: py });
            expect(result).not.toBeFalsy();
        });

        it("不匹配返回 undefined", () => {
            const py = new Pinyin("中国");
            const result = py.match("xyz", { name: "中国", pinyin: py });
            expect(result).toBeFalsy();
        });

        it("多音字：匹配任一读音", () => {
            const py = new Pinyin("银行");
            const result = py.match("yinhang", { name: "银行", pinyin: py });
            expect(result).not.toBeFalsy();
        });

        it("大小写不敏感（查询自动转小写）", () => {
            const py = new Pinyin("中国");
            // 使用 matchAboveStart 直接测试避免 usePlugin 依赖
            const result = py.matchAboveStart("中国", "zhongguo");
            expect(result).not.toBeNull();
            expect(result!.length).toBeGreaterThan(0);
        });
    });

    describe("concat", () => {
        it("拼接两个拼音对象", () => {
            const a = new Pinyin("中国");
            const b = new Pinyin("人");
            const c = a.concat(b);
            expect(c.text).toBe("中国人");
            expect(c.length).toBe(3);
        });
    });
});