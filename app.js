// ====== 初始化 Mermaid ======
mermaid.initialize({
  startOnLoad: false,
  theme: 'base',
  themeVariables: {
    primaryColor: '#eef2ff',
    primaryBorderColor: '#6366f1',
    primaryTextColor: '#1e293b',
    lineColor: '#6366f1',
    fontSize: '14px',
  },
  flowchart: {
    useMaxWidth: true,
    htmlLabels: true,
    curve: 'basis',
  },
});

// ====== DOM 元素 ======
const inputEl = document.getElementById('kinship-input');
const calcBtn = document.getElementById('calc-btn');
const suggestionsEl = document.getElementById('suggestions');
const resultSection = document.getElementById('result-section');
const resultTerm = document.getElementById('result-term');
const resultDegree = document.getElementById('result-degree');
const resultType = document.getElementById('result-type');
const resultCalc = document.getElementById('result-calc');
const resultLaw = document.getElementById('result-law');
const mermaidContainer = document.getElementById('mermaid-container');

// ====== 自動建議 ======
let activeSuggestionIndex = -1;

inputEl.addEventListener('input', () => {
  const query = inputEl.value.trim();
  if (query.length === 0) {
    hideSuggestions();
    return;
  }
  const matches = searchKinship(query);
  showSuggestions(matches);
});

inputEl.addEventListener('keydown', (e) => {
  const items = suggestionsEl.querySelectorAll('li');
  if (items.length === 0) return;

  if (e.key === 'ArrowDown') {
    e.preventDefault();
    activeSuggestionIndex = Math.min(activeSuggestionIndex + 1, items.length - 1);
    updateActiveItem(items);
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    activeSuggestionIndex = Math.max(activeSuggestionIndex - 1, 0);
    updateActiveItem(items);
  } else if (e.key === 'Enter') {
    e.preventDefault();
    if (activeSuggestionIndex >= 0 && items[activeSuggestionIndex]) {
      const term = items[activeSuggestionIndex].dataset.term;
      inputEl.value = term;
      hideSuggestions();
      doCalc(term);
    } else {
      hideSuggestions();
      doCalc(inputEl.value.trim());
    }
  } else if (e.key === 'Escape') {
    hideSuggestions();
  }
});

// 點擊外部關閉建議
document.addEventListener('click', (e) => {
  if (!e.target.closest('.search-box')) {
    hideSuggestions();
  }
});

calcBtn.addEventListener('click', () => {
  hideSuggestions();
  doCalc(inputEl.value.trim());
});

function searchKinship(query) {
  const results = [];
  const seen = new Set();
  for (const entry of KINSHIP_DB) {
    if (seen.has(entry.term)) continue;
    const allNames = [entry.term, ...entry.alias];
    if (allNames.some(n => n.includes(query))) {
      const deg = calcDegree(entry.path);
      results.push({ entry, degree: deg.degree });
      seen.add(entry.term);
    }
    if (results.length >= 15) break;
  }
  return results;
}

function showSuggestions(matches) {
  activeSuggestionIndex = -1;
  if (matches.length === 0) {
    hideSuggestions();
    return;
  }
  suggestionsEl.innerHTML = matches.map(m => {
    const degreeText = m.degree === 0 ? '配偶' : `${m.degree}親等`;
    return `<li data-term="${escapeHtml(m.entry.term)}">
      <span>${escapeHtml(m.entry.term)}</span>
      <span class="sug-degree">${degreeText}</span>
    </li>`;
  }).join('');

  suggestionsEl.querySelectorAll('li').forEach(li => {
    li.addEventListener('click', () => {
      inputEl.value = li.dataset.term;
      hideSuggestions();
      doCalc(li.dataset.term);
    });
  });

  suggestionsEl.classList.remove('hidden');
}

function hideSuggestions() {
  suggestionsEl.classList.add('hidden');
  activeSuggestionIndex = -1;
}

function updateActiveItem(items) {
  items.forEach((li, i) => {
    li.classList.toggle('active', i === activeSuggestionIndex);
  });
}

