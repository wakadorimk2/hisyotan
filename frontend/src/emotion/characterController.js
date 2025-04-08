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
    expression: 'DEFAULT',  // 表情タグ
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

    logDebug(`ランダムタグの設定を開始: カテゴリ=${category}, 接頭辞=${tagPrefix}`);

    // 辞書のロードを確認
    if (!dictionary) {
        logDebug('差分辞書が未ロード - ロードを試みます');
        loadDifferentialDictionary();

        if (!dictionary) {
            logError('差分辞書のロードに失敗しました');
            return false;
        }
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
        console.error('差分辞書:', dictionary);
        return false;
    }

    // 接頭辞で始まるタグを抽出（アンダースコア付きの形式「POINTING_01」も対応）
    const matchingTags = Object.keys(categoryDict).filter(tag =>
        tag.startsWith(tagPrefix) || tag.startsWith(`${tagPrefix}_`)
    );

    if (matchingTags.length === 0) {
        logError(`接頭辞 "${tagPrefix}" に一致するタグが見つかりません`);
        console.log('利用可能なタグ:', Object.keys(categoryDict));
        return false;
    }

    logDebug(`接頭辞 "${tagPrefix}" に一致するタグ: ${matchingTags.join(', ')}`);

    // ランダムにタグを選択
    const randomIndex = Math.floor(Math.random() * matchingTags.length);
    const selectedTag = matchingTags[randomIndex];

    // 選択されたタグのバリエーション番号を取得（デバッグ用）
    let variant = 0;
    const tagNumber = selectedTag.match(/\d+/);
    if (tagNumber) {
        variant = parseInt(tagNumber[0]);
    } else if (selectedTag.includes('_')) {
        // アンダースコアがある場合は、その後の部分を番号として扱う
        const parts = selectedTag.split('_');
        if (parts.length > 1 && !isNaN(parseInt(parts[parts.length - 1]))) {
            variant = parseInt(parts[parts.length - 1]);
        }
    }

    logDebug(`ランダムタグを選択: ${selectedTag} (バリエーション ${variant}番)`);

    // 選択したタグを設定
    const result = setTag(category, selectedTag);
    logDebug(`タグ設定結果: ${result ? '成功' : '失敗'}`);

    return result;
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
 */
function updateCharacterDisplay() {
    logDebug(`キャラクター表示を更新します - モード: ${currentMode}, タグ状態: ${JSON.stringify(currentTags)}`);

    // 表示モードに応じた処理
    switch (currentMode) {
        case DisplayMode.IMAGE:
            updateStaticImage();
            break;
        case DisplayMode.LIVE2D:
            // Live2D更新関数（将来実装）
            console.log('Live2Dモードはまだ実装されていません');
            break;
        case DisplayMode.VRM:
            // VRM更新関数（将来実装）
            console.log('VRMモードはまだ実装されていません');
            break;
        default:
            console.error(`未知の表示モード: ${currentMode}`);
            break;
    }

    // 代替テキストを更新
    updateAltText();
}

/**
 * 静的画像を更新する
 */
