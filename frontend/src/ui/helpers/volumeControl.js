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
    // 既に初期化済みかチェック
    if (volumeIcon) return;

    logDebug('音量コントロールの初期化を開始');

    try {
        // 既存の音量アイコン要素を念のため削除
        const existingIcon = document.getElementById('volumeControlIcon');
        if (existingIcon) {
            existingIcon.parentNode.removeChild(existingIcon);
            logDebug('既存の音量アイコン要素を削除しました');
        }

        const existingPopup = document.getElementById('volumeControlPopup');
        if (existingPopup) {
            existingPopup.parentNode.removeChild(existingPopup);
            logDebug('既存の音量ポップアップ要素を削除しました');
        }

        // 音量アイコン要素の作成
        volumeIcon = document.createElement('div');
        volumeIcon.id = 'volumeControlIcon';
        volumeIcon.className = 'float-up';
        volumeIcon.textContent = getVolumeIcon(getVolume());
        volumeIcon.setAttribute('title', '音量調整');

        // 確実にクリック可能にする
        volumeIcon.setAttribute('role', 'button');
        volumeIcon.setAttribute('tabindex', '0');
        volumeIcon.setAttribute('aria-label', '音量調整');

        // ポップアップ要素の作成
        volumePopup = document.createElement('div');
        volumePopup.id = 'volumeControlPopup';
        volumePopup.className = '';
        volumePopup.style.zIndex = '9999';

        // ポップアップ内のスライダーを初期化
        updateVolumeSlider();

        // ボディに追加
        document.body.appendChild(volumeIcon);
        document.body.appendChild(volumePopup);

        // クリックイベントの設定 - バブリングを防止し、デバッグログを追加
        const clickHandler = (e) => {
            logDebug('音量アイコンがクリックされました');
            e.stopPropagation(); // イベントのバブリングを防止
            e.preventDefault(); // デフォルトの動作を防止
            toggleVolumePopup();
            return false; // イベントの伝播を完全に防止
        };

        volumeIcon.addEventListener('click', clickHandler, true);
        volumeIcon.addEventListener('mousedown', (e) => {
            logDebug('音量アイコンがマウスダウンされました');
            e.stopPropagation();
        }, true);

        // キーボードアクセシビリティ
        volumeIcon.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                logDebug('音量アイコンがキーボードでアクティベートされました');
                e.preventDefault();
                toggleVolumePopup();
            }
        });

        // タッチデバイス用のイベント追加
        volumeIcon.addEventListener('touchend', (e) => {
            logDebug('音量アイコンがタッチされました');
            e.preventDefault();
            toggleVolumePopup();
        }, true);

        // 外部クリックでポップアップを閉じる
        document.addEventListener('click', (e) => {
            if (
                volumePopup.classList.contains('active') &&
                e.target !== volumeIcon &&
                e.target !== volumePopup &&
                !volumePopup.contains(e.target)
            ) {
                hideVolumePopup();
            }
        });

        logDebug('音量コントロールの初期化完了');

        // 初期化後に追加の確認
        setTimeout(() => {
            const iconElement = document.getElementById('volumeControlIcon');
            if (iconElement) {
                const styles = window.getComputedStyle(iconElement);
                logDebug(`音量アイコンの状態確認: display=${styles.display}, zIndex=${styles.zIndex}, pointerEvents=${styles.pointerEvents}, right=${styles.right}, bottom=${styles.bottom}`);

                // 音量アイコンの位置を視覚的にわかりやすく一瞬だけ強調
                iconElement.style.transition = 'all 0.3s ease';
                iconElement.style.transform = 'scale(1.2)';
                iconElement.style.boxShadow = '0 0 10px rgba(147, 112, 219, 0.8)';

                setTimeout(() => {
                    iconElement.style.transform = '';
                    iconElement.style.boxShadow = '';
                }, 1000);

                // クリック可能かどうかデバッグモードでテスト
                if (iconElement.getBoundingClientRect().width > 0) {
                    logDebug('音量アイコンは正常に表示されています');
                } else {
                    logError('音量アイコンのサイズが異常です');
                }
            } else {
                logError('音量アイコン要素が見つかりません');
            }
        }, 1000);
    } catch (error) {
        logError(`音量コントロール初期化エラー: ${error.message}`);
    }
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
function updateVolumeSlider() {
    const currentVolume = getVolume();

    // 音量が0の場合は最小値（0.1）に設定する（ミュート防止）
    const safeVolume = currentVolume <= 0 ? 0.1 : currentVolume;

    // 既存のスライダーコンテナを削除
    while (volumePopup.firstChild) {
        volumePopup.removeChild(volumePopup.firstChild);
    }

    // スライダーコンテナの作成
    const sliderContainer = document.createElement('div');
    sliderContainer.className = 'slider-container';

    // スライダーコントロールの作成
    const sliderControls = document.createElement('div');
    sliderControls.className = 'slider-controls';

    // スライダー入力の作成
    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = '0';
    slider.max = '100';
    slider.value = String(Math.round(safeVolume * 100));
    slider.className = 'slider-input';
    slider.id = 'volumeSlider';
    slider.style.WebkitAppearance = 'slider-vertical';
    slider.style.writingMode = 'bt-lr';
    slider.style.transform = 'rotate(180deg)';

    // Electronでのスライダーつまみ表示のためのインラインスタイル
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
        // 音量設定を更新（0の場合は最小値にする）
        const safeNewValue = newValue <= 0 ? 0.1 : newValue;
        setVolume(safeNewValue);

        // アイコンを更新
        volumeIcon.textContent = getVolumeIcon(safeNewValue);

        // ミュート状態 or 音量変更時にアイコンをアニメーション
        if (safeNewValue <= 0.1 || safeNewValue >= 0.95) {
            volumeIcon.classList.add('pulse');
            setTimeout(() => {
                volumeIcon.classList.remove('pulse');
            }, 2000);
        }

        logDebug(`音量を${formatVolumeValue(safeNewValue)}に設定しました`);
    });

    // 要素を組み合わせる
    sliderControls.appendChild(slider);
    sliderContainer.appendChild(sliderControls);
    volumePopup.appendChild(sliderContainer);
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