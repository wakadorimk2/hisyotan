// layoutManager.js
// UIレイアウトの管理とポジション調整

import { logDebug } from '@core/logger.js';

/**
 * UI要素のレイアウトを更新する関数
 * 画面右下寄りに各UI要素を配置します
 */
export function updateLayoutPositions() {
  logDebug('UIレイアウト位置を更新します');

  // 要素の取得
  const quitButton = document.getElementById('quit-button');
  const pawButton = document.getElementById('paw-button');
  const assistantImage = document.getElementById('assistantImage');
  const speechBubble = document.getElementById('speechBubble');

  if (!quitButton || !pawButton || !assistantImage || !speechBubble) {
    logDebug('レイアウト調整: 一部のUI要素が見つかりません');
    return;
  }

  // 終了ボタンを右下に配置
  quitButton.style.position = 'fixed';
  quitButton.style.bottom = '15px';
  quitButton.style.right = '15px';
  quitButton.style.left = 'auto';
  quitButton.style.top = 'auto';

  // 肉球ボタンをその少し上に配置
  const quitButtonRect = quitButton.getBoundingClientRect();
  const pawButtonMargin = 15; // 余白

  pawButton.style.position = 'fixed';
  pawButton.style.bottom = `${quitButtonRect.height + pawButtonMargin + 15}px`; // 終了ボタンの上
  pawButton.style.right = `${15}px`;
  pawButton.style.left = 'auto';
  pawButton.style.top = 'auto';

  // 秘書たん立ち絵を肉球ボタンの上に配置
  const pawButtonRect = pawButton.getBoundingClientRect();
  const assistantMargin = 5; // 余白

  assistantImage.style.position = 'fixed';
  assistantImage.style.bottom = `${quitButtonRect.height + pawButtonRect.height + assistantMargin + 15}px`; // 肉球ボタンの上
  assistantImage.style.right = `${5}px`; // 右寄せ（少し余白）
  assistantImage.style.left = 'auto';
  assistantImage.style.top = 'auto';

  // 吹き出しを秘書たんの頭の上に相対的に配置
  const assistantRect = assistantImage.getBoundingClientRect();
  const bubbleMargin = 20; // 余白を増やす

  speechBubble.style.position = 'fixed';
  speechBubble.style.bottom = `${quitButtonRect.height + pawButtonRect.height + assistantRect.height + bubbleMargin + 15}px`; // 立ち絵に相対的に配置
  speechBubble.style.right = `${window.innerWidth - assistantRect.right + 5}px`; // 立ち絵に合わせて右寄せ
  speechBubble.style.left = 'auto';
  speechBubble.style.top = 'auto';
  speechBubble.style.zIndex = '9999'; // z-indexを高く設定
  speechBubble.style.display = 'flex'; // 常に表示
  speechBubble.style.visibility = 'visible'; // 常に可視
  speechBubble.style.opacity = '1'; // 不透明度を1に

  // 吹き出しの三角形部分の位置調整
  const bubbleAfter = document.querySelector('.speech-bubble:after');
  if (bubbleAfter) {
    bubbleAfter.style.left = 'auto';
    bubbleAfter.style.right = '40px';
  }

  logDebug('UIレイアウト位置の更新が完了しました');
}

/**
 * ウィンドウリサイズ時に動的にレイアウトを調整するためのイベントリスナーを設定
 */
export function setupLayoutManager() {
  logDebug('レイアウトマネージャーを初期化します');

  // 初期レイアウト設定
  updateLayoutPositions();

  // リサイズイベントのリスナーを設定
  window.addEventListener('resize', () => {
    updateLayoutPositions();
  });

  logDebug('レイアウトマネージャーの初期化が完了しました');

  return {
    updateLayout: updateLayoutPositions
  };
} 