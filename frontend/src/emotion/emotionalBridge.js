/**
 * emotionalBridge.js
 * 既存のexpressionManagerと新しいcharacterControllerを連携するブリッジモジュール
 * 既存の実装との互換性を保ちつつ、新しいタグベースの差分管理システムを導入
 */

import { logDebug, logError } from '@core/logger.js';
import * as expressionManager from './expressionManager.js';
import * as characterController from './characterController.js';

// 表情名からタグへのマッピング
const expressionToTagMap = {
    'normal': 'NORMAL',
    'happy': 'HAPPY',
    'surprised': 'SURPRISED',
    'serious': 'SERIOUS',
    'sleepy': 'SLEEPY',
    'relieved': 'RELIEVED',
    'smile': 'SMILE'
};

// タグから表情名へのマッピング
const tagToExpressionMap = {
    'NORMAL': 'normal',
    'HAPPY': 'happy',
    'SURPRISED': 'surprised',
    'SERIOUS': 'serious',
    'SLEEPY': 'sleepy',
    'RELIEVED': 'relieved',
    'SMILE': 'smile'
};

// 初期化フラグ
let isInitialized = false;

/**
 * 感情ブリッジを初期化する
 * @param {Object} config - 設定オブジェクト
 */
export function initEmotionalBridge(config = {}) {
    try {
        // 既存のexpressionManagerを初期化
        expressionManager.initExpressionElements();

        // 新しいcharacterControllerを初期化
        const initResult = characterController.initCharacterController({
            initialExpression: 'NORMAL',
            ...config
        });

        if (!initResult) {
            logError('キャラクターコントローラーの初期化に失敗しました');
            return false;
        }

        isInitialized = true;
        logDebug('感情ブリッジの初期化が完了しました');
        return true;
    } catch (error) {
        logError(`感情ブリッジの初期化に失敗: ${error.message}`);
        return false;
    }
}

/**
 * 表情を設定する（既存のexpressionManager互換メソッド）
 * @param {string} expression - 表情名（normal, happy, surprised, serious, sleepy, relieved, smile）
 * @returns {boolean} 成功したかどうか
 */
export function setExpression(expression) {
    try {
        // 既存の実装を呼び出し
        const legacyResult = expressionManager.setExpression(expression);

        // 新しい実装も呼び出し（タグに変換）
        if (isInitialized) {
            const expressionTag = expressionToTagMap[expression] || 'NORMAL';
            characterController.setTag('expression', expressionTag);
        }

        return legacyResult;
    } catch (error) {
        logError(`表情設定エラー: ${error.message}`);
        return false;
    }
}

/**
 * 現在の表情を取得する（既存のexpressionManager互換メソッド）
 * @returns {string} 現在の表情
 */
export function getCurrentExpression() {
    // 既存実装を使用
    return expressionManager.getCurrentExpression();
}

/**
 * タグベースで表情を設定する（新メソッド）
 * @param {string} expressionTag - 表情タグ（NORMAL, HAPPY, SURPRISED, SERIOUS, SLEEPY, RELIEVED, SMILE）
 * @returns {boolean} 成功したかどうか
 */
export function setExpressionByTag(expressionTag) {
    try {
        if (!isInitialized) {
            initEmotionalBridge();
        }

        // 新しい実装でタグを設定
        const newResult = characterController.setTag('expression', expressionTag);

        // 既存の実装も更新（タグから表情名に変換）
        const expression = tagToExpressionMap[expressionTag] || 'normal';
        expressionManager.setExpression(expression);

        return newResult;
    } catch (error) {
        logError(`タグによる表情設定エラー: ${error.message}`);
        return false;
    }
}

/**
 * ポーズを設定する（新メソッド）
 * @param {string} poseTag - ポーズタグ（NEUTRAL, ARMSCROSSED, SEIZA）
 * @returns {boolean} 成功したかどうか
 */
export function setPose(poseTag) {
    try {
        if (!isInitialized) {
            initEmotionalBridge();
        }

        return characterController.setTag('pose', poseTag);
    } catch (error) {
        logError(`ポーズ設定エラー: ${error.message}`);
        return false;
    }
}

/**
 * ランダムにタグを設定する（新メソッド）
 * @param {string} category - カテゴリ（'expression', 'pose'）
 * @param {string} tagPrefix - タグの接頭辞（例: "POINTING"）
 * @returns {boolean} 成功したかどうか
 */
export function setRandomTag(category, tagPrefix) {
    try {
        if (!isInitialized) {
            initEmotionalBridge();
        }

        const result = characterController.setRandomTag(category, tagPrefix);

        // 既存実装にも反映（表情カテゴリの場合）
        if (result && category === 'expression') {
            const tags = characterController.getCurrentTags();
            const expression = tagToExpressionMap[tags.expression] || 'normal';
            expressionManager.setExpression(expression);
        }

        return result;
    } catch (error) {
        logError(`ランダムタグ設定エラー: ${error.message}`);
        return false;
    }
}

/**
 * エクストラタグを追加する（新メソッド）
 * @param {string} extraTag - 追加するタグ
 * @returns {boolean} 成功したかどうか
 */
export function addExtra(extraTag) {
    try {
        if (!isInitialized) {
            initEmotionalBridge();
        }

        return characterController.addExtraTag(extraTag);
    } catch (error) {
        logError(`エクストラタグ追加エラー: ${error.message}`);
        return false;
    }
}

/**
 * エクストラタグを削除する（新メソッド）
 * @param {string} extraTag - 削除するタグ
 * @returns {boolean} 成功したかどうか
 */
export function removeExtra(extraTag) {
    try {
        if (!isInitialized) {
            initEmotionalBridge();
        }

        return characterController.removeExtraTag(extraTag);
    } catch (error) {
        logError(`エクストラタグ削除エラー: ${error.message}`);
        return false;
    }
}

/**
 * 組み合わせを設定する（新メソッド）
 * @param {string} combinationName - 組み合わせ名
 * @returns {boolean} 成功したかどうか
 */
export function setCombination(combinationName) {
    try {
        if (!isInitialized) {
            initEmotionalBridge();
        }

        const result = characterController.setCombination(combinationName);

        // 既存実装にも反映（表情のみ）
        if (result) {
            const tags = characterController.getCurrentTags();
            const expression = tagToExpressionMap[tags.expression] || 'normal';
            expressionManager.setExpression(expression);
        }

        return result;
    } catch (error) {
        logError(`組み合わせ設定エラー: ${error.message}`);
        return false;
    }
}

// 既存のアニメーション関連メソッドの転送
export const {
    startTalking,
    stopTalking,
    startTrembling,
    stopTrembling,
    startLightBounce,
    stopLightBounce,
    startNervousShake,
    stopNervousShake,
    resetExpression,
    isTalkingNow
} = expressionManager;

// 新しい関数をエクスポート
export const {
    setDisplayMode,
    getDisplayMode,
    getExpressionTags,
    getPoseTags,
    getExtraTags,
    getCombinations,
    getCurrentTags
} = characterController; 