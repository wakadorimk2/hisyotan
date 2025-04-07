/**
 * characterController.js
 * キャラクターの表情・ポーズなどの差分を管理するモジュール
 * タグベースの差分管理システムで、将来的にLive2DやVRM対応も視野に入れた設計
 */

import { logDebug, logError } from '@core/logger.js';
import dictionaryData from './characterDictionary.json';

// 表示モード
export const DisplayMode = {
    IMAGE: 'IMAGE',       // 静的画像モード
    LIVE2D: 'LIVE2D',     // Live2Dモード（将来対応）
    VRM: 'VRM'           // 3Dモデルモード（将来対応）
};

// 現在の表示モード
let currentMode = DisplayMode.IMAGE;

// 現在のタグ状態
const currentTags = {
    expression: 'NORMAL',  // 表情タグ
    pose: 'NEUTRAL',       // ポーズタグ
    extras: []             // エフェクト/小物タグ（配列）
};

// DOM要素
let characterImageElement = null;

// 差分辞書データ
let dictionary = null;

/**
 * 初期化処理
 * @param {Object} config - 初期設定
 */
export function initCharacterController(config = {}) {
    // DOM要素の初期化
    characterImageElement = document.getElementById('assistantImage');

    if (!characterImageElement) {
        logError('キャラクター表示要素が見つかりません。id="assistantImage"のHTML要素が必要です。');
        return false;
    }

    // 設定反映
    if (config.initialMode) {
        currentMode = config.initialMode;
    }

    // 初期表情の設定
    if (config.initialExpression) {
        currentTags.expression = config.initialExpression;
    }

    if (config.initialPose) {
        currentTags.pose = config.initialPose;
    }

    // 差分辞書の読み込み
    loadDifferentialDictionary();

    logDebug('キャラクターコントローラー初期化完了');
    logDebug(`現在のモード: ${currentMode}`);
    logDebug(`現在のタグ: ${JSON.stringify(currentTags)}`);

    // 初期表示
    updateCharacterDisplay();

    return true;
}

/**
 * タグを設定する
 * @param {string} category - カテゴリ（'expression', 'pose', 'extras'）
 * @param {string|Array} tags - 設定するタグまたはタグ配列
 */
export function setTag(category, tags) {
    if (!category || !tags) {
        logError('タグ設定エラー: カテゴリとタグは必須です');
        return false;
    }

    logDebug(`タグを設定: ${category} -> ${JSON.stringify(tags)}`);

    switch (category) {
        case 'expression':
        case 'pose':
            // 単一タグのカテゴリ
            if (!isValidTag(category, tags)) {
                logError(`無効なタグ: ${category} - ${tags}`);
                return false;
            }
            currentTags[category] = tags;
            break;
        case 'extras':
            // 複数タグ可能なカテゴリ
            if (Array.isArray(tags)) {
                // 配列内の各タグを検証
                const validTags = tags.filter(tag => isValidTag('extras', tag));
                if (validTags.length !== tags.length) {
                    logError(`一部の無効なタグはスキップされました: ${tags.filter(tag => !validTags.includes(tag))}`);
                }
                currentTags.extras = [...validTags];
            } else {
                if (isValidTag('extras', tags)) {
                    currentTags.extras = [tags];
                } else {
                    logError(`無効なタグ: extras - ${tags}`);
                    return false;
                }
            }
            break;
        default:
            logError(`不明なタグカテゴリ: ${category}`);
            return false;
    }

    // 表示更新
    updateCharacterDisplay();
    return true;
}

/**
 * タグをランダムに設定する
 * @param {string} category - カテゴリ（'expression', 'pose', 'extras'）
 * @param {string} tagPrefix - タグの接頭辞（例: "POINTING"）- 接頭辞で始まるタグからランダムに選択します
 * @returns {boolean} 成功したかどうか
 */
export function setRandomTag(category, tagPrefix) {
    if (!category || !tagPrefix) {
        logError('ランダムタグ設定エラー: カテゴリとタグ接頭辞は必須です');
        return false;
    }

    // 辞書からカテゴリに対応するオブジェクトを取得
    let categoryDict;
    switch (category) {
        case 'expression':
            categoryDict = dictionary?.expressions;
            break;
        case 'pose':
            categoryDict = dictionary?.poses;
            break;
        case 'extras':
            categoryDict = dictionary?.extras;
            break;
        default:
            logError(`不明なタグカテゴリ: ${category}`);
            return false;
    }

    if (!categoryDict) {
        logError('差分辞書がロードされていないか、カテゴリが見つかりません');
        return false;
    }

    // 接頭辞で始まるタグを抽出
    const matchingTags = Object.keys(categoryDict).filter(tag => tag.startsWith(tagPrefix));

    if (matchingTags.length === 0) {
        logError(`接頭辞 "${tagPrefix}" に一致するタグが見つかりません`);
        return false;
    }

    // ランダムにタグを選択
    const randomIndex = Math.floor(Math.random() * matchingTags.length);
    const selectedTag = matchingTags[randomIndex];

    // 選択されたタグのインデックスをログ出力（デバッグ用）
    const tagNumber = selectedTag.match(/\d+/);
    const variant = tagNumber ? parseInt(tagNumber[0]) : 0;
    logDebug(`ランダムタグを選択: ${selectedTag} (バリエーション ${variant}番)`);

    // 選択したタグを設定
    return setTag(category, selectedTag);
}

