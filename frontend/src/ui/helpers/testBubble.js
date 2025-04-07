/**
 * testBubble.js
 * ふにゃ吹き出し統合テスト用ファイル
 */

// 旧API（speechBridge.js経由）
import { showBubble, setText, hideBubble } from './speechBridge.js';

// 新API（funyaBubble.js）
import { showFunyaBubble, hideFunyaBubble } from './funyaBubble.js';

// ロガー
import { logDebug } from '../../core/logger.js';

/**
 * 吹き出しテスト関数
 * @param {string} testType - テストタイプ
 */
export function testBubble(testType = 'all') {
    logDebug(`🧪 吹き出しテスト開始: ${testType}`);

    // 旧APIテスト
    if (testType === 'old' || testType === 'all') {
        logDebug('🧪 旧API（speechBridge.js）テスト:');

        // showBubbleテスト
        setTimeout(() => {
            logDebug('- showBubble(default) テスト');
            showBubble('default', '旧APIを使って表示しています！');
        }, 500);

        // showBubble + typeテスト
        setTimeout(() => {
            logDebug('- showBubble(warning) テスト');
            showBubble('warning', '警告メッセージテスト');
        }, 6500);

        // setTextテスト
        setTimeout(() => {
            logDebug('- setText テスト');
            setText('setTextで更新したメッセージ');
        }, 12500);

        // hideBubbleテスト
        setTimeout(() => {
            logDebug('- hideBubble テスト');
            hideBubble();
        }, 18500);
    }

    // 新APIテスト
    if (testType === 'new' || testType === 'all') {
        logDebug('🧪 新API（funyaBubble.js）テスト:');

        // 少し遅らせて新APIテスト開始
        const startDelay = testType === 'all' ? 20000 : 500;

        // showFunyaBubbleテスト
        setTimeout(() => {
            logDebug('- showFunyaBubble テスト');
            showFunyaBubble('新しいふにゃ吹き出しAPIを使って表示しています！✨');
        }, startDelay);

        // 引数なしのshowFunyaBubbleテスト
        setTimeout(() => {
            logDebug('- showFunyaBubble（引数なし） テスト');
            showFunyaBubble();
        }, startDelay + 6000);

        // カスタム表示時間
        setTimeout(() => {
            logDebug('- showFunyaBubble（カスタム表示時間） テスト');
            showFunyaBubble('この吹き出しは10秒間表示されます…💤', 10000);
        }, startDelay + 12000);

        // 手動で非表示
        setTimeout(() => {
            logDebug('- hideFunyaBubble テスト');
            hideFunyaBubble();
        }, startDelay + 15000);
    }

    logDebug('🧪 吹き出しテストキューをセットアップしました');
    return '吹き出しテストを開始しました。コンソールを確認してください。';
}

// 名前付きエクスポートを使用
export { testBubble }; 