import { describe, it, expect } from "vitest";
import { matchSheng, FuzzyPinyinRules } from "@/utils/pinyinCore";

describe("pinyinUtils", () => {
    describe("matchSheng", () => {
        it("普通声母", () => {
            expect(matchSheng("pin")).toEqual({ sheng: "p", yun: "in" });
            expect(matchSheng("guo")).toEqual({ sheng: "g", yun: "uo" });
            expect(matchSheng("da")).toEqual({ sheng: "d", yun: "a" });
        });

        it("双字母声母 zh/ch/sh 优先", () => {
            expect(matchSheng("zhong")).toEqual({ sheng: "zh", yun: "ong" });
            expect(matchSheng("chang")).toEqual({ sheng: "ch", yun: "ang" });
            expect(matchSheng("shang")).toEqual({ sheng: "sh", yun: "ang" });
        });

        it("长度优先：zh 优先于 z", () => {
            expect(matchSheng("zhao").sheng).toBe("zh");
            expect(matchSheng("chao").sheng).toBe("ch");
            expect(matchSheng("shao").sheng).toBe("sh");
        });

        it("零声母", () => {
            expect(matchSheng("er")).toEqual({ sheng: "", yun: "er" });
            expect(matchSheng("an")).toEqual({ sheng: "", yun: "an" });
            expect(matchSheng("ang")).toEqual({ sheng: "", yun: "ang" });
        });
    });

    describe("FuzzyPinyinRules", () => {
        it("双向对称", () => {
            expect(FuzzyPinyinRules["z"]).toContain("zh");
            expect(FuzzyPinyinRules["zh"]).toContain("z");
            expect(FuzzyPinyinRules["in"]).toContain("ing");
            expect(FuzzyPinyinRules["ing"]).toContain("in");
        });

        it("包含声母和韵母规则", () => {
            expect(FuzzyPinyinRules["n"]).toContain("l");
            expect(FuzzyPinyinRules["an"]).toContain("ang");
            expect(FuzzyPinyinRules["en"]).toContain("eng");
        });
    });
});
