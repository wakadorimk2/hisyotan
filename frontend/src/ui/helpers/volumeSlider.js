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
    // スライダーコンテナ
    const sliderContainer = document.createElement('div');
    sliderContainer.className = 'slider-container custom-slider-container';
    sliderContainer.style.position = 'relative';
    sliderContainer.style.width = '100%';
    sliderContainer.style.height = '120px';
    sliderContainer.style.display = 'flex';
    sliderContainer.style.flexDirection = 'column';
    sliderContainer.style.alignItems = 'center';
    sliderContainer.style.justifyContent = 'center';

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
    sliderThumb.style.background = 'rgba(147, 112, 219, 0.9)';
    sliderThumb.style.borderRadius = '50%';
    sliderThumb.style.boxShadow = '0 2px 5px rgba(0, 0, 0, 0.2)';
    sliderThumb.style.border = '2px solid rgba(255, 255, 255, 0.8)';
    sliderThumb.style.cursor = 'pointer';
    sliderThumb.style.zIndex = '10';
    sliderThumb.style.transition = 'transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)';
    sliderThumb.style.left = '50%';
    sliderThumb.style.transform = 'translateX(-50%)';

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
    sliderTrack.appendChild(sliderFill);
    sliderContainer.appendChild(sliderTrack);
    sliderContainer.appendChild(sliderThumb);
    sliderContainer.appendChild(sliderValue);

    // 現在の値
    let currentValue = initialValue || 0;
    updateSliderUI(currentValue);

    // スライダーの値とUIを更新する関数
    function updateSliderUI(value) {
        // 値を0〜100の範囲に制限
        value = Math.max(0, Math.min(100, value));
        currentValue = value;

        // つまみと塗りつぶしバーの位置を更新
        const trackHeight = sliderTrack.offsetHeight;
        const position = (value / 100) * trackHeight;

        sliderThumb.style.bottom = `${position - 10}px`; // つまみの中心が位置に来るよう調整
        sliderFill.style.height = `${position}px`;

        // 値表示を更新
        sliderValue.textContent = `${value}%`;

        // コールバック関数の呼び出し
        if (onChangeCallback && typeof onChangeCallback === 'function') {
            onChangeCallback(value / 100);
        }
    }

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

    // API
    return {
        container: sliderContainer,
        setValue: (value) => {
            updateSliderUI(value);
        },
        getValue: () => currentValue
    };
}

/**
 * 音量スライダーを作成する
 * @returns {Object} - 音量スライダー関連の要素オブジェクト
 */
export function createVolumeSlider() {
    logDebug('🎚️ 音量スライダーを作成します');

    // 音量ボタンを作成
    const volumeButton = document.createElement('button');
    volumeButton.id = 'volumeControlIcon';
    volumeButton.textContent = getVolumeIcon(getVolume());
    volumeButton.setAttribute('role', 'button');
    volumeButton.setAttribute('tabindex', '0');
    volumeButton.setAttribute('aria-label', '音量設定');

    // 必要最小限のスタイルをインラインで設定（CSSが読み込まれない場合の対策）
    volumeButton.style.webkitAppRegion = 'no-drag';
    volumeButton.style.position = 'fixed';
    volumeButton.style.bottom = '90px';
    volumeButton.style.right = '20px';
    volumeButton.style.width = '36px';
    volumeButton.style.height = '36px';
    volumeButton.style.borderRadius = '50%';
    volumeButton.style.backgroundColor = 'rgba(255, 255, 255, 0.5)';
    volumeButton.style.border = 'none';
    volumeButton.style.boxShadow = '0 2px 8px rgba(169, 144, 225, 0.15)';
    volumeButton.style.zIndex = '9999';
    volumeButton.style.cursor = 'pointer';
    volumeButton.style.display = 'flex';
    volumeButton.style.alignItems = 'center';
    volumeButton.style.justifyContent = 'center';
    volumeButton.style.fontSize = '18px';
    volumeButton.style.transition = 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)';

    // 音量スライダーポップアップ
    const volumePopup = document.createElement('div');
    volumePopup.id = 'volumeControlPopup';

    // 必要最小限のスタイルをインラインで設定
    volumePopup.style.position = 'fixed';
    volumePopup.style.bottom = '130px';
    volumePopup.style.right = '20px';
    volumePopup.style.width = '36px';
    volumePopup.style.minHeight = '140px';
    volumePopup.style.backgroundColor = 'rgba(255, 255, 255, 0.25)';
    volumePopup.style.backdropFilter = 'blur(3px)';
    volumePopup.style.webkitBackdropFilter = 'blur(3px)';
    volumePopup.style.borderRadius = '22px';
    volumePopup.style.padding = '10px 0';
    volumePopup.style.boxShadow = '0 4px 15px rgba(0, 0, 0, 0.05), 0 0 5px rgba(169, 144, 225, 0.15)';
    volumePopup.style.zIndex = '9998';
    volumePopup.style.transition = 'all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)';
    volumePopup.style.opacity = '0';
    volumePopup.style.transform = 'translateY(10px) scale(0.8)';
    volumePopup.style.pointerEvents = 'none';
    volumePopup.style.border = '1px solid rgba(255, 255, 255, 0.25)';
    volumePopup.style.webkitAppRegion = 'no-drag';
    volumePopup.style.display = 'flex';
    volumePopup.style.alignItems = 'center';
    volumePopup.style.justifyContent = 'center';

    // 音量変更ハンドラ
    const handleVolumeChange = (newVolume) => {
        setVolume(newVolume);
        volumeButton.textContent = getVolumeIcon(newVolume);
        logDebug(`音量を${formatVolumeValue(newVolume)}に設定しました`);
    };

    // カスタムスライダーを作成
    const currentVolume = Math.round(getVolume() * 100);
    const customSlider = createCustomSlider(currentVolume, handleVolumeChange);

    // ポップアップにスライダーを追加
    volumePopup.appendChild(customSlider.container);

    return {
        volumeButton,
        volumePopup,
        updateVolume: (newVolume) => {
            const volumeValue = Math.round(newVolume * 100);
            customSlider.setValue(volumeValue);
            volumeButton.textContent = getVolumeIcon(newVolume);
        }
    };
} 