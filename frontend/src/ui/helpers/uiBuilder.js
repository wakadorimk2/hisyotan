/**
 * uiBuilder.js
 * 
 * このファイルは、UI要素の作成と初期化を担当します。
 * 
 */

import { setupEventListeners } from '../handlers/uiEventHandlers.js';
import { startFunyaWatchingMode, showFunyaBubble } from '../helpers/funyaBubble.js';
import { createVolumeSlider } from '../helpers/volumeSlider.js';

// 初期化済みフラグ（エクスポートしてどこからでもアクセスできるように）
export let isUIInitialized = false;

/**
 * UI要素を作成
 */
export function createUI() {
  console.log('🎨 UI要素を作成します');

  // 既に要素が存在する場合は作成しない
  if (document.getElementById('assistant-container')) {
    console.log('既にUIコンテナが存在します。スキップします。');
    return;
  }

  // メインコンテナの作成
  const container = document.createElement('div');
  container.id = 'assistant-container';
  container.className = 'assistant-container';

  // キャラクターとセリフのラッパーを作成
  const characterSpeechWrapper = document.createElement('div');
  characterSpeechWrapper.className = 'character-speech-wrapper';

  // 立ち絵の作成
  const assistantImage = document.createElement('img');
  assistantImage.id = 'assistantImage';
  assistantImage.className = 'assistant-image active';
  assistantImage.src = '/assets/images/secretary_normal.png';
  assistantImage.alt = '秘書たん';
  assistantImage.style.width = '256px'; // 明示的なサイズ指定
  assistantImage.style.height = 'auto';
  assistantImage.style.minHeight = '250px';
  assistantImage.style.webkitAppRegion = 'drag'; // ドラッグ可能に設定
  assistantImage.style.imageRendering = 'auto'; // レンダリング設定
  assistantImage.style.objectFit = 'contain';
  assistantImage.style.display = 'block';
  assistantImage.style.visibility = 'visible';
  assistantImage.style.opacity = '1';
  assistantImage.style.position = 'absolute'; // 変更: fixedからabsoluteに
  assistantImage.style.bottom = '0';
  assistantImage.style.right = '10px';
  assistantImage.style.zIndex = '1000';

  // レガシー吹き出しは作成しないように変更
  // 代わりにfunyaBubbleを後で初期化する

  // 肉球ボタンのラッパーを作成
  const pawButtonWrapper = document.createElement('div');
  pawButtonWrapper.className = 'paw-button-wrapper';
  pawButtonWrapper.style.webkitAppRegion = 'no-drag'; // クリック可能に設定
  pawButtonWrapper.style.position = 'fixed';
  pawButtonWrapper.style.bottom = '20px';
  pawButtonWrapper.style.right = '20px';
  pawButtonWrapper.style.zIndex = '9999';

  // 肉球ボタンの背景エフェクト要素を追加
  const pawBackground = document.createElement('div');
  pawBackground.className = 'paw-background';
  pawButtonWrapper.appendChild(pawBackground);

  // 肉球ボタンの作成
  const pawButton = document.createElement('button');
  pawButton.id = 'paw-button';
  pawButton.textContent = '🐾';
  pawButton.setAttribute('role', 'button');
  pawButton.setAttribute('tabindex', '0');
  pawButton.setAttribute('aria-label', '話しかける');
  pawButton.style.webkitAppRegion = 'no-drag'; // クリック可能に設定
  pawButton.style.cursor = 'pointer'; // カーソルをポインタに設定

  // 肉球アイコン（テキスト内容は既にpawButtonに設定済み）
  pawButtonWrapper.appendChild(pawButton);

  // ホバーエフェクト
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

  // 終了ボタンの作成
  const quitButton = document.createElement('button');
  quitButton.id = 'quit-button';
  quitButton.textContent = '❌';
  quitButton.setAttribute('role', 'button');
  quitButton.setAttribute('tabindex', '0');
  quitButton.setAttribute('aria-label', '閉じる');
  quitButton.style.webkitAppRegion = 'no-drag'; // クリック可能に設定（これだけはインラインで）

  // ホバーエフェクト
  quitButton.addEventListener('mouseover', () => {
    quitButton.style.opacity = '1';
  });

  quitButton.addEventListener('mouseout', () => {
    quitButton.style.opacity = '0.8';
  });

  // 音量スライダーを作成（volumeSlider.jsから取得）
  const { volumeButton, volumePopup } = createVolumeSlider();

  // 要素をラッパーに追加
  characterSpeechWrapper.appendChild(assistantImage);
  // speechBubbleはfunyaBubbleに置き換えるため追加しない

  // ラッパーをコンテナに追加
  container.appendChild(characterSpeechWrapper);
  container.appendChild(pawButtonWrapper); // ボタンラッパーを追加
  container.appendChild(quitButton);
  container.appendChild(volumeButton); // 音量ボタンを追加
  container.appendChild(volumePopup); // 音量スライダーポップアップを追加

  // コンテナをドキュメントに追加
  document.body.appendChild(container);

  // デバッグ: volumePopupが正しく追加されたか確認
  console.log('📊 volumePopup要素の追加状態:', {
    added: document.getElementById('volumeControlPopup') !== null,
    element: document.getElementById('volumeControlPopup')
  });

  // グローバル変数に要素を割り当て（参照をセット）
  window.pawButton = pawButton;
  window.quitButton = quitButton;
  window.volumeButton = volumeButton; // 音量ボタンを追加
  window.volumePopup = volumePopup; // 音量ポップアップも追加
  window.assistantImage = assistantImage;
  window.characterSpeechWrapper = characterSpeechWrapper;

  // モジュール内グローバル変数にも割り当て
  globalThis.pawButton = pawButton;
  globalThis.quitButton = quitButton;
  globalThis.volumeButton = volumeButton; // 音量ボタンを追加
  globalThis.volumePopup = volumePopup; // 音量ポップアップも追加
  globalThis.assistantImage = assistantImage;
  globalThis.characterSpeechWrapper = characterSpeechWrapper;

  // イベントリスナーの設定（DOM要素を直接渡す）
  setTimeout(() => {
    console.log('🔄 イベントリスナーを設定します');
    // DOMツリーに追加されたことを確認した上で設定
    setupEventListeners();
  }, 50);

  // funyaBubbleを初期化
  setTimeout(() => {
    // funyaBubbleを初期化（レガシー吹き出しの代わりに使用）
    startFunyaWatchingMode();
    console.log('🌸 funyaBubbleを初期化しました');
  }, 100);

  // MutationObserverを使用して立ち絵の位置変更を監視
  const assistantObserver = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type === 'attributes' &&
        (mutation.attributeName === 'style' || mutation.attributeName === 'class')) {
        // 位置変更があった場合の処理（funyaBubbleの位置は自動調整される）
      }
    });
  });

  // 立ち絵の監視を開始（DOMツリーに追加された後）
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
 * すでに存在する要素があれば取得し、なければ作成する
 */
