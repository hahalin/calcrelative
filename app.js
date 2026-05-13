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

// ====== HTML 樹狀圖渲染 ======
function renderMermaid(entry, deg) {
  const container = mermaidContainer;
  container.innerHTML = '';
  const path = entry.path;

  // 分析路徑：找出上行段、下行段、配偶段
  const upNodes = [];   // 己身側往上的節點（不含己身）
  const downNodes = []; // 共同祖先往下到目標的節點
  let spouseNode = null;
  let spouseAttachIdx = -1; // spouse 接在哪個 down 節點後

  let phase = 'up';
  for (let i = 0; i < path.length; i++) {
    const n = path[i];
    if (n.step === 'up') {
      upNodes.push(n);
    } else if (n.step === 'down') {
      phase = 'down';
      downNodes.push(n);
    } else if (n.step === 'spouse') {
      spouseNode = n;
      spouseAttachIdx = downNodes.length - 1;
    }
  }

  const isCollateral = upNodes.length > 0 && downNodes.length > 0;
  const isDirect = !isCollateral && !spouseNode;
  const wrapper = el('div', 'tree-wrapper');

  if (isCollateral) {
    renderCollateralTree(wrapper, upNodes, downNodes, spouseNode, spouseAttachIdx, deg);
  } else if (spouseNode && upNodes.length === 0 && downNodes.length === 0) {
    // 純配偶
    renderDirectTree(wrapper, path, deg);
  } else {
    renderDirectTree(wrapper, path, deg);
  }

  container.appendChild(wrapper);
}

function renderCollateralTree(wrapper, upNodes, downNodes, spouseNode, spouseAttachIdx, deg) {
  // 共同祖先 = upNodes 最後一個
  const ancestor = upNodes[upNodes.length - 1];

  // 共同祖先節點（編號 = upCount，代表從己身數上來的第幾步）
  const ancestorNode = makeNode(ancestor.label, 'node-ancestor', deg.upCount, '共同祖先');
  wrapper.appendChild(ancestorNode);
  wrapper.appendChild(el('div', 'tree-vline'));

  // 分支容器
  const branches = el('div', 'tree-branches');

  // 左支：旁系（目標側）
  const leftBranch = el('div', 'tree-branch');
  const leftLabel = el('div', 'tree-branch-label');
  leftLabel.textContent = '▼ 旁系';
  leftBranch.appendChild(leftLabel);

  let num = deg.upCount + 1; // 從共同祖先之後繼續編號
  for (let i = 0; i < downNodes.length; i++) {
    const n = downNodes[i];
    const isLast = (i === downNodes.length - 1) && !spouseNode;
    const cls = isLast ? 'node-target' : '';
    const nodeEl = makeNode(n.label, cls, num, null);
    leftBranch.appendChild(nodeEl);
    num++;

    // 如果有配偶接在這個節點
    if (spouseNode && i === spouseAttachIdx) {
      const row = el('div', 'tree-spouse-row');
      row.appendChild(el('div', 'tree-spouse-hline'));
      const sp = makeNode(spouseNode.label, 'node-target', null, '配偶');
      row.appendChild(sp);
      leftBranch.appendChild(row);
    }

    if (i < downNodes.length - 1) {
      leftBranch.appendChild(el('div', 'tree-vline'));
    }
  }

  // 右支：直系（己身側）- 從祖先往下列到己身
  const rightBranch = el('div', 'tree-branch');
  const rightLabel = el('div', 'tree-branch-label');
  rightLabel.textContent = '▼ 直系';
  rightBranch.appendChild(rightLabel);

  // upNodes 是 [父, 祖父, 曾祖父...]，反轉後去掉最後一個(共同祖先) 得到從上往下
  const selfSide = upNodes.slice(0, -1).reverse();
  let selfNum = selfSide.length; // 最靠近共同祖先的編號最大，靠近己身的=1
  for (let i = 0; i < selfSide.length; i++) {
    const n = selfSide[i];
    const nodeEl = makeNode(n.label, '', selfNum, null);
    rightBranch.appendChild(nodeEl);
    selfNum--;
    rightBranch.appendChild(el('div', 'tree-vline'));
  }
  // 己身
  rightBranch.appendChild(makeNode('己身', 'node-self', null, null));

  branches.appendChild(leftBranch);
  branches.appendChild(rightBranch);
  wrapper.appendChild(branches);

  // 總結
  const summary = el('div', 'tree-summary');
  summary.textContent = `上數 ${deg.upCount} 世 + 下數 ${deg.downCount} 世 = ${deg.degree} 親等`;
  wrapper.appendChild(summary);
}

function renderDirectTree(wrapper, path, deg) {
  const direct = el('div', 'tree-direct');
  let num = 0;

  // 直系：由上往下排列
  // 尊親屬(全up)：反轉 → 目標在上，己在下
  // 卑親屬(全down)：己在上，目標在下
  const allUp = path.every(n => n.step === 'up');
  const allDown = path.every(n => n.step === 'down' || n.step === 'spouse');
  const hasSpouse = path.some(n => n.step === 'spouse');

  if (allUp) {
    // 尊親屬：最上面是目標
    const reversed = [...path].reverse();
    const targetNode = makeNode(reversed[0].label, 'node-target', path.length, null);
    direct.appendChild(targetNode);

    for (let i = 1; i < reversed.length; i++) {
      direct.appendChild(el('div', 'tree-vline'));
      const nodeEl = makeNode(reversed[i].label, '', path.length - i, null);
      direct.appendChild(nodeEl);
    }
    direct.appendChild(el('div', 'tree-vline'));
    direct.appendChild(makeNode('己身', 'node-self', null, null));
  } else {
    // 卑親屬或含配偶
    direct.appendChild(makeNode('己身', 'node-self', null, null));
    num = 1;
    for (let i = 0; i < path.length; i++) {
      const n = path[i];
      if (n.step === 'spouse') {
        // 配偶用橫向
        const row = el('div', 'tree-spouse-row');
        const prev = direct.lastElementChild;
        row.appendChild(el('div', 'tree-spouse-hline'));
        const isLast = i === path.length - 1;
        const cls = isLast ? 'node-target' : 'node-spouse';
        row.appendChild(makeNode(n.label, cls, null, '配偶'));
        direct.appendChild(row);
      } else {
        direct.appendChild(el('div', 'tree-vline'));
        const isLast = i === path.length - 1;
        const cls = isLast ? 'node-target' : '';
        direct.appendChild(makeNode(n.label, cls, num, null));
        num++;
      }
    }
  }

  wrapper.appendChild(direct);

  if (deg.type !== 'spouse') {
    const summary = el('div', 'tree-summary');
    summary.textContent = `共 ${deg.degree} 世 = ${deg.degree} 親等`;
    wrapper.appendChild(summary);
  }
}

// 建立節點 DOM
function makeNode(label, extraClass, num, subtitle) {
  const node = el('div', 'tree-node ' + (extraClass || ''));
  node.textContent = label;
  if (num != null) {
    const badge = el('span', 'node-num');
    badge.textContent = num;
    node.appendChild(badge);
  }
  if (subtitle) {
    const sub = el('span', 'node-sub');
    sub.textContent = subtitle;
    node.appendChild(sub);
  }
  return node;
}

function el(tag, className) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  return e;
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
