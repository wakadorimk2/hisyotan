// assistantImageHandler.js

import { setupDragBehavior } from '@shared/ui/dragHelpers.js';

export function setupAssistantImageEvents(imgElement) {
    if (!imgElement || !(imgElement instanceof HTMLElement)) {
      console.warn('❌ 無効な assistantImage が渡されました');
      return;
    }
  
    console.log('🖼️ assistantImage にイベントを設定します');
  
    // ここからイベントリスナーの追加を書くよ〜！
    // クリック、右クリック、ドラッグなど…
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
        logDebug('立ち絵がクリックされました - 反応処理を開始します');

        try {
        // 30%の確率で「ふにゃ」プリセット音声を冒頭に挿入
        const isFunyaMode = Math.random() < 0.3;

        // 1. 表情差分をランダムに切り替え
        // 利用可能な表情タグ: DEFAULT, HAPPY, SURPRISED, SERIOUS, SLEEPY, RELIEVED, SMILE, ANGRY
        const expressions = ['DEFAULT', 'HAPPY', 'SURPRISED', 'SERIOUS', 'SLEEPY', 'RELIEVED', 'SMILE', 'ANGRY'];
        const randomExpression = expressions[Math.floor(Math.random() * expressions.length)];

        if (isFunyaMode) {
            // 「ふにゃ」モードの場合
            console.log('🐈 「ふにゃ」モード発動！');

            // 先に「ふにゃ」効果音を再生
            playPresetSound('funya').then(() => {
            logDebug('「ふにゃ」効果音を再生しました');

            // 表情を驚きに変更
            emotionalBridge.setExpressionByTag('SURPRISED');

            // 少し遅延させてからランダムセリフを再生
            setTimeout(() => {
                speakRandomLine();
                // 表情をランダムに変更
                emotionalBridge.setExpressionByTag(randomExpression);
            }, 1200);
            }).catch(error => {
            console.error('効果音再生エラー:', error);
            });
        } else {
            // 通常モードの場合は直接ランダムセリフと表情変更
            speakRandomLine();
            emotionalBridge.setExpressionByTag(randomExpression);
        }

        // 指さしポーズもランダムに設定（既存機能を維持）
        // 問題発生のため、ポーズはNEUTRALに固定
        emotionalBridge.setPose('NEUTRAL');
        console.log('🖼️ ポーズをNEUTRALに設定しました');
        } catch (error) {
        console.error('❌ キャラクター反応処理中にエラーが発生しました:', error);
        }
    });

    // ドラッグ処理を設定
    setupDragBehavior(imgElement);

    console.log('🖼️ assistantImageのイベント設定が完了しました');
    } else {
    console.log('ℹ️ assistantImageが見つかりません。UI初期化後に再試行します');
    }
  }
  