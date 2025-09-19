/******************************************************
 * 経穴検索 + 臨床病証二段選択 拡張版
 * - APP_VERSION 20250918-20
 * - 変更:
 *   * 臨床CSVパーサ: 横インターリーブ形式 (治療/コメント/治療/コメント ...) に対応
 *   * 12.のぼせ などで 2 病証目以降の治療方針が表示されない不具合修正
 *   * 1番目病証のコメント "(陰分を補う)" が表示されない問題修正
 ******************************************************/

const APP_VERSION = '20250918-20';
const CSV_FILE = '経穴・経絡.csv';
const CLINICAL_CSV_FILE = '東洋臨床論.csv';

const CSV_PATH = encodeURI(CSV_FILE);
const CLINICAL_CSV_PATH = encodeURI(CLINICAL_CSV_FILE);

const MIN_QUERY_LENGTH = 1;
const EXPECTED_TOTAL = 361;

/* ==== 外部辞書 ==== */
const READINGS   = window.ACU_READINGS   || {};
const MUSCLE_MAP = window.ACU_MUSCLE_MAP || {};

/* ==== 状態 ==== */
let ACUPOINTS = [];
let DATA_READY = false;

let CLINICAL_DATA = { order: [], cats: {} };
let CLINICAL_READY = false;

/* ==== DOM ==== */
const inputEl = document.getElementById('acupoint-search-input');
const suggestionListEl = document.getElementById('acupoint-suggestion-list');
const searchBtn = document.getElementById('search-btn');
const statusEl = document.getElementById('data-load-status');

const inlineAcupointResult = document.getElementById('inline-acupoint-result');
const resultNameEl      = document.getElementById('result-name');
const resultMeridianEl  = document.getElementById('result-meridian');
const resultRegionEl    = document.getElementById('result-region');
const resultImportantEl = document.getElementById('result-important');
const resultMuscleEl    = document.getElementById('result-muscle');
const relatedSymptomsEl = document.getElementById('related-symptoms');

const categorySelect = document.getElementById('clinical-category-select');
const patternSelect  = document.getElementById('clinical-pattern-select');
const clinicalStatusEl = document.getElementById('clinical-load-status');
const clinicalResultEl = document.getElementById('clinical-treatment-result');
const clinicalTitleEl  = document.getElementById('clinical-selected-title');
const clinicalGroupsEl = document.getElementById('clinical-treatment-groups');

