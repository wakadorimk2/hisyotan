/**
 * DOM構造とスタイルを確認し、問題があれば修正する
 */

export function verifyAndFixUIStructure() {
  console.log('🔍 UI構造を検証・修復します');

  // 必要なCSSクラスが適用されているか確認
  const assistantImage = document.getElementById('assistantImage');
  if (assistantImage) {
    if (!assistantImage.classList.contains('assistant-image')) {
      console.log('⚠️ 立ち絵にassistant-imageクラスが付与されていません。追加します。');
      assistantImage.classList.add('assistant-image');
    }

    // スタイル適用確認
    const computedStyle = getComputedStyle(assistantImage);
    if (computedStyle.width === '0px' || computedStyle.height === '0px') {
      console.log('⚠️ 立ち絵のサイズが0pxです。修正します。');

      // インラインスタイルで修正
      assistantImage.style.width = '256px';
      assistantImage.style.height = 'auto';
      assistantImage.style.minHeight = '250px';
      assistantImage.style.maxHeight = '400px';
      assistantImage.style.display = 'block';
      assistantImage.style.visibility = 'visible';
      assistantImage.style.opacity = '1';
      assistantImage.style.objectFit = 'contain';
      assistantImage.style.imageRendering = 'auto';
    }

    // ソースパスの確認
    if (!assistantImage.src || !assistantImage.src.includes('secretary_')) {
      console.log('⚠️ 立ち絵の画像パスが不正です。修正します。');
      assistantImage.src = '/assets/images/secretary_normal.png';
    }
  }

  // 吹き出しの構造確認
  const speechBubble = document.getElementById('speechBubble');
  if (speechBubble) {
    if (!speechBubble.classList.contains('speech-bubble')) {
      console.log('⚠️ 吹き出しにspeech-bubbleクラスが付与されていません。追加します。');
      speechBubble.classList.add('speech-bubble');
    }

    // スタイル適用確認
    const computedStyle = getComputedStyle(speechBubble);
    if (computedStyle.display === 'none' || computedStyle.visibility === 'hidden' || parseFloat(computedStyle.opacity) < 0.1) {
      console.log('⚠️ 吹き出しが非表示状態です。修正します。');

      // インラインスタイルで修正
      speechBubble.style.cssText = `
          display: flex !important;
          visibility: visible !important;
          opacity: 1 !important;
          position: fixed !important;
          z-index: 9999 !important;
        `;
    }

    // テキスト要素の確認
    const speechText = document.getElementById('speechText');
    if (!speechText) {
      console.log('⚠️ テキスト要素が見つかりません。作成します。');
      const newText = document.createElement('div');
      newText.id = 'speechText';
      newText.className = 'speech-text';
      newText.textContent = 'こんにちは！何かお手伝いしましょうか？';

      // 明示的なスタイル適用
      newText.style.cssText = `
        display: block !important;
        visibility: visible !important;
        opacity: 1 !important;
        color: #4e3b2b !important;
        width: 100% !important;
        min-height: 50px !important;
      `;

      speechBubble.appendChild(newText);
      console.log('✅ 新しいテキスト要素を作成しました');
    } else if (!speechText.textContent || speechText.textContent.trim() === '') {
      // ロックチェック前の状態を確認（デバッグ用）
      console.log('🔍 空のテキスト要素を検出: データ属性=', {
        locked: speechText.dataset.locked,
        originalText: speechText.dataset.originalText,
        setTime: speechText.dataset.setTime
      });

      // ロックされている場合は必ずdataset.originalTextから復元を試みる
      if (speechText.dataset.locked === 'true') {
        console.log('🔒 テキスト要素はロックされています。dataset.originalTextから復元します。');

        if (speechText.dataset.originalText) {
          console.log('🔄 ロックされたテキストを元のテキストから復元します: ', speechText.dataset.originalText);
          const spanElement = document.createElement('span');
          spanElement.textContent = speechText.dataset.originalText;
          spanElement.className = 'speech-text-content recovered-from-original';
          spanElement.style.cssText = `
              color: #4e3b2b !important; 
              display: inline-block !important;
              visibility: visible !important;
              opacity: 1 !important;
              width: 100% !important;
              font-size: 1.05rem !important;
              line-height: 1.6 !important;
            `;

          // 元のテキストを保持
          const originalText = speechText.dataset.originalText;

          // 安全にクリア（clearTextは呼ばない）
          speechText.innerHTML = '';

          // 要素追加
          speechText.appendChild(spanElement);

          console.log(`✅ テキストを復元しました: "${originalText.substring(0, 15)}..."`);
        } else {
          console.warn('⚠️ ロックされていますが、originalTextが設定されていません');
        }
      } else {
        // ロックされていない場合のみデフォルトテキストを設定
        console.log('⚠️ テキスト要素が空です。テキストを設定します。');

        // メッセージをランダムに選択
        const messages = [
          'こんにちは！何かお手伝いしましょうか？',
          'お疲れ様です！何かご質問はありますか？',
          'いつでもお声がけくださいね！',
        ];
        const randomMessage = messages[Math.floor(Math.random() * messages.length)];

        // spanを作成してスタイルを適用
        const spanElement = document.createElement('span');
        spanElement.textContent = randomMessage;
        spanElement.className = 'speech-text-content verifier-added';
        spanElement.style.cssText = `
          color: #4e3b2b !important; 
          display: inline-block !important;
          visibility: visible !important;
          opacity: 1 !important;
          width: 100% !important;
          font-size: 1.05rem !important;
          line-height: 1.6 !important;
        `;

        // 安全にクリア
        speechText.innerHTML = '';

        // 要素追加
        speechText.appendChild(spanElement);

        console.log(`✅ デフォルトテキストを設定しました: "${randomMessage}"`);
      }
    }
  }

  // 終了ボタンの確認と修復
  const quitButton = document.getElementById('quit-button');
  if (quitButton) {
    // テキスト内容を確認
    if (!quitButton.textContent || quitButton.textContent.trim() === '') {
      console.log('⚠️ 終了ボタンのテキストが空です。修正します。');
      quitButton.textContent = '❌';
    }

    // スタイル適用確認
    const computedStyle = getComputedStyle(quitButton);
    if (computedStyle.display === 'none' || computedStyle.visibility === 'hidden' || parseFloat(computedStyle.opacity) < 0.1) {
      console.log('⚠️ 終了ボタンが非表示状態です。修正します。');

      // インラインスタイルで修正
      quitButton.style.cssText = `
          display: flex !important;
          visibility: visible !important;
          opacity: 0.8 !important;
          -webkit-app-region: no-drag;
        `;
    }
  }

  console.log('✅ UI構造の検証・修復が完了しました');
}

