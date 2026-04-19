/**
 * voicevoxClient.js
 * VOICEVOX音声合成エンジンとの通信を担当するモジュール
 */

import { logDebug, logError } from '@core/logger.js';

// AudioContextのシングルトンインスタンス
let audioContext = null;

// 音声再生中フラグ
let isPlaying = false;

// 音声キャッシュ
const audioCache = new Map();
const CACHE_MAX_SIZE = 20; // キャッシュの最大エントリ数

/**
 * キャッシュにエントリを追加する
 * @param {string} cacheKey - キャッシュキー
 * @param {ArrayBuffer} audioData - 音声データ
 */
function addToCache(cacheKey, audioData) {
  // キャッシュが最大サイズに達している場合、最も古いエントリを削除
  if (audioCache.size >= CACHE_MAX_SIZE) {
    const oldestKey = audioCache.keys().next().value;
    audioCache.delete(oldestKey);
    logDebug(`キャッシュから古いエントリを削除: ${oldestKey}`);
  }
  
  // キャッシュに追加
  audioCache.set(cacheKey, audioData);
  logDebug(`音声データをキャッシュに追加: ${cacheKey}`);
}

/**
 * キャッシュキーを生成する
 * @param {string} text - 合成するテキスト
 * @param {string} emotion - 感情
 * @param {number} speakerId - 話者ID
 * @returns {string} キャッシュキー
 */
function generateCacheKey(text, emotion, speakerId) {
  return `${speakerId}_${emotion}_${text}`;
}

/**
 * 音声合成リクエストを送信する
 * @param {string} text - 合成するテキスト
 * @param {string} emotion - 感情
 * @param {number} speakerId - 話者ID
 * @param {AbortSignal} signal - リクエストキャンセル用のシグナル
 * @param {boolean} useCache - キャッシュを使用するかどうか
 * @returns {Promise<boolean>} 成功したかどうか
 */
