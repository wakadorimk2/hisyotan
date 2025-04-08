import { setupPawButtonEvents } from './pawButtonHandler.js';
import { handleQuitButtonClick } from './quitButtonHandler.js';
import * as emotionalBridge from '@emotion/emotionalBridge.js';
import { logDebug } from '@core/logger.js';
import { getRandomCutePhrase } from '@emotion/emotionHandler.js';
import { playPresetSound } from '@emotion/audioReactor.js';
import { showHordeModeSettings } from '@renderer/assistantUI.js';
import { showFunyaBubble } from '../helpers/funyaBubble.js';

// 処理済みフラグ
let _eventListenersInitialized = false;

// イベントリスナーの設定を分離
export function setupEventListeners() {
  // ガード処理 - すでにリスナーが設定されているかをチェック
  if (_eventListenersInitialized) {
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

  // volumeButton
  const volumeBtn = document.getElementById('volumeControlIcon') || volumeButton;
  if (volumeBtn) {
    console.log('🔊 volumeButtonにイベントリスナーを設定します');
    setupVolumeButtonEvents(volumeBtn);
  } else {
    console.log('ℹ️ volumeButtonが見つかりません。UI初期化後に再試行します');
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

  // 吹き出し
  const bubble = document.getElementById('speechBubble');
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
  _eventListenersInitialized = true;
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

// 音量ボタンのイベント設定を分離
export function setupVolumeButtonEvents(volumeButton) {
  // ボタンクリックイベント
  volumeButton.addEventListener('click', () => {
    console.log('🔊 音量ボタンがクリックされました');
    handleVolumeButtonClick();
  });

  // スライダーイベントリスナーを設定
  const slider = document.getElementById('volumeSlider');
  if (slider) {
    slider.addEventListener('input', handleVolumeSliderChange);
    slider.addEventListener('change', handleVolumeSliderChange);

    // 初期値の設定（ローカルストレージから復元）
    const savedVolume = localStorage.getItem('assistantVolume');
    if (savedVolume) {
      slider.value = savedVolume;
      // 初期値を適用
      if (window.electron && window.electron.ipcRenderer) {
        window.electron.ipcRenderer.send('set-volume', parseInt(savedVolume, 10));
      }
    }
  }

  // ドキュメントクリックで音量メニューを閉じる
  document.addEventListener('click', (event) => {
    const popup = document.getElementById('volumeControlPopup');
    const icon = document.getElementById('volumeControlIcon');

    // ポップアップやアイコン以外をクリックした場合は閉じる
    if (popup && popup.classList.contains('active') &&
      !popup.contains(event.target) &&
      event.target !== icon) {
      popup.classList.remove('active');
      if (icon) icon.classList.remove('popup-active');
    }
  });
}

// 音量スライダー変更ハンドラ
function handleVolumeSliderChange(event) {
  const volume = event.target.value;
  console.log(`🔊 音量を ${volume}% に設定します`);

  // ローカルストレージに保存
  localStorage.setItem('assistantVolume', volume);

  // Electronメインプロセスに音量変更を通知
  if (window.electron && window.electron.ipcRenderer) {
    window.electron.ipcRenderer.send('set-volume', parseInt(volume, 10));
  }
}

// 音量ボタンのクリックハンドラ
function handleVolumeButtonClick() {
  console.log('🔊 音量ボタンがクリックされました');

  // 音量ポップアップを取得
  const popup = document.getElementById('volumeControlPopup');

  // デバッグ: popup要素の状態を詳細に出力
  console.log('📊 volumePopup要素の詳細状態:', {
    found: popup !== null,
    element: popup,
    inDOM: popup ? document.body.contains(popup) : false,
    display: popup ? getComputedStyle(popup).display : 'N/A',
    opacity: popup ? getComputedStyle(popup).opacity : 'N/A',
    visibility: popup ? getComputedStyle(popup).visibility : 'N/A'
  });

  if (!popup) {
    console.error('❌ 音量ポップアップが見つかりません');
    showFunyaBubble('ごめんね、音量設定はまだ開発中です🐈️', 3000);
    return;
  }

  // アイコンも取得（スタイル変更のため）
  const icon = document.getElementById('volumeControlIcon');

  // ポップアップの表示/非表示を切り替え
  if (popup.classList.contains('active')) {
    // 非表示にする
    popup.classList.remove('active');
    // インラインスタイルでも非表示に設定（CSSが効かない場合の対策）
    popup.style.opacity = '0';
    popup.style.transform = 'translateY(10px) scale(0.8)';
    popup.style.pointerEvents = 'none';

    if (icon) {
      icon.classList.remove('popup-active');
      // アイコンもデフォルト状態に戻す
      icon.style.background = 'rgba(255, 255, 255, 0.5)';
    }
    logDebug('音量ポップアップを閉じました');
  } else {
    // 表示する
    popup.classList.add('active');
    // インラインスタイルでも表示に設定（CSSが効かない場合の対策）
    popup.style.opacity = '1';
    popup.style.transform = 'translateY(-5px) scale(1)';
    popup.style.pointerEvents = 'all';

    if (icon) {
      icon.classList.add('popup-active');
      // アイコンも活性化状態に
      icon.style.background = 'rgba(242, 235, 255, 0.9)';
    }
    logDebug('音量ポップアップを表示しました');

    // 短い案内メッセージを表示（初回のみ）
    if (!localStorage.getItem('volumeHintShown')) {
      localStorage.setItem('volumeHintShown', 'true');
      showFunyaBubble('ここで音量を調整できるよ✨', 3000);
    }
  }
}

// ランダムセリフを再生する関数
function speakRandomLine() {
  // speechManagerの存在確認
  if (window.speechManager) {
    // グローバルスコープから取得したSpeechManagerでランダムセリフを再生
    try {
      const phrases = [
        { text: "おつかれさま〜…ぎゅってしてあげたい気分なの", emotion: "soft" },
        { text: "すごいよ…ちゃんと頑張ってるの、見てるからね", emotion: "gentle" },
        { text: "ふにゃ…今日はのんびりしよ？", emotion: "soft" },
        { text: "ねぇ、ちょっとだけ甘えてもいい…？", emotion: "happy" },
        { text: "ここにいるからね。ひとりじゃないよ", emotion: "normal" },
        { text: "お水飲んだ？小休憩しよっか", emotion: "gentle" },
        { text: "えらいえらい…よしよしっ", emotion: "happy" },
        { text: "もし疲れたら、ぎゅってするからね🐾", emotion: "soft" }
      ];

      const phrase = phrases[Math.floor(Math.random() * phrases.length)];
      window.speechManager.speak(phrase.text, phrase.emotion, 5000, null, 'random_speak');
      logDebug(`セリフ再生: "${phrase.text}"`);
    } catch (error) {
      logDebug(`セリフ再生エラー: ${error.message}`);
    }
  } else if (window.showRandomLine) {
    // バックアップ: 古い関数を使用
    window.showRandomLine();
  } else {
    logDebug('セリフ再生機能が利用できません');
  }
}
