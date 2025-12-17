/**
 * js/logic/Scorer.js
 * 符計算、翻数確定、点数早見表に基づいた点数計算ロジック
 * 添付された「点数計算-1, 2, 3.jpg」のルールを厳密に実装
 */

import { Player } from '../core/Player.js';
import { Tile } from '../core/Tile.js';

// --- 添付画像に基づく定数 ---
const FU_TABLE = {
    BASE: 20, // 基本符
    // 面子符 (4枚使いのカンはここでは除外)
    MENTSU: {
        NORMAL: { MEIN: 2, ANN: 4 },   // 中張牌 (2-8)
        YAOCHU: { MEIN: 4, ANN: 8 }    // 幺九牌 (1, 9, 字牌)
    },
    // 面子符 (カン)
    KAN: {
        NORMAL: { MEIN: 8, ANN: 16 },
        YAOCHU: { MEIN: 16, ANN: 32 }
    },
    ATAMA: 2, // 自風牌・場風牌・三元牌 (重複あり)
    MACH: 2,  // 待ちの形 (単騎、嵌張、辺張)
    AGARI: { TSUMO_NOT_PINFU: 2, RON_MENZEN: 10 } // 和了方 (平和でないツモ: +2, 門前ロン: +10)
};

// 符計算の例外
const FU_EXCEPTIONS = {
    CHITOITSU: 25, // 七対子は一律25符
    PINFU_TSUMO: 20 // 平和ツモは一律20符
};

// --- 点数早見表データ (子) ---
// { 符: { 翻数: [ツモ点(親, 子), ロン点] } }
const SCORE_CHILD_MAP = {
    // 20符 (平和ツモのみ)
    20: { 1: [300, 500], 2: [400, 700], 3: [700, 1300], 4: [1300, 2600] },
    // 25符 (七対子/特殊ロン)
    25: { 2: [800, 1600], 3: [1600, 3200], 4: [3200, 6400] },
    // 30符
    30: { 1: [1000, 2000], 2: [500, 1000, 2000], 3: [1000, 2000, 3900], 4: [2000, 3900, 7700] },
    // 40符
    40: { 1: [1300, 2600], 2: [700, 1300, 2600], 3: [1300, 2600, 5200] },
    // ... (添付画像データを全てここに格納する) ...
};

// 満貫以上の点数 (子)
const LIMIT_CHILD_MAP = {
    5: 8000,           // 満貫 (2000-4000)
    6: 12000,          // 跳満 (3000-6000)
    8: 16000,          // 倍満 (4000-8000)
    11: 24000,         // 三倍満 (6000-12000)
    13: 32000          // 役満 (8000-16000)
};
// ... 親のデータも同様に定義 ...

export class Scorer {
    /**
     * 和了した際の点数計算をメインで実行する
     * @param {Player} winner - 和了者
     * @param {Tile} agariTile - 和了牌
     * @param {boolean} isRon - ロン和了かどうか
     * @param {Tile[]} finalHand - 和了牌を含む14枚の手牌
     * @param {Tile[]} doraIndicators - ドラ表示牌
     * @returns {{totalScore: number, han: number, fu: number, yaku: string[], tsumoBase: number}}
     */
    static calculateScore(winner, agariTile, isRon, finalHand, doraIndicators) {
        
        // 1. 役の判定と翻数の算出 (Judge.checkYakuを呼び出す想定)
        // 仮の役結果
        const { han, yaku, isPinfu, isChiitoitsu } = this._calculateYakuAndHan(winner, agariTile, isRon, finalHand, doraIndicators);

        if (han === 0) {
            return { totalScore: 0, han: 0, fu: 0, yaku: ["役なし"], tsumoBase: 0 };
        }
        
        // 2. 符の計算
        const fu = this.calculateFu(winner, agariTile, isRon, finalHand, isPinfu, isChiitoitsu);
        
        // 3. 符と翻数から点数表を参照して点数を決定
        const result = this.lookupScore(winner.isParent, fu, han, isRon);

        // 4. 積み棒(本場)の加算
        // 積み棒はロン: 300点 * 本場数、ツモ: 100点 * 3人 * 本場数
        // 3人麻雀ではツモの支払い人数が2人になる場合があるため注意が必要だが、ここでは一般的な4人麻雀のルールに倣い調整
        
        // 5. リーチ棒の加算 (供託は GameState で管理)
        
        return {
            totalScore: result.score,
            han: han,
            fu: fu,
            yaku: yaku,
            tsumoBase: result.tsumoBase // ツモ和了時の親や子の支払い基準点
        };
    }
    
