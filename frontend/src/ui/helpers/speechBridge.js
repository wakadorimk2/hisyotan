/**
 * speechBridge.js
 * 
 * 旧吹き出しUIから新しいふにゃ吹き出しUIへの移行をスムーズにするためのブリッジモジュール
 * このファイルは互換性のために旧APIを新しいふにゃ吹き出しに橋渡しします
 */

import { showFunyaBubble, hideFunyaBubble } from './funyaBubble.js';
import { logDebug } from '../../core/logger.js';
import { speak, speakWithObject } from '../../emotion/speechManager.js';
import { renderSettingUI } from './settingPanel.js';
import { showVolumeSettingInPanel } from './volumeControl.js';

// 無限ループ防止のためのフラグ
let isProcessingSpeech = false;

/**
 * 旧APIの showBubble を新しいふにゃ吹き出しに橋渡し
 * @param {string} type - 吹き出しタイプ
 * @param {string} text - 表示テキスト
 * @param {boolean} textForceSet - 互換性のため残しているが使用しない
 * @param {boolean} withVoice - テキストを音声で読み上げるかどうか
 */
export function showBubble(type = 'default', text = 'こんにちは！何かお手伝いしましょうか？', textForceSet = true, withVoice = true) {
    // 無限ループ防止：既に処理中の場合は早期リターン
    if (isProcessingSpeech) {
        logDebug(`🛑 既に音声処理中のため、showBubbleの二重実行を回避しました: ${type} - "${text.substring(0, 15)}..."`);
        return;
    }

    logDebug(`🔄 旧API showBubble から新API showFunyaBubble へブリッジ: ${type} - "${text.substring(0, 15)}..."`);

    // 特定のタイプに応じて絵文字を追加
    let decoratedText = text;
    if (type === 'warning') {
        decoratedText = `⚠️ ${text}`;
    } else if (type === 'error') {
        decoratedText = `❌ ${text}`;
    } else if (type === 'success') {
        decoratedText = `✅ ${text}`;
    } else if (type === 'zombie_warning') {
        decoratedText = `🧟 ${text}`;
    }

    // 新しいふにゃ吹き出しAPIを呼び出し（音声再生しないオプションで）
    showFunyaBubble(decoratedText, 5000, false);

    // テキストを音声で読み上げる（絵文字を除去）
    if (withVoice) {
        // 絵文字を除去してテキストだけを抽出
        const plainText = text.replace(/[\u{1F300}-\u{1F6FF}\u{1F900}-\u{1F9FF}]/gu, '').trim();
        if (plainText) {
            try {
                // 処理中フラグをセット
                isProcessingSpeech = true;

                // タイプに応じた感情パラメータを設定
                const emotion = type === 'warning' || type === 'zombie_warning' ? 'surprised' :
                    type === 'error' ? 'sad' :
                        type === 'success' ? 'happy' : 'normal';

                // speechManagerを使用して音声再生と吹き出し表示を統合
                speakWithObject({
                    text: plainText,
                    emotion: emotion,
                    type: type,
                    autoHide: false  // 吹き出しは自動で閉じない（funyaBubbleの自動タイマーに任せる）
                });

                logDebug(`🔊 テキストを音声で再生します: "${plainText}" (感情: ${emotion})`);
            } finally {
                // 処理が終わったら必ずフラグをリセット
                setTimeout(() => {
                    isProcessingSpeech = false;
                    logDebug('🔓 音声処理フラグをリセットしました');
                }, 500); // 少し遅延を入れてイベントの衝突を避ける
            }
        }
    }
}

/**
 * 旧APIの setText を新しいふにゃ吹き出しに橋渡し
 * @param {string} text - 表示テキスト
 * @param {boolean} withVoice - テキストを音声で読み上げるかどうか
 */
export function setText(text, withVoice = true) {
    if (!text) {
        logDebug('setText: テキストが空です');
        return;
    }

    // 無限ループ防止：既に処理中の場合は早期リターン
    if (isProcessingSpeech) {
        logDebug(`🛑 既に音声処理中のため、setTextの二重実行を回避しました: "${text.substring(0, 15)}..."`);
        return;
    }

    logDebug(`🔄 旧API setText から新API showFunyaBubble へブリッジ: "${text.substring(0, 15)}..."`);

    // 新しいふにゃ吹き出しAPIを呼び出し（音声再生しないオプションで）
    showFunyaBubble(text, 5000, false);

    // テキストを音声で読み上げる
    if (withVoice) {
        try {
            // 処理中フラグをセット
            isProcessingSpeech = true;

            // 絵文字を除去してテキストだけを抽出
            const plainText = text.replace(/[\u{1F300}-\u{1F6FF}\u{1F900}-\u{1F9FF}]/gu, '').trim();
            if (plainText) {
                // speechManagerを使用して音声再生
                speak(plainText);
                logDebug(`🔊 テキストを音声で再生します: "${plainText}"`);
            }
        } finally {
            // 処理が終わったら必ずフラグをリセット
            setTimeout(() => {
                isProcessingSpeech = false;
                logDebug('🔓 音声処理フラグをリセットしました');
            }, 500); // 少し遅延を入れてイベントの衝突を避ける
        }
    }
}

/**
 * 旧APIの hideBubble を新しいふにゃ吹き出しに橋渡し
 * @param {boolean} immediate - 即時非表示かどうか（旧APIとの互換性のため）
 */
export function hideBubble(immediate = false) {
    logDebug(`🔄 旧API hideBubble から新API hideFunyaBubble へブリッジ`);
    hideFunyaBubble();
}

/**
 * テキストをクリア（互換性のため）
 */
export function clearText() {
    logDebug('🔄 旧API clearText - 何もアクションは実行しません');
    // 新APIでは特に何もする必要はない
}

/**
 * ホードモード設定表示（互換性のため）
 * @param {boolean} currentValue - 現在の値
 * @param {Function} onChangeCallback - 変更時のコールバック
 */
export function showHordeModeSettings(currentValue = false, onChangeCallback = null) {
    logDebug('🔄 showHordeModeSettings - 現在はサポートされていません');
    // 現在はサポートされていないが、将来的に必要であれば実装する
    // 実装を促すメッセージを表示
    showFunyaBubble('ホードモード設定は現在移行中です✨', 5000, false);
    speak('ホードモード設定は現在移行中です');
}

/**
 * 音量設定パネルを表示する
 */
export function showVolumeSettings() {
    logDebug('🔊 音量設定パネルを表示します');

    try {
        // 音量設定のペイロードを取得
        const volumeSettingPayload = showVolumeSettingInPanel();

        // 設定パネルに表示
        renderSettingUI(volumeSettingPayload);

        // 説明メッセージを表示
        showFunyaBubble('音量をお好みの大きさに調整できます ✨', 5000, false);
    } catch (error) {
        logDebug(`音量設定パネル表示エラー: ${error.message}`);
        showFunyaBubble('音量設定の表示中にエラーが発生しました 😢', 3000, false);
    }
}

// 注: 循環参照を避けるためにデフォルトエクスポートは行わない
// export default {
//     showBubble,
//     setText,
//     hideBubble,
//     clearText,
//     showHordeModeSettings
// }; 