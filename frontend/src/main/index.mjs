/**
 * ふにゃ秘書たんデスクトップアプリのメインプロセス
 * Electronの起動と統合UIの管理を行います
 */

// 日本語コンソール出力のために文字コードを設定
if (process.platform === 'win32') {
  process.env.CHCP = '65001'; // UTF-8に設定

  // コマンドプロンプトのコードページをUTF-8に設定
  try {
    // child_processをESM形式でインポート
    import('child_process').then(({ execSync }) => {
      execSync('chcp 65001');
      console.log('🌸 コンソール出力の文字コードをUTF-8に設定しました');
    }).catch(e => {
      console.error('❌ コードページの設定に失敗しました:', e);
    });
  } catch (e) {
    console.error('❌ 文字コード設定エラー:', e);
  }
}

import { app, BrowserWindow, ipcMain, session } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import fetch from 'node-fetch';
import iconv from 'iconv-lite';
import fs from 'fs';

// ESモジュールでの__dirnameの代替
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 開発モードかどうかを判定
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
const isDevCSP = process.env.ELECTRON_CSP_DEV === 'true';

// .envファイルから環境変数を読み込む
function loadEnvVars() {
  try {
    const envPath = app.isPackaged
      ? path.join(process.resourcesPath, '.env')
      : path.join(process.cwd(), '.env');

    console.log(`🔍 環境変数ファイルを探しています: ${envPath}`);

    if (fs.existsSync(envPath)) {
      console.log('✅ .envファイルが見つかりました');
      const envContent = fs.readFileSync(envPath, 'utf8');
      const envVars = {};

      // .envファイルの各行をパース
      envContent.split('\n').forEach(line => {
        // コメントや空行をスキップ
        if (!line || line.startsWith('#')) return;

        // KEY=VALUE形式の行を解析
        const match = line.match(/^\s*([^=]+)=(.*)$/);
        if (match) {
          const key = match[1].trim();
          const value = match[2].trim().replace(/^['"]|['"]$/g, ''); // 引用符を削除
          envVars[key] = value;
          // 環境変数が未設定の場合のみ設定
          if (process.env[key] === undefined) {
            process.env[key] = value;
          }
        }
      });

      console.log('✨ 環境変数を読み込みました');
      return envVars;
    } else {
      console.warn('⚠️ .envファイルが見つかりません');
      return {};
    }
  } catch (error) {
    console.error('❌ 環境変数読み込みエラー:', error);
    return {};
  }
}

// アプリ起動時に環境変数を読み込む
const envVars = loadEnvVars();
console.log(`🌸 バックエンドポート設定: ${process.env.PORT || '(デフォルト:8000)'}`);

// バックエンド初期化状態フラグ
let isBackendInitialized = false;

// セキュリティポリシーの設定
const setContentSecurityPolicy = () => {
  // 開発モードと本番モードでCSPを分ける
  const csp = isDev ?
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; connect-src 'self' http://localhost:* http://127.0.0.1:* ws://localhost:* ws://127.0.0.1:*; style-src 'self' 'unsafe-inline'; font-src 'self' data:; img-src 'self' data:;" :
    "default-src 'self'; script-src 'self'; connect-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self' data:; img-src 'self' data:;";

  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [csp]
      }
    });
  });

  console.log(`🔒 Content-Security-Policyを設定しました (${isDev ? '開発モード' : '本番モード'})`);
};

// 環境変数からアプリ名を取得
const appNameFromEnv = process.env.HISYOTAN_APP_NAME || null;
if (appNameFromEnv) {
  console.log(`アプリ名を環境変数から取得: ${appNameFromEnv}`);
}

// 環境変数からpreloadPathを取得
const preloadPathFromEnv = process.env.HISYOTAN_PRELOAD_PATH || null;
if (preloadPathFromEnv) {
  console.log(`preloadパスを環境変数から取得: ${preloadPathFromEnv}`);
}

// メインウィンドウ
let mainWindow = null;

// バックエンドサーバー起動管理
let backendProcess = null;
let backendPID = null;

// CSP設定を開発モードで無効化する処理（開発時のみ）
function setupDevCSP() {
  if (isDevCSP) {
    console.log('🔓 開発モード: CSP制限を一時的に緩和します');
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
      delete details.responseHeaders['content-security-policy'];
      callback({
        cancel: false,
        responseHeaders: details.responseHeaders
      });
    });
  }
}

