import { setupEventListeners } from '@features/ui/handlers/uiEventHandlers.js';
import { startFunyaWatchingMode } from '../helpers/funyaBubble.js';
import { createVolumeSlider } from '../helpers/volumeSlider.js';

// UI初期化フラグを共有
export let isUIInitialized = false;

/**
 * UI要素を作成してDOMに追加する
 */
export function createUI() {
  console.log('🎨 UI要素を作成します');

  // 既に要素が存在する場合はスキップ
  if (document.getElementById('assistant-container')) {
    console.log('既にUIコンテナーが存在します。スキップします');
    return;
  }

  // メインコンテナー
  const container = document.createElement('div');
  container.id = 'assistant-container';
  container.className = 'assistant-container';

  // キャラクターとセリフ用ラッパー
  const characterSpeechWrapper = document.createElement('div');
  characterSpeechWrapper.className = 'character-speech-wrapper';

  // 立ち絵
  const assistantImage = document.createElement('img');
  assistantImage.id = 'assistantImage';
  assistantImage.className = 'assistant-image active';
  assistantImage.src = '/assets/images/secretary_normal.png';
  assistantImage.alt = '秘書たん';
  assistantImage.style.width = '256px';
  assistantImage.style.height = 'auto';
  assistantImage.style.minHeight = '250px';
  assistantImage.style.webkitAppRegion = 'drag';
  assistantImage.style.imageRendering = 'auto';
  assistantImage.style.objectFit = 'contain';
  assistantImage.style.display = 'block';
  assistantImage.style.visibility = 'visible';
  assistantImage.style.opacity = '1';
  assistantImage.style.position = 'absolute';
  assistantImage.style.bottom = '0';
  assistantImage.style.right = '10px';
  assistantImage.style.zIndex = '1000';

  // 肉球ボタンのラッパー
  const pawButtonWrapper = document.createElement('div');
  pawButtonWrapper.className = 'paw-button-wrapper';
  pawButtonWrapper.style.webkitAppRegion = 'no-drag';
  pawButtonWrapper.style.position = 'fixed';
  pawButtonWrapper.style.bottom = '20px';
  pawButtonWrapper.style.right = '20px';
  pawButtonWrapper.style.zIndex = '9999';

  // 肉球ボタン背景
  const pawBackground = document.createElement('div');
  pawBackground.className = 'paw-background';
  pawButtonWrapper.appendChild(pawBackground);

  // 肉球ボタン
  const pawButton = document.createElement('button');
  pawButton.id = 'paw-button';
  pawButton.textContent = '🐾';
  pawButton.setAttribute('role', 'button');
  pawButton.setAttribute('tabindex', '0');
  pawButton.setAttribute('aria-label', '話しかける');
  pawButton.style.webkitAppRegion = 'no-drag';
  pawButton.style.cursor = 'pointer';
  pawButtonWrapper.appendChild(pawButton);

  pawButton.addEventListener('mouseover', () => {
    pawButton.style.transform = 'scale(1.1) translateY(-5px)';
  });
  pawButton.addEventListener('mouseout', () => {
    pawButton.style.transform = 'scale(1)';
  });
  pawButton.addEventListener('mousedown', () => {
    pawButton.style.transform = 'scale(0.95)';
  });
  pawButton.addEventListener('mouseup', () => {
    pawButton.style.transform = 'scale(1)';
  });

  // 終了ボタン
  const quitButton = document.createElement('button');
  quitButton.id = 'quit-button';
  quitButton.textContent = '✕';
  quitButton.setAttribute('role', 'button');
  quitButton.setAttribute('tabindex', '0');
  quitButton.setAttribute('aria-label', '閉じる');
  quitButton.style.webkitAppRegion = 'no-drag';

  quitButton.addEventListener('mouseover', () => {
    quitButton.style.opacity = '1';
  });
  quitButton.addEventListener('mouseout', () => {
    quitButton.style.opacity = '0.8';
  });

  // 音量ボタンとポップアップ
  const volumeButton = document.createElement('button');
  volumeButton.id = 'volumeControlIcon';
  volumeButton.type = 'button';
  volumeButton.textContent = '🔊';
  volumeButton.setAttribute('aria-label', '音量を調整する');
  volumeButton.style.webkitAppRegion = 'no-drag';

  const volumePopup = document.createElement('div');
  volumePopup.id = 'volumeControlPopup';
  volumePopup.className = 'volume-popup';

  // 音量スライダーを作成（volumeSlider.jsから取得）
  const { slider: volumeSlider } = createVolumeSlider();
  if (volumeSlider) {
    volumePopup.appendChild(volumeSlider);
  } else {
    console.warn('⚠️ volumeSliderが生成できませんでした');
  }

  // 要素をラッパーに追加
  characterSpeechWrapper.appendChild(assistantImage);

  // ラッパーをコンテナーに追加
  container.appendChild(characterSpeechWrapper);
  container.appendChild(pawButtonWrapper);
  container.appendChild(quitButton);
  container.appendChild(volumeButton);
  container.appendChild(volumePopup);

  // コンテナーをドキュメントに追加
  document.body.appendChild(container);

  // グローバル変数に要素を割り当て（イベントハンドラ側で参照）
  window.pawButton = pawButton;
  window.quitButton = quitButton;
  window.volumeButton = volumeButton;
  window.volumePopup = volumePopup;
  window.assistantImage = assistantImage;
  window.characterSpeechWrapper = characterSpeechWrapper;

  globalThis.pawButton = pawButton;
  globalThis.quitButton = quitButton;
  globalThis.volumeButton = volumeButton;
  globalThis.volumePopup = volumePopup;
  globalThis.assistantImage = assistantImage;
  globalThis.characterSpeechWrapper = characterSpeechWrapper;

  // イベントリスナーの設定（DOMに追加された後）
  setTimeout(() => {
    console.log('🔄 イベントリスナーを設定します');
    setupEventListeners();
  }, 50);

  // funyaBubbleを初期化
  setTimeout(() => {
    startFunyaWatchingMode();
    console.log('🌸 funyaBubbleを初期化しました');
  }, 100);

  // 立ち絵のスタイル変更を監視
  const assistantObserver = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (
        mutation.type === 'attributes' &&
        (mutation.attributeName === 'style' || mutation.attributeName === 'class')
      ) {
        // 位置変更があった場合の処理は必要に応じて追加
      }
    });
  });

  setTimeout(() => {
    const imgElement = document.getElementById('assistantImage');
    if (imgElement) {
      assistantObserver.observe(imgElement, { attributes: true });
    }
  }, 100);

  console.log('✨ UI要素の作成が完了しました');
}

