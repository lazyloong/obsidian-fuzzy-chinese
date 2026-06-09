// src/constants.ts — 共享常量，避免跨模块导入实现细节

/** 文件打开操作的键名列表，供设置 UI 和 fileModal 共用 */
export const OPEN_FILE_KEY_NAMES = [
  '打开',
  '打开到新标签页',
  '打开到其他面板',
  '打开到新面板',
  '打开到新窗口',
  '不操作',
] as const;

export type OpenFileKeyName = (typeof OPEN_FILE_KEY_NAMES)[number];