// バックエンドサーバーの起動
async function startBackendServer() {
  try {
    // ポート環境変数を取得
    const backendPort = parseInt(process.env.PORT || '8000', 10);
    console.log(`🔍 バックエンドポートをチェックします: ${backendPort}`);

    // ポートが既に使用されているか確認
    const isPortInUse = await checkPortInUse(backendPort);
    if (isPortInUse) {
      console.log(`✅ ポート ${backendPort} は既に使用中です。バックエンドは既に起動していると判断します。`);
      isBackendInitialized = true;

      // バックエンドの接続確認
      const isConnected = await checkBackendConnection(backendPort);
      if (isConnected) {
        console.log('🌸 既存のバックエンドサーバーに接続できました');
        return true;
      } else {
        console.warn('⚠️ ポートは使用中ですが、バックエンドに接続できません。別のサービスがポートを使用している可能性があります。');
        isBackendInitialized = false;
        return false;
      }
    }

    // 既存のバックエンドプロセスを確認
    if (backendProcess !== null) {
      console.log('🔄 既存のバックエンドプロセスを終了します');
      try {
        backendProcess.kill('SIGTERM');
        await new Promise(resolve => setTimeout(resolve, 1000));
        if (backendProcess.exitCode === null) {
          console.log('⚠️ プロセスが終了しないため、強制終了します');
          backendProcess.kill('SIGKILL');
        }
      } catch (error) {
        console.error('❌ プロセス終了エラー:', error);
      }
      backendProcess = null;
    }

    console.log('🚀 バックエンドサーバーを起動します...');

    // Pythonの実行パスを取得
    const pythonPath = app.isPackaged
      ? path.join(process.resourcesPath, 'python', 'python.exe')
      : 'python';

    // バックエンドのスクリプトパス
    const backendScript = fileURLToPath(new URL('../../../backend/main.py', import.meta.url));

    // バックエンドサーバーを起動
    backendProcess = spawn(pythonPath, [backendScript], {
      stdio: 'pipe',
      detached: false,
      windowsHide: true,
      env: {
        ...process.env,  // 既存の環境変数を引き継ぐ
        PORT: backendPort.toString()  // ポート番号を設定
      }
    });

    // プロセスIDを記録
    backendPID = backendProcess.pid;
    console.log(`🆔 バックエンドプロセスID: ${backendPID}`);

    // 標準出力のリスニング
    backendProcess.stdout.on('data', (data) => {
      const output = iconv.decode(data, 'utf-8').trim();
      console.log(`📝 バックエンド出力: ${output}`);
    });

    // エラー出力のリスニング
    backendProcess.stderr.on('data', (data) => {
      const output = iconv.decode(data, 'utf-8').trim();
      console.error(`❌ バックエンドエラー: ${output}`);
    });

    // プロセス終了時の処理
    backendProcess.on('close', (code) => {
      console.log(`🛑 バックエンドサーバーが終了しました (コード: ${code})`);
      backendProcess = null;
      backendPID = null;
    });

    // バックエンドサーバーの起動を待機
    await new Promise((resolve) => setTimeout(resolve, 2000));
    console.log('✅ バックエンドサーバー起動待機完了');

    // バックエンドの接続確認
    const isConnected = await checkBackendConnection(backendPort);
    if (!isConnected) {
      throw new Error('バックエンドサーバーへの接続に失敗しました');
    }

    return true;
  } catch (error) {
    console.error('❌ バックエンドサーバー起動エラー:', error);
    if (backendProcess) {
      backendProcess.kill('SIGKILL');
      backendProcess = null;
    }
    return false;
  }
}

// ポートが使用中かどうかを確認する関数
async function checkPortInUse(port) {
  try {
    console.log(`ポート ${port} が使用中かチェックしています...`);

    // サーバーを作成して指定ポートをリッスンしようとする
    const net = await import('net');

    return new Promise((resolve) => {
      const server = net.createServer();

      server.once('error', (err) => {
        // ERREDDRINUSEエラーが発生した場合、ポートは使用中
        if (err.code === 'EADDRINUSE') {
          console.log(`ポート ${port} は既に使用中です`);
          resolve(true);
        } else {
          console.error('ポートチェックエラー:', err);
          resolve(false);
        }
      });

      server.once('listening', () => {
        // サーバーがリッスンできた場合、ポートは利用可能
        server.close();
        console.log(`ポート ${port} は利用可能です`);
        resolve(false);
      });

      // ポートをチェック（127.0.0.1でのみチェック）
      server.listen(port, '127.0.0.1');
    });
  } catch (error) {
    console.error('ポートチェック中にエラーが発生しました:', error);
    return false;
  }
}

