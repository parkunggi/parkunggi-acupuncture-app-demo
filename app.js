/******************************************************
 * 経穴検索アプリ（方式A: 辞書分離版）
 * - 辞書: readings.js (window.ACU_READINGS), muscle-map.js (window.ACU_MUSCLE_MAP)
 * - インライン結果表示
 * - 経穴名 / 読み(ひらがな) / 筋肉名 検索対応 (筋肉ヒット=Mバッジ)
 * - APP_VERSION 20250918-12
 ******************************************************/

const APP_VERSION = '20250918-12';
const CSV_FILE = '経穴・経絡.csv';
const CSV_PATH = encodeURI(CSV_FILE);
const MIN_QUERY_LENGTH = 1;
const EXPECTED_TOTAL = 361;

/* ===== 外部辞書（読み込まれている前提） ===== */
const READINGS   = window.ACU_READINGS   || {};
const MUSCLE_MAP = window.ACU_MUSCLE_MAP || {};

/* ===== 状態 & DOM ===== */
let ACUPOINTS = [];
let DATA_READY = false;

const inputEl = document.getElementById('acupoint-search-input');
const suggestionListEl = document.getElementById('acupoint-suggestion-list');
const searchBtn = document.getElementById('search-btn');
const statusEl = document.getElementById('data-load-status');
const symptomSelect = document.getElementById('symptom-select');

const inlineAcupointResult = document.getElementById('inline-acupoint-result');
const inlineSymptomResult  = document.getElementById('inline-symptom-result');

const resultNameEl      = document.getElementById('result-name');
const resultMeridianEl  = document.getElementById('result-meridian');
const resultRegionEl    = document.getElementById('result-region');
const resultImportantEl = document.getElementById('result-important');
const resultMuscleEl    = document.getElementById('result-muscle');
const relatedSymptomsEl = document.getElementById('related-symptoms');

const symptomResultTitleEl   = document.getElementById('symptom-result-title');
const symptomAcupointsListEl = document.getElementById('symptom-acupoints-list');

/* ===== 症状デモ ===== */
const SYMPTOMS = {
  symptom_demo1: { label: 'デモ症状: 頭痛',   related: ['百会','風府','霊台'] },
  symptom_demo2: { label: 'デモ症状: 首肩こり', related: ['風府','強間','肩井'] }
};

/* ===== ユーティリティ ===== */
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

/* ===== CSV パース ===== */
function parseCSV(text){
  const lines = text.split(/\r?\n/);
  const out = [];
  let currentMeridian = '';
  for(const raw of lines){
    if(!raw) continue;
    const line = raw.replace(/\uFEFF/g,'');
    if(!line.trim()) continue;
    const cols = line.split(',');
    const headCell = cols[0]? cols[0].trim() : '';

    // 見出し行（番号＋経絡名）処理
    if(/^\s*\d+(\.|．)?/.test(headCell)){
      currentMeridian = removeAllUnicodeSpaces(headCell.replace(/^\s*\d+(\.|．)?\s*/,''));
      continue;
    }
    // ヘッダ行スキップ
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

/* ===== 検索 ===== */
function filterPoints(qInput){
  const q = removeAllUnicodeSpaces(qInput);
  if(q.length < MIN_QUERY_LENGTH) return [];
  if(isHiraganaOnly(q)){
    let list = ACUPOINTS.filter(p => p.reading && p.reading.startsWith(q));
    if(!list.length){
      list = ACUPOINTS.filter(p => p.reading && p.reading.includes(q));
    }
    return list.map(p => ({...p,_matchType:'name'}));
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

/* ===== サジェスト ===== */
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

/* ===== 詳細表示 ===== */
function showPointDetail(p){
  inlineSymptomResult.classList.add('hidden');
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

/* ===== 症状 ===== */
symptomSelect.addEventListener('change',()=>{
  if(!symptomSelect.value) return;
  renderSymptom(symptomSelect.value);
});
function renderSymptom(id){
  const sym = SYMPTOMS[id];
  if(!sym) return;
  inlineAcupointResult.classList.add('hidden');
  symptomResultTitleEl.textContent = sym.label;
  symptomAcupointsListEl.innerHTML = '';
  if(!sym.related.length){
    symptomAcupointsListEl.innerHTML = '<li>関連経穴なし</li>';
  } else {
    sym.related.forEach(name=>{
      const p = ACUPOINTS.find(pt=>pt.name===name);
      if(!p) return;
      const li = document.createElement('li');
      const a  = document.createElement('a');
      a.href='#';
      a.textContent = `${p.name}${p.reading?` (${p.reading})`:''}`;
      a.addEventListener('click',e=>{
        e.preventDefault();
        showPointDetail(p);
      });
      li.appendChild(a);
      symptomAcupointsListEl.appendChild(li);
    });
  }
  inlineSymptomResult.classList.remove('hidden');
  inlineSymptomResult.scrollIntoView({behavior:'smooth',block:'start'});
}

/* ===== 検索トリガ ===== */
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

/* ===== 入力イベント ===== */
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

/* ===== 外側クリック ===== */
document.addEventListener('click',e=>{
  if(!e.target.closest('.suggestion-wrapper') &&
     !e.target.closest('#acupoint-search-input')){
    clearSuggestions();
  }
});

/* ===== CSV 読込 ===== */
async function loadCSV(){
  try{
    statusEl.textContent = 'CSV 読み込み中...';
    const res = await fetch(`${CSV_PATH}?v=${APP_VERSION}&_=${Date.now()}`);
    if(!res.ok) throw new Error('HTTP ' + res.status);
    const text = await res.text();
    let parsed = parseCSV(text);
    // 同名重複対策
    const nameCount = {};
    parsed = parsed.map(p=>{
      nameCount[p.name] = (nameCount[p.name]||0)+1;
      return {...p, id: nameCount[p.name]>1 ? `${p.name}__${nameCount[p.name]}` : p.name};
    });
    ACUPOINTS = parsed;
    DATA_READY = true;

    const byMeridian = {};
    for(const p of ACUPOINTS){
      byMeridian[p.meridian] = (byMeridian[p.meridian]||0)+1;
    }
    const total = ACUPOINTS.length;
    const okMark = total === EXPECTED_TOTAL ? '（正常）' : `（想定:${EXPECTED_TOTAL}）`;
    const missingRead   = ACUPOINTS.filter(p=>!p.reading).length;
    const missingMuscle = ACUPOINTS.filter(p=>!p.muscle).length;
    statusEl.textContent =
      `CSV 読み込み完了: ${total}件 ${okMark}` +
      `${missingRead?` / 読み欠:${missingRead}`:''}` +
      `${missingMuscle?` / 筋肉未:${missingMuscle}`:''}`;
    statusEl.title = Object.entries(byMeridian).map(([m,c])=>`${m}:${c}`).join(' / ');

    window._debugAcu = () => ({
      total,
      byMeridian,
      missingReadings: ACUPOINTS.filter(p=>!p.reading).map(p=>p.name),
      missingMuscles: ACUPOINTS.filter(p=>!p.muscle).map(p=>p.name),
      sample: ACUPOINTS.slice(0,8).map(p=>[p.name,p.reading,p.muscle])
    });
    console.log('[ACUPOINTS]', window._debugAcu());
  }catch(err){
    console.error(err);
    statusEl.textContent = 'CSV 読み込み失敗: ' + err.message;
  }
}

/* ===== 初期化 ===== */
(function init(){
  loadCSV();
  injectBadgeCSS();
})();

/* ===== バッジCSS ===== */
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
  }`;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);
}
