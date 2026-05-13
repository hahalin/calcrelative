/**
 * 親屬關係資料庫
 * 
 * 每個稱謂對應一條「路徑」(path)，描述從己身到該親屬的行走方式：
 *   F = 父, M = 母, S = 子, D = 女
 *   H = 夫, W = 妻
 *   eB = 兄(elder brother), yB = 弟(younger brother)
 *   eZ = 姊(elder sister), yZ = 妹(younger sister)
 *   B = 兄弟(不分長幼), Z = 姊妹(不分長幼)
 * 
 * path 中每一步代表一個世代移動：
 *   往上(F/M) = 上一世代
 *   往下(S/D) = 下一世代
 *   同輩(B/Z) = 先上到共同父母再下來，算2世
 * 
 * 親等計算方式（民法第968條）：
 *   直系血親：直接算世代數
 *   旁系血親：己身→共同祖先 + 共同祖先→對方
 *   姻親（民法第969-971條）：以配偶的血親親等為其姻親親等
 * 
 * type: 'blood-direct' | 'blood-collateral' | 'in-law'
 */

const KINSHIP_DB = (() => {

  // ====== 路徑節點定義 ======
  // 每個節點: { step, label, gender?, seniority? }
  // step: 'up'(往上一世), 'down'(往下一世), 'spouse'(配偶,同世)
  const up = (label, gender) => ({ step: 'up', label, gender });
  const down = (label, gender, seniority) => ({ step: 'down', label, gender, seniority });
  const spouse = (label, gender) => ({ step: 'spouse', label, gender });

  // 常用路徑片段
  const F = up('父', 'M');
  const M = up('母', 'F');
  const S = down('子', 'M');
  const D = down('女', 'F');
  const H = spouse('夫', 'M');
  const W = spouse('妻', 'F');
  const eB = (label) => [up('父', 'M'), down(label || '兄', 'M', 'elder')];
  const yB = (label) => [up('父', 'M'), down(label || '弟', 'M', 'younger')];
  const eZ = (label) => [up('父', 'M'), down(label || '姊', 'F', 'elder')];
  const yZ = (label) => [up('父', 'M'), down(label || '妹', 'F', 'younger')];

  // ====== 稱謂資料 ======
  const entries = [
    // ==================== 直系血親（尊親屬）====================
    { term: '父親', alias: ['爸爸','爸','父'], path: [F], type: 'blood-direct' },
    { term: '母親', alias: ['媽媽','媽','母'], path: [M], type: 'blood-direct' },
    { term: '祖父', alias: ['爺爺','阿公','內祖父'], path: [F, up('祖父','M')], type: 'blood-direct' },
    { term: '祖母', alias: ['奶奶','阿嬤','內祖母'], path: [F, up('祖母','F')], type: 'blood-direct' },
    { term: '外祖父', alias: ['外公','姥爺'], path: [M, up('外祖父','M')], type: 'blood-direct' },
    { term: '外祖母', alias: ['外婆','姥姥'], path: [M, up('外祖母','F')], type: 'blood-direct' },
    { term: '曾祖父', alias: ['太公'], path: [F, up('祖父','M'), up('曾祖父','M')], type: 'blood-direct' },
    { term: '曾祖母', alias: ['太婆'], path: [F, up('祖母','F'), up('曾祖母','F')], type: 'blood-direct' },
    { term: '外曾祖父', alias: [], path: [M, up('外祖父','M'), up('外曾祖父','M')], type: 'blood-direct' },
    { term: '外曾祖母', alias: [], path: [M, up('外祖母','F'), up('外曾祖母','F')], type: 'blood-direct' },
    { term: '高祖父', alias: [], path: [F, up('祖父','M'), up('曾祖父','M'), up('高祖父','M')], type: 'blood-direct' },
    { term: '高祖母', alias: [], path: [F, up('祖母','F'), up('曾祖母','F'), up('高祖母','F')], type: 'blood-direct' },

    // ==================== 直系血親（卑親屬）====================
    { term: '兒子', alias: ['子'], path: [S], type: 'blood-direct' },
    { term: '女兒', alias: ['女'], path: [D], type: 'blood-direct' },
    { term: '孫子', alias: ['孫','內孫'], path: [S, down('孫子','M')], type: 'blood-direct' },
    { term: '孫女', alias: ['內孫女'], path: [S, down('孫女','F')], type: 'blood-direct' },
    { term: '外孫', alias: ['外孫子'], path: [D, down('外孫','M')], type: 'blood-direct' },
    { term: '外孫女', alias: [], path: [D, down('外孫女','F')], type: 'blood-direct' },
    { term: '曾孫', alias: ['曾孫子'], path: [S, down('孫子','M'), down('曾孫','M')], type: 'blood-direct' },
    { term: '曾孫女', alias: [], path: [S, down('孫女','F'), down('曾孫女','F')], type: 'blood-direct' },
    { term: '玄孫', alias: ['玄孫子'], path: [S, down('孫子','M'), down('曾孫','M'), down('玄孫','M')], type: 'blood-direct' },

    // ==================== 旁系血親（二親等）====================
    { term: '兄', alias: ['哥哥','哥','兄長'], path: [...eB('兄')], type: 'blood-collateral' },
    { term: '弟', alias: ['弟弟'], path: [...yB('弟')], type: 'blood-collateral' },
    { term: '姊', alias: ['姊姊','姐姐','姐'], path: [...eZ('姊')], type: 'blood-collateral' },
    { term: '妹', alias: ['妹妹'], path: [...yZ('妹')], type: 'blood-collateral' },

    // ==================== 旁系血親（三親等）====================
    { term: '伯父', alias: ['伯伯','大伯'], path: [F, up('祖父','M'), down('伯父','M','elder')], type: 'blood-collateral' },
    { term: '叔父', alias: ['叔叔','叔'], path: [F, up('祖父','M'), down('叔父','M','younger')], type: 'blood-collateral' },
    { term: '姑姑', alias: ['姑','姑母'], path: [F, up('祖父','M'), down('姑姑','F')], type: 'blood-collateral' },
    { term: '舅舅', alias: ['舅','舅父'], path: [M, up('外祖父','M'), down('舅舅','M')], type: 'blood-collateral' },
    { term: '阿姨', alias: ['姨媽','姨母','姨'], path: [M, up('外祖母','F'), down('阿姨','F')], type: 'blood-collateral' },
    { term: '姪子', alias: ['姪','侄子','侄'], path: [...eB('兄'), down('姪子','M')], type: 'blood-collateral' },
    { term: '姪女', alias: ['侄女'], path: [...eB('兄'), down('姪女','F')], type: 'blood-collateral' },
    { term: '外甥', alias: ['外甥子'], path: [...eZ('姊'), down('外甥','M')], type: 'blood-collateral' },
    { term: '外甥女', alias: [], path: [...eZ('姊'), down('外甥女','F')], type: 'blood-collateral' },

    // ==================== 旁系血親（四親等）====================
    { term: '堂兄', alias: ['堂哥'], path: [F, up('祖父','M'), down('伯父','M','elder'), down('堂兄','M','elder')], type: 'blood-collateral' },
    { term: '堂弟', alias: [], path: [F, up('祖父','M'), down('叔父','M','younger'), down('堂弟','M','younger')], type: 'blood-collateral' },
    { term: '堂姊', alias: ['堂姐'], path: [F, up('祖父','M'), down('伯父','M','elder'), down('堂姊','F','elder')], type: 'blood-collateral' },
    { term: '堂妹', alias: [], path: [F, up('祖父','M'), down('叔父','M','younger'), down('堂妹','F','younger')], type: 'blood-collateral' },
    { term: '表兄', alias: ['表哥'], path: [M, up('外祖父','M'), down('舅舅','M'), down('表兄','M','elder')], type: 'blood-collateral' },
    { term: '表弟', alias: [], path: [M, up('外祖父','M'), down('舅舅','M'), down('表弟','M','younger')], type: 'blood-collateral' },
    { term: '表姊', alias: ['表姐'], path: [M, up('外祖父','M'), down('舅舅','M'), down('表姊','F','elder')], type: 'blood-collateral' },
    { term: '表妹', alias: [], path: [M, up('外祖父','M'), down('舅舅','M'), down('表妹','F','younger')], type: 'blood-collateral' },
    // 姑表
    { term: '姑表兄', alias: ['姑表哥'], path: [F, up('祖父','M'), down('姑姑','F'), down('姑表兄','M','elder')], type: 'blood-collateral' },
    { term: '姑表弟', alias: [], path: [F, up('祖父','M'), down('姑姑','F'), down('姑表弟','M','younger')], type: 'blood-collateral' },
    { term: '姑表姊', alias: ['姑表姐'], path: [F, up('祖父','M'), down('姑姑','F'), down('姑表姊','F','elder')], type: 'blood-collateral' },
    { term: '姑表妹', alias: [], path: [F, up('祖父','M'), down('姑姑','F'), down('姑表妹','F','younger')], type: 'blood-collateral' },
    // 姨表
    { term: '姨表兄', alias: ['姨表哥'], path: [M, up('外祖母','F'), down('阿姨','F'), down('姨表兄','M','elder')], type: 'blood-collateral' },
    { term: '姨表弟', alias: [], path: [M, up('外祖母','F'), down('阿姨','F'), down('姨表弟','M','younger')], type: 'blood-collateral' },
    { term: '姨表姊', alias: ['姨表姐'], path: [M, up('外祖母','F'), down('阿姨','F'), down('姨表姊','F','elder')], type: 'blood-collateral' },
    { term: '姨表妹', alias: [], path: [M, up('外祖母','F'), down('阿姨','F'), down('姨表妹','F','younger')], type: 'blood-collateral' },

    // 伯叔祖（祖父的兄弟）
    { term: '伯祖父', alias: ['伯公'], path: [F, up('祖父','M'), up('曾祖父','M'), down('伯祖父','M','elder')], type: 'blood-collateral' },
    { term: '叔祖父', alias: ['叔公'], path: [F, up('祖父','M'), up('曾祖父','M'), down('叔祖父','M','younger')], type: 'blood-collateral' },
    { term: '姑祖母', alias: ['姑婆'], path: [F, up('祖父','M'), up('曾祖父','M'), down('姑祖母','F')], type: 'blood-collateral' },

    // 舅祖（外祖父的兄弟）
    { term: '舅祖父', alias: ['舅公'], path: [M, up('外祖父','M'), up('外曾祖父','M'), down('舅祖父','M')], type: 'blood-collateral' },
    { term: '姨祖母', alias: ['姨婆'], path: [M, up('外祖母','F'), up('外曾祖母','F'), down('姨祖母','F')], type: 'blood-collateral' },

    // ==================== 旁系血親（五親等）====================
    // 堂伯/堂叔（父親的堂兄弟）
    { term: '堂伯父', alias: ['堂伯'], path: [F, up('祖父','M'), up('曾祖父','M'), down('伯祖父','M','elder'), down('堂伯父','M','elder')], type: 'blood-collateral' },
    { term: '堂叔父', alias: ['堂叔'], path: [F, up('祖父','M'), up('曾祖父','M'), down('叔祖父','M','younger'), down('堂叔父','M','younger')], type: 'blood-collateral' },
    { term: '堂姑', alias: ['堂姑母','堂姑姑'], path: [F, up('祖父','M'), up('曾祖父','M'), down('叔祖父','M','younger'), down('堂姑','F')], type: 'blood-collateral' },
    // 表舅/表姨（母親的表兄弟姊妹）
    { term: '表舅', alias: ['表舅舅'], path: [M, up('外祖父','M'), up('外曾祖父','M'), down('舅祖父','M'), down('表舅','M')], type: 'blood-collateral' },
    { term: '表姨', alias: ['表阿姨','表姨母'], path: [M, up('外祖母','F'), up('外曾祖母','F'), down('姨祖母','F'), down('表姨','F')], type: 'blood-collateral' },

    // 從堂兄弟（祖父的兄弟的孫）=> 6親等
    { term: '從堂兄', alias: [], path: [F, up('祖父','M'), up('曾祖父','M'), down('伯祖父','M','elder'), down('堂伯父','M','elder'), down('從堂兄','M','elder')], type: 'blood-collateral' },
    { term: '從堂弟', alias: [], path: [F, up('祖父','M'), up('曾祖父','M'), down('叔祖父','M','younger'), down('堂叔父','M','younger'), down('從堂弟','M','younger')], type: 'blood-collateral' },

    // 表舅公 = 外祖父的表兄弟 = 外曾祖父的姊妹之子
    { term: '表舅公', alias: ['表舅祖父'], path: [M, up('外祖父','M'), up('外曾祖父','M'), down('姑外曾祖母','F'), down('表舅公','M')], type: 'blood-collateral' },

    // ==================== 姻親 ====================
    // -- 配偶 --
    { term: '丈夫', alias: ['夫','老公','先生'], path: [H], type: 'spouse' },
    { term: '妻子', alias: ['妻','老婆','太太'], path: [W], type: 'spouse' },

    // -- 血親之配偶（民法第969條第1款）--
    { term: '嫂嫂', alias: ['嫂','大嫂'], path: [...eB('兄'), spouse('嫂嫂','F')], type: 'in-law' },
    { term: '弟媳', alias: ['弟妹'], path: [...yB('弟'), spouse('弟媳','F')], type: 'in-law' },
    { term: '姊夫', alias: [], path: [...eZ('姊'), spouse('姊夫','M')], type: 'in-law' },
    { term: '妹夫', alias: [], path: [...yZ('妹'), spouse('妹夫','M')], type: 'in-law' },
    { term: '伯母', alias: ['伯娘'], path: [F, up('祖父','M'), down('伯父','M','elder'), spouse('伯母','F')], type: 'in-law' },
    { term: '嬸嬸', alias: ['嬸母','叔母','嬸'], path: [F, up('祖父','M'), down('叔父','M','younger'), spouse('嬸嬸','F')], type: 'in-law' },
    { term: '姑丈', alias: ['姑父'], path: [F, up('祖父','M'), down('姑姑','F'), spouse('姑丈','M')], type: 'in-law' },
    { term: '舅媽', alias: ['舅母','舅妗'], path: [M, up('外祖父','M'), down('舅舅','M'), spouse('舅媽','F')], type: 'in-law' },
    { term: '姨丈', alias: ['姨父','姨夫'], path: [M, up('外祖母','F'), down('阿姨','F'), spouse('姨丈','M')], type: 'in-law' },
    { term: '媳婦', alias: ['兒媳'], path: [S, spouse('媳婦','F')], type: 'in-law' },
    { term: '女婿', alias: [], path: [D, spouse('女婿','M')], type: 'in-law' },
    { term: '孫媳婦', alias: [], path: [S, down('孫子','M'), spouse('孫媳婦','F')], type: 'in-law' },
    { term: '孫女婿', alias: [], path: [S, down('孫女','F'), spouse('孫女婿','M')], type: 'in-law' },
    { term: '姪媳', alias: ['侄媳'], path: [...eB('兄'), down('姪子','M'), spouse('姪媳','F')], type: 'in-law' },

    // -- 配偶之血親（民法第969條第2款）--
    { term: '公公', alias: ['家翁'], path: [H, up('公公','M')], type: 'in-law' },
    { term: '婆婆', alias: ['家姑'], path: [H, up('婆婆','F')], type: 'in-law' },
    { term: '岳父', alias: ['丈人','岳丈'], path: [W, up('岳父','M')], type: 'in-law' },
    { term: '岳母', alias: ['丈母娘'], path: [W, up('岳母','F')], type: 'in-law' },
    { term: '大伯子', alias: ['大伯'], path: [H, up('公公','M'), down('大伯子','M','elder')], type: 'in-law' },
    { term: '小叔子', alias: ['小叔'], path: [H, up('公公','M'), down('小叔子','M','younger')], type: 'in-law' },
    { term: '大姑子', alias: ['大姑'], path: [H, up('公公','M'), down('大姑子','F','elder')], type: 'in-law' },
    { term: '小姑子', alias: ['小姑'], path: [H, up('公公','M'), down('小姑子','F','younger')], type: 'in-law' },
    { term: '大舅子', alias: ['內兄','舅兄','大舅哥'], path: [W, up('岳父','M'), down('大舅子','M','elder')], type: 'in-law' },
    { term: '小舅子', alias: ['內弟','舅弟'], path: [W, up('岳父','M'), down('小舅子','M','younger')], type: 'in-law' },
    { term: '大姨子', alias: ['姨姊'], path: [W, up('岳母','F'), down('大姨子','F','elder')], type: 'in-law' },
    { term: '小姨子', alias: ['姨妹'], path: [W, up('岳母','F'), down('小姨子','F','younger')], type: 'in-law' },

    // -- 配偶之血親之配偶（民法第969條第3款）--
    { term: '妯娌', alias: [], path: [H, up('公公','M'), down('小叔子','M','younger'), spouse('妯娌','F')], type: 'in-law' },
    { term: '連襟', alias: ['襟兄弟'], path: [W, up('岳母','F'), down('大姨子','F','elder'), spouse('連襟','M')], type: 'in-law' },
    { term: '親家公', alias: [], path: [S, spouse('媳婦','F'), up('親家公','M')], type: 'in-law' },
    { term: '親家母', alias: [], path: [S, spouse('媳婦','F'), up('親家母','F')], type: 'in-law' },

    // -- 繼親 --
    { term: '繼父', alias: [], path: [M, spouse('繼父','M')], type: 'in-law' },
    { term: '繼母', alias: [], path: [F, spouse('繼母','F')], type: 'in-law' },
  ];

  return entries;
})();