// バックエンド接続確認
async function checkBackendConnection(port) {
  try {
    const backendPort = port || parseInt(process.env.PORT || '8000', 10);
    console.log(`バックエンド接続確認中... ポート: ${backendPort}`);

    // タイムアウト付きの接続確認
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    try {
      const response = await fetch(`http://127.0.0.1:${backendPort}/`, {
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        console.log('バックエンド接続成功:', data);
        isBackendInitialized = true;
        return true;
      } else {
        console.error('バックエンド接続エラー:', response.status);
        isBackendInitialized = false;
        return false;
      }
    } catch (fetchError) {
      clearTimeout(timeoutId);
      console.error('バックエンド接続確認エラー:', fetchError);
      console.log('バックエンドが起動していない可能性があります。再試行するか、別途バックエンドを起動してください。');
      isBackendInitialized = false;
      return false;
    }
  } catch (error) {
    console.error('バックエンド接続確認エラー (外部):', error);
    isBackendInitialized = false;
    return false;
  }
}

// バックエンドプロセスのPIDを取得する関数
// [将来使用予定] Electron終了時にバックエンドプロセス（Python）も終了させるためのPID取得関数
// 未使用だが保持しておくこと（Ctrl+CでのプロセスKill対応を予定）
// eslint-disable-next-line no-unused-vars
async function getBackendPID() {
  try {
    console.log('バックエンドプロセスのPIDを取得します...');

    // タイムアウト付きの接続確認
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    try {
      const response = await fetch('http://127.0.0.1:8000/api/pid', {
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        console.log('バックエンドPID取得成功:', data);

        // PIDを保存
        if (data.pid) {
          backendPID = data.pid;
          console.log(`🆔 バックエンド実際のプロセスID: ${backendPID}`);

          // メインプロセスにPIDを登録
          try {
            // ESM環境からElectronのIPC呼び出し
            const { ipcRenderer } = await import('electron');
            const registered = await ipcRenderer.invoke('register-backend-pid', backendPID);
            console.log(`🔄 PID登録結果: ${registered ? '成功' : '失敗'}`);
          } catch (ipcError) {
            console.error('IPC呼び出しエラー:', ipcError);

            // 代替手段: fetchを使ってメインプロセスのAPIを呼び出す
            try {
              const port = process.env.ELECTRON_PORT || 3000;
              await fetch(`http://localhost:${port}/register-backend-pid?pid=${backendPID}`);
              console.log('代替手段でPID登録成功');
            } catch (fetchError) {
              console.error('代替手段でのPID登録失敗:', fetchError);
            }
          }

          return backendPID;
        }
        return null;
      } else {
        console.error('バックエンドPID取得エラー:', response.status);
        return null;
      }
    } catch (fetchError) {
      clearTimeout(timeoutId);
      console.error('バックエンドPID取得エラー:', fetchError);
      return null;
    }
  } catch (error) {
    console.error('バックエンドPID取得エラー (外部):', error);
    return null;
  }
}

/**
 * IPC通信の設定
 * レンダラープロセスとの通信を処理
 */
function setupIPC() {
  console.log('🔌 IPC通信の設定を開始します');

  // バックエンドPIDの登録
  ipcMain.handle('register-backend-pid', async (event, pid) => {
    console.log(`🔄 バックエンドPID登録要求: ${pid}`);
    try {
      backendPID = pid;
      console.log(`✅ バックエンドPIDを登録しました: ${backendPID}`);
      return true;
    } catch (error) {
      console.error('❌ バックエンドPID登録エラー:', error);
      return false;
    }
  });

  // バックエンドPIDの取得
  ipcMain.handle('get-backend-pid', () => {
    console.log(`🔍 バックエンドPID取得要求: ${backendPID}`);
    return backendPID;
  });

  // ウィンドウを最前面に表示するハンドラ
  ipcMain.handle('set-always-on-top', (event, value, level) => {
    console.log(`🔝 alwaysOnTop設定要求: ${value}, レベル: ${level || 'デフォルト'}`);
    try {
      if (mainWindow) {
        if (level) {
          mainWindow.setAlwaysOnTop(value, level);
        } else {
          mainWindow.setAlwaysOnTop(value);
        }
        const isAlwaysOnTop = mainWindow.isAlwaysOnTop();
        console.log(`✅ alwaysOnTop設定完了: ${isAlwaysOnTop}`);
        return isAlwaysOnTop;
      }
      return false;
    } catch (error) {
      console.error('❌ alwaysOnTop設定エラー:', error);
      return false;
    }
  });

  // ウィンドウの最前面表示状態を取得するハンドラ
  ipcMain.handle('get-always-on-top', () => {
    if (mainWindow) {
      const isAlwaysOnTop = mainWindow.isAlwaysOnTop();
      console.log(`🔍 alwaysOnTop状態取得: ${isAlwaysOnTop}`);
      return isAlwaysOnTop;
    }
    return false;
  });

  // ウィンドウを最前面に強制的に表示するハンドラ
  ipcMain.handle('force-front', () => {
    console.log('🔝 ウィンドウを最前面に強制表示します');
    try {
      if (mainWindow) {
        // 一度falseにしてから再度trueに設定
        mainWindow.setAlwaysOnTop(false);
        setTimeout(() => {
          mainWindow.setAlwaysOnTop(true, 'screen-saver');
          // フォーカスも設定
          mainWindow.focus();
        }, 100);
        return true;
      }
      return false;
    } catch (error) {
      console.error('❌ 最前面強制表示エラー:', error);
      return false;
    }
  });

  // アセットのパスを解決するハンドラ
  ipcMain.handle('resolve-asset-path', (event, relativePath) => {
    console.log(`🔍 アセットパス解決要求: ${relativePath}`);
    try {
      // パスの正規化: 先頭の'assets/'または'/assets/'を削除
      const normalizedPath = relativePath.replace(/^\/?(assets\/)/i, '');

      // 開発モードと本番モードでのパス解決を分ける
      let assetPath;
      if (isDev) {
        assetPath = path.join(process.cwd(), 'frontend/public/assets', normalizedPath);
      } else {
        assetPath = path.join(app.getAppPath(), 'frontend/public/assets', normalizedPath);
      }

      console.log(`✅ 解決されたパス: ${assetPath}`);
      return assetPath;
    } catch (error) {
      console.error('❌ アセットパス解決エラー:', error);
      return relativePath; // エラー時は元のパスをそのまま返す
    }
  });

  // アプリケーション終了ハンドラ
  ipcMain.handle('quit-app', () => {
    console.log('🚪 アプリケーション終了要求を受信しました');
    try {
      app.quit();
      return true;
    } catch (error) {
      console.error('❌ アプリケーション終了エラー:', error);
      return false;
    }
  });

  // app:quit イベントリスナー（既存の互換性のため）
  ipcMain.on('app:quit', () => {
    console.log('🚪 app:quit イベントを受信しました');
    try {
      app.quit();
    } catch (error) {
      console.error('❌ app:quit イベント処理エラー:', error);
    }
  });

  // quit-app イベントリスナー（invoke以外の方法でも受け付けるため）
  ipcMain.on('quit-app', () => {
    console.log('🚪 quit-app イベントを受信しました');
    try {
      app.quit();
    } catch (error) {
      console.error('❌ quit-app イベント処理エラー:', error);
    }
  });

  console.log('✨ IPC通信の設定が完了しました');
}

/**
 * メインウィンドウの作成
 */
function createWindow() {
  console.log('🪟 メインウィンドウを作成します');

  // メインウィンドウの設定
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      allowRunningInsecureContent: false,
      webSecurity: true,
      preload: path.join(__dirname, 'preload', 'preload.js')
    },
    icon: path.join(__dirname, '..', 'assets', 'icon.png')
  });

  // CSPの設定
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self';" +
          "script-src 'self' 'unsafe-inline' 'unsafe-eval';" +
          "style-src 'self' 'unsafe-inline';" +
          "img-src 'self' data:;" +
          "font-src 'self' data:;" +
          "connect-src 'self' https://api.voicevox.jp;"
        ]
      }
    });
  });

  // 開発モードの場合はデベロッパーツールを開く
  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  // メインウィンドウにindex.htmlを読み込む
  mainWindow.loadFile(path.join(__dirname, '..', 'index.html'));

  return mainWindow;
}

