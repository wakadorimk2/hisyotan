/**
 * volumeControl.js
 * 音声再生の音量を調整するUIを提供するモジュール
 */

import { logDebug, logError } from '@core/logger.js';
import { getVolume, setVolume } from '@voice/speechVoice.js';
import { renderSettingUI } from './settingPanel.js';

// DOM要素
let volumeIcon = null;
let volumePopup = null;

// 自動非表示のタイマーID
let hideTimer = null;

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
 * 音量コントロール機能を初期化する
 */
export function initVolumeControl() {
    const sliderElement = document.querySelector('.volume-slider');

    if (!sliderElement) {
        console.error('音量スライダー要素が見つかりません');
        return;
    }

    // 音量アイコンの初期化
    volumeIcon = document.querySelector('.volume-icon');
    if (!volumeIcon) {
        console.error('音量アイコン要素が見つかりません');
        return;
    }

    // 音量ポップアップの初期化
    volumePopup = document.querySelector('.volume-popup');
    if (!volumePopup) {
        console.error('音量ポップアップ要素が見つかりません');
        return;
    }

    // イベントリスナーの設定
    sliderElement.addEventListener('input', handleVolumeChange);
    volumeIcon.addEventListener('click', toggleVolumePopup);

    // 初期音量の設定
    const initialVolume = getVolume();
    updateVolumeUI(initialVolume);

    console.log('🌸 音量コントロールの初期化が完了しました');
}

/**
 * 音量ポップアップの表示・非表示を切り替える
 */
function toggleVolumePopup() {
    logDebug('toggleVolumePopup が呼び出されました');

    if (volumePopup.classList.contains('active')) {
        hideVolumePopup();
    } else {
        showVolumePopup();
    }
}

/**
 * 音量ポップアップを表示する
 */
function showVolumePopup() {
    // タイマーがあればクリア
    if (hideTimer) {
        clearTimeout(hideTimer);
        hideTimer = null;
    }

    // アクティブクラスを追加して表示
    volumePopup.classList.add('active');

    // 音量アイコンのスタイルも変更
    volumeIcon.classList.add('popup-active');

    // 操作がなければ4秒後に自動的に非表示
    hideTimer = setTimeout(() => {
        hideVolumePopup();
    }, 4000);

    logDebug('音量ポップアップを表示');
}

/**
 * 音量ポップアップを非表示にする
 */
function hideVolumePopup() {
    volumePopup.classList.remove('active');
    volumeIcon.classList.remove('popup-active');
    logDebug('音量ポップアップを非表示');
}

/**
 * 音量スライダーUIを更新する
 */
