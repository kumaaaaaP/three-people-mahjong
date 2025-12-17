/**
 * js/core/Player.js
 * プレイヤー個々の状態を管理するクラス
 */

export class Player {
    /**
     * @param {string} id - プレイヤーの一意なID (例: 'p1', 'p2', 'p3')
     * @param {string} name - プレイヤー名 (例: 'YOU', 'CPU 1')
     * @param {number} startingScore - 初期持ち点
     */
    constructor(id, name, startingScore) {
        this.id = id;
        this.name = name;
        this.isCPU = name.startsWith('CPU'); // CPUかどうかの簡易判定
        
        // --- ① 点数・ステータス管理 ---
        this.score = startingScore;
        this.isRiichi = false;     // 立直状態
        this.isDaburi = false;     // ダブル立直状態 (立直時に確定)
        this.riichiSticks = 0;     // 積み棒数 (このプレイヤーが積んだリーチ棒)
        this.isParent = false;     // 親かどうか
        this.seatWind = '';        // 自分の席風 (東南西北)
        this.roundWind = '';       // 場の風 (東南)
        this.isTsumo = false;      // ツモ和了かどうか
        this.isRon = false;        // ロン和了かどうか
        
        // --- ② 牌のデータ構造 ---
        /** @type {Tile[]} */
        this.hand = [];            // 手牌 (ツモ牌含む、13枚 or 14枚)
        /** @type {Tile[]} */
        this.kawa = [];            // 河（捨て牌の履歴）
        /** @type {Array<Object>} */
        this.naki = [];            // 鳴き（ポン、カン、チー）の履歴
        this.lastDrawnTile = null; // 最後にツモった牌
        
        // --- ③ フリテン判定用 ---
        /** @type {string[]} */
        this.discardCodes = [];    // 河に捨てた牌のコード (フリテン判定用)
        this.isFuriten = false;    // 常にフリテン状態かどうか (ロン和了できない状態)
    }

    /**
     * 手牌に牌を追加する (配牌やツモ時)
     * @param {Tile} tile - 追加する牌
     */
    addTileToHand(tile) {
        this.hand.push(tile);
        this.hand.sort((a, b) => {
            // ソート順: 字牌 < 萬子 < 筒子 < 索子 (一般的に使用しない萬子は無視)
            // TILE_TYPE.JIHAI=z, MANZU=m, PINZU=p, SOUZU=s
            
            // 種類コード順 ('z' < 'm' < 'p' < 's')
            if (a.type !== b.type) {
                return a.type.localeCompare(b.type);
            }
            // 数値順
            if (a.value !== b.value) {
                return a.value - b.value;
            }
            // 赤ドラを後ろに (見た目を考慮)
            return a.isRed ? 1 : b.isRed ? -1 : 0;
        });
        this.lastDrawnTile = tile;
    }

    /**
     * 手牌から牌を捨てる (打牌)
     * @param {Tile} tileToDiscard - 捨てる牌のオブジェクト
     * @param {boolean} isRiichiDiscard - 立直宣言の打牌かどうか
     * @returns {boolean} 成功/失敗
     */
    discardTile(tileToDiscard, isRiichiDiscard = false) {
        const index = this.hand.findIndex(t => t.uniqueId === tileToDiscard.uniqueId);
        
        if (index === -1) {
            console.error('打牌エラー: 指定された牌は手牌にありません。', tileToDiscard);
            return false;
        }

        // 1. 手牌から削除
        this.hand.splice(index, 1);
        
        // 2. 河に追加
        this.kawa.push(tileToDiscard);
        this.discardCodes.push(tileToDiscard.toNormalCode()); // フリテン判定用にコードを保存

        // 3. 立直判定
        if (isRiichiDiscard) {
            this.isRiichi = true;
            this.riichiSticks = 1;
            // ダブルリーチ判定はこの直前のツモ時または立直宣言時に行う
        }

        // 4. ツモ牌のクリア
        this.lastDrawnTile = null;

        return true;
    }

    /**
     * 鳴き（ポン、カン）の牌を手牌から切り出し、鳴きエリアに追加する
     * @param {string} type - 鳴きの種類 ('pon', 'kan', 'chi')
     * @param {Tile[]} tilesUsed - 鳴きに使用した手牌の牌 (ポンなら2枚、チーなら2枚、カンなら3枚)
     * @param {Tile} calledTile - 相手から鳴いた牌
     * @param {string} fromPlayerId - 鳴き牌を提供したプレイヤーのID
     */
    callMeld(type, tilesUsed, calledTile, fromPlayerId) {
        
        // 1. 手牌から使用した牌を削除
        for (const usedTile of tilesUsed) {
            const index = this.hand.findIndex(t => t.uniqueId === usedTile.uniqueId);
            if (index !== -1) {
                this.hand.splice(index, 1);
            }
        }

        // 2. 鳴き構造体を作成し、鳴きエリアに追加
        // 鳴き牌（calledTile）に誰から鳴いたかの情報を持たせることが重要
        const meld = {
            type: type,
            tiles: [...tilesUsed, calledTile], // 鳴き牌も含めた組
            calledFrom: fromPlayerId,
            calledTile: calledTile
        };
        this.naki.push(meld);

        // 3. 河の牌を横向き（鳴かれた牌）にする処理（このクラスでは状態変更のみ）
        // 外部の GameState や Renderer がこの鳴きを検知し、河の牌を「鳴かれ済み」にマークする処理が必要
    }

    /**
     * 手牌が和了形になっているかチェックする (簡易的なチェック)
     * 厳密な役判定は Judge.js にて行うため、ここでは枚数チェックのみ
     * @returns {boolean}
     */
    canWin() {
        // 通常は (鳴き組 * 3 + 手牌) で判定する。
        // 手牌枚数が4n+2枚なら、ツモ和了の可能性あり。
        // 鳴きがない場合、手牌の枚数は 14枚 (ツモ和了) または 13枚 (ロン和了)
        
        // 鳴き組の牌数:
        const nakiCount = this.naki.reduce((sum, meld) => sum + meld.tiles.length, 0);
        
        // 現在の総牌数
        const totalTiles = nakiCount + this.hand.length;

        // 和了形は必ず 4組(12枚) + 1雀頭(2枚) = 14枚
        return totalTiles % 3 === 2;
    }

    // --- その他、補助メソッド ---

    /**
     * プレイヤーの風を設定する
     * @param {string} seatWind - 席風 ('東', '南', '西', '北')
     */
    setWind(seatWind) {
        this.seatWind = seatWind;
    }
}
