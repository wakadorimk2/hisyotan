/**
 * apiClient.js
 * APIリクエスト用のaxiosクライアントを提供
 */

import axios from 'axios';

// APIクライアントの設定
// 環境変数からAPIのベースURLを取得（デフォルトは127.0.0.1）
const API_HOST = window.electron?.apiHost || '127.0.0.1';
const BASE_URL = `http://${API_HOST}:8001`;

console.log(`🔌 API接続先: ${BASE_URL}`);

// axiosインスタンスの作成
const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
});

/**
 * 設定を更新するAPIを呼び出す
 * @param {string} key - 設定キー
 * @param {boolean|string|number} value - 設定値
 * @returns {Promise<Object>} - レスポンスデータ
 */
export async function updateSetting(key, value) {
  try {
    console.log(`🔄 設定更新API呼び出し: ${key}=${value}`);
    const response = await apiClient.post('/api/settings/update', {
      key,
      value
    });
    console.log('✅ 設定更新API成功:', response.data);
    return response.data;
  } catch (error) {
    console.error('❌ 設定更新APIエラー:', error);
    throw error;
  }
}

/**
 * すべての設定を取得するAPIを呼び出す
 * @returns {Promise<Object>} - レスポンスデータ
 */
export async function getAllSettings() {
  try {
    console.log('🔍 全設定取得API呼び出し');
    const response = await apiClient.get('/api/settings/all');
    console.log('✅ 全設定取得API成功:', response.data);
    return response.data;
  } catch (error) {
    console.error('❌ 全設定取得APIエラー:', error);
    throw error;
  }
}

/**
 * 設定を取得するAPIを呼び出す（getAllSettingsのエイリアス）
 * @returns {Promise<Object>} - レスポンスデータ
 */
export async function getSettings() {
  console.log('🔍 getSettings関数が呼び出されました');
  return getAllSettings();
}

/**
 * ふにゃの見守り状態を取得するAPIを呼び出す
 * @returns {Promise<Object>} - レスポンスデータ（watching: boolean を含む）
 */
export async function getFunyaStatus() {
  try {
    console.log('🐈️ ふにゃ状態取得API呼び出し');
    const response = await apiClient.get('/api/funya/status');
    console.log('✅ ふにゃ状態取得API成功:', response.data);
    return response.data;
  } catch (error) {
    console.error('❌ ふにゃ状態取得APIエラー:', error);
    throw error;
  }
}

export default {
  updateSetting,
  getAllSettings,
  getSettings,
  getFunyaStatus
}; 