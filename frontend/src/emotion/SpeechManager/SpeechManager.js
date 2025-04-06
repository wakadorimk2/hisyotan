/**
 * SpeechManager.js
 * 秘書たんの発話・音声合成を管理するクラス
 */

import { logDebug, logError } from '@core/logger.js';
// import { 
//   showBubble, 
//   hideBubble, 
//   setText, 
//   initUIElements, 
//   renderSettingUI 
// } from '@ui/uiHelper.js';
import { initUIElements } from '@ui/helpers/uiBuilder.js';
import { showBubble, hideBubble, setText, clearText } from '@ui/helpers/speechRenderer.js';
import { setExpression, stopTalking } from '../expressionManager.js';
// import { 
//   formatMessage, 
//   forceShowBubble, 
//   displayTextInBubble 
// } from './bubbleDisplay.js.backup';
import {
  speak as speakCore,
  speakWithPreset as speakWithPresetCore,
  isPlaying,
  stopPlaying
} from './speakCore.js';
// VOICEVOXクライアントを新しいモジュールに変更
import {
  // eslint-disable-next-line no-unused-vars
  checkVoicevoxConnection as checkVoicevoxConnectionAPI
} from '@voice/speechVoice.js';
import { speakText, stopSpeaking, isSpeaking } from '@voice/speechVoice.js';
// import {
//   showHordeModeToggle as showHordeModeToggleUI,
//   getHordeModeState,
//   setHordeModeState
// } from './hordeModeToggle.js';

/**
 * エラーメッセージを表示する (showErrorの代替関数)
 * @param {string} message - エラーメッセージ
 */
// eslint-disable-next-line no-unused-vars
function displayError(message) {
  logError(`エラー: ${message}`);
  showBubble('error', message);
}

/**
 * エラーを表示すべきかどうかを判断する (shouldShowErrorの代替関数)
 * @returns {boolean} エラーを表示すべきかどうか
 */
function shouldDisplayError() {
  // 常にエラーを表示する
  return true;
}

/**
 * 秘書たんの発話・音声合成を管理するクラス
 */
export class SpeechManager {
  /**
   * コンストラクタ
   * @param {Object} config - 設定オブジェクト
   */
  constructor(config = null) {
    // 設定データ
    this.config = config;

    // 非表示タイマーをMapで管理（イベントタイプごとに異なるタイマーを持つ）
    this.hideTimeoutMap = new Map();
    this.messageDisplayTime = 5000; // デフォルトのメッセージ表示時間（ミリ秒）

    // 表示制御用フラグと現在のイベント状態管理
    this.currentSpeechEvent = null;
    this.hasAlreadyForced = false;
    this.lastForceTime = 0;

    // VOICEVOX接続状態管理変数
    this.voicevoxRetryCount = 0;
    this.MAX_VOICEVOX_RETRIES = 5;
    this.VOICEVOX_RETRY_INTERVAL = 3000; // 再確認間隔（ミリ秒）
    this.voicevoxConnectionErrorShown = false;

    // 現在表示中のセリフデータ
    this.currentSpeech = null;

    // 🌟 初期化処理
    this.init();

    logDebug('SpeechManagerクラスをインスタンス化しました');
  }

  /**
   * モジュール初期化処理
   */
  init() {
    // UI要素の初期化
    initUIElements();
    logDebug('SpeechManager: UI要素を初期化しました');
  }

  /**
   * 設定をセットする
   * @param {Object} configData - 設定データ
   */
  setConfig(configData) {
    this.config = configData;
    logDebug('音声合成設定をセットしました');
  }

  /**
   * シンプルなテキストから音声合成と表示を行う（互換性のためspeakSimpleも残す）
   * @param {string} text - 表示＆音声化する文字列
   * @returns {Promise<boolean>} 処理が成功したかどうか
   */
  speak(text) {
    return this.speakWithObject({ text });
  }