// 建立快速查找索引
const KINSHIP_INDEX = (() => {
  const index = new Map();
  for (const entry of KINSHIP_DB) {
    index.set(entry.term, entry);
    for (const alias of entry.alias) {
      index.set(alias, entry);
    }
  }
  return index;
})();

/**
 * 根據路徑計算親等
 * @param {Array} path - 路徑節點陣列
 * @returns {{ degree: number, upCount: number, downCount: number, type: string, commonAncestor: string|null }}
 */
function calcDegree(path) {
  let upCount = 0;
  let downCount = 0;
  let phase = 'up'; // up -> down (先上後下)
  let hasSpouse = false;
  let commonAncestorLabel = null;
  let spouseIndex = -1;

  // 找到配偶步驟的位置（如果有）
  for (let i = 0; i < path.length; i++) {
    if (path[i].step === 'spouse') {
      spouseIndex = i;
      break;
    }
  }

  // 對於姻親，計算方式不同
  if (spouseIndex >= 0) {
    hasSpouse = true;
  }

  // 計算世數
  for (let i = 0; i < path.length; i++) {
    const node = path[i];
    if (node.step === 'spouse') {
      // 配偶本身不算親等世數
      continue;
    }
    if (node.step === 'up') {
      upCount++;
      if (phase === 'up') {
        commonAncestorLabel = node.label;
      }
    } else if (node.step === 'down') {
      if (phase === 'up') {
        phase = 'down';
      }
      downCount++;
    }
  }

  // 判斷類型
  let type;
  if (path.length === 1 && path[0].step === 'spouse') {
    type = 'spouse';
  } else if (hasSpouse) {
    type = 'in-law';
  } else if (downCount === 0 || upCount === 0) {
    type = 'blood-direct';
  } else {
    type = 'blood-collateral';
  }

  // 親等計算
  let degree;
  if (type === 'spouse') {
    degree = 0; // 配偶不算親等
  } else if (type === 'blood-direct') {
    degree = upCount + downCount;
  } else if (type === 'blood-collateral') {
    degree = upCount + downCount;
  } else if (type === 'in-law') {
    // 姻親親等 = 對應血親關係的親等
    // 先移除 spouse 步驟後計算
    degree = upCount + downCount;
  }

  return { degree, upCount, downCount, type, commonAncestorLabel, hasSpouse };
}
