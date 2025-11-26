import { setupDragBehavior } from '@shared/ui/dragHelpers.js';
import { logDebug } from '@core/logger.js';

const CLICK_COOLDOWN_MS = 800;
const SPEECH_MANAGER_WAIT_MS = 3000;
const SPEECH_MANAGER_POLL_MS = 100;

const RANDOM_EXPRESSIONS = ['DEFAULT', 'HAPPY', 'SURPRISED', 'SERIOUS', 'SLEEPY', 'RELIEVED', 'SMILE', 'ANGRY'];
const RANDOM_PHRASES = [
  { text: 'おつかれさま〜…ぎゅってしてあげたい気分なの', emotion: 'soft' },
  { text: 'すごいね…ちゃんと頑張ってるの、見てるからね', emotion: 'gentle' },
  { text: 'ふにゃ、今日はのんびりしよ！', emotion: 'soft' },
  { text: 'ねぇ、わたしとだけ甘えてもいいんだよ？', emotion: 'happy' },
  { text: 'ここにいるからね。ひとりじゃないよ', emotion: 'normal' },
  { text: 'お水飲んだ？小休憩しよっか', emotion: 'gentle' },
  { text: 'えらいえらい…よしよしっ', emotion: 'happy' },
  { text: 'もし疲れたら、ぎゅってするからね🐾', emotion: 'soft' }
];

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function normalizeSpeechManager(manager) {
  if (!manager) return null;
  window.speechManager = manager;
  window.SpeechManager = manager;
  return manager;
}

async function resolveSpeechManager(timeoutMs = SPEECH_MANAGER_WAIT_MS) {
  const immediate = normalizeSpeechManager(window.speechManager || window.SpeechManager);
  if (immediate) return immediate;

  if (window.speechManagerBridge?.waitForReady) {
    const bridged = await window.speechManagerBridge.waitForReady(timeoutMs);
    if (bridged) return normalizeSpeechManager(bridged);
  }

  if (window.speechManagerReady && typeof window.speechManagerReady.then === 'function') {
    try {
      const maybeManager = await Promise.race([window.speechManagerReady, wait(timeoutMs)]);
      if (maybeManager) return normalizeSpeechManager(maybeManager);
    } catch (err) {
      console.error('[Speech] speechManagerReady promise failed', err);
    }
  }

  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const manager = normalizeSpeechManager(window.speechManager || window.SpeechManager);
    if (manager) return manager;
    await wait(SPEECH_MANAGER_POLL_MS);
  }

  console.error('[Speech] speechManager not ready within timeout', {
    hasLower: !!window.speechManager,
    hasUpper: !!window.SpeechManager
  });
  return null;
}

async function speakRandomLine() {
  const manager = await resolveSpeechManager();

  if (!manager || (typeof manager.speak !== 'function' && typeof manager.speakWithObject !== 'function')) {
    console.error('[Speech] speechManager is unavailable; skip speakRandomLine');
    return;
  }

  const phrase = RANDOM_PHRASES[Math.floor(Math.random() * RANDOM_PHRASES.length)];

  try {
    const result = manager.speakWithObject
      ? await manager.speakWithObject({
          text: phrase.text,
          emotion: phrase.emotion || 'normal',
          type: 'random'
        })
      : await manager.speak(phrase.text, phrase.emotion || 'normal', 5000, null, 'random_speak');

    if (result === false) {
      console.error('[Speech] speakRandomLine returned false (VOICEVOX may be offline)');
    } else {
      logDebug(`[Speech] spoke random line: "${phrase.text}"`);
    }
  } catch (error) {
    console.error('[Speech] speakRandomLine error', {
      message: error?.message,
      stack: error?.stack
    });
  }
}

export function setupAssistantImageEvents(imgElement) {
  if (!imgElement || !(imgElement instanceof HTMLElement)) {
    console.warn('無効な assistantImage が渡されました');
    return;
  }

  console.log('🖼️ assistantImage にイベントを設定します');

  imgElement.style.webkitAppRegion = 'no-drag';
  imgElement.style.pointerEvents = 'auto';

  imgElement.addEventListener('contextmenu', (event) => {
    event.preventDefault();
    console.log('🖼️ 立ち絵が右クリックされました - 右クリックメニューを無効化');
  });

  imgElement.addEventListener('click', async (event) => {
    console.debug('[Speech] character clicked');
    console.log('🖼️ 立ち絵がクリックされました', { x: event.clientX, y: event.clientY });

    if (imgElement._isDragging) {
      console.log('🖼️ ドラッグ中のためクリックをスキップします');
      return;
    }

    const now = Date.now();
    const lastClick = imgElement._lastClickTime || 0;
    if (now - lastClick < CLICK_COOLDOWN_MS) {
      logDebug('クリック連打防止: クールタイム中のためスキップします');
      return;
    }
    imgElement._lastClickTime = now;
    logDebug('立ち絵がクリックされました - 反応シーケンスを開始します');

    try {
      const isFunyaMode = Math.random() < 0.3;
      const randomExpression = RANDOM_EXPRESSIONS[Math.floor(Math.random() * RANDOM_EXPRESSIONS.length)];
      const canPlayPresetSound = typeof playPresetSound === 'function';

      if (isFunyaMode && canPlayPresetSound) {
        console.log('🐈 「ふにゃモード」発動');

        try {
          await playPresetSound('funya');
          logDebug('「ふにゃ」効果音を再生しました');
          emotionalBridge?.setExpressionByTag?.('SURPRISED');
        } catch (error) {
          console.error('効果音再生エラー:', error);
        }

        setTimeout(async () => {
          await speakRandomLine();
          emotionalBridge?.setExpressionByTag?.(randomExpression);
        }, 1200);
      } else {
        await speakRandomLine();
        emotionalBridge?.setExpressionByTag?.(randomExpression);
      }

      emotionalBridge?.setPose?.('NEUTRAL');
      console.log('🖼️ ポーズをNEUTRALに設定しました');
    } catch (error) {
      console.error('キャラクター反応シーケンスでエラーが発生しました:', error);
    }
  });

  setupDragBehavior(imgElement);
  console.log('🖼️ assistantImageのイベント設定が完了しました');
}
