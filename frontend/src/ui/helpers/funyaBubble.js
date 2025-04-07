/**
 * funyaBubble.js
 * ふにゃ見守りモード時の吹き出し表示を制御するモジュール
 */

import { getFunyaStatus } from '../../core/apiClient.js';
import { logDebug } from '../../core/logger.js';

// 設定値
const POLLING_INTERVAL = 5000; // 5秒ごとにステータスをチェック
const MESSAGES = [
    '……ふにゃ？ だいじょうぶ？',
    '集中してるのかな？',
    'ひとやすみ、しよっか🐈️',
    '長い時間がんばってるね✨',
    'お疲れ様、少し休憩してみる？',
    'ふにゃ〜、元気ある？💫'
];

// 状態管理
let isWatching = false;
let bubbleElement = null;
let textElement = null;
let pollingInterval = null;

/**
 * ランダムなメッセージを取得
 * @returns {string} ランダムなメッセージ
 */
function getRandomMessage() {
    const index = Math.floor(Math.random() * MESSAGES.length);
    return MESSAGES[index];
}

/**
 * 吹き出し要素を作成
 * @returns {HTMLElement} 吹き出し要素
 */
function createBubbleElement() {
    // 既に存在する場合は作成しない
    if (document.getElementById('funyaBubble')) {
        return document.getElementById('funyaBubble');
    }

    // 吹き出し要素
    const bubble = document.createElement('div');
    bubble.id = 'funyaBubble';
    bubble.className = 'funya-bubble hide';

    // テキスト要素
    const text = document.createElement('div');
    text.id = 'funyaText';
    text.className = 'funya-text';

    // メッセージを設定
    const message = document.createElement('span');
    message.innerHTML = `<span class="funya-icon">🐾</span>${getRandomMessage()}`;
    text.appendChild(message);

    // 要素を組み立て
    bubble.appendChild(text);
    document.body.appendChild(bubble);

    return bubble;
}

/**
 * 吹き出しの表示状態を更新
 * @param {boolean} watching 見守り中かどうか
 */
function updateBubbleVisibility(watching) {
    if (!bubbleElement) {
        bubbleElement = createBubbleElement();
        textElement = document.getElementById('funyaText');
    }

    // 状態が変わった場合のみ処理
    if (watching !== isWatching) {
        isWatching = watching;

        if (isWatching) {
            // 表示する場合はメッセージをランダムに設定
            const message = getRandomMessage();
            textElement.innerHTML = `<span class="funya-icon">🐾</span>${message}`;

            // クラスを変更して表示
            bubbleElement.classList.remove('hide');
            bubbleElement.classList.add('show');

            logDebug('ふにゃ吹き出しを表示: ' + message);
        } else {
            // 非表示
            bubbleElement.classList.remove('show');
            bubbleElement.classList.add('hide');

            logDebug('ふにゃ吹き出しを非表示');
        }
    }
}

/**
 * ステータス確認と吹き出し制御
 */
async function checkFunyaStatus() {
    try {
        const status = await getFunyaStatus();
        updateBubbleVisibility(status.watching);
    } catch (error) {
        logDebug('ふにゃステータス取得エラー:', error);
        // エラー時は吹き出しを非表示
        updateBubbleVisibility(false);
    }
}

/**
 * ふにゃ見守りモードのポーリングを開始
 */
export function startFunyaWatchingMode() {
    logDebug('ふにゃ見守りモードを開始');

    // 初回実行
    checkFunyaStatus();

    // 既存のポーリングがあれば停止
    if (pollingInterval) {
        clearInterval(pollingInterval);
    }

    // ポーリングを開始
    pollingInterval = setInterval(checkFunyaStatus, POLLING_INTERVAL);
}

/**
 * ふにゃ見守りモードのポーリングを停止
 */
export function stopFunyaWatchingMode() {
    logDebug('ふにゃ見守りモードを停止');

    // ポーリングを停止
    if (pollingInterval) {
        clearInterval(pollingInterval);
        pollingInterval = null;
    }

    // 吹き出しを非表示
    updateBubbleVisibility(false);
}

// アプリの起動時に自動的に開始
document.addEventListener('DOMContentLoaded', () => {
    logDebug('ふにゃ見守りモードを自動起動');
    startFunyaWatchingMode();
});

// モジュールのエクスポート
export default {
    startFunyaWatchingMode,
    stopFunyaWatchingMode
}; 