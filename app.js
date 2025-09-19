/******************************************************
 * 経穴検索 + 臨床病証二段選択 拡張版 (治療方針表示形式調整)
 * - APP_VERSION 20250918-16
 * - 治療方針(治法)の表示を「ラベル：経穴/…/」+ 次行コメント(括弧)形式へ変更
 ******************************************************/

const APP_VERSION = '20250918-16';
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

/*
 CLINICAL_DATA 構造:
 {
   order: [cat1, cat2, ...],
   cats: {
     "1.眼精疲労": {
       patternOrder: ["【肝血虚】→眼精疲労", ...],
       patterns: {
         "【肝血虚】→眼精疲労": [
           { label:"疏通経絡", points:[...], comment:"..." },
           ...
         ]
       }
     }
   }
 }
*/
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
  if(/^\s*[（(]/.test(c)) return c; // 既に括弧あり
  return '(' + c + ')';
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

/* ==== 臨床 CSV ==== */
function detectDelimiter(sampleText){
  let commaCount=0, tabCount=0;
  sampleText.split(/\r?\n/).slice(0,10).forEach(l=>{
    if(l.includes('\t')) tabCount++;
    if(l.includes(',')) commaCount++;
  });
  return tabCount>commaCount ? '\t' : ',';
}
function splitCSVLine(line, delimiter){
  if(delimiter === '\t') return line.split('\t');
  return line.split(delimiter);
}
function parseClinicalCSV(text){
  const delimiter = detectDelimiter(text);
  const lines = text.split(/\r?\n/);
  const data = { order: [], cats: {} };
  let headerSeen = false;

  for(const rawLine of lines){
    if(!rawLine) continue;
    let raw = rawLine.replace(/\uFEFF/g,'').trim();
    if(!raw) continue;

    raw = raw.replace(/^"+|"+$/g,'');
    const cols = splitCSVLine(raw, delimiter).map(c=>c.replace(/^"+|"+$/g,'').trim());

    if(!headerSeen){
      const lower = cols.map(c=>c.toLowerCase());
      if(lower.some(c=>c.includes('category') || c.includes('pattern') || c.includes('grouplabel'))){
        headerSeen = true;
        continue;
      }
      // ヘッダが無い場合は headerSeen フラグだけ立てて継続
      headerSeen = true;
    }

    let categoryCombined='', pattern='', groupLabel='', pointsRaw='', comment='';

    // 形式B（番号,タイトル,...）
    if(cols.length >=6 && /^\d+$/.test(cols[0]) && cols[1] && cols[2]){
      categoryCombined = `${cols[0]}.${cols[1]}`.replace(/\s+/g,'');
      pattern    = cols[2];
      groupLabel = cols[3];
      pointsRaw  = cols[4];
      comment    = cols[5] || '';
    } else if(cols.length >=5){
      // 形式A
      categoryCombined = cols[0];
      pattern    = cols[1];
      groupLabel = cols[2];
      pointsRaw  = cols[3];
      comment    = cols[4] || '';
      // 微調整 (数字単独列 + 5列ケース)
      if(/^\d+$/.test(cols[0]) && !/\d+\./.test(cols[0]) && cols.length===5){
        categoryCombined = `${cols[0]}.${cols[1]}`.replace(/\s+/g,'');
        pattern    = cols[2];
        groupLabel = cols[3];
        pointsRaw  = cols[4];
        comment    = cols[5] || '';
      }
    } else {
      continue;
    }

    categoryCombined = trimOuter(categoryCombined);
    pattern          = trimOuter(pattern);
    groupLabel       = trimOuter(groupLabel);
    pointsRaw        = trimOuter(pointsRaw);
    comment          = trimOuter(comment);

    if(!categoryCombined || !pattern || !groupLabel || !pointsRaw) continue;

    if(!data.cats[categoryCombined]){
      data.cats[categoryCombined] = { patternOrder: [], patterns: {} };
      data.order.push(categoryCombined);
    }
    if(!data.cats[categoryCombined].patterns[pattern]){
      data.cats[categoryCombined].patterns[pattern] = [];
      data.cats[categoryCombined].patternOrder.push(pattern);
    }
    data.cats[categoryCombined].patterns[pattern].push({
      label: groupLabel,
      points: tokenizePoints(pointsRaw),
      comment
    });
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
    const pointsHtml = g.points.map(pt=>{
      const acu = ACUPOINTS.find(a=>a.name===pt);
      return acu
        ? `<a href="#" class="treat-point-link" data-point="${acu.name}">${acu.name}</a>`
        : `<span class="treat-point-miss">${pt}</span>`;
    }).join('/') + '/'; // 最後にも '/'
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
      const p = ACUPOINTS.find(x=>x.name===name);
      if(p) showPointDetail(p);
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
  }
  .treat-main a:hover{
    color:#c03;
    border-bottom-color:#c03;
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
