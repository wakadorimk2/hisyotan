/**
 * 感情ラベルのユーティリティ関数
 * 感情値から対応するラベルを取得します
 */

/**
 * 数値から感情ラベルを取得する関数
 * @param {number} value - 感情値（-100〜100の範囲）
 * @returns {string} 感情ラベル
 */
export function getEmotionLabel(value) {
    if (value >= 80) return 'very_happy';
    if (value >= 40) return 'happy';
    if (value >= 15) return 'slightly_happy';
    if (value <= -80) return 'very_angry';
    if (value <= -40) return 'angry';
    if (value <= -15) return 'slightly_angry';
    return 'normal';
}

export default {
    getEmotionLabel
}; 