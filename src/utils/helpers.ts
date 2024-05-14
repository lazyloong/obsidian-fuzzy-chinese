import { Notice, TFile } from "obsidian";
import { Item } from "./type";

export function runOnLayoutReady(calback: Function) {
    if (app.workspace.layoutReady) {
        calback();
    } else {
        app.workspace.onLayoutReady(async () => {
            calback();
        });
    }
}

// 在数组中交换两个元素的位置
export function arraymove<T>(arr: T[], fromIndex: number, toIndex: number): void {
    if (toIndex < 0 || toIndex === arr.length) return;
    const element = arr[fromIndex];
    arr[fromIndex] = arr[toIndex];
    arr[toIndex] = element;
}

export async function createFile(name: string): Promise<TFile> {
    return await app.vault.create(
        app.fileManager.getNewFileParent("").path + "/" + name + ".md",
        ""
    );
}

export function copy(text: string) {
    navigator.clipboard.writeText(text).then(
        () => new Notice("已复制到剪贴板：" + text),
        () => new Notice("复制失败：" + text)
    );
}

export function incrementalUpdate<T extends Item>(
    items: T[],
    getAllItems: () => string[],
    text2Item: (name: string) => T
) {
    let oldItems = items.map((p) => p.name);
    let newItems = getAllItems();

    let addItems = newItems.filter((p) => !oldItems.includes(p));
    let removeItems = oldItems.filter((p) => !newItems.includes(p));

    if (addItems.length > 0) items.push(...addItems.map((p) => text2Item(p)));
    if (removeItems.length > 0) items = items.filter((item) => !removeItems.includes(item.name));
    return items;
}
