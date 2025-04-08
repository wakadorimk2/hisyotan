/**
 * volumeSlider.js
 * 音量スライダーUIコンポーネントを提供するモジュール
 * uiBuilder.jsから分離した音量スライダー関連のコード
 */

import { getVolume, setVolume } from '@voice/speechVoice.js';
import { logDebug } from '@core/logger.js';

// 音量アイコンの状態
const ICONS = {
    HIGH: '🔊',
    MEDIUM: '🔉',
    LOW: '🔈',
    MUTE: '🔇'
};

/**
 * 音量に応じたアイコンを取得する
 * @param {number} volume - 音量（0.0〜1.0）
 * @returns {string} - 音量アイコン文字
 */
function getVolumeIcon(volume) {
    if (volume <= 0) return ICONS.MUTE;
    if (volume < 0.3) return ICONS.LOW;
    if (volume < 0.7) return ICONS.MEDIUM;
    return ICONS.HIGH;
}

/**
 * 音量値を表示用にフォーマットする
 * @param {number} volume - 音量（0.0〜1.0）
 * @returns {string} - フォーマットされた音量表示
 */
function formatVolumeValue(volume) {
    return `${Math.round(volume * 100)}%`;
}

/**
 * カスタムスライダー用の要素を作成する
 * @param {number} initialValue - 初期値（0〜100）
 * @param {Function} onChangeCallback - 値変更時のコールバック関数
 * @returns {Object} - スライダー関連の要素と制御メソッド
 */