/**
 * アプリケーションの初期化
 */
app.whenReady().then(async () => {
  console.log('Electronアプリケーションの初期化を開始しています...');

  try {
    // 開発モードの場合、CSP制限を緩和
    if (isDev) {
      setupDevCSP();
    }

    // CSP設定を先に適用
    setContentSecurityPolicy();

    // メインウィンドウを作成
    mainWindow = createWindow();

    // 最前面表示を強制する（優先度を screen-saver に設定）
    console.log('🔝 ウィンドウの最前面表示設定を適用します');
    mainWindow.setAlwaysOnTop(true, 'screen-saver');
    console.log('✅ 最前面表示を優先度: screen-saverで設定しました');

    // IPC通信を設定
    setupIPC();

    // DOMContentLoadedイベントを待ってからUI初期化
    mainWindow.webContents.on('dom-ready', () => {
      console.log('🌸 DOMの読み込みが完了しました');
      // UI初期化処理をここに移動
      mainWindow.webContents.executeJavaScript(`
        document.addEventListener('DOMContentLoaded', () => {
          console.log('🎨 UI初期化を開始します');
          // UI要素の初期化処理
          const initUI = () => {
            const speechBubble = document.getElementById('speechBubble');
            const speechText = document.getElementById('speechText');
            const errorBubble = document.getElementById('errorBubble');
            const errorText = document.getElementById('errorText');
            const statusIndicator = document.getElementById('statusIndicator');
            const speechSettingUI = document.getElementById('speechSettingUI');
            
            if (!speechBubble) console.warn('❌ speechBubble要素が見つかりません');
            if (!speechText) console.warn('❌ speechText要素が見つかりません');
            if (!errorBubble) console.warn('❌ errorBubble要素が見つかりません');
            if (!errorText) console.warn('❌ errorText要素が見つかりません');
            if (!statusIndicator) console.warn('❌ statusIndicator要素が見つかりません');
            if (!speechSettingUI) console.warn('❌ speechSettingUI要素が作成できません');
            
            // 要素が存在する場合のみ初期化を続行
            if (speechBubble && speechText && errorBubble && errorText && statusIndicator && speechSettingUI) {
              console.log('✨ UI要素の初期化が完了しました');
              // ここでUIの初期化処理を続行
            }
          };
          
          // 初期化を実行
          initUI();
        });
      `);
    });

    // バックエンドサーバーを起動
    await startBackendServer();

    // 開発モードでの追加処理
    if (isDev) {
      console.log('開発モードで実行中...');
      // 必要に応じて開発モード固有の処理を追加
    }

    // macOSでの対応
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        mainWindow = createWindow();
      }
    });
  } catch (error) {
    console.error('アプリケーション初期化エラー:', error);
  }
});

