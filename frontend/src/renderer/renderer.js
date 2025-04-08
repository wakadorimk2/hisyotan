/**
 * renderer.js
 * レンダラープロセスのエントリーポイント
 * UIやイベントハンドリングの初期化を行います
 */

// スタイルシート読み込み（インポート時にコンソール出力を追加）
console.log('🎨 styles.cssを読み込み開始します');
import '../ui/styles/main.css';
console.log('✅ styles.cssの読み込み完了');

// ヘルパーモジュールをインポート
import * as assistantUI from './assistantUI.js';
import apiClient from '../core/apiClient.js';
import speechManager from '../emotion/speechManager.js';
import { initAssistantUI } from './assistantUI.js';
import { startFunyaWatchingMode, showFunyaBubble } from '../ui/helpers/funyaBubble.js';
import { initVolumeControl } from '../ui/helpers/volumeControl.js';

// デバッグ情報
console.log('🌸 renderer.js が読み込まれました');
console.log('🔍 ビルドモード:', import.meta.env.MODE);
console.log('📁 現在の実行パス:', import.meta.env.BASE_URL);

// グローバルアクセス用に設定
window.assistantUI = assistantUI;
window.settingsApi = apiClient;
window.funyaBubble = {
  startFunyaWatchingMode,
  showFunyaBubble
};

// speechManagerが正しく読み込まれていることを確認
try {
  if (!speechManager) {
    console.error('❌ speechManagerのインポートに失敗しました');
  } else {
    window.speechManager = speechManager;
    console.log('🎤 SpeechManager をグローバルに登録しました:',
      Object.keys(speechManager).join(', '));

    // メソッドの存在確認
    if (typeof speechManager.speak === 'function') {
      console.log('✅ speechManager.speakメソッドが存在します');
    } else {
      console.error('❌ speechManager.speakメソッドが見つかりません');
    }
  }
} catch (err) {
  console.error('❌ speechManager初期化エラー:', err);
}

// フォールバック：speechManagerが存在しない場合の簡易実装
if (!window.speechManager) {
  console.log('⚠️ フォールバックspeechManagerを作成します');
  window.speechManager = {
    speak: (text, emotion, duration) => {
      console.log(`フォールバックspeak: ${text} (${emotion}, ${duration}ms)`);
      assistantUI.showBubble('default', text);
      return true;
    },
    checkVoicevoxConnection: async () => false,
    setConfig: (config) => console.log('フォールバックsetConfig:', config)
  };
}

/**
 * アプリケーションの初期化
 */
async function initializeApp() {
  try {
    console.log('🚀 アプリケーションを初期化します');

    // 音量コントロールの初期化
    console.log('🔊 音量コントロールを初期化します');
    initVolumeControl();

    // VOICEVOXへの接続確認
    if (window.speechManager && typeof window.speechManager.checkVoicevoxConnection === 'function') {
      const voicevoxConnected = await window.speechManager.checkVoicevoxConnection();
      console.log(`VOICEVOX接続状態: ${voicevoxConnected ? '✅ 接続済み' : '❌ 未接続'}`);
    }

    console.log('✅ アプリケーションの初期化が完了しました');
  } catch (error) {
    console.error('⚠️ アプリケーションの初期化エラー:', error);
  }
}

/**
 * レンダラープロセスの初期化
 */
async function init() {
  try {
    console.log('🚀 レンダラープロセスを初期化します');

    // アシスタントUIの初期化
    initAssistantUI();

    // ふにゃ見守りモードの開始
    console.log('🐈️ ふにゃ見守りモードを開始します');
    startFunyaWatchingMode();

    // ここにアプリケーションの初期化コードを追加

    console.log('✅ レンダラープロセスの初期化が完了しました');
  } catch (error) {
    console.error('⚠️ レンダラープロセスの初期化エラー:', error);
  }
}

// 初期化実行
init();

/**
 * 背景演出の初期化と制御
 */
