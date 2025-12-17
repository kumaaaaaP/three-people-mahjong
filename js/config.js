/**
 * js/config.js
 * ゲームの定数、デフォルト設定、設定クラス
 */

// 牌のID定義 (ビット演算や配列管理をしやすくするための定数)
export const TILE_TYPE = {
    MANZU: 'm',
    PINZU: 'p',
    SOUZU: 's',
    JIHAI: 'z'
};

// 3人麻雀用: 使用しない牌 (萬子の2~8)
export const EXCLUDED_TILES = [
    '2m', '3m', '4m', '5m', '6m', '7m', '8m'
];

/**
 * ゲームのルール設定クラス
 */
export class GameConfig {
    constructor() {
        this.mode = 'cpu';        // 'cpu' or 'online'
        this.roomId = null;       // オンライン時の部屋ID
        this.length = 'south';    // 'east'(東風), 'south'(半荘)
        
        // サンマ特有の赤ドラ設定
        // 5筒, 5索はデフォルトで全赤にするなどのローカルルールも多いため、
        // ここでは一般的な「5は1枚赤、3と7はオプション」という構成に対応
        this.redRules = {
            p3: 0, // 3筒の赤枚数
            s3: 0, // 3索の赤枚数
            p5: 1, // 5筒の赤枚数 (デフォルト1)
            s5: 1, // 5索の赤枚数 (デフォルト1)
            p7: 0, // 7筒の赤枚数
            s7: 0  // 7索の赤枚数
        };
        
        this.startScore = 35000;  // 持ち点
        this.uma = [10, -10];     // サンマのウマ (2人分)
    }
}
