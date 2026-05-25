// ============================================================
// 拼音引擎类型定义
// ============================================================

/** 双拼方案结构：全拼声母/韵母 → 双拼字母 */
export interface ShuangpinScheme {
    name: string;
    /** 声母映射：全拼声母 → 双拼字母 */
    sheng: Record<string, string>;
    /** 韵母映射：全拼韵母 → 双拼字母 */
    yun: Record<string, string>;
}

/** 查询选项 */
export interface QueryOptions {
    /** 是否启用模糊音 */
    fuzzy?: boolean;
    /** 双拼方案名 */
    shuangpin?: string;
}

/** 单字符拼音结果 */
// export type CharPinyinResult = readonly string[];