function initBackgroundEffects() {
  console.log('✨ 背景演出を初期化します');

  // グラデーション背景の追加
  const gradientBg = document.createElement('div');
  gradientBg.className = 'gradient-bg rounded-window';
  document.body.appendChild(gradientBg);

  // パーティクル要素のコンテナ
  const particlesContainer = document.createElement('div');
  particlesContainer.className = 'bg-particles rounded-window';
  document.body.appendChild(particlesContainer);

  // パーティクルの数
  const particleCount = 15;
  const pawPrintCount = 8;

  // パーティクルを生成
  for (let i = 0; i < particleCount; i++) {
    createParticle(particlesContainer);
  }

  // 足跡を生成
  for (let i = 0; i < pawPrintCount; i++) {
    createPawPrint(particlesContainer);
  }

  // 定期的に新しいパーティクルを生成
  setInterval(() => {
    // 古いパーティクルを削除して新しいものを作成
    const oldParticles = particlesContainer.querySelectorAll('.particle');
    if (oldParticles.length > 30) {
      oldParticles[0].remove();
    }
    createParticle(particlesContainer);

    // たまに足跡も追加
    if (Math.random() < 0.3) {
      const oldPaws = particlesContainer.querySelectorAll('.paw-print');
      if (oldPaws.length > 15) {
        oldPaws[0].remove();
      }
      createPawPrint(particlesContainer);
    }
  }, 3000);

  console.log('✅ 背景演出の初期化が完了しました');
}

/**
 * ウィンドウスタイルの最適化
 * 角丸や透明効果を確実に適用
 */
function optimizeWindowStyle() {
  console.log('🪟 ウィンドウスタイルを最適化します');

  // HTML/bodyに角丸クラスを追加
  document.documentElement.classList.add('rounded-window');
  document.body.classList.add('rounded-window');

  // appコンテナにも角丸を適用
  const appContainer = document.getElementById('app');
  if (appContainer) {
    appContainer.classList.add('rounded-window');
  }

  // CSSで角丸を強制適用
  const styleElement = document.createElement('style');
  styleElement.textContent = `
    html, body, #app {
      border-radius: 25px !important;
      overflow: hidden !important;
      background-color: transparent !important;
    }
    
    /* グラデーション背景要素にも角丸を適用 */
    .gradient-bg, .bg-particles {
      border-radius: 25px !important;
      overflow: hidden !important;
    }
    
    /* Windows固有の角丸最適化 */
    @media (-ms-high-contrast: none), (-ms-high-contrast: active) {
      html, body, #app, .gradient-bg, .bg-particles {
        border-radius: 25px !important;
      }
    }
    
    /* 角丸マスク（背景オーバーレイ） */
    .window-mask {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 9999;
      border-radius: 25px !important;
      box-shadow: 0 0 0 2000px rgba(0, 0, 0, 0.01);
    }
  `;
  document.head.appendChild(styleElement);

  // 角丸マスクを追加
  const windowMask = document.createElement('div');
  windowMask.className = 'window-mask';
  document.body.appendChild(windowMask);

  console.log('✅ ウィンドウスタイルの最適化が完了しました');
}

/**
 * パーティクル要素を作成
 */
function createParticle(container) {
  const particle = document.createElement('div');
  particle.className = 'particle';

  // ランダムな位置とサイズ
  const size = Math.random() * 8 + 3;
  particle.style.width = `${size}px`;
  particle.style.height = `${size}px`;
  particle.style.left = `${Math.random() * 100}%`;
  particle.style.top = `${Math.random() * 100}%`;

  // ふわふわ感のためのアニメーション
  const animDuration = Math.random() * 10 + 8;
  const animDelay = Math.random() * 5;
  particle.style.animation = `floaty ${animDuration}s infinite ease-in-out ${animDelay}s`;

  // 淡いピンク系の色をランダムに
  const hue = Math.random() * 20 + 340; // 340-360（赤～ピンク系）
  const saturation = Math.random() * 30 + 70; // 70-100%
  const lightness = Math.random() * 10 + 85; // 85-95%
  const alpha = Math.random() * 0.2 + 0.1; // 0.1-0.3
  particle.style.backgroundColor = `hsla(${hue}, ${saturation}%, ${lightness}%, ${alpha})`;

  // 一定時間後に自動削除
  setTimeout(() => {
    particle.style.opacity = '0';
    setTimeout(() => particle.remove(), 1000);
  }, 20000 + Math.random() * 10000);

  container.appendChild(particle);
}

/**
 * 足跡要素を作成
 */
function createPawPrint(container) {
  const pawPrint = document.createElement('div');
  pawPrint.className = 'paw-print';

  // ランダムな位置とサイズ
  const size = Math.random() * 10 + 10;
  pawPrint.style.width = `${size}px`;
  pawPrint.style.height = `${size}px`;
  pawPrint.style.left = `${Math.random() * 100}%`;
  pawPrint.style.top = `${Math.random() * 100}%`;

  // ランダムな回転
  const rotation = Math.random() * 360;
  pawPrint.style.transform = `rotate(${rotation}deg)`;

  // 淡い透明度
  pawPrint.style.opacity = `${Math.random() * 0.15 + 0.05}`;

  // 一定時間後に自動削除
  setTimeout(() => {
    pawPrint.style.opacity = '0';
    setTimeout(() => pawPrint.remove(), 1000);
  }, 15000 + Math.random() * 10000);

  container.appendChild(pawPrint);
}

