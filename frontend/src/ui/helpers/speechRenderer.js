/**
 * speechRenderer.js
 * 吹き出しテキスト描画専用モジュール
 * 
 * 責務：吹き出し内のテキスト表示のみを担当
 * - テキストの設定（setText）
 * - テキストのクリア（clearText）
 * - 表示状態の制御（showBubble, hideBubble）
 */

/**
 * 吹き出しテキストを設定
 * @param {string} text - 表示テキスト
 */
export function setText(text) {
    if (!text) {
        console.error('setText: テキストが空です');
        return;
    }

    console.log('[setText] 開始: ', text);

    // 他に同じIDの要素が存在していないかチェック
    const allTextElements = document.querySelectorAll('#speechText');
    if (allTextElements.length > 1) {
        console.warn(`❗speechTextが複数存在しています (${allTextElements.length}個)。競合の可能性あり`);
        allTextElements.forEach((el, idx) => {
            if (idx > 0) {
                console.log(`🗑️ 重複するspeechText (${idx + 1}/${allTextElements.length})を削除します`);
                el.remove();
            }
        });
    }

    // テキスト要素の取得（重複削除後なので改めて取得）
    const textElement = document.getElementById('speechText');
    if (!textElement) {
        console.error('speechText要素が見つかりません');
        return;
    }

    console.log(`📝 テキストを設定: "${text.substring(0, 20)}${text.length > 20 ? '...' : ''}"`);

    // カレントテキストのバックアップ（デバッグ用）
    const currentText = textElement.textContent;
    console.log(`📋 設定前の現在値: "${currentText?.substring(0, 15) || '空'}"...`);

    // テキスト要素内を空にする前に、明示的にロックをかける
    textElement.dataset.locked = 'true';
    textElement.dataset.setTime = Date.now().toString();

    // データ属性にバックアップ（最初に設定）
    textElement.dataset.originalText = text;

    // テキスト要素内を空にする
    textElement.innerHTML = '';

    try {
        // 確実に表示されるよう、明示的なスタイルを持つspanを作成
        const spanElement = document.createElement('span');
        spanElement.textContent = text;
        spanElement.className = 'speech-text-content';
        // 明示的な色と表示スタイルを設定
        spanElement.style.cssText = `
      color: #4e3b2b !important; 
      display: inline-block !important;
      visibility: visible !important;
      opacity: 1 !important;
      width: 100% !important;
      font-size: 1.05rem !important;
      line-height: 1.6 !important;
      position: relative !important;
      z-index: 2147483647 !important;
      margin: 0 !important;
      padding: 0 !important;
      text-shadow: 0 0 1px rgba(255,255,255,0.7) !important; /* テキスト視認性向上 */
      background-color: transparent !important;
    `;
        textElement.appendChild(spanElement);

        // テキスト要素自体にも明示的なスタイルを設定
        textElement.style.cssText = `
      display: block !important;
      visibility: visible !important;
      opacity: 1 !important;
      color: #4e3b2b !important;
      width: 100% !important;
      padding: 5px !important;
      box-sizing: border-box !important;
      min-height: 50px !important;
      position: relative !important;
      z-index: 2147483647 !important;
      background-color: transparent !important;
    `;

    } catch (error) {
        console.error('テキスト設定エラー:', error);
    }

    // 強制的に再描画を促す
    void textElement.offsetHeight;

    // 設定後の確認
    setTimeout(() => {
        if (!textElement.textContent || textElement.textContent.trim() === '') {
            console.warn('⚠️ テキスト設定後も空になっています。再試行します。');

            // データ属性から復元を試みる
            if (textElement.dataset.originalText) {
                const spanElement = document.createElement('span');
                spanElement.textContent = textElement.dataset.originalText;
                spanElement.className = 'speech-text-content retry';
                spanElement.style.cssText = `
          color: #4e3b2b !important; 
          display: inline-block !important;
          visibility: visible !important;
          opacity: 1 !important;
          width: 100% !important;
          font-size: 1.05rem !important;
          line-height: 1.6 !important;
          position: relative !important;
          z-index: 2147483647 !important;
          margin: 0 !important;
          padding: 0 !important;
          text-shadow: 0 0 1px rgba(255,255,255,0.7) !important;
          background-color: transparent !important;
        `;
                textElement.innerHTML = '';
                textElement.appendChild(spanElement);
            } else {
                const textNode = document.createTextNode(text);
                textElement.appendChild(textNode);
            }
        }

        // 設定内容を確認（デバッグ用）
        console.log(`✅ setText: テキストを正常に設定しました →`, textElement.textContent);

        // 一定時間後にロックを解除（十分に時間を空けて）
        setTimeout(() => {
            // ロックを解除する前に内容を確認
            if (!textElement.textContent || textElement.textContent.trim() === '') {
                console.warn('⚠️ ロック解除前にテキストが空です。復元を試みます。');
                if (textElement.dataset.originalText) {
                    const spanElement = document.createElement('span');
                    spanElement.textContent = textElement.dataset.originalText;
                    spanElement.className = 'speech-text-content final-recovery';
                    spanElement.style.cssText = `
            color: #4e3b2b !important; 
            display: inline-block !important;
            visibility: visible !important;
            opacity: 1 !important;
            width: 100% !important;
            font-size: 1.05rem !important;
            line-height: 1.6 !important;
            position: relative !important;
            z-index: 2147483647 !important;
            margin: 0 !important;
            padding: 0 !important;
            text-shadow: 0 0 1px rgba(255,255,255,0.7) !important;
            background-color: transparent !important;
          `;
                    textElement.innerHTML = '';
                    textElement.appendChild(spanElement);
                }
            }

            textElement.dataset.locked = 'false';
            console.log('🔓 テキスト要素のロックを解除しました');
        }, 2000); // ロック解除時間をさらに延長（2秒）

    }, 100); // 確認時間を延長
}

