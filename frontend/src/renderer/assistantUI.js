/**
 * assistantUI.js
 * アシスタントUIの初期化と制御
 */

// 必要なモジュールのインポート
import { createUI } from '../ui/helpers/uiBuilder.js';
import { showHordeModeSettings, showBubble, setText } from '../ui/helpers/speechBridge.js';
import { showAssistantImage } from '../ui/helpers/assistantImage.js';
import { cleanupDuplicateElements, verifyAndFixUIStructure } from '../ui/helpers/uiVerifier.js';

// スタイルシートをインポート
import '@ui/styles/main.css';
// CSS変数のある変数ファイルも直接インポート
import '@ui/styles/base/_variables.css';
// 立ち絵・吹き出し用コンポーネントスタイルも明示的にインポート
import '@ui/styles/components/_assistant.css';
// 肉球ボタン用スタイルを明示的にインポート
import '@ui/styles/components/_paw-button.css';




// エクスポート
export {
  showHordeModeSettings,
  setText,
  showBubble
};

// DOMの読み込み完了後にUIを初期化
let domInitialized = false;

document.addEventListener('DOMContentLoaded', () => {
  // 多重初期化の防止
  if (domInitialized) {
    console.log('🔄 DOMContentLoadedは既に処理済みです。処理をスキップします。');
    return;
  }

  // 初期化フラグを設定
  domInitialized = true;

  console.log('🌟 DOMContentLoaded: assistantUI初期化を開始します');

  // すでに初期化済みかどうかをフラグで確認
  if (window._assistantUIInitialized) {
    console.log('🔄 UI要素はすでに初期化済みです。再初期化をスキップします。');
    return;
  }

  // 重複要素のクリーンアップを最初に実行
  cleanupDuplicateElements();

  // 旧吹き出しUI要素（ゾンビBubble）を削除
  const zombieBubble = document.getElementById('speechBubble');
  if (zombieBubble) {
    console.warn('💀 旧吹き出しを除霊します');
    zombieBubble.remove();
  }

  // DOM構造やCSSをチェックし、問題があれば修正
  setTimeout(() => {
    verifyAndFixUIStructure();
  }, 300);

  // すでにDOMに存在する要素を確認
  if (!document.getElementById('assistantImage')) {
    console.log('🎨 UIを新規作成します');
    createUI();
  } else {
    console.log('♻️ 既存のUI要素を再利用します');
  }

  // 立ち絵を表示
  setTimeout(() => {
    showAssistantImage();

    // ウェルカムメッセージを設定し、自動非表示を防止
    const welcomeMessage = 'こんにちは！何かお手伝いしましょうか？';
    console.log('🌸 ウェルカムメッセージを表示します:', welcomeMessage);

    // 安定したウェルカムメッセージ表示（遅延処理）
    setTimeout(() => {
      // 吹き出し要素の取得
      const bubble = document.getElementById('speechBubble');
      const textElement = document.getElementById('speechText');

      if (bubble && textElement) {
        // 吹き出しを表示状態に設定
        bubble.style.cssText = `
          display: flex !important; 
          visibility: visible !important; 
          opacity: 1 !important;
          z-index: 9999 !important;
        `;
        bubble.classList.add('speech-bubble', 'show', 'fixed-position');

        // setText関数を使用してウェルカムメッセージを設定
        setText(welcomeMessage);

        // データ属性に初期メッセージであることを記録
        textElement.dataset.isWelcomeMessage = 'true';

        // 吹き出しが非表示にならないように監視
        startWelcomeMessageProtection();
      } else {
        console.error('speechBubbleまたはspeechText要素が見つかりません');
      }
    }, 500);
  }, 100);

  // 初期化済みフラグを設定
  window._assistantUIInitialized = true;

  console.log('🌸 assistantUI初期化完了');
});



/**
 * ウェルカムメッセージの保護機能
 * 初期化後の一定時間、ウェルカムメッセージが消えないようにする
 */
function startWelcomeMessageProtection() {
  console.log('🛡️ ウェルカムメッセージ保護を開始します');

  // 保護期間（5秒）
  const PROTECTION_DURATION = 5000;

  // メッセージが消えていないか定期的にチェック
  const textRestoreInterval = setInterval(() => {
    const textElement = document.getElementById('speechText');
    const bubble = document.getElementById('speechBubble');

    if (textElement && bubble) {
      // テキストが空になっていないか確認
      if (!textElement.textContent || textElement.textContent.trim() === '') {
        // データ属性から元のテキストを取得
        const originalText = textElement.dataset.originalText;

        if (originalText) {
          console.log(`🔄 空になったウェルカムメッセージを復元します: "${originalText}"`);

          // setText関数を使用してテキストを復元
          setText(originalText);

          // 吹き出しも表示状態に戻す
          bubble.style.cssText = `
            display: flex !important; 
            visibility: visible !important; 
            opacity: 1 !important;
            z-index: 9999 !important;
          `;
          bubble.classList.add('show');
          bubble.classList.remove('hide');
        }
      }
    }
  }, 100);

  // 保護期間後に監視を終了
  setTimeout(() => {
    clearInterval(textRestoreInterval);
    console.log('🛡️ ウェルカムメッセージ保護期間が終了しました');
  }, PROTECTION_DURATION);
}

/**
 * アシスタントUIの初期化処理
 */
export function initAssistantUI() {
  // DOMContentLoadedイベントを待つ
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeUI);
  } else {
    initializeUI();
  }
}

function initializeUI() {
  const speechBubble = document.getElementById('speechBubble');
  const speechText = document.getElementById('speechText');

  if (!speechBubble || !speechText) {
    console.error('必要なDOM要素が見つかりません');
    return;
  }

  // 初期化処理
  console.log('🌸 assistantUI初期化開始');

  // ウェルカムメッセージの設定
  const welcomeMessage = 'こんにちは！ふにゃと一緒に楽しく過ごしましょうね！';
  setText(welcomeMessage);

  // データ属性に初期メッセージであることを記録
  speechText.dataset.isWelcomeMessage = 'true';

  // 吹き出しが非表示にならないように監視
  startWelcomeMessageProtection();

  // 初期化済みフラグを設定
  window._assistantUIInitialized = true;

  console.log('🌸 assistantUI初期化完了');
} 