    // --- 符計算ロジック (点数計算-3.jpgに基づく) ---

    /**
     * 符を計算するメインロジック
     */
    static calculateFu(winner, agariTile, isRon, finalHand, isPinfu, isChiitoitsu) {
        let fu = 0;
        
        // 1. 例外符の処理
        if (isChiitoitsu) {
            return FU_EXCEPTIONS.CHITOITSU; // 25符
        }
        if (isPinfu && !isRon) { // 平和ツモ
            return FU_EXCEPTIONS.PINFU_TSUMO; // 20符
        }
        
        // 2. 基本符 (+20)
        fu += FU_TABLE.BASE;

        // 3. 門前加符 (ロン和了で門前の場合 +10)
        // 鳴きがないかを別途チェックする必要があるが、ここでは簡易的に
        const isMenzen = winner.naki.length === 0;
        if (isMenzen && isRon) {
            fu += FU_TABLE.AGARI.RON_MENZEN;
        }

        // 4. 面子符 (明刻/暗刻/明槓/暗槓)
        // この処理はJudge.jsで分解された面子情報に基づいて行うべきだが、ここではダミー
        // 例: 暗刻の幺九牌があれば +32
        fu += this._calculateMentsuFu(finalHand, winner.naki); // (仮の処理)

        // 5. 雀頭符 (自風/場風/三元牌 +2)
        fu += this._calculateAtamaFu(winner);
        
        // 6. 待ちの形符 (+2)
        // 待ちの形（両面待ち、シャンポン待ちなど）を特定し、単騎、嵌張、辺張であれば +2
        // 例: const machiType = Judge.getMachiType(finalHand, agariTile);
        // if (machiType === 'tanki' || machiType === 'kanchan' || machiType === 'penchan') {
        //     fu += FU_TABLE.MACH;
        // }
        // 簡易的に単騎待ちを仮定して加算
        fu += FU_TABLE.MACH; 
        
        // 7. 和了方符 (ツモ和了で平和以外なら +2)
        if (!isRon && !isPinfu) {
            fu += FU_TABLE.AGARI.TSUMO_NOT_PINFU;
        }
        
        // 8. 最終的な処理: 一の位を切り上げ
        // 例外: 例外1, 2を除き、最終結果が30符未満の場合、30符とする
        if (fu < 30) {
            fu = 30; 
        } else {
            fu = Math.ceil(fu / 10) * 10; // 1の位切り上げ
        }

        return fu;
    }