  /**
   * UI表示と音声再生を統合した発話メソッド
   * @param {Object} params - パラメータオブジェクト
   * @param {string} params.text - 表示＆音声化する文字列
   * @param {string} [params.emotion='neutral'] - VOICEVOX用の感情
   * @param {string} [params.type='normal'] - 吹き出しの種類
   * @param {boolean} [params.autoHide=true] - 再生後に自動で吹き出しを消すか
   * @returns {Promise<boolean>} 処理が成功したかどうか
   */
  async speakWithObject({ text, emotion = 'neutral', type = 'normal', autoHide = true }) {
    try {
      logDebug(`speakWithObject: "${text}" (感情: ${emotion}, タイプ: ${type}, 自動非表示: ${autoHide})`);

      // テキストを設定
      setText(text);

      // 吹き出しを表示
      showBubble(type, text);

      // 音声再生
      await speakText(text, emotion);

      // 自動非表示が有効なら吹き出しを隠す
      if (autoHide) {
        // 少し遅延させて吹き出しを非表示にする
        const hideTimeoutId = setTimeout(() => {
          hideBubble();
        }, 1000); // 1秒後に非表示

        // タイムアウトをMapに保存（type をキーとして使用）
        this.hideTimeoutMap.set(type, hideTimeoutId);
      }

      return true;
    } catch (error) {
      logError(`speakWithObject エラー: ${error.message}`);
      return false;
    }
  }

  /**
   * 秘書たんにセリフを話させる
   * @param {string} message - セリフ
   * @param {string} emotion - 感情（normal, happy, surprised, serious, sleepy, relieved, smile）
   * @param {number} displayTime - 表示時間（ミリ秒）
   * @param {string} animation - アニメーション（bounce_light, trembling, nervous-shake, null）
   * @param {string} eventType - イベントタイプ（イベント識別用、デフォルトは'default'）
   * @param {string} presetSound - 先行再生するプリセット音声の名前（オプション）
   * @param {boolean} autoClose - 自動で閉じるかどうか（デフォルトはtrue）
   */
  async speakLegacy(message, emotion = 'normal', displayTime = null, animation = null, eventType = 'default', presetSound = null, autoClose = true) {
    try {
      // 基本的なセリフオブジェクトを作成（後方互換性のため）
      this.currentSpeech = {
        id: eventType,
        type: 'normal',
        text: message,
        emotion: emotion,
        duration: displayTime || this.messageDisplayTime,
        autoClose: autoClose
      };

      // コアの発話処理にオプションを渡して呼び出し
      const options = {
        hideTimeoutMap: this.hideTimeoutMap,
        messageDisplayTime: this.messageDisplayTime,
        config: this.config,
        onSpeechStart: (data) => {
          this.currentSpeechEvent = data.eventType;
          this.hasAlreadyForced = false;
          this.lastForceTime = Date.now();
        },
        onSpeechEnd: () => {
          // 発話終了時の処理
        }
      };

      return await speakCore(
        message,
        emotion,
        displayTime,
        animation,
        eventType,
        presetSound,
        autoClose,
        options
      );
    } catch (error) {
      logError(`発話エラー: ${error.message}`);
      showBubble('error', `発話処理に失敗しました: ${error.message}`);
      return false;
    }
  }

  /**
   * VOICEVOXの接続確認
   * @returns {Promise<boolean>} 接続成功したかどうか
   */
  async checkVoicevoxConnection() {
    try {
      // 新しい関数を使用
      const isConnected = await checkVoicevoxConnectionAPI();

      if (isConnected) {
        logDebug("VOICEVOXサーバーと接続済み");
        this.voicevoxRetryCount = 0;
        this.voicevoxConnectionErrorShown = false;
        return true;
      } else {
        // 接続失敗時の処理
        this.voicevoxRetryCount++;
        logDebug(`VOICEVOXサーバーとの接続失敗 (試行回数: ${this.voicevoxRetryCount})`);

        // 最大試行回数を超えたときのみエラー表示
        if (this.voicevoxRetryCount >= this.MAX_VOICEVOX_RETRIES && !this.voicevoxConnectionErrorShown) {
          this.voicevoxConnectionErrorShown = true;
          displayError("音声合成エンジン(VOICEVOX)に接続できません");
        }

        return false;
      }
    } catch (error) {
      logError(`VOICEVOX接続チェックエラー: ${error.message}`);
      return false;
    }
  }