// DOM構築後の初期化
document.addEventListener('DOMContentLoaded', () => {
  console.log('🌟 DOMContentLoaded: UIの初期化を開始します');

  // ウィンドウスタイルの最適化
  optimizeWindowStyle();

  // 背景演出の初期化
  initBackgroundEffects();

  // 少し遅延を入れてDOM要素が完全に読み込まれるのを確保
  setTimeout(async () => {
    await initializeApp();
  }, 100);

  // スタイル適用確認
  setTimeout(() => {
    console.log('⏱️ タイムアウト後のスタイル確認:');
    checkUIElements(true);
  }, 1000);
});

// デバッグ用：UI要素の存在確認
function checkUIElements(includeStyles = false) {
  const elements = [
    'paw-button', 'quit-button', 'speechBubble',
    'speechText', 'assistantImage'
    // 'errorBubble' を削除（不要なため）
  ];

  console.log('🔍 UI要素チェック結果:');
  elements.forEach(id => {
    const el = document.getElementById(id);
    console.log(`${id}: ${el ? '✅ 存在します' : '❌ 見つかりません'}`);

    // スタイル情報も表示する場合
    if (includeStyles && el) {
      const computedStyle = window.getComputedStyle(el);
      console.log(`  - display: ${computedStyle.display}`);
      console.log(`  - visibility: ${computedStyle.visibility}`);
      console.log(`  - opacity: ${computedStyle.opacity}`);

      if (id === 'assistantImage') {
        // 立ち絵の追加チェック
        console.log(`  - width: ${computedStyle.width}`);
        console.log(`  - height: ${computedStyle.height}`);
        console.log(`  - src: ${el.src}`);

        // 立ち絵が表示されていない場合は修正
        if (computedStyle.display === 'none' || parseFloat(computedStyle.opacity) < 0.1) {
          console.log('立ち絵が表示されていません。表示設定を適用します。');
          el.style.display = 'block';
          el.style.opacity = '1';
          el.style.visibility = 'visible';
        }
      }

      // pawButtonの見た目を確認・修正
      if (id === 'paw-button') {
        console.log(`  - backgroundColor: ${computedStyle.backgroundColor}`);
        console.log(`  - backgroundImage: ${computedStyle.backgroundImage}`);

        // 肉球ボタンの外観を強化（白い四角の問題を解決）
        if (computedStyle.backgroundImage === 'none' || computedStyle.backgroundColor === 'rgba(0, 0, 0, 0)') {
          console.log('肉球ボタンの見た目に問題があります。スタイルを強化します。');
          el.style.backgroundImage = 'radial-gradient(circle, #ffb6c1 0%, #ff69b4 100%)';
          el.style.backgroundColor = 'rgba(255, 192, 203, 0.8)';
          el.style.boxShadow = '0 2px 5px rgba(0, 0, 0, 0.2)';
          el.style.fontSize = '24px';
          el.textContent = '🐾';
        }
      }
    }
  });
}

// Electronからのイベントを処理するためのリスナー
if (window.electron && window.electron.ipcRenderer) {
  // SpeechManager操作を受け取るリスナー
  window.electron.ipcRenderer.on('speech-manager-operation', (data) => {
    console.log('🎯 SpeechManager操作イベントを受信:', data);

    if (!window.speechManager) {
      console.error('speechManagerが利用できません');
      return;
    }

    const { method, args } = data;

    // メソッドが存在するか確認
    if (typeof window.speechManager[method] === 'function') {
      // メソッドを呼び出す
      try {
        window.speechManager[method](...args);
      } catch (error) {
        console.error(`speechManager.${method}の呼び出しエラー:`, error);
      }
    } else {
      console.error(`speechManagerに${method}メソッドが存在しません`);
    }
  });
}

// ビルド環境の表示
console.log(`🔧 現在の実行環境: ${import.meta.env.MODE}`);

// エクスポート
export default {
  assistantUI,
  apiClient,
  speechManager,
  funyaBubble: { startFunyaWatchingMode, showFunyaBubble }
}; 