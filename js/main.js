/**
 * js/main.js
 * アプリケーションのエントリーポイント (更新版)
 */

import { GameConfig } from './config.js';
import { GameState } from './core/GameState.js'; 
import { Renderer } from './view/Renderer.js';
import { Player } from './core/Player.js'; // Playerクラスもインポート

class Main {
    constructor() {
        // ... (DOMキャッシュ部分は変更なし)
        this.dom = {
            lobby: document.getElementById('scene-lobby'),
            game: document.getElementById('scene-game'),
            settingsForm: document.getElementById('game-settings'),
            btnStart: document.getElementById('btn-start'),
            roomIdInput: document.getElementById('online-input'),
            radiosMode: document.getElementsByName('mode')
        };

        this.config = new GameConfig();
        this.gameState = null;
        this.renderer = null;

        this.init();
    }

    /**
     * 初期化処理
     */
    init() {
        console.log("Open Sanma: Initializing...");

        // イベントリスナーの登録
        this.bindEvents();
    }

    /**
     * イベントハンドラの登録 (更新)
     */
    bindEvents() {
        // 対局開始ボタン
        this.dom.btnStart.addEventListener('click', () => {
            this.handleStartGame();
        });

        // モード切替（CPU / Online）時のUI制御
        Array.from(this.dom.radiosMode).forEach(radio => {
            radio.addEventListener('change', (e) => {
                if (e.target.value === 'online') {
                    this.dom.roomIdInput.classList.remove('hidden');
                } else {
                    this.dom.roomIdInput.classList.add('hidden');
                }
            });
        });

        // 新規追加: Rendererから発火される打牌イベントを捕捉
        document.addEventListener('discardTile', (e) => {
            this.handleUserDiscard(e.detail);
        });
    }
    
    /**
     * ユーザーからの打牌イベントを処理し、GameStateに渡す
     * @param {Tile} tile - 捨てられた牌のTileオブジェクト
     */
    handleUserDiscard(tile) {
        if (this.gameState && this.gameState.gamePhase === 'DISCARD') {
            const player = this.gameState.turnPlayer;
            if (player && player.id === this.gameState.players[0].id) { // 常に自分が東家/p0と仮定
                
                // 1. ユーザー操作を一時的に無効化 (二重操作防止)
                this.renderer.disableDiscardInput(); 

                // 2. GameStateのコアロジックを呼び出す
                // handleDiscardは非同期 (鳴き待ちやアニメーションがあるため)
                this.gameState.handleDiscard(player, tile);
            }
        }
    }


    /**
     * ゲーム開始フロー (更新)
     */
    async handleStartGame() {
        // 1. 設定の読み込み
        this.readSettings();

        // 2. 画面遷移 (ロビー -> ゲーム)
        this.switchScene('game');

        // 3. ゲームコアの初期化
        this.renderer = new Renderer();
        
        // GameStateにRendererのインスタンスを渡し、Game Stateが変更を通知できるようにする
        this.gameState = new GameState(this.config, this.renderer);

        // 4. ゲームスタート (配牌〜開局)
        try {
            console.log("Game Starting with config:", this.config);
            await this.gameState.startGame();
        } catch (e) {
            console.error("Game Error:", e);
            alert("エラーが発生しました: " + e.message);
            this.switchScene('lobby');
        }
    }

    // ... (readSettings と switchScene メソッドは変更なし)

    // アプリケーション起動
    // window.addEventListener('DOMContentLoaded', () => {
    //     new Main();
    // });
}

// アプリケーション起動
window.addEventListener('DOMContentLoaded', () => {
    new Main();
});
