/**
 * js/main.js
 * アプリケーションのエントリーポイント
 */

import { GameConfig } from './config.js';
// ※まだファイルが存在しないため、実装時はこれらを作成する必要があります
import { GameState } from './core/GameState.js'; 
import { Renderer } from './view/Renderer.js';

class Main {
    constructor() {
        // DOM要素のキャッシュ
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
     * イベントハンドラの登録
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
    }

    /**
     * ゲーム開始フロー
     */
    async handleStartGame() {
        // 1. 設定の読み込み
        this.readSettings();

        // 2. 画面遷移 (ロビー -> ゲーム)
        this.switchScene('game');

        // 3. ゲームコアの初期化
        // 描画クラスのインスタンス化
        this.renderer = new Renderer();
        
        // ゲーム状態管理クラスのインスタンス化 (ConfigとRendererを渡す)
        // Rendererを渡すことで、状態変化があったら即座に描画メソッドを呼べるようにする
        this.gameState = new GameState(this.config, this.renderer);

        // 4. ゲームスタート (配牌〜開局)
        try {
            console.log("Game Starting with config:", this.config);
            await this.gameState.startGame();
        } catch (e) {
            console.error("Game Error:", e);
            alert("エラーが発生しました: " + e.message);
            // エラー時はロビーに戻すなどの処理
            this.switchScene('lobby');
        }
    }

    /**
     * フォームから設定値を読み取ってConfigオブジェクトに反映
     */
    readSettings() {
        const form = this.dom.settingsForm;

        // モード
        this.config.mode = form.mode.value;
        if (this.config.mode === 'online') {
            this.config.roomId = document.getElementById('room-id').value || 'default_room';
        }

        // 戦形式
        this.config.length = document.getElementById('game-length').value;

        // 赤ドラ設定 (チェックボックスがあれば1枚、なければ0枚とする)
        // ※5p, 5sは今回は固定設定だが、必要ならここでも取得可能
        this.config.redRules.p3 = document.getElementById('red-3p').checked ? 1 : 0;
        this.config.redRules.s3 = document.getElementById('red-3s').checked ? 1 : 0;
        this.config.redRules.p7 = document.getElementById('red-7p').checked ? 1 : 0;
        this.config.redRules.s7 = document.getElementById('red-7s').checked ? 1 : 0;
    }

    /**
     * シーン切り替え
     * @param {string} sceneName 'lobby' or 'game'
     */
    switchScene(sceneName) {
        if (sceneName === 'game') {
            this.dom.lobby.classList.add('hidden');
            this.dom.lobby.classList.remove('active');
            
            this.dom.game.classList.remove('hidden');
            // 少し遅延させてフェードインなどの演出を入れる余地
            setTimeout(() => this.dom.game.classList.add('active'), 50);
        } else {
            this.dom.game.classList.add('hidden');
            this.dom.game.classList.remove('active');
            
            this.dom.lobby.classList.remove('hidden');
            this.dom.lobby.classList.add('active');
        }
    }
}

// アプリケーション起動
window.addEventListener('DOMContentLoaded', () => {
    new Main();
});