  /**
   * メッセージの表示と音声合成を行う
   * @param {string} message - メッセージ
   * @param {string} emotion - 感情
   * @param {number} duration - 表示時間
   */
  sayMessage(message, emotion = 'normal', duration = 5000) {
    // 新しいspeakWithObjectを使用して表示と発話を行う
    return this.speakWithObject({
      text: message,
      emotion: emotion,
      type: 'normal',
      autoHide: true
    });
  }

  /**
   * プリセット音声とセリフを組み合わせて発話させる
   * @param {string} presetSound - プリセット音声名
   * @param {string} message - セリフ
   * @param {string} emotion - 感情
   * @param {number} displayTime - 表示時間（ミリ秒）
   * @param {string} eventType - イベントタイプ
   */
  async speakWithPreset(presetSound, message, emotion = 'normal', displayTime = null, eventType = 'notification') {
    try {
      const options = {
        hideTimeoutMap: this.hideTimeoutMap,
        messageDisplayTime: this.messageDisplayTime,
        config: this.config
      };

      return await speakWithPresetCore(
        presetSound,
        message,
        emotion,
        displayTime,
        eventType,
        options
      );
    } catch (err) {
      logError(`プリセット音声付き発話処理でエラー: ${err.message}`);
      return false;
    }
  }

  /**
   * ホード夜モードの切り替え設定UIを表示する
   * @param {boolean} currentState - 現在のホード夜モードの状態
   * @param {Function} onChangeCallback - 状態変更時のコールバック関数（オプション）
   * @returns {Promise<boolean>} 非同期処理の結果
   */
  async showHordeModeToggle(currentState = false, onChangeCallback) {
    return await showHordeModeToggleUI(
      currentState,
      onChangeCallback,
      this.speakWithObject.bind(this),
      this.speak.bind(this)
    );
  }

  /**
   * 現在のホード夜モードの状態を取得する
   * @returns {boolean} ホード夜モードが有効ならtrue
   */
  getHordeModeState() {
    return getHordeModeState();
  }

  /**
   * ホード夜モードの状態を直接設定する
   * @param {boolean} enabled - 設定する状態
   */
  setHordeModeState(enabled) {
    return setHordeModeState(enabled);
  }

  /**
   * 音声再生中かどうかを確認する
   * @returns {boolean} 音声再生中ならtrue
   */
  isPlaying() {
    return isPlaying();
  }

  /**
   * フォーマット済みメッセージを取得する
   * @param {string} message - 元のメッセージ
   * @returns {string} フォーマット済みメッセージ
   */
  getFormattedMessage(message) {
    return formatMessage(message);
  }

  /**
   * すべての発話を停止し、UIをクリアする
   */
  stopAllSpeech() {
    try {
      logDebug('すべての発話を停止します');

      // 音声再生を停止
      if (typeof stopSpeaking === 'function') {
        stopSpeaking();
      } else if (typeof stopPlaying === 'function') {
        stopPlaying();
      }

      // 口パクアニメーションを停止
      stopTalking();

      // 吹き出しを非表示にする
      hideBubble();

      // 吹き出しのテキストをクリア
      clearText();

      // タイムアウトをクリア
      for (const [key, timerId] of this.hideTimeoutMap.entries()) {
        clearTimeout(timerId);
        logDebug(`タイマー ${key} をクリアしました`);
      }
      this.hideTimeoutMap.clear();

      logDebug('すべての発話を停止し、UIをクリアしました');
      return true;
    } catch (error) {
      logError(`停止処理エラー: ${error.message}`);
      return false;
    }
  }
}

// デフォルトのインスタンスを作成してエクスポート
export default new SpeechManager(); 