function createCustomSlider(initialValue, onChangeCallback) {
    logDebug('🔍 createCustomSlider が呼び出されました: initialValue=' + initialValue);

    // スライダーコンテナ
    const sliderContainer = document.createElement('div');
    sliderContainer.className = 'slider-container custom-slider-container';
    sliderContainer.id = 'volumeSlider'; // 既存コードと互換性を持たせるためにIDを設定
    sliderContainer.style.position = 'relative';
    sliderContainer.style.width = '100%';
    sliderContainer.style.height = '120px';
    sliderContainer.style.display = 'flex';
    sliderContainer.style.flexDirection = 'column';
    sliderContainer.style.alignItems = 'center';
    sliderContainer.style.justifyContent = 'center';
    sliderContainer.style.border = '1px dashed rgba(169, 144, 225, 0.3)'; // デバッグ用に境界を表示

    // スライダートラック（背景バー）
    const sliderTrack = document.createElement('div');
    sliderTrack.className = 'custom-slider-track';
    sliderTrack.style.position = 'absolute';
    sliderTrack.style.width = '6px';
    sliderTrack.style.height = '100px';
    sliderTrack.style.background = 'rgba(220, 200, 255, 0.7)';
    sliderTrack.style.borderRadius = '10px';
    sliderTrack.style.boxShadow = 'inset 0 2px 4px rgba(0, 0, 0, 0.1)';

    // スライダー進捗バー（塗りつぶし部分）
    const sliderFill = document.createElement('div');
    sliderFill.className = 'custom-slider-fill';
    sliderFill.style.position = 'absolute';
    sliderFill.style.bottom = '0';
    sliderFill.style.width = '6px';
    sliderFill.style.background = 'rgba(169, 144, 225, 0.6)';
    sliderFill.style.borderRadius = '10px';
    sliderFill.style.transition = 'height 0.1s ease';

    // スライダーつまみ
    const sliderThumb = document.createElement('div');
    sliderThumb.className = 'custom-slider-thumb';
    sliderThumb.style.position = 'absolute';
    sliderThumb.style.width = '20px';
    sliderThumb.style.height = '20px';
    sliderThumb.style.background = 'hotpink'; // 目立つ色に変更してデバッグ
    sliderThumb.style.borderRadius = '50%';
    sliderThumb.style.boxShadow = '0 2px 5px rgba(0, 0, 0, 0.2)';
    sliderThumb.style.border = '2px solid rgba(255, 255, 255, 0.8)';
    sliderThumb.style.cursor = 'pointer';
    sliderThumb.style.zIndex = '10';
    sliderThumb.style.transition = 'transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)';
    sliderThumb.style.left = '50%';
    sliderThumb.style.transform = 'translateX(-50%)';
    sliderThumb.style.visibility = 'visible'; // 初期状態でも必ず表示
    sliderThumb.style.display = 'block'; // 確実に表示するためdisplayも設定
    sliderThumb.style.bottom = '50px'; // 初期位置を中央に設定

    logDebug('🔴 スライダーつまみ要素を生成しました');

    // スライダー値表示（オプション）
    const sliderValue = document.createElement('div');
    sliderValue.className = 'custom-slider-value';
    sliderValue.style.position = 'absolute';
    sliderValue.style.top = '-25px';
    sliderValue.style.left = '50%';
    sliderValue.style.transform = 'translateX(-50%)';
    sliderValue.style.fontSize = '10px';
    sliderValue.style.color = 'rgba(147, 112, 219, 0.9)';
    sliderValue.style.opacity = '0';
    sliderValue.style.transition = 'opacity 0.3s ease';

    // 要素を組み立て
    logDebug('🔄 スライダー要素を組み立てます');
    sliderTrack.appendChild(sliderFill);
    sliderContainer.appendChild(sliderTrack);
    sliderContainer.appendChild(sliderThumb); // つまみを追加
    sliderContainer.appendChild(sliderValue);

    // DOM追加後の確認
    logDebug(`📊 DOM構成確認: sliderContainer子要素数=${sliderContainer.childElementCount}`);
    if (sliderContainer.contains(sliderThumb)) {
        logDebug('✅ sliderThumbはsliderContainerに含まれています');
    } else {
        logDebug('❌ sliderThumbがsliderContainerに含まれていません');
    }

    // 現在の値
    let currentValue = initialValue || 0;

    // スライダーの値とUIを更新する関数
    function updateSliderUI(value) {
        // 値を0〜100の範囲に制限
        value = Math.max(0, Math.min(100, value));
        currentValue = value;

        // デバッグ出力
        logDebug(`📝 スライダー値を更新: ${value}%`);

        // つまみと塗りつぶしバーの位置を更新
        const trackHeight = sliderTrack.offsetHeight || 100; // offsetHeightが0の場合は100をデフォルト値とする
        const position = (value / 100) * trackHeight;

        logDebug(`📏 スライダーの位置計算: trackHeight=${trackHeight}, position=${position}, value=${value}`);

        // つまみの位置計算を修正（位置が負にならないように補正）
        const thumbPosition = Math.max(0, position - 10); // マイナス値にならないよう制限
        sliderThumb.style.bottom = `${thumbPosition}px`;
        sliderFill.style.height = `${position}px`;

        // CSSで必ず表示されるように強制
        sliderThumb.style.visibility = 'visible';
        sliderThumb.style.display = 'block'; // 確実に表示するためdisplayも設定
        sliderFill.style.visibility = 'visible';
        sliderTrack.style.visibility = 'visible';

        // 値表示を更新
        sliderValue.textContent = `${value}%`;

        // コールバック関数の呼び出し
        if (onChangeCallback && typeof onChangeCallback === 'function') {
            onChangeCallback(value / 100);
        }
    }

    // 初期値を設定
    updateSliderUI(currentValue);

    // ドラッグ操作の状態
    let isDragging = false;

    // マウスダウン/タッチスタートイベント
    function handleStart(e) {
        e.preventDefault();
        isDragging = true;

        // ドラッグ中のスタイル変更
        sliderThumb.style.transform = 'translateX(-50%) scale(1.1)';
        sliderThumb.style.background = 'rgba(147, 112, 219, 0.95)';
        sliderValue.style.opacity = '1';

        // 現在の位置で値を更新
        handleMove(e);

        // ドキュメント全体でのイベント捕捉
        document.addEventListener('mousemove', handleMove);
        document.addEventListener('touchmove', handleMove, { passive: false });
        document.addEventListener('mouseup', handleEnd);
        document.addEventListener('touchend', handleEnd);
    }

    // マウス移動/タッチ移動イベント
    function handleMove(e) {
        if (!isDragging) return;

        e.preventDefault();

        const trackRect = sliderTrack.getBoundingClientRect();
        const trackHeight = trackRect.height;

        // タッチイベントまたはマウスイベントの位置を取得
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;

        // トラック内での相対位置を計算（上下反転）
        const relativePosition = trackRect.bottom - clientY;
        let newValue = (relativePosition / trackHeight) * 100;

        // 値を0〜100の範囲に制限
        newValue = Math.max(0, Math.min(100, newValue));

        // UIと値を更新
        updateSliderUI(newValue);
    }

    // マウスアップ/タッチ終了イベント
    function handleEnd() {
        if (!isDragging) return;

        isDragging = false;

        // つまみのスタイルを元に戻す
        sliderThumb.style.transform = 'translateX(-50%)';
        sliderThumb.style.background = 'rgba(147, 112, 219, 0.9)';

        // ふにゃっとするアニメーション追加
        sliderThumb.classList.add('squish');
        setTimeout(() => {
            sliderThumb.classList.remove('squish');
        }, 600);

        // 少し経ってから値表示を非表示に
        setTimeout(() => {
            sliderValue.style.opacity = '0';
        }, 1500);

        // ドキュメント全体のイベントリスナーを削除
        document.removeEventListener('mousemove', handleMove);
        document.removeEventListener('touchmove', handleMove);
        document.removeEventListener('mouseup', handleEnd);
        document.removeEventListener('touchend', handleEnd);
    }

    // クリックでも位置を変更できるようにする
    function handleTrackClick(e) {
        if (isDragging) return;

        const trackRect = sliderTrack.getBoundingClientRect();
        const trackHeight = trackRect.height;

        // クリック位置の相対位置を計算（上下反転）
        const relativePosition = trackRect.bottom - e.clientY;
        let newValue = (relativePosition / trackHeight) * 100;

        // 値を0〜100の範囲に制限
        newValue = Math.max(0, Math.min(100, newValue));

        // UIと値を更新
        updateSliderUI(newValue);

        // ふにゃっとするアニメーション追加
        sliderThumb.classList.add('squish');
        setTimeout(() => {
            sliderThumb.classList.remove('squish');
        }, 600);

        // 値表示を一時的に表示
        sliderValue.style.opacity = '1';
        setTimeout(() => {
            sliderValue.style.opacity = '0';
        }, 1500);
    }

    // イベントリスナーの設定
    sliderThumb.addEventListener('mousedown', handleStart);
    sliderThumb.addEventListener('touchstart', handleStart, { passive: false });
    sliderTrack.addEventListener('click', handleTrackClick);

    // つまみにホバーエフェクト
    sliderThumb.addEventListener('mouseenter', () => {
        sliderThumb.style.transform = 'translateX(-50%) scale(1.05)';
        sliderThumb.style.boxShadow = '0 3px 8px rgba(147, 112, 219, 0.5)';
    });

    sliderThumb.addEventListener('mouseleave', () => {
        if (!isDragging) {
            sliderThumb.style.transform = 'translateX(-50%)';
            sliderThumb.style.boxShadow = '0 2px 5px rgba(0, 0, 0, 0.2)';
        }
    });

    // 設定されたイベントリスナーを返却
    return {
        container: sliderContainer,
        thumb: sliderThumb,
        track: sliderTrack,
        fill: sliderFill,
        setValue: updateSliderUI,
        getValue: () => currentValue
    };
}

