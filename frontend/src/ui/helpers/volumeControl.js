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
        volumeIcon.style.pointerEvents = 'auto';
        volumeIcon.style.cursor = 'pointer';
        volumeIcon.style.webkitAppRegion = 'no-drag';
        volumeIcon.style.zIndex = '9999';
        volumeIcon.style.position = 'fixed';
        volumeIcon.style.bottom = '20px';
        volumeIcon.style.right = '80px';
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

    // 表示前にポップアップの位置を音量アイコンの真上に再調整
    const iconRect = volumeIcon.getBoundingClientRect();

    // 音量アイコンの中央上に配置
    volumePopup.style.left = `${iconRect.left + (iconRect.width / 2) - 20}px`; // 中央に配置（幅の半分を引く）
    volumePopup.style.right = 'auto'; // CSSの右指定を上書き

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

    // スライダーペイロードの作成
    const sliderPayload = {
        type: 'slider',
        value: safeVolume,
        min: 0,
        max: 1,
        step: 0.01,
        onChange: (newValue) => {
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
        }
    };

    // スライダーをレンダリング
    volumePopup.innerHTML = '';
    const sliderContainer = document.createElement('div');
    sliderContainer.className = 'slider-container';

    // スライダー入力要素を作成（縦型）
    const sliderInput = document.createElement('input');
    sliderInput.type = 'range';
    sliderInput.className = 'slider-input';
    sliderInput.min = sliderPayload.min;
    sliderInput.max = sliderPayload.max;
    sliderInput.step = sliderPayload.step;
    sliderInput.value = sliderPayload.value;
    sliderInput.setAttribute('orient', 'vertical'); // 一部ブラウザ用の縦型属性

    // スライダーを更新
    sliderInput.addEventListener('input', (e) => {
        // 縦型スライダーでは値をそのまま使用（上が大きい値）
        const newValue = parseFloat(e.target.value);
        sliderPayload.onChange(newValue);

        // タイマーをリセット（操作中は自動非表示しない）
        if (hideTimer) {
            clearTimeout(hideTimer);
        }

        // 操作後4秒で非表示
        hideTimer = setTimeout(() => {
            hideVolumePopup();
        }, 4000);
    });

    // 要素を組み立て
    const sliderControls = document.createElement('div');
    sliderControls.className = 'slider-controls';
    sliderControls.appendChild(sliderInput);

    sliderContainer.appendChild(sliderControls);
    volumePopup.appendChild(sliderContainer);

    // 初期表示時にミュートになっていたら音量を復元
    if (currentVolume <= 0) {
        setVolume(0.1);
        volumeIcon.textContent = getVolumeIcon(0.1);
        logDebug('音量が0だったため、最小値(10%)に設定しました');
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