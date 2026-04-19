/**
 * 秘書たんアプリ - バックエンド起動スクリプト
 * 
 * Pythonバックエンドを起動し、準備完了まで待機します 🐍
 */

const { spawn } = require('child_process');
const { waitForEndpoint } = require('../utils/process-utils');

/**
 * バックエンドサーバーを起動します
 * @param {Object} config 設定オブジェクト
 * @param {number} config.port 使用するポート
 * @returns {Promise<Object>} 起動したプロセスと成功状態を含むオブジェクト
 */
const startBackend = async (config) => {
  const { port } = config;

  console.log(`🐈 Pythonバックエンドを起動しています... (ポート: ${port})`);

  // バックエンド起動
  const backendProcess = spawn('python', [
    '-m', 'uvicorn', 'backend.main:app', '--port', port
  ], {
    stdio: 'inherit',
    shell: true
  });

  backendProcess.on('close', (code) => {
    console.log(`💫 バックエンドプロセスが終了しました (コード: ${code})`);
  });

  // エラーハンドリング
  backendProcess.on('error', (err) => {
    console.error(`💦 バックエンドプロセスの起動中にエラーが発生しました:`, err);
  });

  // バックエンドが応答するまで待機
  const backendUrl = `http://localhost:${port}/`;
  const backendReady = await waitForEndpoint(backendUrl);

  return {
    process: backendProcess,
    ready: backendReady
  };
};

// 単体実行の場合のエントリーポイント
if (require.main === module) {
  const port = process.env.BACKEND_PORT || 8001;

  startBackend({ port })
    .then(({ process, ready }) => {
      if (ready) {
        console.log(`✨ バックエンドが起動しました (PID: ${process.pid})`);
      } else {
        console.warn('⚠️ バックエンドの準備ができませんでした');
      }
    })
    .catch(err => {
      console.error('💔 バックエンド起動中にエラーが発生しました:', err);
      process.exit(1);
    });
}

module.exports = startBackend; 