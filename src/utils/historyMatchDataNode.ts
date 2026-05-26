export default class HistoryMatchDataNode<T> {
    query: string;
    next: HistoryMatchDataNode<T>;
    itemIndex: Array<T>;
    itemIndexByPath: Array<T>;
    constructor(query: string) {
        this.init(query);
    }
    push(query: string): HistoryMatchDataNode<T> {
        this.next = new HistoryMatchDataNode<T>(query);
        return this.next;
    }
    index(index: number): HistoryMatchDataNode<T> | undefined {
        let node: HistoryMatchDataNode<T> = this;
        for (let i = 0; i < index; i++) {
            if (node.next) node = node.next;
            else return;
        }
        return node;
    }
    init(query: string): void {
        this.query = query;
        this.next = null;
        this.itemIndex = [];
        this.itemIndexByPath = [];
    }

    /**
     * 按查询字符串逐字符遍历链表，回退时自动重置节点。
     * 返回最终定位的节点和匹配到的索引。
     */
    walk(query: string): {
        currentNode: HistoryMatchDataNode<T> | undefined;
        matchedIndex: number;
    } {
        let node: HistoryMatchDataNode<T> = this;
        let lastNode: HistoryMatchDataNode<T> | undefined;
        let index = 0;
        let matched = true;
        for (const ch of query) {
            if (node) {
                if (ch !== node.query) {
                    node.init(ch);
                    matched = false;
                }
            } else if (lastNode) {
                node = lastNode.push(ch);
            }
            lastNode = node;
            node = node.next;
            if (matched) index++;
        }
        return { currentNode: this.index(index - 1), matchedIndex: index };
    }
}
