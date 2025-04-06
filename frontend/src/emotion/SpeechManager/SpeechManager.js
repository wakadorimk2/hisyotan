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
import { stopTalking } from '../expressionManager.js';
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
import { speakText, stopSpeaking } from '@voice/speechVoice.js';
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

    // メソッドのバインド
    this.safeClearText = this.safeClearText.bind(this);
    this.speakWithObject = this.speakWithObject.bind(this);
    this.speak = this.speak.bind(this);
    this.speakLegacy = this.speakLegacy.bind(this);
    this.stopAllSpeech = this.stopAllSpeech.bind(this);

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
   * @param {number} [params.autoHideDelay=3000] - 自動非表示までの遅延時間（ミリ秒）
   * @param {boolean} [params.adaptiveDelay=true] - テキスト長に応じて遅延時間を調整するか
   * @returns {Promise<boolean>} 処理が成功したかどうか
   */
  async speakWithObject({
    text,
    emotion = 'neutral',
    type = 'normal',
    autoHide = true,
    autoHideDelay = 3000,
    adaptiveDelay = true
  }) {
    try {
      logDebug(`speakWithObject: "${text}" (感情: ${emotion}, タイプ: ${type}, 自動非表示: ${autoHide}, 遅延: ${autoHideDelay}ms)`);

      // テキスト長に応じた表示時間の調整（適応的遅延が有効な場合）
      let actualDelay = autoHideDelay;
      if (adaptiveDelay && text) {
        // 1文字あたり約150ms（読み上げ速度の目安）+ 基本表示時間1秒
        const estimatedReadTime = Math.max(text.length * 150, 1000);
        // 遅延時間は読み上げ時間+猶予時間（最低でも指定された遅延時間を保証）
        actualDelay = Math.max(estimatedReadTime + 1000, autoHideDelay);
        logDebug(`📏 テキスト長 ${text.length}文字に対する適応的遅延時間: ${actualDelay}ms`);
      }

      // テキストを設定
      setText(text);

      // 吹き出しを表示（textForceSet=falseを指定して、setText()の2重実行を防止）
      showBubble(type, text, false);

      // 音声再生（エラーを補足して失敗判定できるようにする）
      let audioSuccess = true;
      try {
        await speakText(text, emotion);
        logDebug('✅ 音声再生完了しました');
      } catch (audioError) {
        audioSuccess = false;
        logError(`音声再生エラー: ${audioError.message}`);
      }

      // 自動非表示が有効で、かつ音声再生に成功した場合のみ吹き出しを隠す
      if (autoHide && audioSuccess) {
        // 少し遅延させて吹き出しを非表示にする
        const hideTimeoutId = setTimeout(async () => {
          logDebug(`🧹 吹き出しを非表示にします（自動非表示タイマー: ${actualDelay}ms後）`);
          hideBubble();

          // 直接clearTextを呼び出す（self.safeClearTextの代わりに）
          try {
            clearText();
            logDebug('✅ テキストをクリアしました');
          } catch (error) {
            logError(`テキストクリアエラー: ${error.message}`);
          }

        }, actualDelay); // 適応的な遅延時間を使用

        // タイムアウトをMapに保存（type をキーとして使用）
        this.hideTimeoutMap.set(type, hideTimeoutId);
        logDebug(`⏱️ 非表示タイマーを設定しました（ID: ${hideTimeoutId}, タイプ: ${type}）`);
      } else if (!autoHide) {
        logDebug('🔒 自動非表示は無効です。吹き出しは表示されたままです。');
      } else if (!audioSuccess) {
        logDebug('⚠️ 音声再生に失敗したため、吹き出しを表示したままにします。');
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
   * @param {number} duration - 表示時間（ミリ秒）
   * @param {boolean} adaptiveDelay - テキスト長に応じて遅延時間を調整するか
   * @returns {Promise<boolean>} 処理が成功したかどうか
   */
  sayMessage(message, emotion = 'normal', duration = 5000, adaptiveDelay = true) {
    // 新しいspeakWithObjectを使用して表示と発話を行う
    return this.speakWithObject({
      text: message,
      emotion: emotion,
      type: 'normal',
      autoHide: true,
      autoHideDelay: duration || 5000,
      adaptiveDelay: adaptiveDelay
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
  async stopAllSpeech() {
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

      // 吹き出しのテキストをクリア（安全に）
      await this.safeClearText();

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

  /**
   * テキスト要素のロック状態を確認しながら安全にクリアする
   * @param {number} timeout - 最大待機時間（ミリ秒）
   * @returns {Promise<boolean>} クリア成功ならtrue
   */
  async safeClearText(timeout = 3000) {
    try {
      const start = Date.now();
      const speechTextEl = document.getElementById("speechText");

      if (!speechTextEl) {
        logDebug('⚠️ safeClearText: speechText要素が見つかりません');
        return false;
      }

      logDebug('🔍 safeClearText: テキスト要素のロック状態を確認します: ' + speechTextEl.dataset.locked);

      // ロック状態なら少し待機
      if (speechTextEl.dataset.locked === 'true') {
        logDebug('⏳ safeClearText: テキスト要素がロック中。解除を待機します（最大' + timeout + 'ms）');

        // 非同期待機ループ
        let waited = 0;
        while (speechTextEl.dataset.locked === 'true' && waited < timeout) {
          await new Promise(resolve => setTimeout(resolve, 100)); // 100ms待機
          waited += 100;
        }

        logDebug(`⌛ safeClearText: ${waited}ms待機しました。現在のロック状態: ${speechTextEl.dataset.locked}`);
      }

      // タイムアウトしたか確認
      if (Date.now() - start > timeout && speechTextEl.dataset.locked === 'true') {
        logDebug('⚠️ safeClearText: タイムアウト。ロック中でもクリアを試行します');
      }

      // クリア実行
      clearText();
      logDebug('✅ safeClearText: テキストを安全にクリアしました');
      return true;
    } catch (error) {
      logError(`safeClearText エラー: ${error.message}`);
      return false;
    }
  }
}

// デフォルトのインスタンスを作成してエクスポート
export default new SpeechManager();

/**
 * テスト用：吹き出しを固定表示するコマンド例
 * 
 * 実行方法:
 * ```js
 * // 吹き出しを固定表示する（消えない）
 * speechManager.speakWithObject({
 *   text: "テスト表示です。これは消えないはず！",
 *   autoHide: false
 * });
 * 
 * // 長い文章でも適応的に表示時間を調整
 * speechManager.speakWithObject({
 *   text: "これは長めの文章です。テキストの長さに応じて表示時間が自動的に調整されます。読み上げ速度に合わせて適切な時間だけ表示されるはずです。",
 *   adaptiveDelay: true
 * });
 * 
 * // 表示時間を固定（10秒）
 * speechManager.speakWithObject({
 *   text: "この吹き出しは10秒間表示されます",
 *   autoHideDelay: 10000,
 *   adaptiveDelay: false
 * });
 * ```
 */ 