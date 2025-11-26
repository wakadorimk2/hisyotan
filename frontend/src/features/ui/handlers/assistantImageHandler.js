// assistantImageHandler.js

import { setupDragBehavior } from '@shared/ui/dragHelpers.js';
import { logDebug } from '@core/logger.js';

export function setupAssistantImageEvents(imgElement) {
  if (!imgElement || !(imgElement instanceof HTMLElement)) {
    console.warn('無効な assistantImage が渡されました');
    return;
  }

  console.log('🖼️ assistantImage にイベントを設定します');

  // ドラッグとクリックの競合を防ぎつつクリックを許可
  imgElement.style.webkitAppRegion = 'no-drag';
  imgElement.style.pointerEvents = 'auto';

  imgElement.addEventListener('contextmenu', (event) => {
    event.preventDefault();
    console.log('🖼️ 立ち絵が右クリックされました - 右クリックメニューを無効化');
  });

  // 立ち絵のクリックイベント
  imgElement.addEventListener('click', (event) => {
    console.debug('[Speech] character clicked');
    console.log('🖼️ 立ち絵がクリックされました', { x: event.clientX, y: event.clientY });

    // ドラッグ中はスキップ
    if (imgElement._isDragging) {
      console.log('🖼️ ドラッグ中のためクリックをスキップします');
      return;
    }

    // 連打防止
    const now = Date.now();
    const lastClick = imgElement._lastClickTime || 0;
    const cooldown = 800;

    if (now - lastClick < cooldown) {
      logDebug('クリック連打防止: クールタイム中のためスキップします');
      return;
    }

    imgElement._lastClickTime = now;
    logDebug('立ち絵がクリックされました - 反応処理を開始します');

    try {
      // 30% の確率で「ふにゃ」モード
      const isFunyaMode = Math.random() < 0.3;

      // 表情タグからランダムに選択
      const expressions = ['DEFAULT', 'HAPPY', 'SURPRISED', 'SERIOUS', 'SLEEPY', 'RELIEVED', 'SMILE', 'ANGRY'];
      const randomExpression = expressions[Math.floor(Math.random() * expressions.length)];

      if (isFunyaMode) {
        console.log('🐈 「ふにゃ」モード発動');

        playPresetSound('funya')
          .then(() => {
            logDebug('「ふにゃ」効果音を再生しました');
            emotionalBridge.setExpressionByTag('SURPRISED');

            setTimeout(() => {
              speakRandomLine();
              emotionalBridge.setExpressionByTag(randomExpression);
            }, 1200);
          })
          .catch((error) => {
            console.error('効果音再生エラー:', error);
          });
      } else {
        // 通常モード: ランダムセリフと表情変更
        speakRandomLine();
        emotionalBridge.setExpressionByTag(randomExpression);
      }

      // ポーズはNEUTRALに固定
      emotionalBridge.setPose('NEUTRAL');
      console.log('🖼️ ポーズをNEUTRALに設定しました');
    } catch (error) {
      console.error('キャラクター反応処理にエラーが発生しました:', error);
    }
  });

  // ドラッグ処理を設定
  setupDragBehavior(imgElement);

  console.log('🖼️ assistantImageのイベント設定が完了しました');
}
