/**
 * funyaBubble.js
 * ふにゃ見守りモード時の吹き出し表示を制御するモジュール
 */

import { getFunyaStatus } from '../../core/apiClient.js';
import { logDebug } from '../../core/logger.js';
import { updateBubblePosition } from './uiBuilder.js';
import { speak } from '../../emotion/speechManager.js';

// 設定値
const POLLING_INTERVAL = 30000; // 5秒ごとにステータスをチェック
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
let timeout = null; // 自動非表示タイマー用

// 音声再生済みフラグ (吹き出し表示と音声再生の分離のため)
let voicePlayedForCurrentBubble = false;

// 発話処理中フラグ（無限ループ防止用）
let isSpeakingInProgress = false;

// 最後に表示したテキストとタイムスタンプ（重複防止用）
let lastDisplayedText = '';
let lastDisplayedTime = 0;

// 吹き出しの自動非表示を無効にするフラグ
let keepBubbleVisibleFlag = false;

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
 * ふにゃ吹き出しの位置を立ち絵に合わせて更新する
 */
function updateFunyaBubblePosition() {
    const assistantImage = document.getElementById('assistantImage');
    const funyaBubble = document.getElementById('funyaBubble');

    if (!assistantImage || !funyaBubble) return;

    // 立ち絵の位置情報を取得
    const imageRect = assistantImage.getBoundingClientRect();
    const windowHeight = window.innerHeight;

    // 画面が小さい場合は上部に配置、それ以外は立ち絵の頭上に配置
    if (windowHeight < 600) {
        funyaBubble.style.top = '10px';
        funyaBubble.style.bottom = 'auto';
        funyaBubble.style.right = '10px';
    } else {
        funyaBubble.style.bottom = `${window.innerHeight - imageRect.top + 20}px`;
        funyaBubble.style.top = 'auto';
        funyaBubble.style.right = `${window.innerWidth - imageRect.right + 50}px`;
    }
}

/**
 * 吹き出しの表示状態を更新
 * @param {boolean} watching 見守り中かどうか
 * @param {boolean} withVoice テキストを音声で読み上げるかどうか
 */
function updateBubbleVisibility(watching, withVoice = true) {
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

            // 立ち絵の位置に合わせて吹き出しの位置を調整
            updateFunyaBubblePosition();

            logDebug('ふにゃ吹き出しを表示: ' + message);

            // テキストを音声で読み上げる
            if (withVoice && !voicePlayedForCurrentBubble) {
                // 絵文字を除去してテキストだけを抽出
                const plainText = message.replace(/[\u{1F300}-\u{1F6FF}\u{1F900}-\u{1F9FF}]/gu, '').trim();
                if (plainText) {
                    speak(plainText); // speechManagerを使用
                    voicePlayedForCurrentBubble = true;
                    logDebug(`🔊 ふにゃ見守りメッセージを音声で再生: "${plainText}"`);
                }
            }
        } else {
            // 非表示
            bubbleElement.classList.remove('show');
            bubbleElement.classList.add('hide');
            voicePlayedForCurrentBubble = false; // フラグをリセット
            logDebug('ふにゃ吹き出しを非表示');
        }
    }
}

/**
 * 任意のメッセージを表示する吹き出し
 * @param {string} text 表示するテキスト
 * @param {number} duration 表示時間（ミリ秒）デフォルトは5000ms
 * @param {boolean} withVoice テキストを音声で読み上げるかどうか
 * @param {string} emotion 音声の感情（'normal', 'happy', 'sad', 'surprised'など）
 * @returns {HTMLElement} 吹き出し要素
 */