/**
 * すべてのウィンドウが閉じられたときの処理
 */
app.on('window-all-closed', () => {
  // macOS以外の場合はアプリケーションを終了
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

/**
 * アプリケーション終了時の処理
 */
app.on('before-quit', async () => {
  console.log('🛑 アプリケーション終了処理を開始します...');

  if (backendProcess) {
    console.log('🔄 バックエンドサーバーを終了しています...');
    try {
      // まずは正常終了を試みる
      backendProcess.kill('SIGTERM');
      await new Promise(resolve => setTimeout(resolve, 1000));

      // プロセスがまだ生きている場合は強制終了
      if (backendProcess.exitCode === null) {
        console.log('⚠️ プロセスが終了しないため、強制終了します');
        backendProcess.kill('SIGKILL');
      }
    } catch (error) {
      console.error('❌ バックエンド終了エラー:', error);
    }
    backendProcess = null;
  }
});

/**
 * プロセス終了時の処理
 */
process.on('exit', () => {
  console.log('プロセス終了: アプリケーションのクリーンアップを行います');

  // バックエンドサーバーを確実に終了
  if (backendProcess !== null) {
    console.log('プロセス終了時にバックエンドサーバーを強制終了します');
    backendProcess.kill('SIGKILL');
    backendProcess = null;
  }
}); 