/**
 * UI要素の初期化処理
 * 既存要素を再利用し、なければ作成する
 */
export function initUIElements() {
  console.log('🌸 assistantUI: UI要素を初期化します');

  if (typeof isUIInitialized !== 'undefined' && isUIInitialized && document.getElementById('paw-button')) {
    console.log('🔄 UI要素はすでに初期化済みです');
    return;
  }

  // UI要素の事前定義
  const uiElements = {
    assistantImage: { id: 'assistantImage', type: 'img' },
    pawButton: { id: 'paw-button', type: 'button' },
    quitButton: { id: 'quit-button', type: 'button' },
    volumeButton: { id: 'volumeControlIcon', type: 'button' },
    volumePopup: { id: 'volumeControlPopup', type: 'div' },
    errorBubble: { id: 'errorBubble', type: 'div' },
    errorText: { id: 'errorText', type: 'div' }
  };

  // 旧吹き出しUI要素を削除
  const zombieBubble = document.getElementById('speechBubble');
  if (zombieBubble) {
    console.warn('💀 uiBuilder: 旧吹き出しを除霊します');
    zombieBubble.remove();
  }

  // UI要素の初期化
  const elements = {};

  for (const [key, { id, type }] of Object.entries(uiElements)) {
    let element = document.getElementById(id);

    if (!element) {
      console.log(`✏ ${id}要素を作成します`);
      element = document.createElement(type);
      element.id = id;

      switch (id) {
        case 'errorBubble':
          element.className = 'error-bubble';
          break;
        case 'errorText':
          element.className = 'error-text';
          break;
        case 'volumeControlPopup':
          element.className = 'volume-popup';
          break;
        case 'volumeControlIcon':
          element.type = 'button';
          element.textContent = '🔊';
          element.setAttribute('aria-label', '音量を調整する');
          element.style.webkitAppRegion = 'no-drag';
          break;
        default:
          break;
      }

      document.body.appendChild(element);
    }

    elements[key] = element;

    // グローバル変数に要素を保持
    if (key === 'pawButton') window.pawButton = element;
    if (key === 'quitButton') window.quitButton = element;
    if (key === 'volumeButton') window.volumeButton = element;
    if (key === 'volumePopup') window.volumePopup = element;
    if (key === 'assistantImage') window.assistantImage = element;
  }

  // イベントリスナーの設定
  setTimeout(() => {
    try {
      console.log('🔄 イベントリスナーを遅延設定します');
      setupEventListeners();
    } catch (error) {
      console.error('❌ イベントリスナー設定中にエラーが発生しました:', error);
    }

    // 音量コントロールの初期化
    try {
      import('../helpers/volumeControl.js')
        .then((module) => {
          if (typeof module.initVolumeControl === 'function') {
            console.log('🔊 音量コントロールを初期化します');
            module.initVolumeControl();
          }
        })
        .catch((err) => {
          console.error('❌ 音量コントロールモジュールの読み込みに失敗', err);
        });
    } catch (err) {
      console.error('❌ 音量コントロール初期化エラー:', err);
    }
  }, 300);

  // funyaBubbleを初期化
  setTimeout(() => {
    startFunyaWatchingMode();
    console.log('🌸 funyaBubbleを初期化しました');
  }, 150);

  // 初期化済みフラグをセット
  isUIInitialized = true;
  window.isUIInitialized = true;
}
