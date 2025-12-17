/**
 * js/logic/Judge.js
 * 和了判定、フリテン判定、役判定のロジック
 */

import { Tile } from '../core/Tile.js';
import { Player } from '../core/Player.js';

export class Judge {

    /**
     * 和了可能かどうかを総合的に判定する（入り口）
     * @param {Player} player - 判定対象プレイヤー
     * @param {Tile} agariTile - 和了牌 (ツモまたはロン)
     * @param {boolean} isRon - ロン和了かどうか
     * @returns {{canWin: boolean, waitingTiles: Tile[]}}
     */
    static checkAgari(player, agariTile, isRon) {
        
        // 1. 手牌に和了牌を加える (判定のための一時的な操作)
        let tempHand = [...player.hand];
        if (agariTile) {
             tempHand.push(agariTile);
        }
        
        // 2. 枚数チェック (4面子1雀頭 = 14枚 または 7対子 = 14枚)
        if (tempHand.length % 3 !== 2) {
             // 鳴き牌の枚数も含めた合計が14枚でなければ和了形ではない
             // Player.js側で総枚数チェックは行われているはずだが、念のため
             return { canWin: false, waitingTiles: [] }; 
        }

        // 3. フリテン判定
        if (isRon && this.isPermanentFuriten(player, tempHand)) {
            console.log("ロン和了不可: 振り聴");
            return { canWin: false, waitingTiles: [] };
        }
        
        // 4. 役判定 (役なしの和了はロン/ツモ共に不可)
        // 鳴きがない場合、七対子と国士無双を先にチェックすることが多い
        const { isNormalForm, waitingTiles } = this.findWinningForms(tempHand, player.naki);

        if (isNormalForm) {
            // 5. 役の有無チェック (最低1役が必要)
            // このメソッド自体は Judge.js 内の別のメソッド (例: checkYaku) を呼ぶ
            // const yakuResult = this.checkYaku(player, agariTile, isRon, tempHand);
            // if (yakuResult.han === 0) return { canWin: false, waitingTiles };
            
            // 簡易的に、形が整っていれば和了可能とする
            return { canWin: true, waitingTiles };
        }

        // 6. 特殊役判定 (七対子、国士無双)
        if (this.isChiitoitsu(tempHand)) {
             // 七対子は待ち牌が1種類のみ
             return { canWin: true, waitingTiles: [agariTile] };
        }
        // if (this.isKokushi(tempHand)) ...
        
        return { canWin: false, waitingTiles: [] };
    }


    // --- 複合形判定 (面子手と七対子/国士無双の識別) ---

    /**
     * 手牌が4面子1雀頭の形になっているかを解析する (再帰バックトラック法を使用)
     * @param {Tile[]} hand - 手牌 (和了牌を含む14枚)
     * @param {Array<Object>} naki - 鳴き牌の配列
     * @returns {{isNormalForm: boolean, waitingTiles: Tile[]}}
     */
    static findWinningForms(hand, naki) {
        // 鳴き牌は既に面子として確定しているため、手牌のみを解析する
        
        // 1. 解析用のデータを準備 (ソート、枚数カウント)
        const sortedHand = [...hand].sort((a, b) => a.code.localeCompare(b.code));
        
        // 2. 牌の枚数をマップに記録 { '1p': 4, '2p': 1, ... }
        const tileCounts = new Map();
        for (const tile of sortedHand) {
            const key = tile.toNormalCode(); // 赤ドラを無視したコード
            tileCounts.set(key, (tileCounts.get(key) || 0) + 1);
        }

        // 3. 雀頭（アタマ）の候補を探す (カウントが2以上の牌)
        const pairCandidates = Array.from(tileCounts.entries())
            .filter(([key, count]) => count >= 2)
            .map(([key]) => key);

        let isWinning = false;
        let waitingTiles = [];

        for (const pairCode of pairCandidates) {
            // 雀頭候補を2枚使用
            const tempCounts = new Map(tileCounts);
            tempCounts.set(pairCode, tempCounts.get(pairCode) - 2);
            
            // 雀頭以外の残り12枚で4面子（順子 or 刻子）が完成するかチェック
            if (this._findMentsu(tempCounts)) {
                isWinning = true;
                // 待ち牌の特定は、この関数外で行うか、このメソッド内でロジックを分岐させる必要がある
                // (今回は和了形が確認できたことのみを返す)
                break;
            }
        }
        
        return { isNormalForm: isWinning, waitingTiles };
    }

    /**
     * 4面子を探すための再帰関数（バックトラック法）
     * @param {Map<string, number>} counts - 牌の残数マップ
     * @returns {boolean} 4面子が完成したか
     */
    static _findMentsu(counts) {
        
        // 1. 残っている牌のうち、最も数の少ない牌（先頭の牌）を見つける
        let firstTileCode = null;
        for (const [code, count] of counts.entries()) {
            if (count > 0) {
                firstTileCode = code;
                break;
            }
        }

        // 2. 全ての牌を使い切った場合 (4面子完成)
        if (!firstTileCode) {
            return true;
        }

        // 3. 現在の牌の残り枚数
        const count = counts.get(firstTileCode);

        // --- 刻子（コーツ）として処理 ---
        if (count >= 3) {
            counts.set(firstTileCode, count - 3);
            if (this._findMentsu(counts)) {
                return true;
            }
            // バックトラック: 戻す
            counts.set(firstTileCode, count);
        }

        // --- 順子（シュンツ）として処理 ---
        // 字牌以外 かつ 8, 9ではない場合
        if (firstTileCode[0] !== 'z' && firstTileCode[0] < '8') {
            const type = firstTileCode.slice(-1); // m, p, s
            const value = parseInt(firstTileCode[0]);

            // 順子の次の牌 (value + 1) とその次の牌 (value + 2)
            const nextCode = (value + 1) + type;
            const nextNextCode = (value + 2) + type;

            if (counts.get(nextCode) > 0 && counts.get(nextNextCode) > 0) {
                // 順子として使用する牌の枚数を減らす
                counts.set(firstTileCode, count - 1);
                counts.set(nextCode, counts.get(nextCode) - 1);
                counts.set(nextNextCode, counts.get(nextNextCode) - 1);
                
                if (this._findMentsu(counts)) {
                    return true;
                }
                
                // バックトラック: 戻す
                counts.set(firstTileCode, count);
                counts.set(nextCode, counts.get(nextCode) + 1);
                counts.set(nextNextCode, counts.get(nextNextCode) + 1);
            }
        }

        return false; // 面子が見つからなかった
    }

