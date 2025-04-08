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

    // スライダーコンテナ
    const sliderContainer = document.createElement('div');
    sliderContainer.className = 'slider-container';
    sliderContainer.style.margin = '5px 0';
    sliderContainer.style.padding = '0';
    sliderContainer.style.background = 'transparent';
    sliderContainer.style.borderRadius = '12px';
    sliderContainer.style.transition = 'all 0.3s ease';
    sliderContainer.style.display = 'flex';
    sliderContainer.style.flexDirection = 'column';
    sliderContainer.style.position = 'relative';
    sliderContainer.style.width = '100%';
    sliderContainer.style.boxShadow = 'none';

    // スライダーコントロール
    const sliderControls = document.createElement('div');
    sliderControls.className = 'slider-controls';
    sliderControls.style.display = 'flex';
    sliderControls.style.flexDirection = 'column';
    sliderControls.style.alignItems = 'center';
    sliderControls.style.justifyContent = 'center';
    sliderControls.style.width = '100%';
    sliderControls.style.height = '100%';

    // スライダー入力
    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = '0';
    slider.max = '100';
    slider.value = String(Math.round(getVolume() * 100));
    slider.className = 'slider-input';
    slider.id = 'volumeSlider';
    slider.style.width = '6px';
    slider.style.height = '120px';
    slider.style.WebkitAppearance = 'slider-vertical';
    slider.style.writingMode = 'bt-lr';
    slider.style.margin = '10px auto';
    slider.style.background = 'rgba(240, 230, 255, 0.5)';
    slider.style.borderRadius = '20px';
    slider.style.outline = 'none';
    slider.style.opacity = '0.85';
    slider.style.transition = 'all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)';
    slider.style.transform = 'rotate(180deg)';

    // Electronでのスライダーつまみ表示の問題を解決するためのハック
    const styleElement = document.createElement('style');
    styleElement.textContent = `
        #volumeSlider::-webkit-slider-thumb {
            -webkit-appearance: none !important;
            appearance: none !important;
            width: 20px;
            height: 20px;
            border-radius: 50%;
            background: rgba(147, 112, 219, 0.9);
            box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2);
            cursor: pointer;
            border: 2px solid rgba(255, 255, 255, 0.8);
            margin-top: -7px;
        }
    `;
    document.head.appendChild(styleElement);

    // スライダー値の変更イベント
    slider.addEventListener('input', (e) => {
        const newValue = parseInt(e.target.value, 10) / 100;
        setVolume(newValue);
        volumeButton.textContent = getVolumeIcon(newValue);
        logDebug(`音量を${formatVolumeValue(newValue)}に設定しました`);
    });

    // 要素を組み合わせる
    sliderControls.appendChild(slider);
    sliderContainer.appendChild(sliderControls);
    volumePopup.appendChild(sliderContainer);

    return {
        volumeButton,
        volumePopup,
        slider
    };
} 