async function updateVolumeSlider() {
    const currentVolume = getVolume();

    // 音量が0の場合は最小値（0.1）に設定する（ミュート防止）
    const safeVolume = currentVolume <= 0 ? 0.1 : currentVolume;

    // 既存のスライダーコンテナを削除
    logDebug('🧹 既存のスライダーを削除します');
    while (volumePopup.firstChild) {
        volumePopup.removeChild(volumePopup.firstChild);
    }

    try {
        // ポップアップ自体のスタイルを事前に確認
        const popupStyles = window.getComputedStyle(volumePopup);
        logDebug(`🔍 ポップアップの現在のスタイル: display=${popupStyles.display}, visibility=${popupStyles.visibility}`);

        // volumeSlider.jsから新しいカスタムスライダーを取得
        logDebug('📦 volumeSlider.jsモジュールを読み込みます');
        let createVolumeSlider;
        try {
            const module = await import('./volumeSlider.js');
            createVolumeSlider = module.createVolumeSlider;
            logDebug(`🔍 インポート成功: module=${Object.keys(module).join(',')}`);
        } catch (importError) {
            logError(`🚨 volumeSlider.jsのインポートエラー: ${importError.message}`);
            logError(`🚨 エラースタック: ${importError.stack}`);
            throw new Error(`モジュールのインポートに失敗しました: ${importError.message}`);
        }

        // スライダー要素を生成して追加
        try {
            if (typeof createVolumeSlider === 'function') {
                logDebug('🔧 カスタムスライダーを生成します');
                const sliderElement = createVolumeSlider();

                // デバッグのために重要な属性を確認
                if (sliderElement) {
                    logDebug(`🔍 スライダー要素生成結果: id=${sliderElement.id}, class=${sliderElement.className}`);
                    logDebug(`🔍 子要素数: ${sliderElement.childElementCount}`);

                    // カスタムスライダーのサムが存在するか確認
                    const thumb = sliderElement.querySelector('.custom-slider-thumb');
                    if (thumb) {
                        logDebug('✅ カスタムスライダーのサムが存在します');
                        // サムに必要なクラスを確実に適用
                        thumb.classList.add('custom-slider-thumb');
                        thumb.style.visibility = 'visible';
                        thumb.style.display = 'block';
                    } else {
                        logDebug('⚠️ カスタムスライダーのサムが見つかりません');
                    }

                    volumePopup.appendChild(sliderElement);
                    return; // 成功したら終了
                } else {
                    logError('🚨 スライダー要素が生成できませんでした');
                }
            } else {
                logError('🚨 createVolumeSlider関数が見つかりません');
            }
        } catch (error) {
            logError(`🚨 カスタムスライダー生成エラー: ${error.message}`);
        }

        // ここに到達した場合は、フォールバックスライダーを使用する
        logDebug('⚠️ フォールバックスライダーを使用します');
        createFallbackSlider();

    } catch (error) {
        logError(`音量スライダー更新エラー: ${error.message}`);
        // エラー発生時もフォールバックスライダーを表示
        createFallbackSlider();
    }

    // フォールバックスライダーを作成する関数
    function createFallbackSlider() {
        logDebug('📝 フォールバックスライダーを作成します');

        // スライダーコンテナ
        const sliderContainer = document.createElement('div');
        sliderContainer.className = 'slider-container';

        // スライダーコントロール
        const sliderControls = document.createElement('div');
        sliderControls.className = 'slider-controls';

        // 標準的なrange入力を作成
        const sliderInput = document.createElement('input');
        sliderInput.type = 'range';
        sliderInput.id = 'volumeSlider';
        sliderInput.className = 'slider-input'; // 重要: CSSが適用されるようにクラスを設定
        sliderInput.min = '0';
        sliderInput.max = '100';
        sliderInput.value = String(Math.round(safeVolume * 100));
        sliderInput.setAttribute('aria-label', '音量');
        sliderInput.style.visibility = 'visible';
        sliderInput.style.display = 'block';

        // スライダー入力変更イベント
        sliderInput.addEventListener('input', function () {
            const value = parseInt(this.value, 10) / 100;
            setVolume(value);
            volumeIcon.textContent = getVolumeIcon(value);

            // 設定を保存
            localStorage.setItem('assistantVolume', this.value);

            // Electron経由で音量を設定
            if (window.electron && window.electron.ipcRenderer) {
                window.electron.ipcRenderer.send('set-volume', parseInt(this.value, 10));
            }
        });

        // 要素を組み立て
        sliderControls.appendChild(sliderInput);
        sliderContainer.appendChild(sliderControls);
        volumePopup.appendChild(sliderContainer);

        logDebug('✅ フォールバックスライダーの作成完了');
    }
}

/**
 * 音量設定UI をセッティングパネル内に表示する
 * @returns {Object} - 設定UI表示用のペイロード
 */
export function showVolumeSettingInPanel() {
    const currentVolume = getVolume();

    return {
        type: 'slider',
        label: '音声音量',
        value: currentVolume,
        min: 0,
        max: 1,
        step: 0.01,
        formatValue: formatVolumeValue,
        description: '音声再生の音量を調整します',
        onChange: (newValue) => {
            // 音量設定を更新
            setVolume(newValue);

            // アイコンも更新
            if (volumeIcon) {
                volumeIcon.textContent = getVolumeIcon(newValue);
            }

            logDebug(`設定パネルから音量を${formatVolumeValue(newValue)}に設定しました`);
        }
    };
} 