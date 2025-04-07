import { setupPawButtonEvents } from './pawButtonHandler.js';
import { handleQuitButtonClick } from './quitButtonHandler.js';
import * as emotionalBridge from '../../emotion/emotionalBridge.js';
import { logDebug } from '../../core/logger.js';
import { speak } from '../../emotion/speechManager.js';
import { getRandomCutePhrase } from '../../emotion/emotionHandler.js';

// イベントリスナーの設定を分離
export function setupEventListeners() {
  // ガード処理 - すでにリスナーが設定されているかをチェック
  if (window._eventListenersInitialized) {
    console.log('🔄 イベントリスナーはすでに設定済みです');
    return;
  }

  // pawButton
  const pawBtn = document.getElementById('paw-button') || pawButton;
  if (pawBtn) {
    console.log('🐾 pawButtonにイベントリスナーを設定します');
    setupPawButtonEvents(pawBtn);
  } else {
    console.log('ℹ️ pawButtonが見つかりません。UI初期化後に再試行します');
  }

  // quitButton
  const quitBtn = document.getElementById('quit-button') || quitButton;
  if (quitBtn) {
    console.log('🚪 quitButtonにイベントリスナーを設定します');
    setupQuitButtonEvents(quitBtn);
  } else {
    console.log('ℹ️ quitButtonが見つかりません。UI初期化後に再試行します');
  }

  // 立ち絵と吹き出しのイベント設定
  const imgElement = document.getElementById('assistantImage') || assistantImage;
  if (imgElement instanceof HTMLElement) {
    console.log('🖼️ assistantImageにイベントリスナーを設定します');
    // CSS -webkit-app-regionを使用してドラッグ可能にする
    imgElement.style.webkitAppRegion = 'drag';

    imgElement.addEventListener('contextmenu', (event) => {
      event.preventDefault();
      console.log('🖼️ 立ち絵が右クリックされました - 右クリックメニューを無効化');
    });

    // 立ち絵のクリックイベントを追加
    imgElement.addEventListener('click', (event) => {
      // クリック操作を優先するため、ドラッグフラグがある場合はスキップ
      if (imgElement._isDragging) return;

      // クールタイムチェック（連打防止）
      const now = Date.now();
      const lastClick = imgElement._lastClickTime || 0;
      const cooldown = 1000; // 1秒間のクールタイム

      if (now - lastClick < cooldown) {
        logDebug('クリック連打防止: クールタイム中のためスキップします');
        return;
      }

      imgElement._lastClickTime = now;
      logDebug('立ち絵がクリックされました - 指さしポーズをランダム設定します');

      // 指さしポーズをランダムに設定
      emotionalBridge.setRandomTag('pose', 'POINTING');

      // かわいいセリフをランダムに表示
      const phraseObj = getRandomCutePhrase();
      if (phraseObj && phraseObj.text) {
        speak(phraseObj.text, 'normal', 5000);
      }
    });
  } else {
    console.log('ℹ️ assistantImage要素が見つかりません。UI初期化後に再試行します');
  }

  // 吹き出し
  const bubble = document.getElementById('speechBubble') || speechBubble;
  if (bubble instanceof HTMLElement) {
    console.log('💬 speechBubbleにイベントリスナーを設定します');
    // CSS -webkit-app-regionを使用してドラッグ可能にする
    bubble.style.webkitAppRegion = 'drag';

    bubble.addEventListener('contextmenu', (event) => {
      event.preventDefault();
      console.log('💬 吹き出しが右クリックされました - 右クリックメニューを無効化');
    });
  } else {
    console.log('ℹ️ speechBubble要素が見つかりません。UI初期化後に再試行します');
  }

  // 設定済みフラグを設定
  window._eventListenersInitialized = true;
}


// 終了ボタンのイベント設定を分離
export function setupQuitButtonEvents(quitButton) {
  quitButton.addEventListener('click', () => {
    console.log('🚪 終了ボタンがクリックされました');
    handleQuitButtonClick();
  });
}
