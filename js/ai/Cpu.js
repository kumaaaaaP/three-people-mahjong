/**
 * js/ai/Cpu.js
 * CPUプレイヤーの思考ルーチンと打牌判断
 */

import { Player } from '../core/Player.js';
import { Tile } from '../core/Tile.js';
import { Judge } from '../logic/Judge.js'; // 和了判定、向聴数計算などを利用

export class Cpu {
    /**
     * CPUの打牌を決定する (メインルーチン)
     * @param {Player} player - 思考対象のCPUプレイヤー
     * @param {Tile[]} hand - ツモ牌を含む14枚の手牌
     * @returns {Tile} 捨てるべき牌
     */
    static decideDiscard(player, hand) {
        
        // 1. 手牌の初期評価
        // 現在の向聴数を計算
        const currentShanten = this.calculateShanten(hand, player.naki);

        // 2. 門前/副露の状態、局の進行度、点棒状況に応じた戦略の決定
        // 例: { strategy: 'speed', safetyLevel: 0 }
        const strategy = this.determineStrategy(player, currentShanten);
        
        let bestDiscardTile = null;
        let bestEvaluation = -Infinity;

        // 3. 全ての牌を試して、最も「良い」打牌を決定する
        for (const tile of hand) {
            
            // 評価値の初期化
            let evaluation = 0;

            // 3-1. 向聴数評価 (最も重要: 向聴数が進む牌は高評価)
            // その牌を捨てたとき、向聴数が何になるか
            const nextHand = hand.filter(t => t.uniqueId !== tile.uniqueId);
            const nextShanten = this.calculateShanten(nextHand, player.naki);
            
            // 向聴数が進む（減少）: 非常に高い評価
            // 向聴数が変わらない: 標準評価
            // 向聴数が戻る（増加）: 非常に低い評価
            evaluation += this._evaluateShanten(currentShanten, nextShanten);


            // 3-2. 牌効率評価 (聴牌までの速度に寄与)
            // その牌を捨てた後、待ち牌（有効牌）の枚数が最大になるかを評価
            // 牌効率が高い牌ほど評価が高い
            const effectiveTiles = this._calculateEffectiveTiles(nextHand);
            evaluation += effectiveTiles.length * 10; 
            
            
            // 3-3. 安全度評価 (守備に寄与)
            // 局の終盤や他家のリーチ時、この評価が支配的になる
            // その牌が他家にロンされる危険性（現物、スジ、壁）を評価
            const safetyScore = this._evaluateSafety(tile, player);
            evaluation += safetyScore * strategy.safetyLevel; // 戦略に基づき重み付け

            
            // 3-4. 点数的な価値評価
            // ドラ、役牌、赤ドラなどの価値を評価
            if (tile.isRed || this.isYakuHai(tile, player)) {
                evaluation -= 5; // 基本的に価値の高い牌は温存するため、評価を低くする
            }

            // 4. 最も評価の高い牌を更新
            if (evaluation > bestEvaluation) {
                bestEvaluation = evaluation;
                bestDiscardTile = tile;
            }
        }

        // 5. リーチ判断 (向聴数が0、つまり聴牌している場合)
        if (currentShanten === 0 && !player.isRiichi) {
            if (strategy.strategy === 'speed' || strategy.strategy === 'balanced') {
                // 簡易的にリーチを行う
                console.log("CPUがリーチ宣言！");
                // リーチ宣言牌として返す (GameState側で処理される)
            }
        }
        
        // 最終的な打牌
        return bestDiscardTile || hand[0]; // fallbackとして最初の牌を捨てる
    }
    
    // --- 補助ロジック ---

    /**
     * 現在の手牌の向聴数を計算する
     * @param {Tile[]} hand - 手牌 (通常13枚、ツモ前)
     * @param {Array<Object>} naki - 鳴き牌の配列
     * @returns {number} 向聴数 (0=聴牌, -1=和了)
     */
    static calculateShanten(hand, naki) {
        // 麻雀AIで最も複雑なロジックの一つ。ここでは骨格のみ
        
        // 面子の数 (鳴きを含む)
        const mentsuCount = naki.length + 4 - currentShanten; 
        
        // 1. 標準形 (4面子1雀頭) の向聴数計算
        // 2. 七対子の向聴数計算
        // 3. 国士無双の向聴数計算
        
        // 最も小さい向聴数を採用
        
        // 簡易実装として、常に1向聴を返す (開発中の仮の値)
        return 1; 
    }
    
    /**
     * 戦略を決定する (速度優先、安全優先、バランス型など)
     */
    static determineStrategy(player, currentShanten) {
        // 簡易的な戦略決定ロジック
        // 1. 親番、トップ目、終盤でない -> 速度（speed）
        // 2. 他家リーチあり、ラス目、終盤 -> 守備（safety）
        // 3. その他 -> バランス（balanced）
        
        const strategy = { strategy: 'speed', safetyLevel: 0 }; // 序盤は速度優先
        
        if (currentShanten >= 3) {
            strategy.strategy = 'rebuild'; // 悪形手牌は一旦立て直し
        }
        
        // 終盤の判定 (壁の残り枚数など)
        // if (this.wall.remainingTiles < 10) {
        //     strategy.safetyLevel = 5;
        //     strategy.strategy = 'balanced';
        // }
        
        return strategy;
    }

    /**
     * 向聴数変化に基づき打牌を評価する
     */
    static _evaluateShanten(current, next) {
        if (next < current) return 1000; // 向聴数が進む: 非常に良い
        if (next === current) return 100; // 向聴数が変わらない: 標準
        return -500;                     // 向聴数が戻る: 非常に悪い
    }

    /**
     * その牌を捨てた後の有効牌（待ち牌）の枚数を計算する
     * ※これも複雑なロジック
     */
    static _calculateEffectiveTiles(hand) {
        // その牌を抜いた13枚の手牌で、何種類の牌がくれば向聴数が進むか/聴牌するか
        // を計算し、それらの牌の山に残っている枚数を合計する。
        
        // 簡易実装として、手牌の種類数 * 4
        const tileTypes = new Set(hand.map(t => t.toNormalCode()));
        return Array.from(tileTypes);
    }

    /**
     * 捨て牌の安全度を評価する (現物、スジ、字牌など)
     * @param {Tile} tile - 評価対象の牌
     * @param {Player} player - 思考対象のプレイヤー (他家の河の情報を取得するため)
     * @returns {number} 安全スコア (高いほど安全)
     */
    static _evaluateSafety(tile, player) {
        let score = 0;
        
        // 1. 現物判定 (他家の河にあるか)
        // if (Judge.isGenbutsu(tile, player.otherPlayersKawa)) score += 100;
        
        // 2. 字牌判定 (役牌でない字牌は比較的安全)
        if (tile.type === 'z' && !this.isYakuHai(tile, player)) score += 10;
        
        // 3. 筋判定 (危険度を下げる要素)
        
        // 4. 序盤は危険度が低い
        // if (this.wall.remainingTiles > 20) score += 50;
        
        return score;
    }
    
    /**
     * その牌が役牌かどうか判定する
     */
    static isYakuHai(tile, player) {
        // 三元牌
        if (tile.type === 'z' && (tile.value >= 5 && tile.value <= 7)) return true;
        
        // 場風
        // if (tile.code === `${tile.value}${player.roundWind}`) return true;
        
        // 自風
        // if (tile.code === `${tile.value}${player.seatWind}`) return true;
        
        return false;
    }
}
