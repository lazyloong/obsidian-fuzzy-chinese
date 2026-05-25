export default class HistoryMatchDataNode<T> {
    query: string[1];
    next: HistoryMatchDataNode<T>;
    itemIndex: Array<T>;
    itemIndexByPath: Array<T>;
    constructor(query: string[1]) {
        this.init(query);
    }
    push(query: string[1]) {
        this.next = new HistoryMatchDataNode<T>(query);
        return this.next;
    }
    index(index: number) {
        let node: HistoryMatchDataNode<T> = this;
        for (let i = 0; i < index; i++) {
            if (node.next) node = node.next;
            else return;
        }
        return node;
    }
    init(query: string[1]) {
        this.query = query;
        this.next = null;
        this.itemIndex = [];
        this.itemIndexByPath = [];
    }
}
