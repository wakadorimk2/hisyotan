import { setupPawButtonEvents } from './pawButtonHandler.js';
import { handleQuitButtonClick } from './quitButtonHandler.js';
import * as emotionalBridge from '../../emotion/emotionalBridge.js';
import { logDebug } from '../../core/logger.js';
import { getRandomCutePhrase } from '../../emotion/emotionHandler.js';
import { playPresetSound } from '../../emotion/audioReactor.js';

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
    // ドラッグとクリックの競合を解決
    imgElement.style.webkitAppRegion = 'no-drag'; // drag→no-dragに変更

    // 立ち絵本体にクリックイベントをより明示的に設定
    imgElement.style.pointerEvents = 'auto';

    imgElement.addEventListener('contextmenu', (event) => {
      event.preventDefault();
      console.log('🖼️ 立ち絵が右クリックされました - 右クリックメニューを無効化');
    });

    // 立ち絵のクリックイベントを追加
    imgElement.addEventListener('click', (event) => {
      // デバッグログを追加
      console.log('🖼️ 立ち絵がクリックされました！', { x: event.clientX, y: event.clientY });

      // クリック操作を優先するため、ドラッグフラグがある場合はスキップ
      if (imgElement._isDragging) {
        console.log('🖼️ ドラッグ中のためクリックをスキップします');
        return;
      }

      // クールタイムチェック（連打防止）- UI表示用
      const now = Date.now();
      const lastClick = imgElement._lastClickTime || 0;
      const cooldown = 800; // UIポーズ変更のクールタイム（0.8秒）

      if (now - lastClick < cooldown) {
        logDebug('クリック連打防止: クールタイム中のためスキップします');
        return;
      }

      imgElement._lastClickTime = now;
      logDebug('立ち絵がクリックされました - 指さしポーズをランダム設定します');

      // 指さしポーズをランダムに設定
      try {
        emotionalBridge.setRandomTag('pose', 'POINTING');
        console.log('🖼️ 指さしポーズをランダムに設定しました');

        // 「ぴょこっ」効果音を再生（クールダウンは audioReactor 側で制御）
        playPresetSound('funya').then(() => {
          logDebug('「ぴょこっ」効果音を再生しました');
        }).catch(error => {
          console.error('効果音再生エラー:', error);
        });
      } catch (error) {
        console.error('❌ 指さしポーズ設定中にエラーが発生しました:', error);
      }
    });

    // ドラッグ処理を設定
    setupDragBehavior(imgElement);

    console.log('🖼️ assistantImageのイベント設定が完了しました');
  } else {
    console.log('ℹ️ assistantImageが見つかりません。UI初期化後に再試行します');
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

  // 処理済みフラグを設定
  window._eventListenersInitialized = true;
  console.log('🔄 イベントリスナーの設定が完了しました');
}

// ドラッグ処理の設定を分離
function setupDragBehavior(element) {
  if (!element) return;

  let isDragging = false;
  let startPos = { x: 0, y: 0 };

  // マウスダウン時の処理
  element.addEventListener('mousedown', (e) => {
    // 左クリックの場合のみドラッグ処理を行う
    if (e.button === 0) {
      // 開始位置を記録
      startPos = { x: e.clientX, y: e.clientY };
      console.log('🖱️ 立ち絵のマウスダウンを検出', startPos);
    }
  });

  // マウス移動時の処理
  document.addEventListener('mousemove', (e) => {
    // 左ボタンが押されている場合のみドラッグ判定
    if (e.buttons === 1 && startPos.x !== 0) {
      // 少し動いたらドラッグと判定
      const diffX = Math.abs(e.clientX - startPos.x);
      const diffY = Math.abs(e.clientY - startPos.y);

      // 5px以上動いたらドラッグと判定
      if (diffX > 5 || diffY > 5) {
        element._isDragging = true;

        // Electronにウィンドウドラッグの開始を通知
        if (window.electron && window.electron.ipcRenderer) {
          window.electron.ipcRenderer.send('start-window-drag');
        }
      }
    }
  });

  // マウスアップ時の処理
  document.addEventListener('mouseup', () => {
    // フラグをリセット
    setTimeout(() => {
      element._isDragging = false;
      startPos = { x: 0, y: 0 };
    }, 100);
  });
}

// 終了ボタンのイベント設定を分離
export function setupQuitButtonEvents(quitButton) {
  quitButton.addEventListener('click', () => {
    console.log('🚪 終了ボタンがクリックされました');
    handleQuitButtonClick();
  });
}