/* ==== ユーティリティ ==== */
function normalizeNFC(s){ return s ? s.normalize('NFC') : ''; }
function removeAllUnicodeSpaces(str){
  return normalizeNFC(str||'')
    .replace(/[\u0000-\u001F\u007F]/g,'')
    .replace(/[ \u00A0\u1680\u2000-\u200B\u202F\u205F\u3000]/g,'')
    .replace(/\uFEFF/g,'');
}
function trimOuter(s){ return (s||'').trim(); }
function isHiraganaOnly(s){ return !!s && /^[\u3041-\u3096]+$/.test(s); }
function applyRedMarkup(text){
  if(!text) return '';
  return text.replace(/\[\[(.+?)\]\]/g,'<span class="bui-red">$1</span>');
}
function tokenizePoints(raw){
  return raw
    .replace(/[，、]/g,'/')
    .replace(/／/g,'/')
    .split(/[\/\s]+/)
    .map(t=>t.trim())
    .filter(t=>t.length)
    .map(t=>t.replace(/[。,.、，;；]+$/,''));
}
function ensureCommentParens(c){
  if(!c) return '';
  if(/^\s*[（(]/.test(c)) return c;
  return '(' + c + ')';
}

/* ==== 治療方針内 経穴トークン化 ==== */
function parseTreatmentPoints(raw){
  if(!raw) return [];
  return raw
    .replace(/\r?\n/g,'/')
    .replace(/[，、]/g,'/')
    .replace(/[＋+※･・]/g,'/')
    .replace(/／/g,'/')
    .replace(/\/{2,}/g,'/')
    .split('/')
    .map(t=>removeAllUnicodeSpaces(t))
    .map(t=>t.trim())
    .filter(t=>t.length)
    .map(t=>t.replace(/[。.,、，;；/]+$/,''))
    .filter(Boolean);
}
function normalizeAcuLookupName(name){
  return removeAllUnicodeSpaces(name || '').trim();
}
function findAcupointByToken(token){
  const key = normalizeAcuLookupName(token);
  if(!key) return null;
  return ACUPOINTS.find(p=>p.name === key);
}

/* ==== 経穴 CSV パース ==== */
function parseAcuCSV(text){
  const lines = text.split(/\r?\n/);
  const out = [];
  let currentMeridian = '';
  for(const raw of lines){
    if(!raw) continue;
    const line = raw.replace(/\uFEFF/g,'');
    if(!line.trim()) continue;
    const cols = line.split(',');
    const headCell = cols[0]? cols[0].trim() : '';
    if(/^\s*\d+(\.|．)?/.test(headCell)){
      currentMeridian = removeAllUnicodeSpaces(
        headCell.replace(/^\s*\d+(\.|．)?\s*/,'')
      );
      continue;
    }
    if(/経絡/.test(headCell) && /経穴/.test(cols[1]||'')) continue;
    if(cols.length < 2) continue;

    const meridian  = removeAllUnicodeSpaces(headCell) || currentMeridian;
    const pointName = removeAllUnicodeSpaces(trimOuter(cols[1]||''));
    if(!pointName) continue;

    const region    = trimOuter(cols[2]||'');
    const important = trimOuter(cols[3]||'');

    out.push({
      id: pointName,
      name: pointName,
      meridian,
      region: applyRedMarkup(region),
      important,
      reading: (READINGS[pointName] || '').trim(),
      muscle: MUSCLE_MAP[pointName] || ''
    });
  }
  return out;
}

/* ==== 臨床 CSV: 横持ち行列パーサ ==== */
function preprocessClinicalCSV(raw){
  return raw
    .replace(/"治療方針\s*\r?\n\s*\(治法\)\s*"/g,'"治療方針(治法)"')
    .replace(/\r\n/g,'\n');
}
function toRows(text){
  return text.split(/\n/).map(line=>{
    if(!line.trim()) return [];
    return line.split(',').map(c=>c.replace(/^"+|"+$/g,'').trim());
  });
}
function isCategoryCell(cell){
  if(!cell) return false;
  const c = removeAllUnicodeSpaces(cell);
  return /^[0-9０-９][0-9０-９-]*\./.test(c);
}
function isPatternHeaderCell(cell){
  if(!cell) return false;
  const t = cell.replace(/\s+/g,'');
  return /病証名/.test(t);
}
function isTreatmentHeaderRowFirstCell(cell){
  if(!cell) return false;
  return /治療方針/.test(cell);
}
function isLikelyCommentCell(cell){
  if(!cell) return false;
  return /^[（(]/.test(cell.trim());
}
function splitLabelAndPoints(cell){
  if(!cell) return {label:'', rawPoints:''};
  const idx = cell.indexOf('：');
  const idx2 = cell.indexOf(':');
  let use = -1;
  if(idx >=0 && idx2 >=0) use = Math.min(idx, idx2);
  else use = idx >=0 ? idx : idx2;
  if(use<0){
    return {label: cell.trim(), rawPoints:''};
  }
  return {
    label: cell.slice(0,use).trim(),
    rawPoints: cell.slice(use+1).trim()
  };
}

function parseClinicalCSV(rawText){
  const text = preprocessClinicalCSV(rawText);
  const rows = toRows(text)
    .map(cols => cols.map(c => c.replace(/\uFEFF/g,'').replace(/\u00A0/g,' ').trim()));

  const data = { order: [], cats: {} };
  let i=0;

  while(i < rows.length){
    const row = rows[i];
    if(!row.length){ i++; continue; }

    if(isCategoryCell(row[0])){
      const category = removeAllUnicodeSpaces(row[0]);
      if(!data.cats[category]){
        data.cats[category] = { patternOrder: [], patterns: {} };
        data.order.push(category);
      }

      let patternRow = rows[i+1] || [];
      if(!patternRow.length || !isPatternHeaderCell(patternRow[0])){
        i++;
        continue;
      }
      const patternNames = [];
      for(let c=1;c<patternRow.length;c++){
        const name = trimOuter(patternRow[c]);
        if(name){
          patternNames.push({ index:c, name });
          if(!data.cats[category].patterns[name]){
            data.cats[category].patterns[name] = [];
            data.cats[category].patternOrder.push(name);
          }
        }
      }
      i += 2;

      while(i < rows.length){
        const r = rows[i];
        if(!r.length){ i++; continue; }
        if(isCategoryCell(r[0])) break;
        if(!isTreatmentHeaderRowFirstCell(r[0])){
          i++;
          continue;
        }

        const groupRow = r;
        const interleaved = groupRow.slice(1).some(c=>isLikelyCommentCell(c));

        if(interleaved){
          // 横インターリーブ： [治療, (コメ), 治療, (コメ), ...]
            const after = groupRow.slice(1);
          let ptr = 0;
          for(let p=0; p<patternNames.length; p++){
            // スキップ空
            while(ptr<after.length && !after[ptr]) ptr++;
            if(ptr>=after.length) break;
            const treatCell = after[ptr];
            if(!treatCell){
              ptr++;
              continue;
            }
            ptr++;
            let commentCell = '';
            if(ptr<after.length && isLikelyCommentCell(after[ptr])){
              commentCell = after[ptr];
              ptr++;
            }
            if(!treatCell || isLikelyCommentCell(treatCell)) continue;
            const {label, rawPoints} = splitLabelAndPoints(treatCell);
            if(!label && !rawPoints) continue;
            data.cats[category].patterns[patternNames[p].name].push({
              label,
              rawPoints,
              comment: commentCell
            });
          }
          i++; // コメント行は存在しない（同一行内）
          continue;
        }

        // 従来形式: 次行がコメント行
        const next = rows[i+1] || [];
        let commentRow = null;
        const nextFirst = next[0]||'';
        const nextLooksCategory = isCategoryCell(nextFirst);
        if(!nextLooksCategory &&
           !isTreatmentHeaderRowFirstCell(nextFirst) &&
           (next.slice(1).some(c=>isLikelyCommentCell(c)) || isLikelyCommentCell(next[1]||''))){
          commentRow = next;
        }

        for(const pInfo of patternNames){
          const cell = groupRow[pInfo.index] || '';
          if(!cell) continue;
          const {label, rawPoints} = splitLabelAndPoints(cell);
          if(!label && !rawPoints) continue;
          let comment = '';
          if(commentRow){
            const cc = commentRow[pInfo.index] || '';
            if(isLikelyCommentCell(cc)) comment = cc;
          }
          data.cats[category].patterns[pInfo.name].push({
            label,
            rawPoints,
            comment
          });
        }
        i += commentRow ? 2 : 1;
      }
      continue;
    }
    i++;
  }

  console.log('[ClinicalParser] Categories:', data.order);
  if(data.order.length){
    console.log('[ClinicalParser] First category patterns:', data.cats[data.order[0]].patternOrder);
  }
  return data;
}

/* ==== 検索 ==== */
function filterPoints(qInput){
  const q = removeAllUnicodeSpaces(qInput);
  if(q.length < MIN_QUERY_LENGTH) return [];
  if(isHiraganaOnly(q)){
    let list = ACUPOINTS.filter(p => p.reading && p.reading.startsWith(q));
    if(!list.length) list = ACUPOINTS.filter(p => p.reading && p.reading.includes(q));
    return list.map(p=>({...p,_matchType:'name'}));
  }
  const nameMatches = [];
  const seen = new Set();
  for(const p of ACUPOINTS){
    if(p.name.includes(q)){
      nameMatches.push({...p,_matchType:'name'});
      seen.add(p.id);
    }
  }
  const muscleMatches = [];
  for(const p of ACUPOINTS){
    if(!p.muscle) continue;
    if(seen.has(p.id)) continue;
    if(p.muscle.includes(q)){
      muscleMatches.push({...p,_matchType:'muscle'});
    }
  }
  return nameMatches.concat(muscleMatches);
}

/* ==== サジェスト ==== */
function clearSuggestions(){
  suggestionListEl.innerHTML = '';
  suggestionListEl.classList.add('hidden');
  inputEl.setAttribute('aria-expanded','false');
}
function renderSuggestions(list){
  suggestionListEl.innerHTML = '';
  list.slice(0,120).forEach((p,i)=>{
    const li = document.createElement('li');
    li.dataset.id = p.id;
    if(p._matchType) li.dataset.matchType = p._matchType;
    const badge = p._matchType === 'muscle'
      ? '<span class="match-badge" title="筋肉名でヒット">M</span>' : '';
    li.innerHTML = `<span>${p.name}</span><span class="kana">${p.reading||''}</span>${badge}`;
    if(i===0) li.classList.add('active');
    li.addEventListener('click', ()=> selectPoint(p));
    suggestionListEl.appendChild(li);
  });
  if(!list.length){
    const li = document.createElement('li');
    li.textContent = '該当なし';
    li.style.color = '#888';
    suggestionListEl.appendChild(li);
  }
  suggestionListEl.classList.remove('hidden');
  inputEl.setAttribute('aria-expanded','true');
}
function setActive(items, idx){
  items.forEach(li=>li.classList.remove('active'));
  if(items[idx]){
    items[idx].classList.add('active');
    items[idx].scrollIntoView({block:'nearest'});
  }
}
function handleSuggestionKeyboard(e){
  const items = Array.from(suggestionListEl.querySelectorAll('li'));
  if(!items.length) return;
  let current = items.findIndex(li=>li.classList.contains('active'));
  if(e.key==='ArrowDown'){
    e.preventDefault(); current = (current+1)%items.length; setActive(items,current);
  } else if(e.key==='ArrowUp'){
    e.preventDefault(); current = (current-1+items.length)%items.length; setActive(items,current);
  } else if(e.key==='Enter'){
    e.preventDefault();
    const act = items[current>=0?current:0];
    if(act && act.dataset.id){
      const p = ACUPOINTS.find(x=>x.id===act.dataset.id);
      if(p) selectPoint(p);
    }
  } else if(e.key==='Escape'){
    clearSuggestions();
  }
}

/* ==== 経穴詳細 ==== */
function showPointDetail(p){
  resultNameEl.textContent      = `${p.name}${p.reading?` (${p.reading})`:''}`;
  resultMeridianEl.textContent  = p.meridian || '（経絡未登録）';
  resultRegionEl.innerHTML      = p.region || '（部位未登録）';
  resultImportantEl.textContent = p.important || '（要穴未登録）';
  resultMuscleEl.textContent    = p.muscle || '（筋肉未登録）';
  relatedSymptomsEl.innerHTML   = '<li>（関連症状未登録）</li>';
  inlineAcupointResult.classList.remove('hidden');
  inlineAcupointResult.scrollIntoView({behavior:'smooth',block:'start'});
}
function showUnknownPoint(name){
  resultNameEl.textContent      = `${name}（未登録）`;
  resultMeridianEl.textContent  = '（経絡未登録）';
  resultRegionEl.innerHTML      = '（部位未登録）';
  resultImportantEl.textContent = '（要穴未登録）';
  resultMuscleEl.textContent    = '（筋肉未登録）';
  relatedSymptomsEl.innerHTML   = '<li>（関連症状未登録）</li>';
  inlineAcupointResult.classList.remove('hidden');
  inlineAcupointResult.scrollIntoView({behavior:'smooth',block:'start'});
}
function selectPoint(p){
  clearSuggestions();
  inputEl.value = p.name;
  showPointDetail(p);
}

/* ==== 臨床 UI ==== */
categorySelect.addEventListener('change', ()=>{
  const cat = categorySelect.value;
  patternSelect.innerHTML = '<option value="">-- 病証を選択 --</option>';
  patternSelect.disabled = true;
  clinicalResultEl.classList.add('hidden');
  clinicalGroupsEl.innerHTML = '';
  if(!cat || !CLINICAL_DATA.cats[cat]) return;
  CLINICAL_DATA.cats[cat].patternOrder.forEach(pat=>{
    const opt = document.createElement('option');
    opt.value = pat;
    opt.textContent = pat;
    patternSelect.appendChild(opt);
  });
  patternSelect.disabled = false;
});

patternSelect.addEventListener('change', ()=>{
  const cat = categorySelect.value;
  const pat = patternSelect.value;
  clinicalResultEl.classList.add('hidden');
  clinicalGroupsEl.innerHTML = '';
  if(!cat || !pat || !CLINICAL_DATA.cats[cat] || !CLINICAL_DATA.cats[cat].patterns[pat]) return;
  const groups = CLINICAL_DATA.cats[cat].patterns[pat];
  clinicalTitleEl.textContent = `治療方針(治法)：${pat}`;

  groups.forEach(g=>{
    const div = document.createElement('div');
    div.className = 'treat-line';
    const tokens = parseTreatmentPoints(g.rawPoints);
    const pointsHtml = tokens.map(token=>{
      const acu = findAcupointByToken(token);
      if(acu){
        const importantClass = acu.important ? ' acu-important' : '';
        return `<a href="#" class="treat-point-link${importantClass}" data-point="${acu.name}">${acu.name}</a>`;
      }
      return `<a href="#" class="treat-point-link treat-point-unknown" data-point="${token}" data-unknown="1">${token}</a>`;
    }).join('/') + (tokens.length? '/' : '');

    const comment = g.comment ? ensureCommentParens(g.comment) : '';
    div.innerHTML = `
      <p class="treat-main">${g.label}：${pointsHtml}</p>
      ${comment ? `<p class="treat-comment">${comment}</p>` : ''}
    `;
    clinicalGroupsEl.appendChild(div);
  });

  clinicalResultEl.classList.remove('hidden');
  clinicalResultEl.scrollIntoView({behavior:'smooth',block:'start'});

  clinicalGroupsEl.querySelectorAll('.treat-point-link').forEach(a=>{
    a.addEventListener('click', e=>{
      e.preventDefault();
      const name = a.dataset.point;
      const p = findAcupointByToken(name);
      if(p){
        showPointDetail(p);
      } else {
        showUnknownPoint(name);
      }
    });
  });
});

/* ==== 検索トリガ ==== */
function runSearch(){
  if(!DATA_READY) return;
  const q = removeAllUnicodeSpaces(inputEl.value);
  if(!q){ clearSuggestions(); return; }
  const exact = ACUPOINTS.find(p=>p.name===q);
  if(exact){ selectPoint(exact); return; }
  const list = filterPoints(q);
  if(list.length===1){
    selectPoint(list[0]);
  } else {
    renderSuggestions(list);
  }
}

/* ==== 入力イベント ==== */
inputEl.addEventListener('keyup',e=>{
  if(['ArrowDown','ArrowUp','Enter','Escape'].includes(e.key)){
    handleSuggestionKeyboard(e);
    return;
  }
  if(!DATA_READY) return;
  const val = inputEl.value;
  if(removeAllUnicodeSpaces(val).length < MIN_QUERY_LENGTH){
    clearSuggestions();
    return;
  }
  renderSuggestions(filterPoints(val));
});
inputEl.addEventListener('keydown',e=>{
  if(e.key==='Enter'){
    e.preventDefault();
    runSearch();
  } else if(['ArrowDown','ArrowUp','Escape'].includes(e.key)){
    handleSuggestionKeyboard(e);
  }
});
searchBtn.addEventListener('click', runSearch);

/* ==== 外側クリック ==== */
document.addEventListener('click',e=>{
  if(!e.target.closest('.suggestion-wrapper') &&
     !e.target.closest('#acupoint-search-input')){
    clearSuggestions();
  }
});

/* ==== 経穴 CSV 読込 ==== */
async function loadAcuCSV(){
  try{
    statusEl.textContent = 'CSV 読み込み中...';
    const res = await fetch(`${CSV_PATH}?v=${APP_VERSION}&_=${Date.now()}`);
    if(!res.ok) throw new Error('HTTP '+res.status);
    const text = await res.text();
    let parsed = parseAcuCSV(text);
    const nameCount = {};
    parsed = parsed.map(p=>{
      nameCount[p.name] = (nameCount[p.name]||0)+1;
      return {...p, id: nameCount[p.name]>1 ? `${p.name}__${nameCount[p.name]}`:p.name};
    });
    ACUPOINTS = parsed;
    DATA_READY = true;

    const total = ACUPOINTS.length;
    const okMark = total === EXPECTED_TOTAL ? '（正常）' : `（想定:${EXPECTED_TOTAL}）`;
    const missingRead   = ACUPOINTS.filter(p=>!p.reading).length;
    const missingMuscle = ACUPOINTS.filter(p=>!p.muscle).length;
    statusEl.textContent =
      `CSV 読み込み完了: ${total}件 ${okMark}` +
      `${missingRead?` / 読み欠:${missingRead}`:''}` +
      `${missingMuscle?` / 筋肉未:${missingMuscle}`:''}`;
  }catch(err){
    console.error(err);
    statusEl.textContent = 'CSV 読み込み失敗: '+err.message;
  }
}

/* ==== 臨床 CSV 読込 ==== */
async function loadClinicalCSV(){
  try{
    clinicalStatusEl.textContent = '臨床CSV 読み込み中...';
    const res = await fetch(`${CLINICAL_CSV_PATH}?v=${APP_VERSION}&_=${Date.now()}`);
    if(!res.ok) throw new Error('HTTP '+res.status);
    const text = await res.text();
    CLINICAL_DATA = parseClinicalCSV(text);
    CLINICAL_READY = true;

    categorySelect.innerHTML = '<option value="">-- カテゴリを選択 --</option>';
    CLINICAL_DATA.order.forEach(cat=>{
      const opt = document.createElement('option');
      opt.value = cat;
      opt.textContent = cat;
      categorySelect.appendChild(opt);
    });

    clinicalStatusEl.textContent =
      `臨床CSV 読み込み完了: カテゴリ ${CLINICAL_DATA.order.length}件`;
    console.log('[ClinicalParser] 完了', CLINICAL_DATA);
  }catch(err){
    console.error(err);
    clinicalStatusEl.textContent = '臨床CSV 読み込み失敗: '+err.message;
  }
}

/* ==== 初期化 ==== */
(function init(){
  loadAcuCSV();
  loadClinicalCSV();
  injectDynamicCSS();
})();

/* ==== 動的CSS ==== */
function injectDynamicCSS(){
  const css = `
  #acupoint-suggestion-list li .match-badge{
    display:inline-block;
    margin-left:6px;
    padding:2px 4px 3px;
    font-size:.55rem;
    font-weight:600;
    line-height:1;
    background:#6f42c1;
    color:#fff;
    border-radius:4px;
    letter-spacing:.05em;
  }
  #acupoint-suggestion-list li.active .match-badge{
    background:#fff;
    color:#6f42c1;
  }
  .clinical-result{
    margin-top:2rem;
    padding:1rem;
    border:1px solid #ccc;
    border-radius:8px;
    background:#fafafa;
  }
  .clinical-result h2{
    margin-top:0;
    font-size:1.15rem;
  }
  .treat-line{
    margin-bottom:.9rem;
  }
  .treat-main{
    margin:.2rem 0 .1rem;
    font-weight:600;
    line-height:1.5;
    white-space:normal;
  }
  .treat-main a{
    color:#004c99;
    text-decoration:none;
    border-bottom:1px dotted #004c99;
    padding:0 2px;
  }
  .treat-main a:hover{
    color:#c03;
    border-bottom-color:#c03;
  }
  .treat-main a.acu-important{
    color:#c40000;
    border-bottom-color:#c40000;
    font-weight:700;
  }
  .treat-main a.acu-important:hover{
    color:#ff2a2a;
    border-bottom-color:#ff2a2a;
  }
  .treat-point-unknown{
    color:#555;
    border-bottom-color:#999;
  }
  .treat-point-unknown:hover{
    color:#222;
    border-bottom-color:#666;
  }
  .treat-comment{
    margin:0 0 .4rem;
    font-size:.85rem;
    color:#555;
  }
  .treat-point-miss{
    color:#888;
  }
  .clinical-select-group{
    margin-bottom:.75rem;
  }
  .clinical-select-group label{
    display:block;
    font-weight:600;
    margin-bottom:.25rem;
  }`;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);
}