// ====== 主要計算邏輯 ======
function doCalc(term) {
  if (!term) return;
  const entry = KINSHIP_INDEX.get(term);
  if (!entry) {
    alert(`找不到「${term}」的稱謂資料。\n請嘗試其他稱謂，或從下方常見稱謂選擇。`);
    return;
  }

  const deg = calcDegree(entry.path);
  displayResult(entry, deg);
  renderMermaid(entry, deg);
  resultSection.classList.remove('hidden');
  resultSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ====== 顯示結果 ======
function displayResult(entry, deg) {
  resultTerm.textContent = entry.term;

  if (deg.type === 'spouse') {
    resultDegree.textContent = '配偶（無親等）';
  } else {
    resultDegree.textContent = `${deg.degree} 親等`;
  }

  // 關係類型
  const typeMap = {
    'blood-direct': '直系血親',
    'blood-collateral': '旁系血親',
    'in-law': '姻親',
    'spouse': '配偶',
  };
  resultType.textContent = typeMap[deg.type] || deg.type;

  // 計算方式描述
  resultCalc.textContent = buildCalcText(entry, deg);

  // 法律依據
  resultLaw.textContent = buildLawText(deg);
}

function buildCalcText(entry, deg) {
  if (deg.type === 'spouse') {
    return '配偶不以親等計算';
  }

  const parts = [];
  // 建構路徑描述
  const labels = ['己身'];
  for (const node of entry.path) {
    if (node.step !== 'spouse') {
      labels.push(node.label);
    }
  }

  if (deg.type === 'blood-direct') {
    parts.push(`己身 → ${entry.term}，直接計算世代數`);
    parts.push(`共 ${deg.degree} 世 = ${deg.degree} 親等`);
  } else if (deg.type === 'blood-collateral') {
    parts.push(`上數 ${deg.upCount} 世至共同祖先（${deg.commonAncestorLabel}）`);
    parts.push(`下數 ${deg.downCount} 世至 ${entry.term}`);
    parts.push(`${deg.upCount} + ${deg.downCount} = ${deg.degree} 親等`);
  } else if (deg.type === 'in-law') {
    // 找出配偶步驟
    const spouseIdx = entry.path.findIndex(n => n.step === 'spouse');
    if (spouseIdx === 0) {
      // 配偶的血親
      parts.push(`經由配偶關係，計算配偶方的血親親等`);
    } else if (spouseIdx === entry.path.length - 1) {
      // 血親的配偶
      parts.push(`計算該血親的親等，其配偶為同親等姻親`);
    } else {
      parts.push(`結合血親與姻親關係計算`);
    }
    parts.push(`姻親親等 = ${deg.degree} 親等`);
  }

  return parts.join('；');
}

function buildLawText(deg) {
  switch (deg.type) {
    case 'blood-direct':
      return '民法第967條：稱直系血親者，謂己身所從出或從己身所出之血親。直系血親親等之計算，以世代數定之。';
    case 'blood-collateral':
      return '民法第968條：旁系血親親等之計算，從己身數上至同源之直系血親，再由同源之直系血親數下至目標旁系血親，合計世代數定之。';
    case 'in-law':
      return '民法第969-971條：姻親之親等，從配偶之血親或血親之配偶關係計算。';
    case 'spouse':
      return '民法第969條：配偶非親屬，不以親等計算。姻親關係因婚姻而生。';
    default:
      return '';
  }
}

// ====== Mermaid 圖表渲染 ======
let mermaidCounter = 0;

async function renderMermaid(entry, deg) {
  const code = buildMermaidCode(entry, deg);
  mermaidContainer.innerHTML = '';

  mermaidCounter++;
  const id = `mermaid-graph-${mermaidCounter}`;

  try {
    const { svg } = await mermaid.render(id, code);
    mermaidContainer.innerHTML = svg;
  } catch (e) {
    console.error('Mermaid render error:', e);
    mermaidContainer.innerHTML = `<pre style="color:red">圖表渲染失敗: ${escapeHtml(e.message)}</pre>`;
  }
}

function buildMermaidCode(entry, deg) {
  const path = entry.path;
  const lines = ['graph TB'];
  const nodeIds = [];
  const nodeLabels = [];
  const nodeTypes = []; // 'self', 'ancestor', 'target', 'middle', 'spouse'

  // 建立節點
  // 第一個節點是己身
  nodeIds.push('N_self');
  nodeLabels.push('己身');
  nodeTypes.push('self');

  // 追蹤路徑建構節點
  let currentUpCount = 0;
  let currentDownCount = 0;
  let phase = 'up';
  let ancestorIndex = -1;

  for (let i = 0; i < path.length; i++) {
    const node = path[i];
    const nodeId = `N_${i}`;
    nodeIds.push(nodeId);
    nodeLabels.push(node.label);

    if (node.step === 'up') {
      currentUpCount++;
      nodeTypes.push('ancestor');
      // 追蹤最高祖先
      ancestorIndex = nodeIds.length - 1;
    } else if (node.step === 'down') {
      if (phase === 'up') phase = 'down';
      currentDownCount++;
      if (i === path.length - 1) {
        nodeTypes.push('target');
      } else {
        nodeTypes.push('middle');
      }
    } else if (node.step === 'spouse') {
      nodeTypes.push('spouse');
    }
  }

  // 如果最後一個節點是配偶（例如嫂嫂），標記前一個也特殊處理
  if (path.length > 0 && path[path.length - 1].step === 'spouse') {
    // 目標是最後的 spouse 節點
    nodeTypes[nodeTypes.length - 1] = 'target';
  }

  // 如果整個路徑都是 up（直系尊親屬），最後一個是 target
  if (path.every(n => n.step === 'up')) {
    nodeTypes[nodeTypes.length - 1] = 'target';
  }

  // 如果整個路徑都是 down（直系卑親屬），最後一個是 target
  if (path.every(n => n.step === 'down')) {
    nodeTypes[nodeTypes.length - 1] = 'target';
  }

  // 判斷共同祖先（旁系血親用）
  let commonAncestorIdx = -1;
  if (deg.type === 'blood-collateral') {
    // 找最後一個 'up' 節點
    for (let i = path.length - 1; i >= 0; i--) {
      if (path[i].step === 'up') {
        commonAncestorIdx = i + 1; // +1 因為 nodeIds 比 path 多一個 self
        break;
      }
    }
  }

  // 寫節點定義
  for (let i = 0; i < nodeIds.length; i++) {
    const id = nodeIds[i];
    const label = nodeLabels[i];
    let shape;

    if (nodeTypes[i] === 'self') {
      shape = `${id}["🧑 ${label}"]`;
    } else if (nodeTypes[i] === 'target') {
      shape = `${id}["🎯 ${label}"]`;
    } else if (i === commonAncestorIdx) {
      shape = `${id}["👑 ${label}<br/><small>共同祖先</small>"]`;
      nodeTypes[i] = 'common-ancestor';
    } else if (nodeTypes[i] === 'spouse') {
      shape = `${id}["💍 ${label}"]`;
    } else {
      shape = `${id}["${label}"]`;
    }
    lines.push(`  ${shape}`);
  }

  // 寫連線
  for (let i = 0; i < nodeIds.length - 1; i++) {
    const from = nodeIds[i];
    const to = nodeIds[i + 1];
    const node = path[i]; // path[i] 對應 nodeIds[i+1]

    let edgeLabel;
    if (node.step === 'up') {
      edgeLabel = '上1世';
    } else if (node.step === 'down') {
      edgeLabel = '下1世';
    } else if (node.step === 'spouse') {
      edgeLabel = '配偶';
    }
    lines.push(`  ${from} -->|"${edgeLabel}"| ${to}`);
  }

  // 套用樣式
  for (let i = 0; i < nodeIds.length; i++) {
    const id = nodeIds[i];
    switch (nodeTypes[i]) {
      case 'self':
        lines.push(`  style ${id} fill:#d1fae5,stroke:#059669,stroke-width:3px,color:#064e3b`);
        break;
      case 'target':
        lines.push(`  style ${id} fill:#fce7f3,stroke:#db2777,stroke-width:3px,color:#831843`);
        break;
      case 'common-ancestor':
        lines.push(`  style ${id} fill:#fef3c7,stroke:#d97706,stroke-width:3px,color:#78350f`);
        break;
      case 'spouse':
        lines.push(`  style ${id} fill:#ede9fe,stroke:#7c3aed,stroke-width:2px,color:#4c1d95`);
        break;
      case 'ancestor':
        lines.push(`  style ${id} fill:#e0f2fe,stroke:#0284c7,stroke-width:2px,color:#0c4a6e`);
        break;
      default:
        lines.push(`  style ${id} fill:#f1f5f9,stroke:#64748b,stroke-width:1px,color:#334155`);
        break;
    }
  }

  return lines.join('\n');
}

// ====== 常見稱謂標籤 ======
function renderQuickTags() {
  const directTerms = ['父親', '母親', '祖父', '祖母', '外祖父', '外祖母', '曾祖父', '兒子', '女兒', '孫子', '孫女', '外孫', '曾孫'];
  const collateralTerms = ['兄', '弟', '姊', '妹', '伯父', '叔父', '姑姑', '舅舅', '阿姨', '姪子', '外甥', '堂兄', '堂弟', '表兄', '表弟', '堂伯父', '堂叔父', '表舅', '伯祖父', '叔祖父', '從堂兄'];
  const inlawTerms = ['丈夫', '妻子', '嫂嫂', '弟媳', '姊夫', '伯母', '嬸嬸', '姑丈', '舅媽', '姨丈', '公公', '婆婆', '岳父', '岳母', '大伯子', '小姑子', '大舅子', '小姨子', '媳婦', '女婿', '妯娌', '連襟'];

  renderTagGroup('tags-direct', directTerms, 'blood-direct');
  renderTagGroup('tags-collateral', collateralTerms, 'blood-collateral');
  renderTagGroup('tags-inlaw', inlawTerms, 'in-law');
}

function renderTagGroup(containerId, terms, type) {
  const container = document.getElementById(containerId);
  container.innerHTML = terms.map(t =>
    `<span class="tag" data-type="${type}" data-term="${escapeHtml(t)}">${escapeHtml(t)}</span>`
  ).join('');

  container.querySelectorAll('.tag').forEach(tag => {
    tag.addEventListener('click', () => {
      inputEl.value = tag.dataset.term;
      doCalc(tag.dataset.term);
    });
  });
}

// ====== 工具函數 ======
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ====== 啟動 ======
renderQuickTags();
