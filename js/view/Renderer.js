/**
 * js/view/Renderer.js
 * ゲームの状態をDOMに反映させる描画クラス
 */

export class Renderer {
    constructor() {
        this.playerContainers = {
            self: document.getElementById('player-self'),
            kamicha: document.getElementById('player-kamicha'), // 上家 (左)
            shimocha: document.getElementById('player-shimocha') // 下家 (右)
        };
        this.centerField = document.getElementById('center-field');
        this.actionControls = document.getElementById('action-controls');
        this.cutinLayer = document.getElementById('cutin-layer');
        
        /** @type {Player[]} */
        this.players = []; // GameStateから受け取るプレイヤーデータ
        this.selfPlayer = null; // 常にユーザー自身
    }

    /**
     * GameStateからプレイヤー情報を設定し、UIの紐付けを確定する
     * @param {Player[]} players - GameStateから渡されるPlayerオブジェクトの配列 (東家、南家、西家)
     */
    setPlayers(players) {
        this.players = players;
        this.selfPlayer = players.find(p => p.name === 'YOU') || players[0];

        // 3人麻雀の視点に基づく配置マッピング
        // ユーザー (YOU) がp0(東家)の場合を想定
        // 自分の視点から見て、左が上家(p2)、右が下家(p1)となるようマッピングする処理が必要
        
        // 簡易的なマッピング (YOU = p0, p1=下家, p2=上家と仮定)
        this.uiMap = {
            [this.players[0].id]: this.playerContainers.self,
            [this.players[1].id]: this.playerContainers.shimocha,
            [this.players[2].id]: this.playerContainers.kamicha
        };
        
        this.updatePlayerInfos(players);
    }
    
    /**
     * プレイヤーの点数や名前、風などの静的情報を更新する
     * @param {Player[]} players 
     */
    updatePlayerInfos(players) {
        players.forEach(p => {
            const container = this.uiMap[p.id];
            if (!container) return;

            // スコア、名前、風の表示を更新
            container.querySelector('.player-info .name').textContent = p.name;
            container.querySelector('.player-info .score').textContent = p.score.toLocaleString();
            
            const windEl = container.querySelector('.player-info .wind');
            windEl.textContent = p.seatWind; // 席風

            // 親の風は赤色にするなど
            if (p.isParent) {
                 windEl.style.color = 'red';
                 windEl.style.borderColor = 'red';
            } else {
                 windEl.style.color = 'white';
                 windEl.style.borderColor = 'white';
            }
        });
    }

    /**
     * すべてのプレイヤーの手牌を描画または更新する
     * @param {Player[]} players 
     */
    renderHands(players) {
        players.forEach(p => {
            const container = this.uiMap[p.id];
            const handArea = container.querySelector('.hand-area');
            handArea.innerHTML = ''; // 一度クリア

            // 手牌の描画
            p.hand.forEach(tile => {
                const tileEl = this.createTileElement(tile);
                
                if (p.id !== this.selfPlayer.id) {
                    // 他家は裏向きの牌（backクラス）
                    tileEl.classList.add('back');
                } else if (p.lastDrawnTile && p.lastDrawnTile.uniqueId === tile.uniqueId) {
                    // 自分のツモ牌は少し右に配置する（CSSでマージン調整済みだが、フラグを残す）
                    tileEl.classList.add('drawn'); 
                }
                
                handArea.appendChild(tileEl);
            });
        });
    }

    /**
     * プレイヤーの河（捨て牌）を更新する
     * @param {Player} player - 捨て牌のプレイヤー
     */
    updateKawa(player) {
        const container = this.uiMap[player.id];
        const kawaArea = container.querySelector('.kawa-area');
        kawaArea.innerHTML = ''; // 一度クリア

        player.kawa.forEach((tile, index) => {
            const tileEl = this.createTileElement(tile);
            
            // 鳴かれた牌は横向きにするなど、特別な処理をここで行う (ここでは未実装)
            // 例: if (tile.isCalled) tileEl.classList.add('side'); 

            kawaArea.appendChild(tileEl);
        });
    }