/**
 * 音量スライダーを作成する
 * @returns {Object} - 音量スライダー関連の要素オブジェクト
 */
export function createVolumeSlider() {
    logDebug('🎚️ 音量スライダーを作成します');

    // 音量変更ハンドラ
    const handleVolumeChange = (newVolume) => {
        setVolume(newVolume);
        logDebug(`音量を${formatVolumeValue(newVolume)}に設定しました`);
    };

    // カスタムスライダーを作成
    const currentVolume = Math.round(getVolume() * 100);
    const slider = createCustomSlider(currentVolume, handleVolumeChange);

    // スライダーオブジェクトの中身をログ出力（デバッグ用）
    logDebug('🔍 slider変数の中身: ' + JSON.stringify(Object.keys(slider)));
    logDebug(`🔍 slider.container: ${slider.container ? '存在します' : '存在しません'}`);
    logDebug(`🔍 slider.thumb: ${slider.thumb ? '存在します' : '存在しません'}`);

    // スライダー要素の存在を確認
    if (slider.container && slider.thumb) {
        logDebug('✅ スライダーとつまみ要素が正常に生成されました');
        logDebug(`📊 container.childElementCount=${slider.container.childElementCount}`);

        // つまみ要素を直接操作して目立たせる（デバッグ用）
        slider.thumb.style.background = 'hotpink';
        slider.thumb.style.border = '2px dashed yellow';
        slider.thumb.style.width = '24px';
        slider.thumb.style.height = '24px';
    } else {
        logDebug('❌ スライダー要素生成に問題があります');
    }

    // 確実に表示するために、追加のスタイルを設定
    slider.container.style.opacity = '1';
    slider.container.style.visibility = 'visible';

    // 直接要素を返す形に変更し、thumb要素も含める
    return {
        slider: slider.container,
        thumb: slider.thumb, // つまみ要素への参照も返す
        updateVolume: (newVolume) => {
            const volumeValue = Math.round(newVolume * 100);
            slider.setValue(volumeValue);
        }
    };
} 