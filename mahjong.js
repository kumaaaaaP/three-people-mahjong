class Tile {
    constructor(type, value, isRedDora = false) {
        this.type = type; // 'm', 'p', 's', 'z' (萬, 筒, 索, 字)
        this.value = value; // 1, 3, 5, 7, 9 (萬子の場合) または 1~9, 1~7 (字牌)
        this.isRedDora = isRedDora; // 赤ドラかどうか (5p, 5s, または設定次第の3p, 7p, 3s, 7s)
        this.isNorth = (type === 'z' && value === 4); // 北抜き判定
    }

    // 牌を絵文字として描画するためのメソッド
    get displaySymbol() {
        // ここに絵文字マッピングロジックを実装します
        // 例: if (this.type === 'p' && this.value === 5 && this.isRedDora) return '🀕(赤)';
        // 例: if (this.type === 'z' && this.value === 1) return '🀀'; // 東
        // 実際には、牌の種類と数値から対応するUnicode絵文字を返す処理が必要です。
    }

    // ... その他の判定メソッド (isHonor, isTerminal, etc.)
}

class Player {
    constructor(id, name, initialScore = 25000) {
        this.id = id;
        this.name = name;
        this.score = initialScore;
        this.hand = []; // 手牌 (Tileオブジェクトの配列)
        this.river = []; // 河 (捨て牌の配列)
        this.melds = []; // 鳴き (ポン、チー、カンの配列)
        this.isDealer = false;
        this.isRiichi = false;
        this.isFuriten = false;
    }
    
    // ... 手牌をソートする、ツモる、捨てるなどのメソッド
}

class Game {
    constructor(players) {
        this.players = players;
        this.deck = []; // 山牌 (Tileオブジェクトの配列)
        this.doraMarkers = []; // ドラ表示牌
        this.currentWind = '東';
        this.currentKyoku = 1;
        this.activePlayerId = players[0].id;
    }

    // 牌山を初期化し、シャッフルする
    initializeDeck() {
        // 萬子の2〜8を抜いた牌を生成し、4枚ずつデッキに追加するロジック
        // 例: 筒子1~9を4枚ずつ、字牌7種を4枚ずつ
        // 牌生成後、Fisher-Yatesシャッフルなどで混ぜます。
    }

    // 牌を配る
    dealTiles() { /* ... 13枚ずつ配り、嶺上牌を確保するロジック ... */ }

    // ... ゲームサイクルを制御する主要なメソッド (startGame, nextTurn, etc.)
}

class UIManager {
    // 牌を描画するDOM要素をキャッシュ
    constructor() {
        this.handElement = document.getElementById('hand-self');
        this.scoreElement = document.getElementById('score-self');
        this.logElement = document.getElementById('game-log');
        // ... その他のボタンや表示要素
    }

    // 手牌の描画を更新する
    renderHand(hand) {
        this.handElement.innerHTML = ''; // 一度クリア
        hand.forEach(tile => {
            const tileDiv = document.createElement('span');
            tileDiv.className = 'tile';
            tileDiv.textContent = tile.displaySymbol;
            // 牌クリックで捨てるロジックをここに追加
            tileDiv.addEventListener('click', () => { 
                // ... ゲームの打牌処理を呼び出す ...
            });
            this.handElement.appendChild(tileDiv);
        });
    }

    // 点数や場風などの情報を更新する
    updateFieldInfo(game) { /* ... */ }

    // ログにメッセージを追加する
    log(message) { /* ... */ }
}

// game.js 内、または別ファイルとして
class NetworkManager {
    constructor(game) {
        this.socket = io('http://localhost:3000'); // サーバーURLに接続

        this.socket.on('connect', () => {
            // 接続成功時のUI更新
        });

        this.socket.on('game_state_update', (gameState) => {
            // サーバーから最新のゲーム状態を受け取り、Gameクラスを更新し、UIを再描画
        });
        
        // ... 他のイベントハンドラ (on_discard, on_call, etc.)
    }

    // サーバーへアクションを送信する
    sendAction(actionType, data) {
        this.socket.emit(actionType, data);
    }
}

class CPUPlayer extends Player {
    // ... CPU特有のロジック
    
    decideDiscard() {
        // 牌効率に基づいて捨てる牌を決定するロジック
        // (向聴数計算、危険度計算などが必要)
        
        // 現状の簡略版: ランダムに捨てる
        const randomIndex = Math.floor(Math.random() * this.hand.length);
        return this.hand[randomIndex];
    }
}