/**
 * 吹き出しを表示する
 * @param {string} type - 吹き出しタイプ（default、warning、error、success、zombie_warningなど）
 * @param {string} text - 表示テキスト
 * @param {boolean} textForceSet - trueの場合、setText()を実行する。falseの場合は呼び出し元ですでにsetText()が実行されていると想定（デフォルト：true）
 */
export function showBubble(type = 'default', text = 'こんにちは！何かお手伝いしましょうか？', textForceSet = true) {
    console.log(`🗨️ 吹き出しを表示: ${type} - "${text.substring(0, 15)}..."`);

    // 他に同じIDの要素が存在していないかチェック
    const allBubbles = document.querySelectorAll('#speechBubble');
    if (allBubbles.length > 1) {
        console.warn(`❗speechBubbleが複数存在しています (${allBubbles.length}個)。競合の可能性あり`);
        allBubbles.forEach((el, idx) => {
            if (idx > 0) {
                console.log(`🗑️ 重複するspeechBubble (${idx + 1}/${allBubbles.length})を削除します`);
                el.remove();
            }
        });
    }

    // 吹き出し要素の取得（重複削除後なので改めて取得）
    const bubble = document.getElementById('speechBubble');
    if (!bubble) {
        console.error('speechBubble要素が見つかりません');
        return;
    }

    // テキスト要素の取得
    const textElement = document.getElementById('speechText');
    if (!textElement) {
        console.error('speechText要素が見つかりません');
        return;
    }

    // 必ず親子関係を確認し修正
    if (!bubble.contains(textElement)) {
        console.log('⚠️ speechTextがspeechBubbleの子要素ではありません。追加します。');

        // 既存の親がある場合は切り離す
        if (textElement.parentElement) {
            console.log('🔄 既存の親からspeechTextを切り離します');
            textElement.parentElement.removeChild(textElement);
        }

        // speechBubbleに追加
        bubble.appendChild(textElement);
        console.log('✅ speechTextをspeechBubbleに追加しました');
    }

    // textForceSet が true の場合にのみ setText を実行
    if (textForceSet) {
        // 先にテキストを設定（順序重要: テキスト設定→吹き出し表示）
        setText(text);
    }

    // 吹き出しのスタイルを設定
    bubble.className = 'speech-bubble';
    bubble.classList.add('show');
    bubble.classList.add('fixed-position');

    // 吹き出しに明示的なスタイルを設定
    bubble.style.cssText = `
    display: flex !important; 
    visibility: visible !important; 
    opacity: 1 !important;
    z-index: 2147483647 !important;
    position: fixed !important;
    top: 15% !important;
    right: 50px !important;
    background-color: rgba(255, 255, 255, 0.95) !important;
    border-radius: 20px !important;
    padding: 15px !important;
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.15) !important;
  `;

    // 強制的に再描画を促す
    void bubble.offsetHeight;

    // テキストが設定されているか確認（冗長でも念のため、最終確認）
    setTimeout(() => {
        if (!textElement.textContent || textElement.textContent.trim() === '') {
            console.warn('⚠️ 吹き出し表示後もテキストが空です。再設定します。');
            setText(text); // 念のため再設定
        } else {
            console.log('✅ 吹き出しとテキストが正常に表示されています');
            // 確認のために、テキストのスタイルとDOM構造を詳細にログ出力
            console.log('📊 テキスト要素の状態:', {
                'テキスト内容': textElement.textContent,
                'visibility': textElement.style.visibility,
                'opacity': textElement.style.opacity,
                'display': textElement.style.display,
                'z-index': textElement.style.zIndex,
                '子要素数': textElement.childElementCount,
                '親要素': textElement.parentElement?.id || '不明'
            });
        }
    }, 100);
}

