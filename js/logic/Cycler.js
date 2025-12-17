/**
 * js/logic/Cycler.js
 * 局 (Round) および場の進行 (親の交代、場風の変更) を管理する
 */

import { Player } from '../core/Player.js';

// 場の風と席風の定数
const ROUND_WINDS = ['東', '南', '西', '北'];

export class Cycler {
    
    /**
     * @param {GameConfig} config - ゲーム設定 (特に半荘/東風の長さ)
     * @param {Player[]} players - GameStateから渡されるPlayerオブジェクトの配列
     */
    constructor(config, players) {
        this.config = config;
        this.players = players;
        
        this.currentRound = 1;      // 現在の局 (東1, 東2, ...)
        this.currentBaKaze = '東';  // 現在の場の風 ('東', '南')
        this.currentHonba = 0;      // 現在の本場数
        this.riichiCount = 0;       // 場に供託されているリーチ棒の数
    }

    /**
     * ターンを次のプレイヤーに進める
     * 3人麻雀の場合、プレイヤー配列は[東家, 南家, 西家]の3人
     * @param {number} currentTurnIndex - 現在のターンプレイヤーのインデックス
     * @returns {number} 次のターンプレイヤーのインデックス
     */
    advanceTurn(currentTurnIndex) {
        // インデックスを循環させる (0 -> 1 -> 2 -> 0 ...)
        return (currentTurnIndex + 1) % this.players.length;
    }

    /**
     * 局の結果を受けて、次の局の状態を決定する
     * @param {boolean} isParentAgari - 親が和了したかどうか
     * @param {boolean} isTempaiAtRyukyoku - 親が流局時に聴牌していたかどうか
     * @returns {{isGameOver: boolean, isRoundOver: boolean}}
     */
    handleRoundEnd(isParentAgari, isTempaiAtRyukyoku) {
        
        let parentRenchan = false;
        
        // 1. 連荘（レンチャン）判定
        if (isParentAgari) {
            // 親が和了した場合、連荘 (親続行)
            parentRenchan = true;
        } else if (isTempaiAtRyukyoku) {
            // 親が流局時に聴牌していた場合、連荘 (親続行)
            parentRenchan = true;
        }

        if (parentRenchan) {
            // 連荘: 本場数を増やして親はそのまま
            this.currentHonba++;
            console.log(`連荘: ${this.currentBaKaze}${this.currentRound}局 ${this.currentHonba}本場`);
        } else {
            // 親流れ: 次の局へ進む
            this.currentHonba = 0;
            this._advanceRound();
        }

        // 2. 終局（ゲームオーバー）判定
        return {
            isGameOver: this.isGameOver(),
            isRoundOver: !parentRenchan // 局が進んだかどうか
        };
    }
    
    /**
     * 局を次の状態に進め、プレイヤーの席風をローテーションさせる
     * (親流れが発生した場合に呼ばれる)
     */
    _advanceRound() {
        // 1. 局数と場風の更新
        this.currentRound++;
        
        // 3人麻雀では通常「東」→「南」の2周のみ
        if (this.currentRound > 4) {
            if (this.currentBaKaze === '東') {
                this.currentBaKaze = '南';
                this.currentRound = 1;
            } else {
                // 南4局が終了した場合 (東風戦なら東4局で終了)
                this.isGameOver = true;
                return;
            }
        }
        
        // 2. プレイヤーのローテーション (親の交代)
        // プレイヤー配列を一つずらす (0 -> 1, 1 -> 2, 2 -> 0)
        const oldParent = this.players.shift(); // 配列の先頭を削除 (元の東家)
        oldParent.isParent = false;
        this.players.push(oldParent);          // 末尾に追加
        
        // 新しい親の設定 (配列の先頭)
        this.players[0].isParent = true;
        
        // 3. 席風（自風）の更新
        this.players.forEach((p, index) => {
            // 東, 南, 西 (北は使わない)
            p.setWind(ROUND_WINDS[index % 3]);
        });
        
        console.log(`局進行: ${this.currentBaKaze}${this.currentRound}局 0本場`);
    }

    /**
     * ゲームが終了したか判定する
     * @returns {boolean}
     */
    isGameOver() {
        // 1. 規定局数のチェック
        if (this.currentBaKaze === '南' && this.currentRound > 4 && this.config.length === 'south') {
            return true;
        }
        if (this.currentBaKaze === '東' && this.currentRound > 4 && this.config.length === 'east') {
            return true;
        }
        
        // 2. 持ち点による終了判定 (トビ)
        const hasTobi = this.players.some(p => p.score < 0);
        if (hasTobi) {
            // オーラスでなければ続行ルールもあるが、簡易的にトビ終了とする
            return true; 
        }

        // 3. 終了条件満貫時 (南場終了時、トップが30000点超えなど)
        
        return false;
    }

    /**
     * 現在の場風と局数を取得する
     * @returns {string} (例: "東1局")
     */
    getCurrentRoundString() {
        return `${this.currentBaKaze}${this.currentRound}局`;
    }
}
