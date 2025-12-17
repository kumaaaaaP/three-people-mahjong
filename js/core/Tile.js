/**
 * js/core/Tile.js
 * 牌（タイル）の定義と管理
 * 牌の種類、数値、赤ドラの状態、一意なIDを保持する
 */

import { TILE_TYPE } from '../config.js'; // TILE_TYPE定数をインポート

/**
 * 牌を表すクラス (萬子, 筒子, 索子, 字牌)
 */
export class Tile {
    /**
     * @param {string} type - 牌の種類 ('m', 'p', 's', 'z')
     * @param {number} value - 牌の数値 (1〜9 または 字牌の1〜7)
     * @param {boolean} isRed - 赤ドラかどうか
     * @param {number} uniqueId - 牌の重複を避けるための通し番号 (0〜135など)
     */
    constructor(type, value, isRed, uniqueId) {
        this.type = type;
        this.value = value;
        this.isRed = isRed;
        this.uniqueId = uniqueId;

        // 牌のショートコード (例: '1p', '5ps', 'z1')
        this.code = this.generateCode();
    }

    /**
     * 牌のショートコードを生成する
     * 例: 1p, 5p (通常の5筒), 5pr (赤5筒)
     * 字牌: z1 (東), z2 (南), z3 (西), z4 (北), z5 (白), z6 (發), z7 (中)
     * @returns {string} 牌の識別コード
     */
    generateCode() {
        if (this.type === TILE_TYPE.JIHAI) {
            // 字牌は z1〜z7
            return `${TILE_TYPE.JIHAI}${this.value}`;
        }
        
        // 数牌は type + value
        let code = `${this.value}${this.type}`;

        // 赤ドラの場合、末尾に 'r' を付ける (表示用)
        if (this.isRed) {
            code += 'r';
        }
        return code;
    }

    /**
     * 牌が通常のドラ表示牌になったときのコードを返す
     * (例: 赤5pでもドラ表示牌としては '5p' と扱う)
     * @returns {string} 数値と種類のみのコード
     */
    toNormalCode() {
        if (this.type === TILE_TYPE.JIHAI) {
            return `${TILE_TYPE.JIHAI}${this.value}`;
        }
        return `${this.value}${this.type}`;
    }

    /**
     * 牌が同種・同数値かどうかを判定する (赤ドラかどうかは無視)
     * @param {Tile} otherTile - 比較対象の牌
     * @returns {boolean}
     */
    isSameKind(otherTile) {
        return this.type === otherTile.type && this.value === otherTile.value;
    }

    /**
     * 牌が完全に一致するかどうかを判定する (uniqueIdは無視)
     * @param {Tile} otherTile - 比較対象の牌
     * @returns {boolean}
     */
    equals(otherTile) {
        return this.isSameKind(otherTile) && this.isRed === otherTile.isRed;
    }

    /**
     * 牌が順子を作れる牌かどうかを判定する
     * @returns {boolean}
     */
    isSequenceable() {
        // 字牌は順子を作れない
        return this.type !== TILE_TYPE.JIHAI && this.value >= 1 && this.value <= 9;
    }

    /**
     * 牌が刻子を作れる牌かどうかを判定する (すべての牌で可能)
     * @returns {boolean}
     */
    isTripletteable() {
        return true;
    }

    /**
     * 牌を複製する (ユニークIDは保持)
     * @returns {Tile}
     */
    clone() {
        return new Tile(this.type, this.value, this.isRed, this.uniqueId);
    }
}
