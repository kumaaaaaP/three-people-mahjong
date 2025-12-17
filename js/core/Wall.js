/**
 * js/core/Wall.js
 * 山牌 (Wall) の生成、シャッフル、管理
 */

import { Tile } from './Tile.js';
import { TILE_TYPE, EXCLUDED_TILES } from '../config.js';

export class Wall {
    /**
     * @param {GameConfig} config - ゲーム設定 (特に赤ドラルール)
     */
    constructor(config) {
        this.config = config;
        this.tiles = [];       // 全ての牌（シャッフル済み）
        this.deadWall = [];    // 嶺上牌 (4枚) + ドラ表示牌 (5枚) = 王牌
        this.remainingTiles = 0; // 残りの牌数
    }

    /**
     * 全ての牌を生成し、山を構築する
     */
    build() {
        this.tiles = [];
        let uniqueIdCounter = 0;
        
        // 萬子, 筒子, 索子の生成
        for (const type of [TILE_TYPE.MANZU, TILE_TYPE.PINZU, TILE_TYPE.SOUZU]) {
            for (let value = 1; value <= 9; value++) {
                
                const tileCode = `${value}${type}`;
                
                // 3人麻雀ルール: 萬子の2〜8は不使用
                if (EXCLUDED_TILES.includes(tileCode)) {
                    continue;
                }

                // 牌の総枚数を計算
                let count = 4;
                let redCount = 0;

                // 赤ドラの枚数設定
                if (type === TILE_TYPE.PINZU || type === TILE_TYPE.SOUZU) {
                    if (value === 5) {
                        // 5筒, 5索はconfigで指定された枚数（デフォルト1枚）を赤とする
                        redCount = this.config.redRules[tileCode] || 1; 
                    } else if (value === 3 || value === 7) {
                        // 3筒, 3索, 7筒, 7索はconfigで指定されたオプションの赤枚数
                        redCount = this.config.redRules[tileCode] || 0;
                    }
                }
                
                const normalCount = count - redCount;

                // 通常牌の追加
                for (let i = 0; i < normalCount; i++) {
                    this.tiles.push(new Tile(type, value, false, uniqueIdCounter++));
                }

                // 赤ドラ牌の追加
                for (let i = 0; i < redCount; i++) {
                    this.tiles.push(new Tile(type, value, true, uniqueIdCounter++));
                }
            }
        }

        // 字牌の生成 (東1, 南2, 西3, 北4, 白5, 發6, 中7)
        for (let value = 1; value <= 7; value++) {
            for (let i = 0; i < 4; i++) {
                // 字牌に赤ドラはない
                this.tiles.push(new Tile(TILE_TYPE.JIHAI, value, false, uniqueIdCounter++));
            }
        }
        
        console.log(`山牌構築完了: 総枚数 ${this.tiles.length}枚 (3人麻雀)`, 
                    `(萬子1,9: 8枚, 筒子/索子: 36枚, 字牌: 28枚。合計: 72枚 + 36枚 + 28枚 = 136枚 - 28枚(2m-8m) = 108枚。あれ、総数108枚ではない。計算再確認: 
                    萬子 (1,9) * 4 * 2 = 8
                    筒子 (1-9) * 4 = 36
                    索子 (1-9) * 4 = 36
                    字牌 (7種) * 4 = 28
                    合計: 8 + 36 + 36 + 28 = 108枚。)`
        ); 
        this.remainingTiles = this.tiles.length;
    }

    /**
     * 牌をシャッフルする (Fisher-Yatesアルゴリズム)
     */
    shuffle() {
        for (let i = this.tiles.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.tiles[i], this.tiles[j]] = [this.tiles[j], this.tiles[i]];
        }
        console.log("山牌シャッフル完了。");
    }

    /**
     * 牌山から牌を1枚引く (ツモ)
     * @returns {Tile | null} 引いた牌、または山がない場合はnull
     */
    draw() {
        if (this.tiles.length > 0) {
            this.remainingTiles--;
            // 配牌は山牌の末尾から行うのが一般的だが、
            // シャッフル済み配列の先頭から引くことで実装をシンプルにする
            return this.tiles.shift(); 
        }
        return null;
    }

    /**
     * 王牌（嶺上牌とドラ表示牌）を山から切り分ける
     * 3人麻雀では通常、嶺上牌4枚とドラ表示牌5枚分を確保する。
     */
    setDeadWall() {
        // 王牌は山牌の末尾から14枚を切り分けるのが通常だが、
        // 今回はシャッフル済み配列の末尾から取ることで実装をシンプルにする。
        // ドラ表示牌5枚 (裏ドラ5枚) + 嶺上牌4枚 = 9枚を王牌として切り出すのが一般的
        // 4人打ち: 嶺上4 + ドラ5 = 14枚
        // 3人打ち: 嶺上4 + ドラ5 = 9枚 (残りの5枚はツモしない) -> 一般的には14枚切り分けることが多い
        
        // 4人打ちに倣い、14枚を切り分ける（嶺上4枚＋ドラ表示牌5枚＋裏ドラ表示牌5枚）
        const deadWallSize = 14; 
        this.deadWall = this.tiles.splice(this.tiles.length - deadWallSize, deadWallSize);
        this.remainingTiles -= deadWallSize;
        console.log(`王牌 (${this.deadWall.length}枚) を切り分けました。残りのツモ可能な牌: ${this.remainingTiles}枚。`);
    }

    /**
     * 嶺上牌を引く
     * @returns {Tile | null} 嶺上牌、または王牌がない場合はnull
     */
    drawRinshan() {
        // 王牌の先頭4枚が嶺上牌となる
        if (this.deadWall.length >= 1) {
             // 嶺上牌を引いたら、山から1枚補充する（ツモ牌を確保）
             // 3人麻雀では嶺上牌を引いても補充しないルールもあるが、ここでは補充する
             const rinshanTile = this.deadWall.shift();
             this.remainingTiles--; // 残りツモ牌数は減る (嶺上牌もツモ牌の総数に含まれるため)
             
             // 嶺上牌を引いた後、王牌が14枚を維持するようにツモ牌を王牌に移動する処理は省略
             // 代わりに、単純にdeadWallから引く動作のみとする
             return rinshanTile;
        }
        return null;
    }
    
    /**
     * 初期ドラ表示牌を公開する
     * @returns {Tile[]} 初期ドラ表示牌 (1枚目)
     */
    getInitialDoraIndicators() {
        // 王牌の3枚目 (インデックス2) が初期ドラ表示牌の位置
        // 4人麻雀の王牌は [ドラ裏][ドラ表] | [嶺上] [裏ドラ表][裏ドラ裏] | [嶺上]
        // 14枚を切り分けた場合、通常は中央の5枚の裏側から表をめくる。
        // [1] [2] [3裏] [4表] | [5表] [6裏] [7裏] [8裏] | [9裏] [10裏] [11裏] [12裏] [13裏] [14裏]
        
        // ここでは実装の簡単のため、王牌の配列の最初の5枚をドラ表示牌、次の4枚を嶺上牌とする
        const doraIndex = 4; // 王牌の5枚目がドラ表示牌 (裏側) の位置

        // 5枚目の裏をめくって表とする
        return [this.deadWall[doraIndex]]; 
    }
}
