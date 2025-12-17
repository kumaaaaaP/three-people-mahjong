/**
 * js/core/GameState.js
 * ゲーム全体の進行、状態、サイクルの管理
 */

import { GameConfig } from '../config.js';
import { Tile } from './Tile.js';
import { Wall } from './Wall.js';
import { Player } from './Player.js';

// 場の風と席風の定数
const WINDS = ['東', '南', '西', '北']; // 3人麻雀では通常「北」は「北家」ではなく「抜きドラ」として扱うことが多いが、席風としては存在する

export class GameState {
    /**
     * @param {GameConfig} config - ゲーム設定
     * @param {Renderer} renderer - 描画クラスのインスタンス (依存性注入)
     */
    constructor(config, renderer) {
        this.config = config;
        this.renderer = renderer;

        // --- 場と進行状態 ---
        this.wall = null;              // 山牌のインスタンス
        this.players = [];             // プレイヤー配列 (Playerクラスのインスタンス)
        this.round = 1;                // 現在の局 (東1, 東2, ...)
        this.honba = 0;                // 本場数
        this.baKaze = '東';             // 場の風 ('東', '南', ...)
        this.turnIndex = 0;            // 現在のターンプレイヤーのインデックス
        this.turnPlayer = null;        // 現在のターンプレイヤー (Playerインスタンス)
        this.discardedTile = null;     // 直前に捨てられた牌 (鳴き/ロン判定用)
        this.discardSourcePlayer = null; // 捨て牌のプレイヤー
        
        // --- 制御フラグ ---
        this.gamePhase = 'LOBBY';      // 現在のフェーズ ('LOBBY', 'SETUP', 'DRAW', 'DISCARD', 'CALL_PHASE', 'RESULT')
        this.isGameOver = false;
        this.riichiCount = 0;          // 場に供託されているリーチ棒の数
        this.doraIndicators = [];      // ドラ表示牌の配列 (Tile[])

        this.initPlayers();
    }

    /**
     * プレイヤーを初期化し、席順を設定する
     * 3人麻雀では、席風は東・南・西を使用し、北は通常空席扱い (または北家=北ドラ)。
     * 最初の親は東。
     */
    initPlayers() {
        // プレイヤーID: p0(東家/親), p1(南家), p2(西家)
        this.players.push(new Player('p0', 'YOU', this.config.startScore));
        this.players.push(new Player('p1', 'CPU 1', this.config.startScore));
        this.players.push(new Player('p2', 'CPU 2', this.config.startScore));

        // 席風の設定 (東家, 南家, 西家)
        this.players.forEach((p, index) => {
            p.setWind(WINDS[index % 3]); // 東, 南, 西
        });
        
        // 最初の親を設定
        this.players[0].isParent = true;
        this.turnIndex = 0;
        this.turnPlayer = this.players[0];
        
        // 描画クラスにプレイヤー情報を連携
        this.renderer.setPlayers(this.players);
    }

    /**
     * ゲーム開始、山構築、配牌、初回のドラ公開までを行う
     */
    async startGame() {
        this.gamePhase = 'SETUP';
        
        // 1. 山の構築とシャッフル
        this.wall = new Wall(this.config);
        this.wall.build();
        this.wall.shuffle();
        this.wall.setDeadWall();
        
        // 2. ドラ表示牌の公開
        this.doraIndicators = this.wall.getInitialDoraIndicators();
        this.renderer.updateDora(this.doraIndicators);
        
        // 3. 配牌 (各プレイヤー13枚)
        for (let i = 0; i < 13; i++) {
            for (const player of this.players) {
                const tile = this.wall.draw();
                if (tile) {
                    player.addTileToHand(tile);
                }
            }
        }
        
        // 4. 初回描画
        this.renderer.renderHands(this.players);
        this.renderer.updateTurnIndicator(this.turnPlayer);
        
        // 5. 親のツモ（東家の初回ツモ）からゲームサイクルを開始
        await this.startPlayerTurn(this.turnPlayer);
    }

    /**
     * プレイヤーのターンを開始する (ツモまたは嶺上ツモ)
     * @param {Player} player - ターンを開始するプレイヤー
     */
    async startPlayerTurn(player) {
        this.gamePhase = 'DRAW';
        this.turnPlayer = player;
        this.renderer.updateTurnIndicator(player);
        
        // 1. 牌をツモる
        const drawnTile = this.wall.draw();
        if (!drawnTile) {
            // ツモ牌がない場合 -> 流局
            await this.handleRyuuKyoku('yamagire');
            return;
        }

        player.addTileToHand(drawnTile);
        this.renderer.renderHands(this.players); // 手牌を更新

        // 2. ツモ和了判定 (リーチ後のツモ切り牌でもロン判定は必須)
        // 複雑な判定は Judge.js に任せる
        // 例: const canTsumo = Judge.canTsumo(player);
        const canTsumo = true; // 仮の判定
        
        if (canTsumo) {
            // ツモ和了の選択肢を提示
            // 例: this.renderer.showActionButtons(['tsumo', 'discard']);
        }
        
        // 3. 打牌待ち
        if (player.isCPU) {
            // CPUの思考ルーチン起動 (④ CPU.js)
            // 例: const tileToDiscard = CPU.decideDiscard(player);
            // await this.handleDiscard(player, tileToDiscard);
        } else {
            // ユーザー操作待ち
            this.gamePhase = 'DISCARD';
            this.renderer.enableDiscardInput(player);
        }
    }