    /**
     * ドラ表示牌を更新し、中央に表示する
     * @param {Tile[]} doraIndicators - ドラ表示牌の配列
     */
    updateDora(doraIndicators) {
        const doraContainer = document.getElementById('dora-indicators');
        doraContainer.innerHTML = '';

        doraIndicators.forEach(tile => {
            const tileEl = this.createTileElement(tile);
            doraContainer.appendChild(tileEl);
        });
    }

    /**
     * ターンが回ってきたプレイヤーを示すインジケータを更新する
     * @param {Player} turnPlayer 
     */
    updateTurnIndicator(turnPlayer) {
        // 全プレイヤーのコンテナからハイライトを削除
        Object.values(this.playerContainers).forEach(c => c.classList.remove('active-turn'));
        
        // 現在のターンプレイヤーのコンテナをハイライト
        const container = this.uiMap[turnPlayer.id];
        if (container) {
            container.classList.add('active-turn');
        }
    }
    
    /**
     * 打牌操作を有効にする
     * @param {Player} player - 打牌権を持つプレイヤー
     */
    enableDiscardInput(player) {
        if (player.id !== this.selfPlayer.id) return;

        const handArea = this.playerContainers.self.querySelector('.hand-area');
        
        // 牌がクリックされたらGame Stateに通知するリスナーを付与
        handArea.querySelectorAll('.tile').forEach(tileEl => {
            tileEl.classList.add('selectable'); // CSSでホバー効果を付与
            tileEl.onclick = (e) => this.handleTileClick(e.currentTarget);
        });
        
        // TODO: アクションボタン (リーチ、ツモ) もここで表示/非表示を制御
    }
    
    /**
     * 牌がクリックされたときのハンドラ
     * @param {HTMLElement} tileEl - クリックされた牌のDOM要素
     */
    handleTileClick(tileEl) {
        // 1. DOM要素からユニークIDを取得
        const uniqueId = parseInt(tileEl.dataset.uniqueId);
        
        // 2. 手牌から対応するTileオブジェクトを検索
        const tileToDiscard = this.selfPlayer.hand.find(t => t.uniqueId === uniqueId);
        
        if (tileToDiscard) {
            // 3. GameStateに打牌処理を要求 (イベント通知/コールバック)
            // ※ main.jsまたはGameStateに定義されたイベントハンドラを呼ぶ必要がある
            console.log(`牌を打牌: ${tileToDiscard.code}`);
            
            // 暫定的に、グローバルイベントを発火させる
            const discardEvent = new CustomEvent('discardTile', { detail: tileToDiscard });
            document.dispatchEvent(discardEvent);
            
            // クリックイベントを一時的に無効化
            this.disableDiscardInput();
        }
    }
    
    /**
     * 打牌操作を無効にする
     */
    disableDiscardInput() {
        const handArea = this.playerContainers.self.querySelector('.hand-area');
        handArea.querySelectorAll('.tile.selectable').forEach(tileEl => {
            tileEl.classList.remove('selectable');
            tileEl.onclick = null;
        });
    }

    /**
     * 汎用的な牌のDOM要素を作成するヘルパー関数
     * @param {Tile} tile - 牌データ
     * @returns {HTMLElement}
     */
    createTileElement(tile) {
        const div = document.createElement('div');
        div.classList.add('tile');
        
        // 例: '5pr' の場合、クラスは 'p5pr' になり、CSSで対応する牌画像を表示
        // 画像がない場合は、CSSのフォントで表示
        div.classList.add(tile.code); 
        div.textContent = tile.toNormalCode(); // デバッグ用にコードを表示
        
        // ロジックとの紐付けに必要なユニークIDをデータ属性として保存
        div.dataset.uniqueId = tile.uniqueId;

        // 赤ドラの場合、視覚的なクラスを追加
        if (tile.isRed) {
            div.classList.add('red-dora');
        }
        
        return div;
    }

    /**
     * 画面中央にカットインメッセージを表示する
     * @param {string} text - 表示するテキスト (例: 'リーチ！', 'ロン！')
     */
    showCutin(text) {
        const messageEl = document.createElement('div');
        messageEl.classList.add('cut-in-text');
        messageEl.textContent = text;
        
        this.cutinLayer.appendChild(messageEl);
        
        // 0.8秒後に消去
        setTimeout(() => {
            messageEl.remove();
        }, 800);
    }
    
    // 他にも、showActionButtons, showResultModal などのメソッドがここに追加される
}
