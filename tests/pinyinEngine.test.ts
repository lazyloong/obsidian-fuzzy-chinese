import { describe, it, expect, beforeEach } from "vitest";
import { PinyinEngine } from "@/engine/pinyinEngine";

function createEngine() {
    const engine = new PinyinEngine();
    engine.loadBase({
        中: ["zhong", "zhong"],
        国: ["guo"],
        拼: ["pin"],
        音: ["yin"],
        行: ["hang", "xing"],
        长: ["chang", "zhang"],
        重: ["zhong", "chong"],
        一: ["yi"],
        二: ["er"],
        儿: ["er"],
    });
    engine.loadLegacySchemes();
    engine.loadDefaultFuzzyRules();
    return engine;
}

describe("PinyinEngine", () => {
    let engine: PinyinEngine;

    beforeEach(() => {
        engine = createEngine();
    });

    describe("matchSheng", () => {
        it("切分普通拼音", () => {
            expect(engine.matchSheng("pin")).toEqual({ sheng: "p", yun: "in" });
            expect(engine.matchSheng("guo")).toEqual({ sheng: "g", yun: "uo" });
        });
        it("切分双字母声母 (zh/ch/sh)", () => {
            expect(engine.matchSheng("zhong")).toEqual({ sheng: "zh", yun: "ong" });
            expect(engine.matchSheng("chang")).toEqual({ sheng: "ch", yun: "ang" });
        });
        it("零声母", () => {
            expect(engine.matchSheng("er")).toEqual({ sheng: "", yun: "er" });
            expect(engine.matchSheng("an")).toEqual({ sheng: "", yun: "an" });
        });
    });

    describe("getCharPinyin (全拼)", () => {
        it("单音字", () => {
            expect(engine.getCharPinyin("国")).toEqual(["guo"]);
        });
        it("多音字", () => {
            expect(engine.getCharPinyin("行")).toEqual(["hang", "xing"]);
        });
        it("非汉字返回字符本身", () => {
            expect(engine.getCharPinyin("A")).toEqual(["A"]);
        });
    });

    describe("getCharPinyin (模糊音)", () => {
        beforeEach(() => {
            engine.toggleFuzzy(true);
        });
        it("zh ↔ z", () => {
            const r = engine.getCharPinyin("中", { fuzzy: true });
            expect(r).toContain("zong");
            expect(r).toContain("zhong");
        });
        it("in ↔ ing", () => {
            const r = engine.getCharPinyin("音", { fuzzy: true });
            expect(r).toContain("ying");
            expect(r).toContain("yin");
        });
    });

    describe("getCharPinyin (双拼)", () => {
        beforeEach(() => {
            engine.setActiveShuangpin("小鹤双拼");
        });
        it("单音字转双拼", () => {
            expect(engine.getCharPinyin("国")).toEqual(["go"]);
            expect(engine.getCharPinyin("拼")).toEqual(["pb"]);
        });
        it("多音字转双拼", () => {
            expect(engine.getCharPinyin("行")).toEqual(["hh", "xk"]);
        });
        it("zh/ch/sh 双拼", () => {
            expect(engine.getCharPinyin("中")).toEqual(["vs", "vs"]);
        });
    });

    describe("toShuangpin", () => {
        beforeEach(() => {
            engine.setActiveShuangpin("小鹤双拼");
        });
        it("基础转换", () => {
            expect(engine.toShuangpin("pin")).toBe("pb");
            expect(engine.toShuangpin("guo")).toBe("go");
            expect(engine.toShuangpin("zhong")).toBe("vs");
        });
    });

    describe("toFuzzy", () => {
        beforeEach(() => {
            engine.toggleFuzzy(true);
        });
        it("zh ↔ z", () => {
            const r = engine.toFuzzy("zhong");
            expect(r).toContain("zhong");
            expect(r).toContain("zong");
        });
        it("禁用时不扩展", () => {
            engine.toggleFuzzy(false);
            expect(engine.toFuzzy("yin")).toEqual(["yin"]);
        });
    });

    describe("缓存", () => {
        it("双拼结果被缓存", () => {
            engine.setActiveShuangpin("小鹤双拼");
            const a = engine.getCharPinyin("中");
            const b = engine.getCharPinyin("中");
            expect(a).toBe(b);
        });
        it("切换方案清空缓存", () => {
            engine.setActiveShuangpin("小鹤双拼");
            const a = engine.getCharPinyin("中");
            engine.setActiveShuangpin("自然码");
            const b = engine.getCharPinyin("中");
            expect(a).not.toBe(b);
        });
    });
});