    /**
     * プレイヤーが牌を捨てたときの処理
     * @param {Player} player - 打牌したプレイヤー
     * @param {Tile} tile - 捨てられた牌
     */
    async handleDiscard(player, tile) {
        player.discardTile(tile);
        this.discardedTile = tile;
        this.discardSourcePlayer = player;
        
        this.renderer.renderHands(this.players);
        this.renderer.updateKawa(player); // 河の更新

        // 1. リーチ宣言の場合の処理
        if (player.isRiichi && player.riichiSticks === 0) {
            // 立直宣言牌の場合、供託に1000点移動
            player.score -= 1000;
            this.riichiCount++;
            this.renderer.showCutin('リーチ！');
        }

        // 2. 鳴き・ロン判定フェーズへ移行
        await this.startCallPhase(tile, player);
    }

    /**
     * 捨て牌に対する鳴き・ロンの権利判定と処理を行う
     * @param {Tile} discardedTile - 捨てられた牌
     * @param {Player} sourcePlayer - 捨て牌のプレイヤー
     */
    async startCallPhase(discardedTile, sourcePlayer) {
        this.gamePhase = 'CALL_PHASE';
        
        // 1. ロン判定
        const ronCandidates = this.players.filter(p => p !== sourcePlayer && this.canRon(p, discardedTile));
        
        if (ronCandidates.length > 0) {
            // 優先度の高いプレイヤーから選択権を与える
            const winningPlayer = ronCandidates[0]; // 簡易的に1人目
            // await this.handleAgari(winningPlayer, discardedTile, 'ron');
            return;
        }
        
        // 2. 鳴き判定 (ポン・カン)
        // 3人麻雀ではチーは基本的にない（上家がいないため）
        
        // 捨て牌の次のプレイヤー（下家）から順番に判定
        // ポン・カン判定は複雑なため、ここではプレイヤーに選択肢を提示する処理を想定
        // 例: const canPon = this.canPon(this.getNextPlayer(sourcePlayer), discardedTile);
        
        // 3. 鳴きがなかった場合、次のツモへ
        this.advanceTurn();
        await this.startPlayerTurn(this.turnPlayer);
    }
    
    /**
     * プレイヤーがロン可能か判定する (Judge.jsに委譲するべきだが、骨格として)
     * @param {Player} player - 判定対象プレイヤー
     * @param {Tile} tile - 捨てられた牌
     * @returns {boolean}
     */
    canRon(player, tile) {
        // (省略) フリテン、役あり、形テンなどの複雑な判定が必要
        return false;
    }

    /**
     * 和了処理 (ツモまたはロン)
     * @param {Player} winner - 和了したプレイヤー
     * @param {Tile} tile - 和了牌
     * @param {string} type - 'tsumo' or 'ron'
     */
    async handleAgari(winner, tile, type) {
        this.gamePhase = 'RESULT';
        this.renderer.showCutin(type === 'tsumo' ? 'ツモ！' : 'ロン！');
        
        // 1. 役の判定と点数計算 (③ Judge.js, Scorer.js にて行う)
        // 例: const result = Scorer.calculate(winner, tile, type, this.doraIndicators);
        
        // 2. 点数移動
        // 3. 供託の回収
        // 4. 次局への準備 (連荘/流局処理)
        
        // (省略)
        await this.advanceRound(winner.isParent);
    }

    /**
     * 流局処理
     * @param {string} reason - 流局理由 ('yamagire', 'kyuushu', 'suufong')
     */
    async handleRyuuKyoku(reason) {
        this.gamePhase = 'RESULT';
        this.renderer.showCutin('流局');

        // 1. 聴牌/不聴の判定
        // 2. 点数移動 (不聴罰符の精算)
        // 3. 次局への準備 (連荘/流局処理)
        
        // (省略)
        await this.advanceRound(false); // 流局時は連荘条件を満たさないと親は流れる
    }

    /**
     * ターンを次のプレイヤーに進める
     */
    advanceTurn() {
        this.turnIndex = (this.turnIndex + 1) % this.players.length;
        this.turnPlayer = this.players[this.turnIndex];
    }
    
    /**
     * 次の局へ進める
     * @param {boolean} isParentRenchan - 親が連荘するかどうか
     */
    async advanceRound(isParentRenchan) {
        
        // 1. 親が連荘する場合
        if (isParentRenchan) {
            this.honba++;
            console.log(`連荘。東${this.round}局 ${this.honba}本場`);
        } else {
            // 2. 親が流れる場合 (ツモ番のインデックスをずらす)
            this.honba = 0;
            this.round++;
            
            // プレイヤー配列の順序をローテーションさせる (親変更)
            const oldParent = this.players.shift();
            oldParent.isParent = false;
            this.players.push(oldParent);
            this.players[0].isParent = true; // 新しい親
            
            // 席風も更新 (東南西をプレイヤーに再設定)
            this.players.forEach((p, index) => p.setWind(WINDS[index % 3]));
            
            // 場風の更新 (東場→南場など)
            if (this.round > 4) { // 東4局が終わったら場風を南へ
                 this.baKaze = '南';
                 this.round = 1;
            }
        }
        
        // 終局判定
        if (this.baKaze === '南' && this.round > 4 && this.config.length === 'south') {
            this.isGameOver = true;
            // this.renderer.showGameOver(this.players);
            return;
        }

        // 次の局の初期化 (startGameを呼び出す代わりに、resetRoundメソッドを使うべき)
        // await this.resetRound();
        console.log(`次の局へ: ${this.baKaze}${this.round}局 ${this.honba}本場`);
    }
}
