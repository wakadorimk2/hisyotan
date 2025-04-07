/**
 * emotion/index.js
 * 秘書たんの感情表現モジュール全体のエントリーポイント
 * このファイルから一括で感情関連機能をエクスポートします
 */

// 感情状態管理
import emotionState, {
  getEmotionState,
  setEmotion,
  setEmotionValue,
  onEmotionChange,
  resetEmotionState,
  updateEmotionOverTime,
  EMOTION_TYPES,
  VOICE_TONES
} from './emotionState.js';

// 音声リアクション
import {
  reactWithVoice,
  playPresetSound,
  playSE,
  playVoice,
  stopCurrentPlayback,
  addCustomSEMapping,
  addCustomVoiceMapping,
  testAllReactions,
  init as initAudioReactor
} from './audioReactor.js';

// 発話管理
import { speak, speakWithPreset, isPlaying } from './SpeechManager/speakCore.js';
import { hideTimeoutMap } from './speechManager.js';

// 吹き出し表示
import {
  formatMessage,
  displayTextInBubble
} from './bubbleDisplay.js';

// 表情管理 - 旧システム
import {
  setExpression,
  startTalking,
  stopTalking,
  startLightBounce,
  stopLightBounce,
  startTrembling,
  stopTrembling,
  startNervousShake,
  stopNervousShake,
  initExpressionElements
} from './expressionManager.js';

// 表情管理 - 新システム（タグベース）
import * as emotionalBridge from './emotionalBridge.js';

// ランダムセリフ生成
import {
  getRandomCutePhrase,
  reactToEmotionChange,
  initRandomLines,
  stopRandomLines,
  showRandomLine,
  init as initEmotionHandler
} from './emotionHandler.js';

// ユーティリティ関数
import * as emotionUtils from './emotionUtils.js';

// スピーチマネージャー
import speechManager from './speechManager.js';

/**
 * 感情システム全体を初期化する
 */
export function initEmotionSystem() {
  // 既存の表情管理システムを初期化
  initExpressionElements();

  // 新しい差分管理ブリッジを初期化
  emotionalBridge.initEmotionalBridge();

  // その他の関連サブシステムの初期化
  initAudioReactor();
  initEmotionHandler();
  emotionState.init();

  console.log('🌸 感情システムを初期化しました');
}

// シンプルなファサード関数をエクスポート
/**
 * 簡単に感情を表現するためのシンプルなファサード関数
 * 感情タイプを指定するだけで適切な表情、音声、セリフを表示します
 * 
 * @param {string} emotion - 感情タイプ（happy, sad, surprised, fearful, funya, normal など）
 * @param {string} message - 表示するメッセージ（指定しない場合は感情に合わせた自動生成）
 * @param {Object} options - 追加オプション
 * @returns {Promise<boolean>} 成功したかどうか
 */
export async function express(emotion, message = null, options = {}) {
  try {
    // 感情状態を更新
    setEmotion(emotion);

    // メッセージが指定されていない場合は感情に合わせて自動生成
    if (!message) {
      const emotionValue = emotion === 'happy' ? 70 :
        emotion === 'sad' ? -70 :
          emotion === 'surprised' ? 30 :
            emotion === 'fearful' ? -60 :
              emotion === 'funya' ? 20 : 0;

      // emotionHandlerの関数を使って適切なメッセージを生成
      const phraseObj = emotionValue === 0 ? getRandomCutePhrase() : null;
      if (phraseObj) {
        message = phraseObj.text;
      } else {
        // 簡易的なデフォルトメッセージ
        message = emotion === 'happy' ? 'わぁ、嬉しいな！' :
          emotion === 'sad' ? '少し悲しいよ...' :
            emotion === 'surprised' ? 'えっ！？' :
              emotion === 'fearful' ? 'こ、怖いよ...！' :
                emotion === 'funya' ? 'ふにゃ〜' : 'どうしたの？';
      }
    }

    // 音声と表情でリアクション
    reactWithVoice(emotion);

    // 吹き出しと表情を表示
    return await speak(message, emotion, options.displayTime || 5000, options.animation);
  } catch (error) {
    console.error('感情表現エラー:', error);
    return false;
  }
}

/**
 * タグベースの表情システムを使用して感情表現するファサード関数
 * 
 * @param {string} expressionTag - 表情タグ（HAPPY, SAD, SURPRISED など）
 * @param {string} poseTag - ポーズタグ（NEUTRAL, ARMSCROSSED, SEIZA など）
 * @param {string|Array} extraTags - エフェクト/小物タグ（オプション）
 * @param {string} message - 表示するメッセージ（オプション）
 * @returns {Promise<boolean>} 成功したかどうか
 */
export async function expressWithTags(expressionTag, poseTag = null, extraTags = null, message = null) {
  try {
    // 表情タグを設定
    emotionalBridge.setExpressionByTag(expressionTag);

    // ポーズタグが指定されていれば設定
    if (poseTag) {
      emotionalBridge.setPose(poseTag);
    }

    // エフェクト/小物タグが指定されていれば設定
    if (extraTags) {
      if (Array.isArray(extraTags)) {
        // タグを一括設定
        emotionalBridge.setTag('extras', extraTags);
      } else {
        // 単一タグを追加
        emotionalBridge.addExtra(extraTags);
      }
    }

    // メッセージが指定されていれば表示
    if (message) {
      // 対応する表情に変換
      const emotionMap = {
        'NORMAL': 'normal',
        'HAPPY': 'happy',
        'SURPRISED': 'surprised',
        'SERIOUS': 'serious',
        'SLEEPY': 'sleepy',
        'RELIEVED': 'relieved',
        'SMILE': 'smile'
      };

      const emotion = emotionMap[expressionTag] || 'normal';
      return await speak(message, emotion, 5000);
    }

    return true;
  } catch (error) {
    console.error('タグベース感情表現エラー:', error);
    return false;
  }
}

// すべてのサブモジュールをエクスポート
export {
  // 感情状態
  emotionState,
  getEmotionState,
  setEmotion,
  setEmotionValue,
  onEmotionChange,
  resetEmotionState,
  updateEmotionOverTime,
  EMOTION_TYPES,
  VOICE_TONES,

  // 音声リアクション
  reactWithVoice,
  playPresetSound,
  playSE,
  playVoice,
  stopCurrentPlayback,
  addCustomSEMapping,
  addCustomVoiceMapping,
  testAllReactions,

  // 発話管理
  speak,
  speakWithPreset,
  isPlaying,
  hideTimeoutMap,

  // 吹き出し表示
  formatMessage,
  displayTextInBubble,

  // 表情管理 - 旧システム
  setExpression,
  startTalking,
  stopTalking,
  startLightBounce,
  stopLightBounce,
  startTrembling,
  stopTrembling,
  startNervousShake,
  stopNervousShake,

  // 表情管理 - 新システム（タグベース）
  emotionalBridge,

  // ランダムセリフ生成
  getRandomCutePhrase,
  reactToEmotionChange,
  initRandomLines,
  stopRandomLines,
  showRandomLine,

  // ユーティリティ
  emotionUtils,

  // スピーチマネージャー
  speechManager
};

// デフォルトエクスポート
export default {
  express,
  expressWithTags,
  initEmotionSystem,
  emotionState,
  emotionalBridge,
  speak,
  reactWithVoice,
  setExpression
}; 