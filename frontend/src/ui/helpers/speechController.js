/**
 * speechController.js
 * 
 * 吹き出しUIの制御を担当するモジュール
 * 
 * 注意: このファイルは互換性のためだけに存在します。
 * 内部ではspeechBridge.jsを通じてfunyaBubble.jsの新しいAPIを使用しています。
 */

// すべての関数をspeechBridgeから再エクスポート
export {
  showBubble,
  setText,
  hideBubble,
  clearText,
  showHordeModeSettings
} from './speechBridge.js';

// 注: 循環参照を避けるためにデフォルトエクスポートは行わない
// import speechBridge from './speechBridge.js';
// export default speechBridge;