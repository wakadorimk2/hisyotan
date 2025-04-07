/**
 * speechBridge.js
 * 
 * 旧吹き出しUIから新しいふにゃ吹き出しUIへの移行をスムーズにするためのブリッジモジュール
 * このファイルは互換性のために旧APIを新しいふにゃ吹き出しに橋渡しします
 */

import { showFunyaBubble, hideFunyaBubble } from './funyaBubble.js';
import { logDebug } from '../../core/logger.js';

/**
 * 旧APIの showBubble を新しいふにゃ吹き出しに橋渡し
 * @param {string} type - 吹き出しタイプ
 * @param {string} text - 表示テキスト
 * @param {boolean} textForceSet - 互換性のため残しているが使用しない
 */
export function showBubble(type = 'default', text = 'こんにちは！何かお手伝いしましょうか？', textForceSet = true) {
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

    // 新しいふにゃ吹き出しAPIを呼び出し
    showFunyaBubble(decoratedText);
}

/**
 * 旧APIの setText を新しいふにゃ吹き出しに橋渡し
 * @param {string} text - 表示テキスト
 */
export function setText(text) {
    if (!text) {
        logDebug('setText: テキストが空です');
        return;
    }

    logDebug(`🔄 旧API setText から新API showFunyaBubble へブリッジ: "${text.substring(0, 15)}..."`);

    // 新しいふにゃ吹き出しAPIを呼び出し（非表示状態なら表示する）
    showFunyaBubble(text);
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
    showFunyaBubble('ホードモード設定は現在移行中です✨');
}

// 注: 循環参照を避けるためにデフォルトエクスポートは行わない
// export default {
//     showBubble,
//     setText,
//     hideBubble,
//     clearText,
//     showHordeModeSettings
// }; 