// src/settings.ts — 设置数据模型 + 默认值，从 settingTab.ts 提取以减少耦合

export interface TheSettings {
  global: {
    traditionalChineseSupport: boolean;
    doublePinyin: string;
    fuzzyPinyin: boolean;
    fuzzyPinyinSetting: string[];
    closeWithBackspace: boolean;
    palladius: boolean;
    autoCaseSensitivity: boolean;
  };
  file: {
    showAllFileTypes: boolean;
    showAttachments: boolean;
    showUnresolvedLink: boolean;
    attachmentExtensions: Array<string>;
    usePathToSearch: boolean;
    useFileEditorSuggest: boolean;
    showTags: boolean;
    searchWithTag: boolean;
    quicklySelectHistoryFiles: boolean;
    quicklySelectHistoryFilesHint: string;
    keyEnter: string;
    keyCtrlEnter: string;
    keyAltEnter: string;
    keyCtrlAltEnter: string;
  };
  heading: {
    showFirstLevelHeading: boolean;
    headingIndent: boolean;
  };
  command: {
    pinnedCommands: Array<string>;
  };
  other: {
    useTagEditorSuggest: boolean;
    devMode: boolean;
  };
}

export const DEFAULT_SETTINGS: TheSettings = {
  global: {
    traditionalChineseSupport: false,
    doublePinyin: '全拼',
    fuzzyPinyin: false,
    fuzzyPinyinSetting: [],
    palladius: false,
    closeWithBackspace: false,
    autoCaseSensitivity: true,
  },
  file: {
    showAttachments: false,
    showAllFileTypes: false,
    showUnresolvedLink: false,
    quicklySelectHistoryFiles: false,
    quicklySelectHistoryFilesHint: 'asdfjklgh',
    attachmentExtensions: [
      'bmp',
      'png',
      'jpg',
      'jpeg',
      'gif',
      'svg',
      'webp',
      'mp3',
      'wav',
      'm4a',
      '3gp',
      'flac',
      'ogg',
      'oga',
      'opus',
      'mp4',
      'webm',
      'ogv',
      'mov',
      'mkv',
      'pdf',
    ],
    usePathToSearch: false,
    useFileEditorSuggest: true,
    showTags: false,
    searchWithTag: true,
    keyEnter: '打开',
    keyCtrlEnter: '打开到新标签页',
    keyAltEnter: '打开到其他面板',
    keyCtrlAltEnter: '打开到新面板',
  },
  heading: {
    showFirstLevelHeading: true,
    headingIndent: true,
  },
  command: {
    pinnedCommands: [],
  },
  other: {
    useTagEditorSuggest: true,
    devMode: false,
  },
};