/**
 * タグの有効性を検証する
 * @param {string} category - カテゴリ名
 * @param {string} tag - 検証するタグ
 * @returns {boolean} 有効かどうか
 */
function isValidTag(category, tag) {
    if (!dictionary) return true; // 辞書がロードされていない場合は一時的にすべて有効とする

    switch (category) {
        case 'expression':
            return !!dictionary.expressions[tag];
        case 'pose':
            return !!dictionary.poses[tag];
        case 'extras':
            return !!dictionary.extras[tag];
        default:
            return false;
    }
}

/**
 * タグを追加する（extrasカテゴリ用）
 * @param {string} tag - 追加するタグ
 */
export function addExtraTag(tag) {
    if (!tag) return false;

    if (!isValidTag('extras', tag)) {
        logError(`無効なエクストラタグ: ${tag}`);
        return false;
    }

    if (!currentTags.extras.includes(tag)) {
        currentTags.extras.push(tag);
        logDebug(`エクストラタグを追加: ${tag}`);
        updateCharacterDisplay();
        return true;
    }

    return false;
}

/**
 * タグを削除する（extrasカテゴリ用）
 * @param {string} tag - 削除するタグ
 */
export function removeExtraTag(tag) {
    if (!tag) return false;

    const index = currentTags.extras.indexOf(tag);
    if (index !== -1) {
        currentTags.extras.splice(index, 1);
        logDebug(`エクストラタグを削除: ${tag}`);
        updateCharacterDisplay();
        return true;
    }

    return false;
}

/**
 * 現在のタグ状態を取得する
 * @returns {Object} 現在のタグ状態
 */
export function getCurrentTags() {
    return { ...currentTags };
}

/**
 * タグセットを一括設定する（複合表情用）
 * @param {string} combinationName - 組み合わせ名
 */
export function setCombination(combinationName) {
    if (!dictionary || !dictionary.combinations[combinationName]) {
        logError(`未定義の組み合わせ: ${combinationName}`);
        return false;
    }

    const combination = dictionary.combinations[combinationName];
    logDebug(`組み合わせを設定: ${combinationName}`);

    // 組み合わせに含まれるタグを解析して設定
    const tags = combination.tags || [];
    let expressionTag = currentTags.expression;
    let poseTag = currentTags.pose;
    const extrasTags = [];

    // タグを適切なカテゴリに分類
    tags.forEach(tag => {
        if (dictionary.expressions[tag]) {
            expressionTag = tag;
        } else if (dictionary.poses[tag]) {
            poseTag = tag;
        } else if (dictionary.extras[tag]) {
            extrasTags.push(tag);
        }
    });

    // 各カテゴリのタグを設定
    currentTags.expression = expressionTag;
    currentTags.pose = poseTag;
    currentTags.extras = extrasTags;

    updateCharacterDisplay();
    return true;
}

/**
 * 定義されている表情タグの一覧を取得
 * @returns {Array} 表情タグの配列
 */
export function getExpressionTags() {
    if (!dictionary) return [];
    return Object.keys(dictionary.expressions);
}

/**
 * 定義されているポーズタグの一覧を取得
 * @returns {Array} ポーズタグの配列
 */
export function getPoseTags() {
    if (!dictionary) return [];
    return Object.keys(dictionary.poses);
}

/**
 * 定義されているエクストラタグの一覧を取得
 * @returns {Array} エクストラタグの配列
 */
export function getExtraTags() {
    if (!dictionary) return [];
    return Object.keys(dictionary.extras);
}

/**
 * 定義されている組み合わせの一覧を取得
 * @returns {Array} 組み合わせ名の配列
 */
export function getCombinations() {
    if (!dictionary) return [];
    return Object.keys(dictionary.combinations);
}

/**
 * 表示モードを設定する
 * @param {string} mode - 表示モード（DisplayMode）
 */
export function setDisplayMode(mode) {
    if (!Object.values(DisplayMode).includes(mode)) {
        logError(`不明な表示モード: ${mode}`);
        return false;
    }

    currentMode = mode;
    logDebug(`表示モードを変更: ${mode}`);
    updateCharacterDisplay();
    return true;
}

/**
 * 現在の表示モードを取得する
 * @returns {string} 現在の表示モード
 */
export function getDisplayMode() {
    return currentMode;
}

/**
 * キャラクター表示を更新する
 * @private
 */
