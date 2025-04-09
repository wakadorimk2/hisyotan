
// ドラッグ処理の設定を分離
export function setupDragBehavior(element) {
  if (!element) return;

  let isDragging = false;
  let startPos = { x: 0, y: 0 };

  // マウスダウン時の処理
  element.addEventListener('mousedown', (e) => {
    // 左クリックの場合のみドラッグ処理を行う
    if (e.button === 0) {
      // 開始位置を記録
      startPos = { x: e.clientX, y: e.clientY };
      console.log('🖱️ 立ち絵のマウスダウンを検出', startPos);
    }
  });

  // マウス移動時の処理
  document.addEventListener('mousemove', (e) => {
    // 左ボタンが押されている場合のみドラッグ判定
    if (e.buttons === 1 && startPos.x !== 0) {
      // 少し動いたらドラッグと判定
      const diffX = Math.abs(e.clientX - startPos.x);
      const diffY = Math.abs(e.clientY - startPos.y);

      // 5px以上動いたらドラッグと判定
      if (diffX > 5 || diffY > 5) {
        element._isDragging = true;

        // Electronにウィンドウドラッグの開始を通知
        if (window.electron && window.electron.ipcRenderer) {
          window.electron.ipcRenderer.send('start-window-drag');
        }
      }
    }
  });

  // マウスアップ時の処理
  document.addEventListener('mouseup', () => {
    // フラグをリセット
    setTimeout(() => {
      element._isDragging = false;
      startPos = { x: 0, y: 0 };
    }, 100);
  });
}