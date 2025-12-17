/**
 * js/view/Renderer.js
 * ゲームの状態をDOMに反映させる描画クラス（完成版）
 */

import { TILE_EMOJI_MAP, BACK_TILE_EMOJI } from '../config/TileCodes.js';

export class Renderer {
    constructor() {
        this.playerContainers = {
            self: document.getElementById('player-self'),
            kamicha: document.getElementById('player-kamicha'),
            shimocha: document.getElementById('player-shimocha')
        };
        this.centerField = document.getElementById('center-field');
        this.actionControls = document.getElementById('action-controls');
        this.cutinLayer = document.getElementById('cutin-layer');
        this.modalOverlay = document.getElementById('modal-overlay');
        
        /** @type {Player[]} */
        this.players = [];
        this.selfPlayer = null;
        this.uiMap = {};
    }

    /**
     * プレイヤー情報を設定しUIと紐付ける
     */
    setPlayers(players) {
        this.players = players;
        this.selfPlayer = players.find(p => p.name === 'YOU') || players[0];

        // 3人麻雀用マッピング (自分、右:下家、左:上家)
        this.uiMap = {
            [this.players[0].id]: this.playerContainers.self,
            [this.players[1].id]: this.playerContainers.shimocha,
            [this.players[2].id]: this.playerContainers.kamicha
        };
        
        this.updatePlayerInfos(players);
    }
    
    /**
     * 点数・風・名前などの情報を更新
     */
    updatePlayerInfos(players) {
        players.forEach(p => {
            const container = this.uiMap[p.id];
            if (!container) return;

            container.querySelector('.player-info .name').textContent = p.name;
            container.querySelector('.player-info .score').textContent = p.score.toLocaleString();
            
            const windEl = container.querySelector('.player-info .wind');
            windEl.textContent = p.seatWind;

            if (p.isParent) {
                windEl.classList.add('parent');
            } else {
                windEl.classList.remove('parent');
            }
        });
    }

    /**
     * 手牌の描画（自分は表、他家は裏）
     */
    renderHands(players) {
        players.forEach(p => {
            const container = this.uiMap[p.id];
            const handArea = container.querySelector('.hand-area');
            handArea.innerHTML = '';

            const isSelf = (p.id === this.selfPlayer.id);

            p.hand.forEach(tile => {
                const tileEl = this.createTileElement(tile, !isSelf);
                
                if (isSelf && p.lastDrawnTile && p.lastDrawnTile.uniqueId === tile.uniqueId) {
                    tileEl.classList.add('drawn'); 
                }
                handArea.appendChild(tileEl);
            });
        });
    }

    /**
     * 河（捨て牌）の更新
     */
    updateKawa(player) {
        const container = this.uiMap[player.id];
        const kawaArea = container.querySelector('.kawa-area');
        kawaArea.innerHTML = '';

        player.kawa.forEach(tile => {
            const tileEl = this.createTileElement(tile, false);
            kawaArea.appendChild(tileEl);
        });
    }

    /**
     * ドラ表示牌の更新
     */
    updateDora(doraIndicators) {
        const doraContainer = document.getElementById('dora-indicators');
        doraContainer.innerHTML = '';

        doraIndicators.forEach(tile => {
            doraContainer.appendChild(this.createTileElement(tile, false));
        });
    }

    /**
     * ターンインジケータの更新
     */
    updateTurnIndicator(turnPlayer) {
        Object.values(this.playerContainers).forEach(c => c.classList.remove('active-turn'));
        const container = this.uiMap[turnPlayer.id];
        if (container) container.classList.add('active-turn');
    }

    /**
     * 打牌操作を有効化
     */
    enableDiscardInput(player) {
        if (player.id !== this.selfPlayer.id) return;
        const handArea = this.playerContainers.self.querySelector('.hand-area');
        
        handArea.querySelectorAll('.tile').forEach(tileEl => {
            tileEl.classList.add('selectable');
            tileEl.onclick = () => this.handleTileClick(tileEl);
        });
    }

    handleTileClick(tileEl) {
        const uniqueId = parseInt(tileEl.dataset.uniqueId);
        const tile = this.selfPlayer.hand.find(t => t.uniqueId === uniqueId);
        if (tile) {
            document.dispatchEvent(new CustomEvent('discardTile', { detail: tile }));
            this.disableDiscardInput();
        }
    }

    disableDiscardInput() {
        const handArea = this.playerContainers.self.querySelector('.hand-area');
        handArea.querySelectorAll('.tile.selectable').forEach(el => {
            el.classList.remove('selectable');
            el.onclick = null;
        });
    }

    /**
     * アクションボタン（リーチ、ポン、ロン等）の表示
     * @param {string[]} actions - ['riichi', 'tsumo', 'ron', 'pon', 'skip']
     */
    showActionButtons(actions) {
        this.actionControls.innerHTML = '';
        this.actionControls.classList.remove('hidden');

        actions.forEach(action => {
            const btn = document.createElement('button');
            btn.className = `action-btn btn-${action}`;
            btn.textContent = this._getActionLabel(action);
            btn.onclick = () => {
                document.dispatchEvent(new CustomEvent('playerAction', { detail: action }));
                this.actionControls.classList.add('hidden');
            };
            this.actionControls.appendChild(btn);
        });
    }

    /**
     * リザルトモーダルの表示
     * @param {Object} result - { winner, yaku, han, fu, score, tsumoInfo }
     */
    showResultModal(result) {
        const modal = document.getElementById('result-modal');
        const content = modal.querySelector('.modal-content');
        
        modal.querySelector('.result-winner').textContent = `${result.winner.name} の和了`;
        modal.querySelector('.result-score').textContent = `${result.score} 点`;
        
        const yakuList = modal.querySelector('.result-yaku');
        yakuList.innerHTML = '';
        result.yaku.forEach(y => {
            const li = document.createElement('li');
            li.textContent = y;
            yakuList.appendChild(li);
        });

        modal.querySelector('.result-details').textContent = `${result.fu} 符 ${result.han} 翻`;
        
        this.modalOverlay.classList.remove('hidden');
        modal.classList.remove('hidden');

        modal.querySelector('.btn-next-round').onclick = () => {
            this.modalOverlay.classList.add('hidden');
            modal.classList.add('hidden');
            document.dispatchEvent(new CustomEvent('nextRoundRequested'));
        };
    }

    /**
     * 牌DOMの生成
     */
    createTileElement(tile, isBack = false) {
        const div = document.createElement('div');
        div.classList.add('tile');
        div.dataset.uniqueId = tile.uniqueId;

        if (isBack) {
            div.textContent = BACK_TILE_EMOJI;
            div.classList.add('back-tile');
        } else {
            div.textContent = TILE_EMOJI_MAP[tile.toNormalCode()] || tile.code;
            if (tile.isRed) div.classList.add('red-dora');
        }
        return div;
    }

    showCutin(text) {
        const el = document.createElement('div');
        el.className = 'cut-in-text';
        el.textContent = text;
        this.cutinLayer.appendChild(el);
        setTimeout(() => el.remove(), 1200);
    }

    _getActionLabel(action) {
        const labels = {
            riichi: '立直', tsumo: 'ツモ', ron: 'ロン', 
            pon: 'ポン', kan: 'カン', skip: 'スルー'
        };
        return labels[action] || action;
    }
}