function updateStaticImage() {
    if (!characterImageElement) {
        logError('キャラクター画像要素が見つかりません');
        return;
    }

    try {
        // 現在のタグ状態からパスを生成
        const imagePath = getImagePathFromTags();

        logDebug(`画像パスを生成しました: ${imagePath}`);

        // 画像の更新
        const currentSrc = characterImageElement.src || '';
        const newSrc = imagePath;

        // 現在のsrcから相対パスを抽出
        const currentPath = currentSrc.split('/').slice(-1)[0];
        const newPath = newSrc.split('/').slice(-1)[0];

        logDebug(`画像の更新: ${currentPath} → ${newPath}`);

        // 循環参照チェック用フラグ
        let isFallbackActive = false;

        if (currentSrc !== newSrc) {
            characterImageElement.src = newSrc;
            logDebug(`キャラクター画像を更新しました: ${newSrc}`);

            // 読み込みのエラーハンドリング
            characterImageElement.onerror = () => {
                logError(`画像の読み込みに失敗しました: ${newSrc}`);

                // 既にフォールバック処理中の場合は循環を避ける
                if (isFallbackActive) {
                    logError('フォールバックでも画像の読み込みに失敗しました。処理を中断します。');
                    return;
                }

                // フォールバック処理開始
                isFallbackActive = true;

                // 秘書たん画像が見つからない場合はダミー画像を表示
                try {
                    const fallbackPath = `/assets/images/dummy.png`;
                    characterImageElement.src = fallbackPath;
                    logDebug(`ダミー画像に切り替えました: ${fallbackPath}`);

                    // ダミー画像も見つからない場合の処理
                    characterImageElement.onerror = () => {
                        logError('ダミー画像も見つかりません');
                        // エラー表示を抑制するために空のデータURIを設定
                        characterImageElement.src = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
                    };
                } catch (e) {
                    logError(`フォールバック処理中にエラーが発生: ${e.message}`);
                }
            };
        } else {
            logDebug('画像パスに変更がないため、更新をスキップします');
        }
    } catch (error) {
        logError(`静的画像の更新中にエラーが発生しました: ${error.message}`);
        console.error('詳細エラー:', error);
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
    // 新しいファイル命名規則に基づいて画像名を生成: funya_{EXPRESSION}_{POSE}_{EFFECT}.png
    const effectTag = extrasTags.length > 0 ? extrasTags[0] : 'NONE';

    // 新しいファイル名形式で画像パスを生成
    const filename = `funya_${expressionTag}_${poseTag}_${effectTag}.png`;
    logDebug(`新しいファイル名形式で画像パスを生成: ${filename}`);

    return `${dictionary.modes.IMAGE.basePath}${filename}`;
}

/**
 * 辞書が利用できない場合のフォールバックパス生成
 * @private
 * @returns {string} 画像ファイルパス
 */
function getImagePathFallback() {
    // 新しいフォーマットにマッチするフォールバック画像を返す
    return `/assets/images/funya_DEFAULT_NEUTRAL_NONE.png`;
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

/**
 * 画像ファイル名からタグ情報を解析する
 * @param {string} filename - 画像ファイル名（例: funya_HAPPY_POINTING_01_BLUSH.png）
 * @returns {Object|null} タグ情報を含むオブジェクト、解析失敗時はnull
 */
export function parseTagsFromFilename(filename) {
    try {
        // ファイル名から拡張子と接頭辞を削除
        const baseFilename = filename.replace(/\.[^/.]+$/, ''); // 拡張子削除

        // funya_ で始まるファイル名のみを処理
        if (!baseFilename.startsWith('funya_')) {
            logDebug(`非対応のファイル名形式: ${filename}`);
            return null;
        }

        // funya_ 接頭辞を削除した残りの部分をアンダースコアで分割
        const parts = baseFilename.substring(6).split('_');

        if (parts.length < 3) {
            logDebug(`タグ要素が不足しているファイル名: ${filename}`);
            return null;
        }

        // 基本的には [EXPRESSION, POSE, EFFECT] の順を想定
        const tagInfo = {
            expression: parts[0],
            pose: parts.length > 2 ? `${parts[1]}${parts[2].match(/^\d+$/) ? '_' + parts[2] : ''}` : parts[1],
            effect: parts.length > 3 ? parts[3] : 'NONE'
        };

        logDebug(`ファイル名からタグを解析: ${filename} -> ${JSON.stringify(tagInfo)}`);
        return tagInfo;
    } catch (error) {
        logError(`ファイル名からのタグ解析エラー: ${error.message}`);
        return null;
    }
}

/**
 * ファイル名から辞書を自動更新する
 * @param {Array<string>} filenames - 画像ファイル名の配列
 * @returns {boolean} 成功したかどうか
 */
export function updateDictionaryFromFilenames(filenames) {
    try {
        if (!dictionary) {
            loadDifferentialDictionary();
            if (!dictionary) {
                logError('差分辞書のロードに失敗しました');
                return false;
            }
        }

        // 処理したファイル数をカウント
        let processedCount = 0;

        filenames.forEach(filename => {
            const tagInfo = parseTagsFromFilename(filename);
            if (!tagInfo) return;

            const { expression, pose, effect } = tagInfo;

            // expressions辞書に表情がなければ追加
            if (expression && !dictionary.expressions[expression]) {
                dictionary.expressions[expression] = {
                    image: {
                        filename: `funya_${expression}_NEUTRAL_NONE.png`,
                        description: `${expression.toLowerCase()}表情`
                    },
                    live2d: { parameters: {} },
                    vrm: { blendShapes: {} }
                };
                logDebug(`新しい表情を辞書に追加: ${expression}`);
            }

            // poses辞書にポーズがなければ追加
            if (pose && !dictionary.poses[pose]) {
                dictionary.poses[pose] = {
                    image: {
                        pathModifier: `_${pose}`,
                        description: `${pose.toLowerCase()}ポーズ`
                    },
                    live2d: { motion: pose.toLowerCase(), parameters: {} },
                    vrm: { pose: pose.toLowerCase(), parameters: {} }
                };
                logDebug(`新しいポーズを辞書に追加: ${pose}`);
            }

            // extras辞書にエフェクトがなければ追加
            if (effect && effect !== 'NONE' && !dictionary.extras[effect]) {
                dictionary.extras[effect] = {
                    image: {
                        overlay: `sfx_${effect.toLowerCase()}.png`,
                        position: { x: 0, y: 0 },
                        description: `${effect.toLowerCase()}エフェクト`
                    },
                    live2d: { overlay: null, parameters: {} }
                };
                logDebug(`新しいエフェクトを辞書に追加: ${effect}`);
            }

            processedCount++;
        });

        logDebug(`ファイル名から辞書を更新しました（処理ファイル数: ${processedCount}）`);
        return true;
    } catch (error) {
        logError(`辞書の自動更新エラー: ${error.message}`);
        return false;
    }
} 