export function initUIElements() {
  console.log('🌸 assistantUI: UI要素を初期化します');

  // 初期化済みの場合は早期リターン（変数参照エラーを防ぐために明示的に変数をチェック）
  if (typeof isUIInitialized !== 'undefined' && isUIInitialized && document.getElementById('paw-button')) {
    console.log('🔄 UI要素はすでに初期化済みです');
    return;
  }

  // UI要素の事前定義
  const uiElements = {
    assistantImage: { id: 'assistantImage', type: 'img' },
    pawButton: { id: 'paw-button', type: 'button' },
    quitButton: { id: 'quit-button', type: 'button' },
    volumeButton: { id: 'volumeControlIcon', type: 'button' }, // 音量ボタンを追加
    volumePopup: { id: 'volumeControlPopup', type: 'div' }, // 音量ポップアップを追加
    errorBubble: { id: 'errorBubble', type: 'div' },
    errorText: { id: 'errorText', type: 'div' }
    // speechBubbleとspeechTextは削除（非推奨）
  };

  // 旧吹き出しUI要素（ゾンビBubble）を削除
  const zombieBubble = document.getElementById('speechBubble');
  if (zombieBubble) {
    console.warn('💀 uiBuilder: 旧吹き出しを除霊します');
    zombieBubble.remove();
  }

  // UI要素の初期化
  const elements = {};

  for (const [key, { id, type }] of Object.entries(uiElements)) {
    // 既存の要素を検索
    let element = document.getElementById(id);

    if (!element) {
      console.log(`🆕 ${id}要素を作成します`);
      element = document.createElement(type);
      element.id = id;

      // 要素に応じた初期設定
      switch (id) {
        case 'errorBubble':
          element.className = 'error-bubble';
          break;
        case 'errorText':
          element.className = 'error-text';
          break;
      }

      document.body.appendChild(element);
    }

    // グローバル変数に要素を保存
    if (key === 'pawButton') window.pawButton = element;
    if (key === 'quitButton') window.quitButton = element;
    if (key === 'volumeButton') window.volumeButton = element; // 音量ボタンを追加
    if (key === 'assistantImage') window.assistantImage = element;
  }

  // イベントリスナーの設定 - 循環参照を避けるため遅延実行
  setTimeout(() => {
    try {
      console.log('🔄 イベントリスナーを遅延設定します');
      setupEventListeners();
    } catch (error) {
      console.error('❌ イベントリスナー設定中にエラーが発生しました:', error);
    }
  }, 100);

  // funyaBubbleを初期化
  setTimeout(() => {
    startFunyaWatchingMode();
    console.log('🌸 funyaBubbleを初期化しました');
  }, 150);

  // 初期化済みフラグをセット
  isUIInitialized = true;
}