export async function requestVoiceSynthesis(text, emotion = 'normal', speakerId = 8, signal = null, useCache = true) {
  try {
    // キャッシュキーを生成
    const cacheKey = generateCacheKey(text, emotion, speakerId);
    
    // キャッシュをチェック
    if (useCache && audioCache.has(cacheKey)) {
      logDebug(`キャッシュから音声データを使用: ${cacheKey}`);
      // キャッシュから音声データを取得して再生
      await playAudioData(audioCache.get(cacheKey));
      return true;
    }
    
    // バックエンドAPIのベースURLを設定
    const apiBaseUrl = 'http://127.0.0.1:8001';
    
    logDebug(`VOICEVOX音声合成APIを呼び出します (話者ID: ${speakerId}, 感情: ${emotion})`);
    
    // タイムアウト設定
    const timeoutSignal = AbortSignal.timeout(10000); // 10秒でタイムアウト
    
    // 複数のシグナルを組み合わせる関数
    const combineSignals = (...signals) => {
      // nullや未定義のシグナルを除外
      const validSignals = signals.filter(s => s);
      if (validSignals.length === 0) return null;
      if (validSignals.length === 1) return validSignals[0];
      
      const controller = new AbortController();
      const { signal } = controller;
      
      validSignals.forEach(s => {
        if (s.aborted) {
          controller.abort(s.reason);
          return;
        }
        
        s.addEventListener('abort', () => controller.abort(s.reason), { once: true });
      });
      
      return signal;
    };
    
    // シグナルの組み合わせ
    const combinedSignal = combineSignals(signal, timeoutSignal);
    
    // リクエストボディを準備
    const requestBody = {
      text: text,
      emotion: emotion,
      speaker_id: speakerId
    };
    
    logDebug(`リクエスト内容: ${JSON.stringify(requestBody)}`);
    
    // バックエンド側で音声合成＆WAVデータ取得するAPIを呼び出す
    const response = await fetch(`${apiBaseUrl}/api/voice/synthesize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody),
      signal: combinedSignal
    });
    
    if (!response.ok) {
      // レスポンスのテキストを取得してエラーメッセージに含める
      const errorText = await response.text();
      logError(`バックエンドAPI呼び出し失敗: ${response.status} ${response.statusText}`);
      logError(`エラー詳細: ${errorText}`);
      throw new Error(`バックエンドAPI呼び出し失敗: ${response.status} ${response.statusText}`);
    }
    
    // WAVデータを取得（バイナリデータとして）
    const audioData = await response.arrayBuffer();
    
    // キャッシュに追加
    if (useCache) {
      addToCache(cacheKey, audioData);
    }
    
    // フロントエンド側で音声再生
    await playAudioData(audioData);
    
    return true;
    
  } catch (error) {
    // エラーハンドリング：AbortErrorの場合は正常処理
    if (error.name === 'AbortError') {
      if (error.message === 'The operation was aborted due to timeout') {
        logDebug("⏱ 音声合成リクエストがタイムアウトしました");
      } else {
        logDebug("🎙 発話リクエストがキャンセルされました");
      }
      return false;
    }
    
    // ネットワークエラーの場合
    if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
      logDebug(`ネットワークエラー: バックエンドサーバーに接続できません`);
      return false;
    }
    
    logError(`VOICEVOX音声合成エラー: ${error.message}`);
    return false;
  }
}

/**
 * 音声データを再生する関数
 * @param {ArrayBuffer} audioData - 再生する音声データ（WAVフォーマット）
 * @returns {Promise<boolean>} 再生が完了したらtrueを返す
 */
async function playAudioData(audioData) {
  try {
    // 再生中の場合は前の再生を停止
    if (isPlaying) {
      logDebug('前の音声再生を停止します');
      stopCurrentPlayback();
    }
    
    // AudioContextの初期化
    if (!audioContext) {
      try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        logDebug('AudioContextを初期化しました');
      } catch (err) {
        logError(`AudioContext初期化エラー: ${err.message}`);
        return false;
      }
    }
    
    // 音声データをデコード
    const audioBuffer = await audioContext.decodeAudioData(audioData);
    
    // 音源ノードを作成
    const sourceNode = audioContext.createBufferSource();
    sourceNode.buffer = audioBuffer;
    
    // 音量ノードを追加
    const gainNode = audioContext.createGain();
    gainNode.gain.value = 1.0; // 最大音量
    
    // ノードを接続
    sourceNode.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    // 再生中フラグをセット
    isPlaying = true;
    logDebug('音声再生を開始します');
    
    // 再生開始
    sourceNode.start(0);
    
    // 再生終了時の処理
    return new Promise((resolve) => {
      sourceNode.onended = () => {
        isPlaying = false;
        logDebug('音声再生が完了しました');
        resolve(true);
      };
      
      // タイムアウト処理（万が一onendedが発火しない場合の保険）
      setTimeout(() => {
        if (isPlaying) {
          isPlaying = false;
          logDebug('音声再生タイムアウト処理を実行しました');
          resolve(true);
        }
      }, audioBuffer.duration * 1000 + 500);
    });
  } catch (error) {
    isPlaying = false;
    logError(`音声再生エラー: ${error.message}`);
    return false;
  }
}

/**
 * 現在再生中の音声を停止する
 */
export function stopCurrentPlayback() {
  try {
    if (audioContext && isPlaying) {
      // すべてのノードを切断
      audioContext.suspend();
      setTimeout(() => {
        audioContext.resume();
      }, 100);
      
      isPlaying = false;
      logDebug('音声再生を停止しました');
    }
  } catch (err) {
    logError(`音声停止エラー: ${err.message}`);
  }
}

/**
 * VOICEVOX接続確認API呼び出し
 * @returns {Promise<boolean>} 接続成功したかどうか
 */
export async function checkVoicevoxConnection() {
  try {
    // バックエンドAPIのURLを直接指定
    const apiBaseUrl = 'http://127.0.0.1:8001';
    const response = await fetch(`${apiBaseUrl}/api/voice/check-connection`);
    
    if (response.ok) {
      const result = await response.json();
      return result.connected;
    }
    return false;
  } catch (error) {
    logError(`VOICEVOX接続確認エラー: ${error.message}`);
    return false;
  }
}

/**
 * 現在音声が再生中かどうか
 * @returns {boolean} 再生中ならtrue
 */
export function isAudioPlaying() {
  return isPlaying;
}

/**
 * キャッシュをクリアする
 */
export function clearAudioCache() {
  audioCache.clear();
  logDebug('音声キャッシュをクリアしました');
}

/**
 * ゾンビ検出に対するリアクションを実行する
 * @param {number} count - 検出されたゾンビの数
 * @param {number} distance - 最も近いゾンビとの距離
 * @param {boolean} force - クールダウンを無視して強制的に再生するか
 * @returns {Promise<boolean>} 成功したかどうか
 */
export async function reactToZombie(count, distance = 0, force = false) {
  try {
    // バックエンドAPIのベースURLを設定
    const apiBaseUrl = 'http://127.0.0.1:8001';
    
    logDebug(`ゾンビ検出リアクション: count=${count}, distance=${distance}`);
    
    // リクエストパラメータを準備
    const params = new URLSearchParams({
      count,
      distance,
      force
    });
    
    // バックエンド側でゾンビ検出リアクションAPIを呼び出す
    const response = await fetch(`${apiBaseUrl}/api/voice/react_to_zombie?${params}`, {
      method: 'POST'
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      logError(`ゾンビ検出リアクションAPI呼び出し失敗: ${response.status}`);
      logError(`エラー詳細: ${errorText}`);
      return false;
    }
    
    // レスポンスのJSON解析
    const result = await response.json();
    
    // レスポンスから音声合成のために必要な情報を取得
    if (result.status === 'success' && result.reaction) {
      const { text, emotion, speaker_id } = result.reaction;
      
      // テキストがある場合は音声合成して再生
      if (text) {
        // プリセット音声を再生（予定通りに実装されている場合）
        // 音声合成を実行（キャッシュは使わない - 緊急性を優先）
        await requestVoiceSynthesis(text, emotion, speaker_id, null, false);
      }
      
      return true;
    }
    
    return false;
  } catch (error) {
    logError(`ゾンビ検出リアクションエラー: ${error.message}`);
    return false;
  }
}

export default {
  requestVoiceSynthesis,
  checkVoicevoxConnection,
  isAudioPlaying,
  clearAudioCache,
  reactToZombie,
  stopCurrentPlayback
}; 