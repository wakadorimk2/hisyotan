/**
 * speechRenderer.js
 * 吹き出しテキスト描画専用モジュール
 * 
 * 責務：吹き出し内のテキスト表示のみを担当
 * - テキストの設定（setText）
 * - テキストのクリア（clearText）
 * - 表示状態の制御（showBubble, hideBubble）
 * 
 * 注意: このファイルは互換性のためだけに存在します。
 * 内部では funyaBubble.js の新しいAPIを使用しています。
 */

import {
    showBubble as bridgeShowBubble,
    setText as bridgeSetText,
    hideBubble as bridgeHideBubble,
    clearText as bridgeClearText
} from './speechBridge.js';

import { logDebug } from '../../core/logger.js';

/**
 * 吹き出しテキストを設定
 * @param {string} text - 表示テキスト
 */
export function setText(text) {
    logDebug(`[speechRenderer] setText → speechBridge → funyaBubble: ${text?.substring(0, 15) || '空'}...`);
    bridgeSetText(text);
}

/**
 * 吹き出しを表示する
 * @param {string} type - 吹き出しタイプ（default、warning、error、success、zombie_warningなど）
 * @param {string} text - 表示テキスト
 * @param {boolean} textForceSet - trueの場合、setText()を実行する。falseの場合は呼び出し元ですでにsetText()が実行されていると想定（デフォルト：true）
 */
export function showBubble(type = 'default', text = 'こんにちは！何かお手伝いしましょうか？', textForceSet = true) {
    logDebug(`[speechRenderer] showBubble → speechBridge → funyaBubble: ${type} - ${text?.substring(0, 15) || '空'}...`);
    bridgeShowBubble(type, text, textForceSet);
}

/**
 * 吹き出しを非表示にする
 * @param {boolean} immediate - 即時非表示かどうか
 */
export function hideBubble(immediate = false) {
    logDebug('[speechRenderer] hideBubble → speechBridge → funyaBubble');
    bridgeHideBubble(immediate);
}

/**
 * テキストをクリア
 */
export function clearText() {
    logDebug('[speechRenderer] clearText → speechBridge → funyaBubble');
    bridgeClearText();
}

// 名前付きエクスポートのみを使用し、循環参照を避ける
// export default {
//     setText,
//     showBubble,
//     hideBubble,
//     clearText
// }; 