export function showFunyaBubble(text, duration = 5000, withVoice = true, emotion = 'normal') {
    // 重複防止：直近で同じテキストが表示されていたら無視する（5秒以内）
    const now = Date.now();
    if (text === lastDisplayedText && now - lastDisplayedTime < 5000) {
        logDebug(`🛑 重複表示を防止しました: "${text?.substring(0, 15)}..." (前回から${now - lastDisplayedTime}ms)`);
        return bubbleElement;
    }

    // 表示テキストとタイムスタンプを記録
    lastDisplayedText = text || '';
    lastDisplayedTime = now;

    // 既存のタイマーをクリア
    if (timeout) {
        clearTimeout(timeout);
        timeout = null;
    }

    if (!bubbleElement) {
        bubbleElement = createBubbleElement();
        textElement = document.getElementById('funyaText');
    }

    // テキストを設定
    let displayText;
    if (text) {
        displayText = text;
        textElement.innerHTML = `<span class="funya-icon">🐾</span>${text}`;
    } else {
        displayText = getRandomMessage();
        textElement.innerHTML = `<span class="funya-icon">🐾</span>${displayText}`;
    }

    // 吹き出しを表示
    bubbleElement.classList.remove('hide');
    bubbleElement.classList.add('show');

    // 立ち絵の位置に合わせて吹き出しの位置を調整
    updateFunyaBubblePosition();

    logDebug(`ふにゃ吹き出しを表示: ${displayText || 'ランダムメッセージ'}`);

    // 音声再生は呼び出し元（speechBridge）に任せる
    // 直接呼び出した場合のみここで音声再生する
    if (withVoice && displayText && !voicePlayedForCurrentBubble && !isSpeakingInProgress) {
        try {
            // 発話処理中フラグをセット
            isSpeakingInProgress = true;

            // 絵文字を除去してテキストだけを抽出
            const plainText = displayText.replace(/[\u{1F300}-\u{1F6FF}\u{1F900}-\u{1F9FF}]/gu, '').trim();
            if (plainText) {
                // speechManagerを使用して音声再生
                speak(plainText);
                voicePlayedForCurrentBubble = true;
                logDebug(`🔊 ふにゃ吹き出しのテキストを音声で再生: "${plainText}"`);
            }
        } finally {
            // 処理が終わったらフラグをリセット
            setTimeout(() => {
                isSpeakingInProgress = false;
                logDebug('🔓 発話処理フラグをリセットしました');
            }, 500);
        }
    }

    // 指定時間後に自動的に非表示（強制表示モードでない場合のみ）
    if (!keepBubbleVisibleFlag) {
        timeout = setTimeout(() => {
            hideFunyaBubble();
        }, duration);
    } else {
        logDebug('🔒 吹き出しの自動非表示が無効化されているため、タイマーをセットしません');
    }

    return bubbleElement;
}

/**
 * 吹き出しを非表示にする
 */
export function hideFunyaBubble() {
    // 強制表示モードの場合は非表示にしない
    if (keepBubbleVisibleFlag) {
        logDebug('🔒 吹き出しの自動非表示が無効化されているため、非表示処理をスキップします');
        return;
    }

    if (bubbleElement) {
        bubbleElement.classList.remove('show');
        bubbleElement.classList.add('hide');
        voicePlayedForCurrentBubble = false; // フラグをリセット
        logDebug('ふにゃ吹き出しを非表示');
    }

    if (timeout) {
        clearTimeout(timeout);
        timeout = null;
    }
}

/**
 * ステータス確認と吹き出し制御
 * @param {boolean} withVoice テキストを音声で読み上げるかどうか
 */
async function checkFunyaStatus(withVoice = true) {
    try {
        const status = await getFunyaStatus();
        updateBubbleVisibility(status.watching, withVoice);
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

    // 立ち絵の位置変更を監視
    setupPositionObserver();
}

/**
 * 立ち絵の位置変更を監視する設定
 */
function setupPositionObserver() {
    // ResizeObserverを追加し、画面サイズ変更時に吹き出しの位置を調整
    const resizeObserver = new ResizeObserver(() => {
        if (isWatching || document.getElementById('funyaBubble')?.classList.contains('show')) {
            updateFunyaBubblePosition();
        }
    });
    resizeObserver.observe(document.body);

    // MutationObserverを使用して立ち絵の位置変更を監視
    const assistantObserver = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.type === 'attributes' &&
                (mutation.attributeName === 'style' || mutation.attributeName === 'class')) {
                if (isWatching || document.getElementById('funyaBubble')?.classList.contains('show')) {
                    updateFunyaBubblePosition();
                }
            }
        });
    });

    // 立ち絵の監視を開始
    setTimeout(() => {
        const imgElement = document.getElementById('assistantImage');
        if (imgElement) {
            assistantObserver.observe(imgElement, { attributes: true });
        }
    }, 100);
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

/**
 * 吹き出しの自動非表示を無効にする
 * 設定UIが表示されている間など、吹き出しを表示し続けたい場合に使用
 */
export function keepBubbleVisible() {
    keepBubbleVisibleFlag = true;
    logDebug('🔒 吹き出しの自動非表示を無効化しました');

    // 既存のタイマーをクリア
    if (timeout) {
        clearTimeout(timeout);
        timeout = null;
    }
}

/**
 * 吹き出しの自動非表示を有効に戻す
 */
export function allowBubbleHide() {
    keepBubbleVisibleFlag = false;
    logDebug('🔓 吹き出しの自動非表示を再有効化しました');
}

// アプリの起動時に自動的に開始
document.addEventListener('DOMContentLoaded', () => {
    logDebug('ふにゃ見守りモードを自動起動');
    startFunyaWatchingMode();
}); 