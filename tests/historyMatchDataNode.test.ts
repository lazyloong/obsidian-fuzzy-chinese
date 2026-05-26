import { describe, it, expect } from "vitest";
import HistoryMatchDataNode from "@/utils/historyMatchDataNode";

describe("HistoryMatchDataNode", () => {
    it("构造函数调用 init", () => {
        const node = new HistoryMatchDataNode("a");
        expect(node.query).toBe("a");
        expect(node.next).toBeNull();
        expect(node.itemIndex).toEqual([]);
        expect(node.itemIndexByPath).toEqual([]);
    });

    it("init 重置节点状态", () => {
        const node = new HistoryMatchDataNode("a");
        node.itemIndex = [1 as any];
        node.itemIndexByPath = [2 as any];
        node.init("b");
        expect(node.query).toBe("b");
        expect(node.next).toBeNull();
        expect(node.itemIndex).toEqual([]);
        expect(node.itemIndexByPath).toEqual([]);
    });

    it("push 创建并链接新节点", () => {
        const node = new HistoryMatchDataNode("a");
        const child = node.push("b");
        expect(child).toBeInstanceOf(HistoryMatchDataNode);
        expect(child.query).toBe("b");
        expect(node.next).toBe(child);
    });

    it("index(0) 返回根节点自身", () => {
        const root = new HistoryMatchDataNode("a");
        expect(root.index(0)!.query).toBe("a");
    });

    it("index(1) 返回第一个子节点", () => {
        const root = new HistoryMatchDataNode("a");
        root.push("b").push("c");
        expect(root.index(1)!.query).toBe("b");
    });

    it("index 返回指定位置的节点", () => {
        const root = new HistoryMatchDataNode("a");
        root.push("b").push("c").push("d");
        expect(root.index(2)!.query).toBe("c");
        expect(root.index(3)!.query).toBe("d");
    });

    it("index 越界返回 undefined", () => {
        const node = new HistoryMatchDataNode("a");
        node.push("b");
        expect(node.index(5)).toBeUndefined();
    });

    describe("walk", () => {
        it("全匹配：沿已有节点遍历到末尾", () => {
            const root = new HistoryMatchDataNode("z");
            root.push("h").push("o").push("n").push("g");
            const { currentNode, matchedIndex } = root.walk("zhong");
            expect(currentNode!.query).toBe("g");
            expect(matchedIndex).toBe(5);
        });

        it("单字符：matchedIndex=1，currentNode 为根节点", () => {
            const root = new HistoryMatchDataNode("z");
            const { currentNode, matchedIndex } = root.walk("z");
            // matchedIndex=1 → this.index(0) → 返回根节点
            expect(currentNode).toBe(root);
            expect(matchedIndex).toBe(1);
        });

        it("部分回退：中间不匹配时重置后续节点", () => {
            const root = new HistoryMatchDataNode("a");
            root.push("b").push("c");
            const { currentNode, matchedIndex } = root.walk("ad");
            expect(matchedIndex).toBe(1);
            expect(root.next!.query).toBe("d");
            expect(root.next!.next).toBeNull();
        });

        it("新建节点：查询比已有链表更长", () => {
            const root = new HistoryMatchDataNode("a");
            const { currentNode, matchedIndex } = root.walk("abcdef");
            expect(matchedIndex).toBe(6);
            expect(currentNode!.query).toBe("f");
            // index(1) = 第一个节点
            expect(root.index(1)!.query).toBe("b");
            // index(5) = 第5个节点 = "f"
            expect(root.index(5)!.query).toBe("f");
        });

        it("空字符串：返回根节点", () => {
            const root = new HistoryMatchDataNode("a");
            const { currentNode, matchedIndex } = root.walk("");
            expect(matchedIndex).toBe(0);
            expect(currentNode).toBe(root);
        });
    });
});