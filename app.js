/******************************************************
 * 経穴検索アプリ + 臨床病証二段選択
 * - 経穴検索: 経穴名 / 読み(ひらがな) / 筋肉名（漢字, Mバッジ）
 * - 臨床: 東洋臨床論.csv (Category,Pattern,GroupLabel,Points,Comment)
 * - 選択: ①カテゴリ → ②病証 → 治療方針(治法)表示
 * - 治療方針内の経穴クリックで下部経穴詳細更新
 * - 辞書 (READINGS / MUSCLE_MAP) は readings.js / muscle-map.js からグローバル取得
 * - APP_VERSION 20250918-14
 ******************************************************/

const APP_VERSION = '20250918-14';
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

let CLINICAL_DATA = {}; // { category: { patterns: { pattern: [ {label, points[], comment} ] } } }
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
    .split(/[\/／\s]+/)
    .map(t=>t.trim())
    .filter(t=>t.length)
    .map(t=>t.replace(/[。,.]+$/,''));
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

/* ==== 臨床 CSV パース (Category,Pattern,GroupLabel,Points,Comment) ==== */
function parseClinicalCSV(text){
  const lines = text.split(/\r?\n/);
  const data = {};
  let headerParsed = false;
  for(const raw of lines){
    if(!raw) continue;
    const line = raw.replace(/\uFEFF/g,'').trim();
    if(!line) continue;
    const cols = line.split(',');
    if(!headerParsed){
      headerParsed = true;
      if(/category/i.test(cols[0])) continue; // ヘッダ行スキップ
    }
    if(cols.length < 5) continue;

    const category = trimOuter(cols[0]);
    const pattern  = trimOuter(cols[1]);
    const groupLbl = trimOuter(cols[2]);
    const pointsRaw= trimOuter(cols[3]);
    const comment  = trimOuter(cols[4]);

    if(!category || !pattern || !groupLbl || !pointsRaw) continue;

    if(!data[category]) data[category] = { patterns:{} };
    if(!data[category].patterns[pattern]) data[category].patterns[pattern] = [];
    data[category].patterns[pattern].push({
      label: groupLbl,
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

/* ==== 経穴詳細表示 ==== */
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

/* ==== 臨床 UI: カテゴリ選択 ==== */
categorySelect.addEventListener('change', ()=>{
  const cat = categorySelect.value;
  patternSelect.innerHTML = '<option value="">-- 病証を選択 --</option>';
  patternSelect.disabled = true;
  clinicalResultEl.classList.add('hidden');
  clinicalGroupsEl.innerHTML = '';
  if(!cat || !CLINICAL_DATA[cat]) return;
  Object.keys(CLINICAL_DATA[cat].patterns).forEach(pat=>{
    const opt = document.createElement('option');
    opt.value = pat;
    opt.textContent = pat;
    patternSelect.appendChild(opt);
  });
  patternSelect.disabled = false;
});

/* ==== 臨床 UI: 病証選択 ==== */
patternSelect.addEventListener('change', ()=>{
  const cat = categorySelect.value;
  const pat = patternSelect.value;
  clinicalResultEl.classList.add('hidden');
  clinicalGroupsEl.innerHTML = '';
  if(!cat || !pat || !CLINICAL_DATA[cat] || !CLINICAL_DATA[cat].patterns[pat]) return;
  const groups = CLINICAL_DATA[cat].patterns[pat];
  clinicalTitleEl.textContent = `治療方針(治法)：${pat}`;
  groups.forEach(g=>{
    const wrap = document.createElement('div');
    wrap.className = 'treat-group';
    const pointsHtml = g.points.map(pt=>{
      const acu = ACUPOINTS.find(a=>a.name===pt);
      return acu
        ? `<a href="#" class="treat-point-link" data-point="${acu.name}">${acu.name}</a>`
        : `<span class="treat-point-miss">${pt}</span>`;
    }).join(' / ');
    wrap.innerHTML = `
      <h3 class="treat-label">${g.label}</h3>
      <p class="treat-points">${pointsHtml}</p>
      ${g.comment ? `<p class="treat-comment">${g.comment}</p>` : '' }
    `;
    clinicalGroupsEl.appendChild(wrap);
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
      return {...p, id: nameCount[p.name]>1 ? `${p.name}__${nameCount[p.name]}` : p.name};
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

    window._debugAcu = () => ({
      total,
      missingReadings: ACUPOINTS.filter(p=>!p.reading).map(p=>p.name),
      missingMuscles: ACUPOINTS.filter(p=>!p.muscle).map(p=>p.name),
      sample: ACUPOINTS.slice(0,5).map(p=>[p.name,p.reading,p.muscle])
    });
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
    Object.keys(CLINICAL_DATA).forEach(cat=>{
      const opt = document.createElement('option');
      opt.value = cat;
      opt.textContent = cat;
      categorySelect.appendChild(opt);
    });
    clinicalStatusEl.textContent = `臨床CSV 読み込み完了: カテゴリ ${Object.keys(CLINICAL_DATA).length}件`;

    window._debugClinical = () => ({
      categories: Object.keys(CLINICAL_DATA),
      firstCategory: Object.keys(CLINICAL_DATA)[0],
      firstPatterns: Object.keys(CLINICAL_DATA[Object.keys(CLINICAL_DATA)[0]].patterns)
    });
  }catch(err){
    console.error(err);
    clinicalStatusEl.textContent = '臨床CSV 読み込み失敗: '+err.message;
  }
}

/* ==== 初期化 ==== */
(function init(){
  loadAcuCSV();
  loadClinicalCSV();
  injectBadgeCSS();
})();

/* ==== バッジ & 臨床用CSS 注入 ==== */
function injectBadgeCSS(){
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
  .clinical-result h2{margin-top:0;font-size:1.15rem;}
  .treat-group{
    margin-bottom:1.1rem;
    padding-bottom:.8rem;
    border-bottom:1px dashed #ddd;
  }
  .treat-group:last-child{border-bottom:none;}
  .treat-label{margin:.2rem 0 .3rem;font-size:1rem;color:#333;}
  .treat-points{margin:.2rem 0;font-weight:500;line-height:1.5;}
  .treat-points a{
    color:#004c99;
    text-decoration:none;
    border-bottom:1px dotted #004c99;
  }
  .treat-points a:hover{
    color:#c03;
    border-bottom-color:#c03;
  }
  .treat-comment{
    margin:.25rem 0;
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