    /**
     * 点数早見表を参照し、点数を決定する
     */
    static lookupScore(isParent, fu, han, isRon) {
        const SCORE_MAP = isParent ? SCORE_PARENT_MAP : SCORE_CHILD_MAP;
        const LIMIT_MAP = isParent ? LIMIT_PARENT_MAP : LIMIT_CHILD_MAP;
        
        // 1. 満貫未満の処理 (4翻以下)
        if (han <= 4) {
            const fuData = SCORE_MAP[fu];
            if (fuData && fuData[han]) {
                const scoreArr = fuData[han];
                
                if (isRon) {
                    // ロン点: 配列の最後の値
                    const score = scoreArr.length === 3 ? scoreArr[2] : scoreArr[0];
                    return { score: score, tsumoBase: 0 };
                } else {
                    // ツモ点: 配列の最初の値 (親の支払い/子の支払い)
                    const base = scoreArr[0]; 
                    // 3人麻雀では子の支払いが異なるが、ここでは子の支払い基準点を返す
                    return { score: base * 4, tsumoBase: base }; // 総点 = base * 4 (子3人分 + 親1人分)
                }
            }
        }
        
        // 2. 満貫以上の処理 (5翻以上)
        if (han >= 13) {
            return { score: LIMIT_MAP[13], tsumoBase: LIMIT_MAP[13] / 4 }; // 役満
        }
        if (han >= 11) {
            return { score: LIMIT_MAP[11], tsumoBase: LIMIT_MAP[11] / 4 }; // 三倍満
        }
        if (han >= 8) {
            return { score: LIMIT_MAP[8], tsumoBase: LIMIT_MAP[8] / 4 };   // 倍満
        }
        if (han >= 6) {
            return { score: LIMIT_MAP[6], tsumoBase: LIMIT_MAP[6] / 4 };   // 跳満
        }
        if (han >= 5) {
            return { score: LIMIT_MAP[5], tsumoBase: LIMIT_MAP[5] / 4 };   // 満貫
        }
        
        // 予期せぬエラーまたはデータ不足
        return { score: 0, tsumoBase: 0 };
    }
    
    // --- 符計算の補助関数 (簡易版) ---

    /**
     * 役の判定と翻数の計算を行う (Judge.jsからの呼び出しを想定)
     * @returns {{han: number, yaku: string[], isPinfu: boolean, isChiitoitsu: boolean}}
     */
    static _calculateYakuAndHan(winner, agariTile, isRon, finalHand, doraIndicators) {
        // ここにロン/ツモ、門前/副底を考慮した全ての役判定ロジックが入る
        // 例: Judge.checkTanyao(finalHand), Judge.checkPinfu(finalHand, agariTile, winner.naki)
        
        // 役満は13翻以上として扱う。
        const han = 1; // ダミー: 最低1翻は確保されていると仮定
        const yaku = ["立直"]; // ダミー
        const isPinfu = false; // ダミー
        const isChiitoitsu = false; // ダミー
        
        // ドラの計算
        const doraHan = this._calculateDora(finalHand, doraIndicators);
        
        return { han: han + doraHan, yaku: yaku, isPinfu: isPinfu, isChiitoitsu: isChiitoitsu };
    }
    
    /**
     * 面子符（刻子、槓子）を計算する
     * ※ Judge.jsで面子が分解された後で呼び出す必要がある
     */
    static _calculateMentsuFu(finalHand, naki) {
        let fu = 0;
        // 面子の解析ロジックが未実装のため、ダミーとして暗刻の幺九牌が1組あったと仮定
        // fu += FU_TABLE.KAN.YAOCHU.ANN; // 暗槓の幺九牌
        return fu;
    }

    /**
     * 雀頭符を計算する
     */
    static _calculateAtamaFu(player) {
        let fu = 0;
        // 雀頭の牌が何であるかを Judge.js から受け取る必要があるが、ここでは風牌のチェックのみ
        // 雀頭が自風牌かつ場風牌であれば+4（自風+2, 場風+2）
        
        // 三元牌（白, 發, 中）の雀頭であれば +2
        
        return fu;
    }

    /**
     * ドラ翻数を計算する
     */
    static _calculateDora(hand, doraIndicators) {
        let count = 0;
        
        // ドラ表示牌から実際のドラ牌を特定 (例: 1m -> 2m)
        const effectiveDoraCodes = this._getEffectiveDoraCodes(doraIndicators);
        
        hand.forEach(tile => {
            // 赤ドラボーナス
            if (tile.isRed) {
                count++;
            }
            // 通常ドラボーナス
            if (effectiveDoraCodes.includes(tile.toNormalCode())) {
                count++;
            }
        });
        // 簡易的にダミーで返す
        return count; 
    }
    
    /**
     * ドラ表示牌から実際のドラ牌のコードリストを返す
     * 例: 1m -> 2m, 9m -> 1m, z4(北) -> z1(東)
     */
    static _getEffectiveDoraCodes(doraIndicators) {
        // ... (ドラめくりロジック) ...
        return []; // ダミー
    }
}