/**
 * 吹き出しを非表示にする
 * @param {boolean} immediate - 即時に非表示にするかどうか（falseの場合はフェードアウト）
 */
export function hideBubble(immediate = false) {
    console.log('🗨️ 吹き出しを非表示にします', immediate ? '（即時）' : '（フェードアウト）');

    const bubble = document.getElementById('speechBubble');
    if (!bubble) {
        console.error('speechBubble要素が見つかりません');
        return;
    }

    if (immediate) {
        // 即時非表示
        bubble.style.display = 'none';
        bubble.classList.remove('show');
        bubble.classList.add('hide');
    } else {
        // フェードアウト
        bubble.classList.remove('show');
        bubble.classList.add('hide');

        // フェードアウト完了後に非表示
        setTimeout(() => {
            bubble.style.display = 'none';
        }, 500); // CSSのトランジション時間に合わせる
    }
}

/**
 * 吹き出しのテキストをクリアする
 */
export function clearText() {
    const textElement = document.getElementById('speechText');
    if (!textElement) {
        console.error('speechText要素が見つかりません');
        return;
    }

    // クリア前の内容をログ出力
    console.log(`🧹 clearText実行: クリア前の内容→ "${textElement.textContent?.substring(0, 20) || '空'}"...`);

    // ロックされている場合はクリアしない
    if (textElement.dataset.locked === 'true') {
        console.warn('⚠️ テキスト要素がロックされているため、クリアをスキップします');
        const lockTime = textElement.dataset.setTime ? (Date.now() - parseInt(textElement.dataset.setTime)) / 1000 : 'unknown';
        console.log(`🔒 ロック中: ${lockTime}秒前からロック中 (元のテキスト: ${textElement.dataset.originalText?.substring(0, 15) || '不明'}...)`);
        return;
    }

    // ロック状態を解除
    textElement.dataset.locked = 'false';

    // データ属性をクリア
    textElement.dataset.originalText = '';
    textElement.dataset.setTime = '';

    // テキスト要素内を空にする
    textElement.innerHTML = '';

    // 空のスパンを追加（CSSセレクタで.speech-text:emptyを回避するため）
    const emptySpan = document.createElement('span');
    emptySpan.className = 'speech-text-content empty';
    emptySpan.style.cssText = `
    display: inline-block !important;
    width: 100% !important;
    min-height: 20px !important;
  `;
    textElement.appendChild(emptySpan);

    console.log('✅ テキストを正常にクリアしました');
} 