/**
 * 重複する要素を削除するクリーンアップ関数
 */
export function cleanupDuplicateElements() {
  console.log('🧹 重複要素のクリーンアップを開始します');

  // 吹き出し要素の重複チェック
  const speechBubbles = document.querySelectorAll('#speechBubble');
  if (speechBubbles.length > 1) {
    console.log(`💬 重複する吹き出し要素が ${speechBubbles.length} 個見つかりました。古い要素を削除します。`);

    // 最初の要素以外を削除（インデックス1以降）
    for (let i = 1; i < speechBubbles.length; i++) {
      console.log(`🗑️ 吹き出し要素 ${i + 1}/${speechBubbles.length} を削除します`);
      speechBubbles[i].remove();
    }
  }

  // テキスト要素の重複チェック（テキスト内容を保持）
  const speechTexts = document.querySelectorAll('#speechText');
  let preservedText = ''; // 保持するテキスト内容

  if (speechTexts.length > 1) {
    console.log(`📝 重複するテキスト要素が ${speechTexts.length} 個見つかりました。内容を保持して古い要素を削除します。`);

    // すべての要素からテキスト内容を集める（空でないものを優先）
    for (let i = 0; i < speechTexts.length; i++) {
      const currentText = speechTexts[i].textContent?.trim();
      if (currentText && !preservedText) {
        preservedText = currentText;
        console.log(`💾 テキスト内容「${preservedText.substring(0, 15)}...」を保持します`);
      }

      // データ属性からオリジナルテキストも確認
      if (speechTexts[i].dataset.originalText && !preservedText) {
        preservedText = speechTexts[i].dataset.originalText;
        console.log(`💾 データ属性から「${preservedText.substring(0, 15)}...」を復元します`);
      }
    }

    // 最初の要素以外を削除（インデックス1以降）
    for (let i = 1; i < speechTexts.length; i++) {
      console.log(`🗑️ テキスト要素 ${i + 1}/${speechTexts.length} を削除します`);
      speechTexts[i].remove();
    }

    // 保持したテキストを残った要素に設定（空でない場合のみ）
    if (preservedText) {
      const remainingTextElement = document.getElementById('speechText');
      if (remainingTextElement) {
        console.log(`🔄 保持したテキストを残った要素に設定します: ${preservedText.substring(0, 15)}...`);
        remainingTextElement.textContent = preservedText;

        // データ属性も設定
        remainingTextElement.dataset.originalText = preservedText;
      }
    }
  }

  // 立ち絵要素の重複チェック
  const assistantImages = document.querySelectorAll('#assistantImage');
  if (assistantImages.length > 1) {
    console.log(`🖼️ 重複する立ち絵要素が ${assistantImages.length} 個見つかりました。古い要素を削除します。`);

    // 最初の要素以外を削除（インデックス1以降）
    for (let i = 1; i < assistantImages.length; i++) {
      console.log(`🗑️ 立ち絵要素 ${i + 1}/${assistantImages.length} を削除します`);
      assistantImages[i].remove();
    }
  }

  // quitボタン要素の重複チェック
  const quitButtons = document.querySelectorAll('#quit-button');
  if (quitButtons.length > 1) {
    console.log(`🚪 重複する終了ボタン要素が ${quitButtons.length} 個見つかりました。古い要素を削除します。`);

    // 最初の要素以外を削除（インデックス1以降）
    for (let i = 1; i < quitButtons.length; i++) {
      console.log(`🗑️ 終了ボタン要素 ${i + 1}/${quitButtons.length} を削除します`);
      quitButtons[i].remove();
    }
  }

  // pawボタン要素の重複チェック
  const pawButtons = document.querySelectorAll('#paw-button');
  if (pawButtons.length > 1) {
    console.log(`🐾 重複する肉球ボタン要素が ${pawButtons.length} 個見つかりました。古い要素を削除します。`);

    // 最初の要素以外を削除（インデックス1以降）
    for (let i = 1; i < pawButtons.length; i++) {
      console.log(`🗑️ 肉球ボタン要素 ${i + 1}/${pawButtons.length} を削除します`);
      pawButtons[i].remove();
    }
  }

  console.log('🧹 重複要素のクリーンアップが完了しました');
}