    /**
     * 七対子（チートイツ）の和了形を判定する
     * @param {Tile[]} hand - 手牌 (和了牌を含む14枚)
     * @returns {boolean}
     */
    static isChiitoitsu(hand) {
        if (hand.length !== 14 || hand.length % 2 !== 0) return false;
        
        // 鳴きがあったら七対子は不可 (Player.nakiでチェック)
        // 今回はhandのみ渡すので、呼び出し元でチェックが必要
        
        const counts = new Map();
        for (const tile of hand) {
            const key = tile.toNormalCode();
            counts.set(key, (counts.get(key) || 0) + 1);
        }

        // 全ての牌種が2枚ずつ（合計7種類）存在するか
        if (counts.size !== 7) return false;
        
        // 全ての牌種のカウントが2であるか
        for (const count of counts.values()) {
            // 国士無双と区別するため、4枚使いは七対子としては認めないルールがあるが、
            // 一般的には2枚組7組の形で判定する
            if (count !== 2) return false;
        }

        return true;
    }


    // --- フリテン判定 ---

    /**
     * ロン和了できない永続的な振り聴状態（フリテン）かを判定する
     * @param {Player} player - 判定対象プレイヤー
     * @param {Tile[]} finalHand - 和了牌を加えた手牌 (14枚)
     * @returns {boolean}
     */
    static isPermanentFuriten(player, finalHand) {
        if (!player.isRiichi) {
            // リーチしていなければ、永続的なフリテンではない
            return false;
        }
        
        // 1. リーチ後のフリテン：和了形を構成している待ち牌が、過去に河（kawa）にあるか
        
        // リーチ後の和了形を解析し、全ての待ち牌を特定する
        const allWaitTiles = this.findAllWaitTiles(finalHand, player.naki);
        
        // プレイヤーの捨て牌履歴 (赤ドラを無視したコード)
        const discardCodes = player.discardCodes;
        
        for (const waitTileCode of allWaitTiles) {
            if (discardCodes.includes(waitTileCode)) {
                // 待ち牌のいずれかが既に捨てられている場合、フリテン確定
                return true;
            }
        }
        
        return false;
    }
    
    /**
     * 和了形から全ての待ち牌のコード (例: ['1p', '4p']) を特定する
     * ※この関数は複雑なため、ここではロジックの意図を示すのみ
     * @param {Tile[]} hand - 和了牌を含む手牌 (14枚)
     * @param {Array<Object>} naki - 鳴き牌の配列
     * @returns {string[]} 全ての待ち牌のコード
     */
    static findAllWaitTiles(hand, naki) {
        // これは非常に高度なロジックが必要（天鳳/雀魂レベル）
        // 14枚の手牌から、どの1枚を引いても和了形になる牌種を全て探す必要がある
        // 例: 23456789p 11s -> 14枚から1枚抜いた13枚の和了形を判定し、
        // 抜いた牌が待ち牌かどうかをチェックする...という処理を行う

        // 簡易実装として、一旦、手牌の牌種を返す (ダミー)
        const dummy = hand.map(t => t.toNormalCode());
        return Array.from(new Set(dummy));
    }


    // --- 役判定のプレースホルダ ---
    
    /**
     * 役の有無と翻数を計算する（Scorer.jsに処理を委譲）
     * @param {Player} player 
     * @param {Tile} agariTile 
     * @param {boolean} isRon 
     * @param {Tile[]} finalHand 
     * @returns {{han: number, fu: number, yaku: string[]}}
     */
    static checkYaku(player, agariTile, isRon, finalHand) {
        // 役判定は Scorer.js で行うため、ここではダミーを返す
        return { han: 1, fu: 30, yaku: ["タンヤオ"] }; 
    }
    
    // 他にも、canChi, canPon, canKan, canKita などがここに追加される
    
    /**
     * ポン可能かどうか判定する
     * @param {Player} player 
     * @param {Tile} discardedTile 
     * @returns {boolean}
     */
    static canPon(player, discardedTile) {
        // 1. 手牌に同じ牌が2枚以上あるか (赤ドラは無視して種類が合えばOK)
        const sameKindCount = player.hand.filter(t => t.isSameKind(discardedTile)).length;
        if (sameKindCount < 2) return false;
        
        // 2. 立直後ではないか (立直後はポン・チー・カンは不可)
        if (player.isRiichi) return false;
        
        // 3. 捨てられた牌が自身の河からでないか (自摸切りではない)
        // ロン判定と異なり、ポンは全プレイヤーから可能
        
        return true;
    }
}
