/**
 * js/network/Socket.js
 * サーバーとのリアルタイム通信を管理するクラス (WebSocketクライアント)
 */

export class Socket {
    /**
     * @param {string} url - 接続するWebSocketサーバーのURL
     * @param {GameState} gameState - GameStateへの参照 (受信データを反映させるため)
     */
    constructor(url, gameState) {
        this.url = url;
        this.gameState = gameState;
        /** @type {WebSocket} */
        this.ws = null;
        this.isConnected = false;
        
        // 外部へのイベント通知用 (RendererやMainが購読する)
        this.eventHandlers = {}; 
    }

    /**
     * WebSocketサーバーへの接続を開始する
     * @returns {Promise<void>} 接続成功時に解決されるPromise
     */
    connect() {
        return new Promise((resolve, reject) => {
            if (this.ws) {
                console.warn("WebSocket is already initialized.");
                resolve();
                return;
            }

            this.ws = new WebSocket(this.url);

            this.ws.onopen = () => {
                this.isConnected = true;
                console.log(`WebSocket接続成功: ${this.url}`);
                this.emit('connected', { success: true });
                resolve();
            };

            this.ws.onmessage = (event) => {
                this._handleMessage(event.data);
            };

            this.ws.onclose = () => {
                this.isConnected = false;
                console.warn("WebSocket接続終了。");
                this.emit('disconnected');
            };

            this.ws.onerror = (error) => {
                console.error("WebSocketエラー:", error);
                this.isConnected = false;
                this.emit('error', error);
                reject(error);
            };
        });
    }

    /**
     * データをJSON形式でサーバーに送信する
     * @param {string} type - メッセージの種別 (例: 'DISCARD', 'JOIN', 'RIICHI')
     * @param {Object} payload - 送信するデータ
     */
    send(type, payload = {}) {
        if (!this.isConnected) {
            console.warn("WebSocketが未接続です。送信をスキップしました。");
            return;
        }

        const message = JSON.stringify({
            type: type,
            payload: payload
        });
        
        this.ws.send(message);
        console.log(`[OUT] ${type}:`, payload);
    }

    /**
     * 受信したメッセージを処理し、適切なロジックを呼び出す
     * @param {string} data - 受信したJSON文字列
     */
    _handleMessage(data) {
        try {
            const message = JSON.parse(data);
            const { type, payload } = message;
            
            console.log(`[IN ] ${type}:`, payload);

            // 1. GameStateの状態更新をトリガーする
            switch (type) {
                case 'GAME_START':
                    // 他家が配牌を完了したことを通知
                    this.gameState.handleGameStart(payload); 
                    break;
                case 'TILE_DRAWN':
                    // 他家のツモ (ツモ牌は非公開)
                    this.gameState.handleRemoteDraw(payload.playerId);
                    break;
                case 'TILE_DISCARDED':
                    // 他家の打牌 (鳴き/ロンの判定フェーズへ移行)
                    this.gameState.handleRemoteDiscard(payload.playerId, payload.tileCode);
                    break;
                case 'CALL_MADE':
                    // 他家の鳴き (ポン, チー, カン) または ロン
                    this.gameState.handleRemoteCall(payload.playerId, payload.callType, payload.calledTileCode);
                    break;
                case 'SCORE_UPDATE':
                    // 点数移動の通知 (和了や流局時)
                    this.gameState.handleScoreUpdate(payload.scores);
                    break;
                case 'ROUND_ADVANCE':
                    // 局の進行や親の交代
                    this.gameState.handleRoundAdvance(payload.newRoundInfo);
                    break;
                case 'ROOM_STATE':
                    // ルーム内の全プレイヤー情報や初期状態
                    this.emit('roomStateReceived', payload);
                    break;
                default:
                    console.warn(`未定義のメッセージタイプを受信: ${type}`);
            }

            // 2. 外部リスナーへの通知 (Rendererなど)
            this.emit(type, payload);

        } catch (e) {
            console.error("受信メッセージの解析エラー:", e, data);
        }
    }

    // --- イベントハンドリング (カスタム) ---
    
    /**
     * イベントリスナーを登録する
     * @param {string} event - イベント名 (例: 'connected', 'TILE_DISCARDED')
     * @param {Function} handler - 実行するコールバック関数
     */
    on(event, handler) {
        if (!this.eventHandlers[event]) {
            this.eventHandlers[event] = [];
        }
        this.eventHandlers[event].push(handler);
    }

    /**
     * イベントを発火させる
     * @param {string} event - イベント名
     * @param {Object} data - イベントに渡すデータ
     */
    emit(event, data) {
        const handlers = this.eventHandlers[event];
        if (handlers) {
            handlers.forEach(handler => handler(data));
        }
    }
}