function updateCharacterDisplay() {
    switch (currentMode) {
        case DisplayMode.IMAGE:
            updateStaticImage();
            break;
        case DisplayMode.LIVE2D:
            // Live2Dモード実装時に追加
            logDebug('Live2Dモードはまだ実装されていません');
            break;
        case DisplayMode.VRM:
            // VRMモード実装時に追加
            logDebug('VRMモードはまだ実装されていません');
            break;
        default:
            logError(`不明な表示モード: ${currentMode}`);
    }
}

/**
 * 静的画像モードでの表示更新
 * @private
 */
function updateStaticImage() {
    try {
        // 現在のタグから画像パスを生成
        const imagePath = getImagePathFromTags();

        // タイムスタンプ（キャッシュ防止）
        const timestamp = new Date().getTime();

        // 画像を更新
        characterImageElement.src = `${imagePath}?t=${timestamp}`;

        // 代替テキスト更新
        updateAltText();

        logDebug(`画像を更新: ${imagePath}`);
        return true;
    } catch (error) {
        logError(`画像更新エラー: ${error.message}`);
        return false;
    }
}

/**
 * 現在のタグから画像パスを生成する
 * @private
 * @returns {string} 画像ファイルパス
 */
function getImagePathFromTags() {
    if (!dictionary) {
        // 辞書が読み込まれていない場合は既存の方法にフォールバック
        return getImagePathFallback();
    }

    const expressionTag = currentTags.expression;
    const poseTag = currentTags.pose;
    const extrasTags = currentTags.extras;

    // 組み合わせが定義されているか確認
    for (const [combinationName, combination] of Object.entries(dictionary.combinations)) {
        const combinationTags = combination.tags || [];

        // 現在のタグセットが組み合わせのすべてのタグを含んでいるか確認
        const allTagsMatch = combinationTags.every(tag =>
            tag === expressionTag ||
            tag === poseTag ||
            extrasTags.includes(tag)
        );

        // 組み合わせが定義されている場合はその画像を使用
        if (allTagsMatch && combination.image && combination.image.filename) {
            return `${dictionary.modes.IMAGE.basePath}${combination.image.filename}`;
        }
    }

    // 組み合わせが定義されていない場合は個別のタグから画像を合成
    // 現在はポーズを修飾子として使用
    if (dictionary.expressions[expressionTag] && dictionary.expressions[expressionTag].image) {
        const expression = dictionary.expressions[expressionTag].image.filename;
        const basePath = dictionary.modes.IMAGE.basePath;

        // ポーズが存在し、pathModifierがある場合
        let pathWithPose = expression;
        if (dictionary.poses[poseTag] && dictionary.poses[poseTag].image.pathModifier) {
            const poseModifier = dictionary.poses[poseTag].image.pathModifier;
            // ファイル名の拡張子の前にポーズ修飾子を挿入
            const extIndex = expression.lastIndexOf('.');
            if (extIndex !== -1) {
                pathWithPose = `${expression.substring(0, extIndex)}${poseModifier}${expression.substring(extIndex)}`;
            }
        }

        return `${basePath}${pathWithPose}`;
    }

    // 該当する表現が辞書にない場合はフォールバック
    return getImagePathFallback();
}

/**
 * 辞書が利用できない場合のフォールバックパス生成
 * @private
 * @returns {string} 画像ファイルパス
 */
function getImagePathFallback() {
    // expressionタグを既存の表情名に変換
    let expressionPath = 'normal';

    switch (currentTags.expression) {
        case 'HAPPY':
            expressionPath = 'happy';
            break;
        case 'SURPRISED':
            expressionPath = 'surprised';
            break;
        case 'SERIOUS':
            expressionPath = 'serious';
            break;
        case 'SLEEPY':
            expressionPath = 'sleepy';
            break;
        case 'RELIEVED':
            expressionPath = 'relieved';
            break;
        case 'SMILE':
            expressionPath = 'smile';
            break;
        default:
            expressionPath = 'normal';
    }

    return `/assets/images/secretary_${expressionPath}.png`;
}

/**
 * 代替テキストを更新する
 * @private
 */
function updateAltText() {
    if (characterImageElement) {
        let description = '秘書たん';

        // 辞書から説明文を取得
        if (dictionary && dictionary.expressions[currentTags.expression]) {
            const expressionDesc = dictionary.expressions[currentTags.expression].image.description;
            if (expressionDesc) {
                description += `（${expressionDesc}）`;
            }
        } else {
            // フォールバック
            description += `（${currentTags.expression.toLowerCase()}）`;
        }

        characterImageElement.alt = description;
    }
}

/**
 * 差分辞書をロードする
 * @private
 */
function loadDifferentialDictionary() {
    try {
        // インポートしたJSONを使用
        dictionary = dictionaryData;
        logDebug('差分辞書をロードしました');
        return true;
    } catch (error) {
        logError(`差分辞書ロードエラー: ${error.message}`);
        dictionary = null;
        return false;
    }
} 