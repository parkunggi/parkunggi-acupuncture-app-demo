/******************************************************
 * 経穴検索 + 臨床病証 (4階層: 分類/系統/症状/病証) + 履歴 + 画像 + ギャラリー
 * APP_VERSION 20250930-HIERARCHY-FIX2
 *
 * FIX2 (state machine parser):
 *  - 分類はホワイトリスト 3 件のみ
 *  - 状態マシンで 1 パス処理 (後方探索廃止)
 *  - 系統/症状誤検出による症状 1 件問題を解消
 *  - 系統不在時は system='-' 自動適用
 ******************************************************/

const APP_VERSION = '20250930-HIERARCHY-FIX2';

const CSV_FILE = '経穴・経絡.csv';
const CLINICAL_CSV_FILE = '東洋臨床論.csv';
const CSV_PATH = encodeURI(CSV_FILE);
const CLINICAL_CSV_PATH = encodeURI(CLINICAL_CSV_FILE);

const MIN_QUERY_LENGTH = 1;
const EXPECTED_TOTAL = 361;

const READINGS   = window.ACU_READINGS   || {};
const MUSCLE_MAP = window.ACU_MUSCLE_MAP || {};

/* ------------ グローバル状態 ------------ */
let ACUPOINTS = [];
let ACUPOINT_NAME_LIST = [];
let ACUPOINT_NAME_SET  = new Set();

let DATA_READY = false;
let CLINICAL_READY = false;

/*
  CLINICAL_HIERARCHY = {
    分類: {
      系統: {
        症状: {
          patterns: [...],
          groupsByPattern: {
             patternName: [ {label,rawPoints,comment,tokens}, ... ]
          }
        }
      }
    }
  }
*/
let CLINICAL_HIERARCHY = {};
let CLASSIFICATIONS_ORDER = [];
let ACUPOINT_PATTERN_INDEX = {}; // 経穴 → [{classification,system,symptom,pattern}...]

/* 履歴 */
let historyStack = [];
let historyIndex = -1;
let IS_APPLYING_HISTORY = false;
let patternHistory = [];
let pointHistory   = [];
const HISTORY_LIMIT = 300;

/* ------------ DOM ------------ */
const inputEl = document.getElementById('acupoint-search-input');
const suggestionListEl = document.getElementById('acupoint-suggestion-list');
const searchBtn = document.getElementById('search-btn');

const statusEl = document.getElementById('data-load-status');
const clinicalStatusEl = document.getElementById('clinical-load-status');

const inlineAcupointResult = document.getElementById('inline-acupoint-result');
const resultNameEl      = document.getElementById('result-name');
const resultMeridianEl  = document.getElementById('result-meridian');
const resultRegionEl    = document.getElementById('result-region');
const resultImportantEl = document.getElementById('result-important');
const resultMuscleEl    = document.getElementById('result-muscle');
const relatedSymptomsEl = document.getElementById('related-symptoms');

const classificationSelect = document.getElementById('clinical-classification-select');
const systemSelect         = document.getElementById('clinical-system-select');
const symptomSelect        = document.getElementById('clinical-symptom-select');
const patternSelect        = document.getElementById('clinical-pattern-select');

const clinicalResultEl = document.getElementById('clinical-treatment-result');
const clinicalTitleEl  = document.getElementById('clinical-selected-title');
const clinicalGroupsEl = document.getElementById('clinical-treatment-groups');

const searchCard  = document.getElementById('search-card');
const symptomCard = document.getElementById('symptom-card');
const meridianImageSection = document.getElementById('meridian-image-section');
const meridianImageEl      = document.getElementById('meridian-image');

const homeBtn    = document.getElementById('home-btn');
const backBtn    = document.getElementById('back-btn');
const forwardBtn = document.getElementById('forward-btn');

const patternHistoryBtn      = document.getElementById('pattern-history-btn');
const patternHistoryMenu     = document.getElementById('pattern-history-menu');
const patternHistoryMenuList = document.getElementById('pattern-history-menu-list');

const pointHistoryBtn      = document.getElementById('point-history-btn');
const pointHistoryMenu     = document.getElementById('point-history-menu');
const pointHistoryMenuList = document.getElementById('point-history-menu-list');

const homeGallerySection = document.getElementById('home-gallery-section');
const homeGallerySelect  = document.getElementById('home-gallery-select');
const homeGalleryImage   = document.getElementById('home-gallery-image');
const homeGalleryFallback= document.getElementById('home-gallery-fallback');

/* ------------ Home ギャラリー ------------ */
const HOME_GALLERY_IMAGES = [
  { file: '十四経経脈経穴図_1.前面.jpeg',        label: '① 前面' },
  { file: '十四経経脈経穴図_2.後面.jpeg',        label: '② 後面' },
  { file: '十四経経脈経穴図_3.後面(骨格).jpeg',  label: '③ 後面 (骨格)' },
  { file: '十四経経脈経穴図_4.側面(筋肉).jpeg',  label: '④ 側面 (筋肉)' }
];
const HOME_GALLERY_LS_KEY = 'homeGallery.lastFile';

function initHomeGallery(){
  if(!homeGallerySelect) return;
  homeGallerySelect.innerHTML = '';
  const saved = localStorage.getItem(HOME_GALLERY_LS_KEY);
  let initialIdx = 0;
  if(saved){
    const idx = HOME_GALLERY_IMAGES.findIndex(i=>i.file===saved);
    if(idx>=0) initialIdx = idx;
  }
  HOME_GALLERY_IMAGES.forEach((img,idx)=>{
    const opt=document.createElement('option');
    opt.value=img.file;
    opt.textContent=img.label;
    if(idx===initialIdx) opt.selected=true;
    homeGallerySelect.appendChild(opt);
  });
  if(HOME_GALLERY_IMAGES[initialIdx]){
    updateHomeGalleryImage(HOME_GALLERY_IMAGES[initialIdx].file,false);
  }
}
function updateHomeGalleryImage(file, store=true){
  if(!homeGalleryImage) return;
  const url='image/'+encodeURI(file)+'?v='+APP_VERSION;
  homeGalleryFallback.classList.add('hidden');
  homeGalleryImage.classList.remove('hidden');
  homeGalleryImage.alt = file.replace(/\.(jpeg|jpg|png)$/i,'');
  homeGalleryImage.onload=()=>{};
  homeGalleryImage.onerror=()=>{
    homeGalleryImage.classList.add('hidden');
    homeGalleryFallback.classList.remove('hidden');
  };
  homeGalleryImage.src = url;
  if(store){
    try{ localStorage.setItem(HOME_GALLERY_LS_KEY,file); }catch(_){}
  }
}
if(homeGallerySelect){
  homeGallerySelect.addEventListener('change', ()=>{
    const f=homeGallerySelect.value;
    if(f) updateHomeGalleryImage(f,true);
  });
}
function showHomeGallery(){ if(homeGallerySection) homeGallerySection.classList.remove('hidden'); }
function hideHomeGallery(){ if(homeGallerySection) homeGallerySection.classList.add('hidden'); }

/* ------------ Utility ------------ */
function isShown(el){ return el && !el.classList.contains('hidden'); }
function normalizeNFC(s){ return s? s.normalize('NFC'):''; }
function removeAllUnicodeSpaces(str){
  return normalizeNFC(str||'')
    .replace(/[\u0000-\u001F\u007F]/g,'')
    .replace(/[ \u00A0\u1680\u2000-\u200B\u202F\u205F\u3000]/g,'')
    .replace(/\uFEFF/g,'');
}
function trimOuter(s){ return (s||'').trim(); }
function escapeHTML(s){
  return (s||'').replace(/[&<>"']/g,ch=>{
    switch(ch){
      case '&':return'&amp;'; case '<':return'&lt;'; case '>':return'&gt;';
      case '"':return'&quot;'; case "'":return'&#39;';
    }
  });
}
// 旧 transformPatternDisplay と getDisplayPatternName をこの2つに置き換え
function transformPatternDisplay(original){
  if(!original) return '';
  const idx = original.indexOf('→');
  if(idx === -1) return original;
  const left  = original.slice(0, idx).trim();
  const right = original.slice(idx + 1).trim();
  if(/^【[^】]+】$/.test(left) && right && !/^【/.test(right)){
    return `${right}→${left}`;
  }
  return original;
}
function getDisplayPatternName(n){ 
  return transformPatternDisplay(n);
}
function ensureCommentParens(c){
  if(!c) return '';
  if(/^\s*[（(]/.test(c)) return c;
  return '('+c+')';
}
function applyRedMarkup(text){
  if(!text) return '';
  if(text.includes('<span class="bui-red">')) return text;
  return text.replace(/\[\[([^\[\]\r\n]{1,120})\]\]/g,'<span class="bui-red">$1</span>');
}

/* ------------ 履歴 ------------ */
function statesEqual(a,b){
  if(!a||!b) return false;
  if(a.type!==b.type) return false;
  if(a.type==='home') return true;
  if(a.type==='point'||a.type==='unknownPoint') return a.name===b.name;
  if(a.type==='pattern'){
    return a.classification===b.classification &&
           a.system===b.system &&
           a.symptom===b.symptom &&
           a.pattern===b.pattern;
  }
  return false;
}
function updateNavButtons(){
  backBtn.disabled = (historyIndex <= 0);
  forwardBtn.disabled = (historyIndex < 0 || historyIndex >= historyStack.length - 1);
  if(!patternHistoryMenu.classList.contains('hidden')) safeRenderPatternHistoryMenu();
  if(!pointHistoryMenu.classList.contains('hidden')) safeRenderPointHistoryMenu();
}
function updateHistoryBadge(){
  if(pointHistoryBtn){
    pointHistoryBtn.title = `経穴 履歴 - ${pointHistory.length}件`;
    pointHistoryBtn.dataset.count = pointHistory.length;
  }
  if(patternHistoryBtn){
    patternHistoryBtn.title = `治療方針 履歴 - ${patternHistory.length}件`;
    patternHistoryBtn.dataset.count = patternHistory.length;
  }
}
function pushState(state, replace=false){
  if(IS_APPLYING_HISTORY) return;
  const prevState = historyStack[historyIndex] || null;

  state.showPoint   = state.showPoint   !== undefined ? state.showPoint   : isShown(inlineAcupointResult);
  state.showPattern = state.showPattern !== undefined ? state.showPattern : isShown(clinicalResultEl);

  if(state.type==='home'){
    state.showPoint=false; state.showPattern=false;
  }else if(state.type==='point'||state.type==='unknownPoint'){
    state.showPoint=true;
  }else if(state.type==='pattern'){
    state.showPattern=true;
  }
  if(prevState){
    if(state.type==='pattern' && prevState.showPoint) state.showPoint = true;
    if((state.type==='point'||state.type==='unknownPoint') && prevState.showPattern) state.showPattern = true;
  }

  if(historyIndex>=0 && statesEqual(historyStack[historyIndex],state)){
    historyStack[historyIndex].showPoint   = state.showPoint;
    historyStack[historyIndex].showPattern = state.showPattern;
  }else{
    if(replace){
      if(historyIndex>=0) historyStack[historyIndex]=state;
      else { historyStack.push(state); historyIndex=0; }
    }else{
      if(historyIndex < historyStack.length -1){
        historyStack = historyStack.slice(0, historyIndex+1);
      }
      state.ts = Date.now();
      historyStack.push(state);
      historyIndex = historyStack.length -1;
    }
    if(state.type==='pattern'){
      patternHistory.push({ref:state, idx:historyIndex, ts:state.ts});
      if(patternHistory.length>HISTORY_LIMIT) patternHistory.shift();
    } else if(state.type==='point' || state.type==='unknownPoint'){
      pointHistory.push({ref:state, idx:historyIndex, ts:state.ts});
      if(pointHistory.length>HISTORY_LIMIT) pointHistory.shift();
    }
  }
  updateHistoryBadge();
  updateNavButtons();
}
function applyState(state){
  if(!state) return;
  IS_APPLYING_HISTORY=true;
  try{
    const showPointFlag   = !!state.showPoint;
    const showPatternFlag = !!state.showPattern;

    switch(state.type){
      case 'home':
        resetHierarchySelects(true);
        inputEl.value='';
        inlineAcupointResult.classList.add('hidden');
        hideMeridianImage();
        clinicalResultEl.classList.add('hidden');
        relatedSymptomsEl.innerHTML='<li>-</li>';
        break;
      case 'point': {
        const p=ACUPOINTS.find(x=>x.name===state.name);
        if(p) showPointDetail(p,true); else showUnknownPoint(state.name,true);
        break;
      }
      case 'unknownPoint':
        showUnknownPoint(state.name,true);
        break;
      case 'pattern':
        if(CLINICAL_READY){
          selectHierarchy(state.classification, state.system, state.symptom, state.pattern, true);
        }
        break;
    }

    if(state.type==='home') showHomeGallery(); else hideHomeGallery();

    if(showPointFlag){
      inlineAcupointResult.classList.remove('hidden');
      if(!meridianImageEl.src && resultMeridianEl.textContent && !/未登録/.test(resultMeridianEl.textContent)){
        updateMeridianImage(resultMeridianEl.textContent.trim());
      }
    }else{
      inlineAcupointResult.classList.add('hidden');
      hideMeridianImage();
    }
    if(showPatternFlag){
      clinicalResultEl.classList.remove('hidden');
    }else{
      clinicalResultEl.classList.add('hidden');
    }
  } finally {
    IS_APPLYING_HISTORY=false;
    updateNavButtons();
  }
}
function goBack(){ if(historyIndex>0){ historyIndex--; applyState(historyStack[historyIndex]); } }
function goForward(){ if(historyIndex < historyStack.length -1){ historyIndex++; applyState(historyStack[historyIndex]); } }
function formatTime(ts){
  const d=new Date(ts||Date.now());
  const pad=n=>('0'+n).slice(-2);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/* 履歴メニュー (Pattern) */
function renderPatternHistoryMenu(){
  patternHistoryMenuList.innerHTML='';
  const arr=[...patternHistory].reverse();
  if(!arr.length){
    const li=document.createElement('li'); li.textContent='履歴なし';
    patternHistoryMenuList.appendChild(li); return;
  }
  const current = historyStack[historyIndex];
  arr.forEach(entry=>{
    const st=entry.ref;
    const li=document.createElement('li');
    if(st===current) li.classList.add('active');
    const label = getDisplayPatternName(st.pattern);
    li.innerHTML=`
      <div style="display:flex;align-items:center;gap:6px;">
        <span class="hist-time">${formatTime(entry.ts)}</span>
      </div>
      <div class="hist-label">${escapeHTML(label)}</div>`;
    li.addEventListener('click', ()=>{
      patternHistoryMenu.classList.add('hidden');
      historyIndex = entry.idx;
      const clone = {...st};
      clone.showPoint   = isShown(inlineAcupointResult);
      clone.showPattern = true;
      applyState(clone);
    });
    patternHistoryMenuList.appendChild(li);
  });
}
function fallbackRenderPatternHistoryMenu(){
  patternHistoryMenuList.innerHTML = patternHistory.length
    ? patternHistory.slice().reverse().map(h=>{
        const st=h.ref||{};
        const label = getDisplayPatternName(st?.pattern||'?');
        return `<li><div style="display:flex;align-items:center;gap:6px;">
          <span class="hist-time">${formatTime(h.ts)}</span></div>
          <div class="hist-label">${escapeHTML(label)}</div></li>`;
      }).join('')
    : '<li>履歴なし</li>';
}

/* 履歴メニュー (Point) */
function renderPointHistoryMenu(){
  pointHistoryMenuList.innerHTML='';
  const arr=[...pointHistory].reverse();
  if(!arr.length){
    const li=document.createElement('li'); li.textContent='履歴なし';
    pointHistoryMenuList.appendChild(li); return;
  }
  const current=historyStack[historyIndex];
  arr.forEach(entry=>{
    const st=entry.ref;
    const li=document.createElement('li');
    if(st===current) li.classList.add('active');
    const label = (st.type==='unknownPoint') ? `未登録: ${st.name}` : `経穴: ${st.name}`;
    li.innerHTML=`
      <div style="display:flex;align-items:center;gap:6px;">
        <span class="hist-time">${formatTime(entry.ts)}</span>
      </div>
      <div class="hist-label">${escapeHTML(label)}</div>`;
    li.addEventListener('click',()=>{
      pointHistoryMenu.classList.add('hidden');
      historyIndex = entry.idx;
      const clone = {...st};
      clone.showPattern = isShown(clinicalResultEl);
      clone.showPoint   = true;
      applyState(clone);
    });
    pointHistoryMenuList.appendChild(li);
  });
}
function fallbackRenderPointHistoryMenu(){
  pointHistoryMenuList.innerHTML = pointHistory.length
    ? pointHistory.slice().reverse().map(h=>{
        const st=h.ref||{};
        const label= st && st.type==='unknownPoint' ? `未登録: ${st.name}` : `経穴: ${st?.name||'(不明)'}`;
        return `<li><div style="display:flex;align-items:center;gap:6px;">
          <span class="hist-time">${formatTime(h.ts)}</span></div>
          <div class="hist-label">${escapeHTML(label)}</div></li>`;
      }).join('')
    : '<li>履歴なし</li>';
}

/* Guard */
function guardRender(renderFn,fallbackFn,kind){
  try{
    if(typeof renderFn!=='function' || !/innerHTML/.test(renderFn.toString())){
      console.warn(`[HISTORY-GUARD] ${kind} renderer overwritten. fallback`);
      fallbackFn(); return;
    }
    renderFn();
    const listEl = kind==='point'? pointHistoryMenuList : patternHistoryMenuList;
    const arr    = kind==='point'? pointHistory : patternHistory;
    if(arr.length && !listEl.querySelector('li')){
      console.warn(`[HISTORY-GUARD] ${kind} menu empty after render. fallback rebuild.`);
      fallbackFn();
    }
  }catch(e){
    console.error(`[HISTORY-GUARD] ${kind} render error`,e);
    fallbackFn();
  }
}
function safeRenderPointHistoryMenu(){ guardRender(renderPointHistoryMenu,fallbackRenderPointHistoryMenu,'point'); }
function safeRenderPatternHistoryMenu(){ guardRender(renderPatternHistoryMenu,fallbackRenderPatternHistoryMenu,'pattern'); }

/* トグル */
if(patternHistoryBtn){
  patternHistoryBtn.addEventListener('click',()=>{
    pointHistoryMenu.classList.add('hidden');
    if(patternHistoryMenu.classList.contains('hidden')){
      safeRenderPatternHistoryMenu();
      patternHistoryMenu.classList.remove('hidden');
    }else patternHistoryMenu.classList.add('hidden');
  });
}
if(pointHistoryBtn){
  pointHistoryBtn.addEventListener('click',()=>{
    patternHistoryMenu.classList.add('hidden');
    if(pointHistoryMenu.classList.contains('hidden')){
      safeRenderPointHistoryMenu();
      pointHistoryMenu.classList.remove('hidden');
    }else pointHistoryMenu.classList.add('hidden');
  });
}
document.addEventListener('click',e=>{
  if(!patternHistoryMenu.classList.contains('hidden') &&
     !e.target.closest('#pattern-history-btn-wrapper')){
    patternHistoryMenu.classList.add('hidden');
  }
  if(!pointHistoryMenu.classList.contains('hidden') &&
     !e.target.closest('#point-history-btn-wrapper')){
    pointHistoryMenu.classList.add('hidden');
  }
});
window.addEventListener('keydown',e=>{
  if(e.key==='Escape'){
    patternHistoryMenu.classList.add('hidden');
    pointHistoryMenu.classList.add('hidden');
  }
});

/* ------------ 経穴 CSV 解析 ------------ */
function parseAcuCSV(raw){
  if(!raw) return [];
  const text=raw.replace(/\r\n/g,'\n').replace(/\uFEFF/g,'');
  const lines=text.split('\n').filter(l=>l.trim().length>0);

  function splitLine(line){
    if(!line.includes('"')) return line.split(',').map(c=>c.trim());
    const out=[]; let cur=''; let inQ=false;
    for(let i=0;i<line.length;i++){
      const ch=line[i];
      if(ch==='"'){
        if(inQ && line[i+1]==='"'){ cur+='"'; i++; }
        else inQ=!inQ;
        continue;
      }
      if(ch===',' && !inQ){
        out.push(cur); cur='';
      } else cur+=ch;
    }
    out.push(cur);
    return out.map(c=>c.trim());
  }

  const results=[];
  for(const rawLine of lines){
    if(/^[0-9０-９]+\./.test(rawLine.trim())) continue;
    const cols=splitLine(rawLine);
    if(!cols.length) continue;
    if(cols[0]==='経絡' && cols[1]==='経穴') continue;
    if(cols.length<2) continue;
    const meridian=trimOuter(cols[0]);
    const name    =trimOuter(cols[1]);
    if(!meridian||!name) continue;
    const region   = cols[2]? cols[2].trim():'';
    const important= cols[3]? cols[3].trim():'';
    results.push({
      name,
      reading: READINGS[name]||'',
      meridian,
      region,
      regionRaw: region,
      important,
      muscle: MUSCLE_MAP[name]||''
    });
  }
  return results;
}

/* ------------ 治療方針トークン解析 ------------ */
function parseTreatmentPoints(raw){
  if(!raw) return [];
  const stripped=raw
    .replace(/（[^）]*）/g,'')
    .replace(/\([^)]*\)/g,'');
  return stripped
    .replace(/\r?\n/g,'/')
    .replace(/[，、]/g,'/')
    .replace(/[＋+･・]/g,'/')
    .replace(/／/g,'/')
    .replace(/\/{2,}/g,'/')
    .split('/')
    .map(t=>removeAllUnicodeSpaces(t))
    .map(t=>t.trim())
    .filter(t=>t.length)
    .map(t=>t.replace(/[。.,、，;；/]+$/,''))
    .filter(Boolean)
    .filter(t=>!/^[-・※＊*+/／\/]+$/.test(t));
}
function normalizeAcuLookupName(name){
  return removeAllUnicodeSpaces(name||'').trim();
}
function findAcupointByToken(token){
  const key=normalizeAcuLookupName(token);
  if(!key) return null;
  return ACUPOINTS.find(p=>p.name===key);
}
function buildNameLookup(){
  ACUPOINT_NAME_LIST=ACUPOINTS.map(p=>p.name).sort((a,b)=> b.length - a.length);
  ACUPOINT_NAME_SET=new Set(ACUPOINT_NAME_LIST);
}

/* ------------ CSV パース補助 ------------ */
function rebuildLogicalRows(raw){
  const physical=raw.replace(/\r\n/g,'\n').split('\n');
  const rows=[]; let buf=''; let quotes=0;
  for(const line of physical){
    if(buf) buf+='\n'+line; else buf=line;
    quotes=(buf.match(/"/g)||[]).length;
    if(quotes%2===0){ rows.push(buf); buf=''; quotes=0; }
  }
  if(buf) rows.push(buf);
  return rows;
}
function parseCSVLogicalRow(row){
  const cols=[]; let cur=''; let inQ=false;
  for(let i=0;i<row.length;i++){
    const ch=row[i];
    if(ch==='"'){
      if(inQ && row[i+1]==='"'){ cur+='"'; i++; }
      else inQ=!inQ;
      continue;
    }
    if(ch===',' && !inQ){
      cols.push(cur); cur='';
    } else cur+=ch;
  }
  cols.push(cur);
  return cols.map(c=>c.replace(/\uFEFF/g,'').replace(/\u00A0/g,' ').trim());
}

/* 治療方針セル分解 */
function dissectTreatmentCell(cell){
  if(!cell) return {label:'',rawPoints:'',comment:''};
  const lines=cell.split(/\n+/).map(l=>l.trim()).filter(Boolean);
  let comment='';
  if(lines.length && /^[（(]/.test(lines[lines.length-1])) comment=lines.pop();
  let main=lines.join(' ');
  if(!main) main=cell;
  const tail=main.match(/([（(].*?[）)])\s*$/);
  if(tail){
    comment=comment||tail[1];
    main=main.slice(0,tail.index).trim();
  }
  let label='',rawPoints='';
  const p1=main.indexOf('：'); const p2=main.indexOf(':');
  let sep=-1;
  if(p1>=0 && p2>=0) sep=Math.min(p1,p2);
  else sep=p1>=0? p1:p2;
  if(sep>=0){
    label=main.slice(0,sep).trim();
    rawPoints=main.slice(sep+1).trim();
  } else label=main.trim();
  return {label,rawPoints,comment};
}

/* ------------ 状態マシン CSV パーサ (FIX2) ------------ */
const CLASSIFICATION_WHITELIST = new Set([
  '1.疼痛',
  '2.臓腑と関連する症候',
  '3.全身の症候'
]);

function isPatternHeader(row){
  if(!row || !row.length) return false;
  return /病証名/.test(removeAllUnicodeSpaces(row[0]||''));
}
function isTreatmentHeaderCell(cell){
  return /治療方針/.test(removeAllUnicodeSpaces(cell||''));
}
function normalizeFirst(cell){
  return trimOuter(cell||'').replace(/\u3000/g,' ');
}
function isSystemLine(firstCell){
  const fc=removeAllUnicodeSpaces(firstCell||'');
  if(fc==='-') return true;
  return /系統/.test(fc);
}
function isClassificationLine(firstCell){
  const norm=normalizeFirst(firstCell);
  return CLASSIFICATION_WHITELIST.has(removeAllUnicodeSpaces(norm));
}
function isNumberedLine(firstCell){
  return /^[0-9０-９]+\.?.*/.test(removeAllUnicodeSpaces(firstCell||''));
}
function isSymptomLine(firstCell){
  if(!firstCell) return false;
  const f=normalizeFirst(firstCell);
  if(isClassificationLine(f)) return false;
  if(isSystemLine(f)) return false;
  if(isTreatmentHeaderCell(f)) return false;
  if(/病証名/.test(removeAllUnicodeSpaces(f))) return false;
  if(removeAllUnicodeSpaces(f)==='-') return false;
  if(!isNumberedLine(f)) return false;
  return true;
}

function parseClinicalHierarchyStateMachine(raw){
  const logical=rebuildLogicalRows(raw);
  const table=logical.map(parseCSVLogicalRow);

  const hierarchy={};
  const classificationsOrder=[];
  let currentClassification=null;
  let currentSystem=null;
  let currentSymptom=null;

  for(let i=0;i<table.length;i++){
    const row=table[i];
    if(!row.length){ continue; }
    const first = row[0] ? row[0].trim() : '';

    // 分類行
    if(isClassificationLine(first)){
      currentClassification = normalizeFirst(first);
      if(!hierarchy[currentClassification]){
        hierarchy[currentClassification]={};
        classificationsOrder.push(currentClassification);
      }
      currentSystem=null;
      currentSymptom=null;
      continue;
    }

    // 系統行
    if(isSystemLine(first) && currentClassification){
      currentSystem = normalizeFirst(first); // '-' か '1.肝系統' 等
      currentSymptom=null;
      if(!hierarchy[currentClassification][currentSystem]){
        hierarchy[currentClassification][currentSystem]={};
      }
      continue;
    }

    // 症状行
    if(isSymptomLine(first) && currentClassification){
      // 系統未確定なら '-' を自動
      if(!currentSystem){
        currentSystem='-';
        if(!hierarchy[currentClassification][currentSystem]){
          hierarchy[currentClassification][currentSystem]={};
        }
      }
      currentSymptom = normalizeFirst(first);
      if(!hierarchy[currentClassification][currentSystem][currentSymptom]){
        hierarchy[currentClassification][currentSystem][currentSymptom]={
          patterns:[],
          groupsByPattern:{}
        };
      }
      continue;
    }

    // 病証名ヘッダ
    if(isPatternHeader(row) && currentClassification && currentSymptom){
      if(!currentSystem){
        currentSystem='-';
        if(!hierarchy[currentClassification][currentSystem]){
          hierarchy[currentClassification][currentSystem]={};
        }
        if(!hierarchy[currentClassification][currentSystem][currentSymptom]){
          hierarchy[currentClassification][currentSystem][currentSymptom]={
            patterns:[],groupsByPattern:{}
          };
        }
      }
      const node = hierarchy[currentClassification][currentSystem][currentSymptom];
      const patterns=row.slice(1)
        .map(c=>c.trim())
        .filter(c=>c && !/^治療方針/.test(c));
      patterns.forEach(p=>{
        if(!node.patterns.includes(p)){
          node.patterns.push(p);
          node.groupsByPattern[p]=[];
        }
      });

      // 後続の治療方針行
      let j=i+1;
      while(j<table.length){
        const nr=table[j];
        if(!nr.length){ j++; continue; }
        const nf=nr[0]? nr[0].trim():'';
        if(isPatternHeader(nr)) break;                 // 次の病証名
        if(isClassificationLine(nf)) break;            // 次の分類
        if(isSystemLine(nf)) break;                    // 次の系統
        if(isSymptomLine(nf)) break;                   // 次の症状

        if(isTreatmentHeaderCell(nf)){
          const after=nr.slice(1);
          after.forEach((cell,k)=>{
            const pat=patterns[k];
            if(!pat || !cell) return;
            const parsed=dissectTreatmentCell(cell);
            if(parsed.label || parsed.rawPoints){
              if(!parsed.tokens) parsed.tokens=parseTreatmentPoints(parsed.rawPoints);
              node.groupsByPattern[pat].push(parsed);
            }
          });
        }
        j++;
      }
      continue;
    }

    // それ以外は無視
  }

  // tokens補完（念のため）
  Object.keys(hierarchy).forEach(cls=>{
    Object.keys(hierarchy[cls]).forEach(sys=>{
      Object.keys(hierarchy[cls][sys]).forEach(sym=>{
        const node=hierarchy[cls][sys][sym];
        node.patterns.forEach(p=>{
          node.groupsByPattern[p].forEach(g=>{
            if(!g.tokens) g.tokens=parseTreatmentPoints(g.rawPoints);
          });
        });
      });
    });
  });

  return {hierarchy, classificationsOrder};
}

/* ------------ 逆インデックス ------------ */
function rebuildAcuPointPatternIndex(){
  ACUPOINT_PATTERN_INDEX={};
  Object.keys(CLINICAL_HIERARCHY).forEach(cls=>{
    Object.keys(CLINICAL_HIERARCHY[cls]).forEach(sys=>{
      Object.keys(CLINICAL_HIERARCHY[cls][sys]).forEach(sym=>{
        const node=CLINICAL_HIERARCHY[cls][sys][sym];
        node.patterns.forEach(pat=>{
          const groups=node.groupsByPattern[pat];
          const seen=new Set();
          groups.forEach(g=>{
            (g.tokens||[]).forEach(tk=>{
              if(!tk || seen.has(tk)) return;
              seen.add(tk);
              if(!ACUPOINT_PATTERN_INDEX[tk]) ACUPOINT_PATTERN_INDEX[tk]=[];
              ACUPOINT_PATTERN_INDEX[tk].push({classification:cls,system:sys,symptom:sym,pattern:pat});
            });
          });
        });
      });
    });
  });
  Object.keys(ACUPOINT_PATTERN_INDEX).forEach(k=>{
    const uniq=new Map();
    ACUPOINT_PATTERN_INDEX[k].forEach(e=>{
      const key=e.classification+'||'+e.system+'||'+e.symptom+'||'+e.pattern;
      if(!uniq.has(key)) uniq.set(key,e);
    });
    ACUPOINT_PATTERN_INDEX[k]=Array.from(uniq.values());
  });
}

/* ------------ レイアウト ------------ */
function equalizeTopCards(){
  if(window.innerWidth<860){
    searchCard.style.height='';
    symptomCard.style.height='';
    return;
  }
  searchCard.style.height='';
  symptomCard.style.height='';
  const maxH=Math.max(searchCard.scrollHeight, symptomCard.scrollHeight);
  searchCard.style.height=maxH+'px';
  symptomCard.style.height=maxH+'px';
}

/* ------------ Region/治療点リンク処理など（既存） ------------ */
function matchTokenWithSpaces(raw,pos,token){
  let i=pos,k=0,len=raw.length;
  while(k<token.length){
    while(i<len && /[ \u00A0\u1680\u2000-\u200B\u202F\u205F\u3000]/.test(raw[i])) i++;
    if(i>=len) return 0;
    if(raw[i]!==token[k]) return 0;
    i++; k++;
  }
  return i - pos;
}
function linkifyParenthesisGroup(group){
  if(group.length<2) return escapeHTML(group);
  const open=group[0], close=group[group.length-1];
  const inner=group.slice(1,-1);
  let i=0,out='';
  while(i<inner.length){
    const ch=inner[i];
    if(/[ \u00A0\u1680\u2000-\u200B\u202F\u205F\u3000]/.test(ch)){ out+=escapeHTML(ch); i++; continue; }
    let matched=null, consumed=0;
    for(const name of ACUPOINT_NAME_LIST){
      const c=matchTokenWithSpaces(inner,i,name);
      if(c){ matched=name; consumed=c; break; }
    }
    if(matched){
      const p=findAcupointByToken(matched);
      if(p){
        const imp=p.important?' acu-important':'';
        out+=`<a href="#" class="treat-point-link${imp}" data-point="${escapeHTML(p.name)}">${escapeHTML(p.name)}</a>`;
      } else out+=escapeHTML(matched);
      i+=consumed;
    } else { out+=escapeHTML(ch); i++; }
  }
  return escapeHTML(open)+out+escapeHTML(close);
}
function linkifyRegionAcupoints(html){
  if(!html || !ACUPOINT_NAME_LIST.length) return html;
  const wrapper=document.createElement('div');
  wrapper.innerHTML=html;
  function process(node){
    if(node.nodeType===Node.TEXT_NODE){
      const text=node.nodeValue;
      if(!text.trim()) return;
      let work=text;
      const frag=document.createDocumentFragment();
      let cursor=0;
      for(let i=0;i<work.length;){
        let matched=null,len=0;
        for(const name of ACUPOINT_NAME_LIST){
          if(work.startsWith(name,i)){ matched=name; len=name.length; break; }
        }
        if(matched){
          if(i>cursor) frag.appendChild(document.createTextNode(work.slice(cursor,i)));
          const a=document.createElement('a');
          a.href='#';
          a.className='treat-point-link';
          const p=findAcupointByToken(matched);
          if(p && p.important) a.classList.add('acu-important');
          a.dataset.point=matched;
          a.textContent=matched;
          frag.appendChild(a);
          i+=len; cursor=i;
        }else i++;
      }
      if(cursor<work.length) frag.appendChild(document.createTextNode(work.slice(cursor)));
      if(frag.childNodes.length) node.replaceWith(frag);
    }else if(node.nodeType===Node.ELEMENT_NODE){
      if(node.tagName.toLowerCase()==='a') return;
      Array.from(node.childNodes).forEach(process);
    }
  }
  Array.from(wrapper.childNodes).forEach(process);
  return wrapper.innerHTML;
}

function hideMeridianImage(){
  if(meridianImageSection){
    meridianImageSection.classList.add('hidden');
    if(meridianImageEl){
      meridianImageEl.removeAttribute('src');
      meridianImageEl.alt='';
    }
  }
}
function updateMeridianImage(meridian){
  if(!meridian){ hideMeridianImage(); }
  else {
    const fileName= meridian + '.png';
    const url='image/'+encodeURI(fileName)+'?v='+APP_VERSION;
    meridianImageEl.onload = ()=>meridianImageSection.classList.remove('hidden');
    meridianImageEl.onerror= ()=>hideMeridianImage();
    meridianImageEl.alt=meridian;
    meridianImageEl.src=url;
  }
}

function showPointDetail(p, suppressHistory=false){
  hideHomeGallery();
  let regionHTML=p.region||'';
  if(regionHTML.includes('[[')){
    regionHTML = p.regionRaw? applyRedMarkup(p.regionRaw): applyRedMarkup(regionHTML);
  }
  regionHTML = linkifyRegionAcupoints(regionHTML);

  resultNameEl.textContent = `${p.name}${p.reading?` (${p.reading})`:''}`;
  if(p.important) resultNameEl.classList.add('is-important'); else resultNameEl.classList.remove('is-important');
  resultMeridianEl.textContent = p.meridian||'（経絡未登録）';
  resultRegionEl.innerHTML = regionHTML||'（部位未登録）';
  if(p.important){
    resultImportantEl.innerHTML=`<span class="acu-important-flag">${escapeHTML(p.important)}</span>`;
  }else resultImportantEl.textContent='-';
  if(resultMuscleEl) resultMuscleEl.textContent=p.muscle||'（筋肉未登録）';

  renderRelatedPatterns(p.name);
  inlineAcupointResult.classList.remove('hidden');
  updateMeridianImage(p.meridian||'');

  if(!suppressHistory && !IS_APPLYING_HISTORY){
    pushState({type:'point',name:p.name});
  }
  requestAnimationFrame(equalizeTopCards);
}
function renderRelatedPatterns(pointName){
  relatedSymptomsEl.innerHTML='';
  if(!CLINICAL_READY || !ACUPOINT_PATTERN_INDEX[pointName] || !ACUPOINT_PATTERN_INDEX[pointName].length){
    relatedSymptomsEl.innerHTML='<li>-</li>'; return;
  }
  ACUPOINT_PATTERN_INDEX[pointName].forEach(entry=>{
    const display=getDisplayPatternName(entry.pattern);
    const li=document.createElement('li');
    li.innerHTML=`
      <a href="#" class="acu-pattern-link"
         data-class="${escapeHTML(entry.classification)}"
         data-system="${escapeHTML(entry.system)}"
         data-symptom="${escapeHTML(entry.symptom)}"
         data-pattern="${escapeHTML(entry.pattern)}">${escapeHTML(display)}</a>`;
    relatedSymptomsEl.appendChild(li);
  });
}
function showUnknownPoint(name, suppressHistory=false){
  hideHomeGallery();
  resultNameEl.textContent=`${name}（未登録）`;
  resultNameEl.classList.remove('is-important');
  resultMeridianEl.textContent='（経絡未登録）';
  resultRegionEl.innerHTML='（部位未登録）';
  resultImportantEl.textContent='-';
  if(resultMuscleEl) resultMuscleEl.textContent='（筋肉未登録）';
  relatedSymptomsEl.innerHTML='<li>-</li>';
  inlineAcupointResult.classList.remove('hidden');
  hideMeridianImage();
  if(!suppressHistory && !IS_APPLYING_HISTORY){
    pushState({type:'unknownPoint',name});
  }
  requestAnimationFrame(equalizeTopCards);
}
function selectPoint(p){
  clearSuggestions();
  inputEl.value=p.name;
  showPointDetail(p);
}

/* ------------ 階層セレクト制御 ------------ */
function makeOptions(selectEl, values, {placeholder, disabledSet} = {}){
  selectEl.innerHTML = '';
  if(placeholder){
    const opt=document.createElement('option');
    opt.value=''; opt.textContent=placeholder;
    opt.disabled=true; opt.selected=true;
    selectEl.appendChild(opt);
  }
  values.forEach(v=>{
    const opt=document.createElement('option');
    opt.value=v; opt.textContent=v;
    if(disabledSet && disabledSet.has(v)){
      opt.disabled=true;
      opt.classList.add('disabled');
    }
    selectEl.appendChild(opt);
  });
  selectEl.disabled = !values.length;
}

function resetHierarchySelects(clearAll){
  classificationSelect.value='';
  systemSelect.innerHTML='<option value="">(系統を選択)</option>';
  systemSelect.disabled=true;
  symptomSelect.innerHTML='<option value="">(症状を選択)</option>';
  symptomSelect.disabled=true;
  patternSelect.innerHTML='<option value="">(病証を選択)</option>';
  patternSelect.disabled=true;
  clinicalResultEl.classList.add('hidden');
  clinicalGroupsEl.innerHTML='';
  if(clearAll){
    classificationSelect.innerHTML='<option value="">(分類を選択)</option>';
  }
}

function handleClassificationChange(){
  const cls = classificationSelect.value;
  systemSelect.innerHTML=''; symptomSelect.innerHTML=''; patternSelect.innerHTML='';
  clinicalGroupsEl.innerHTML='';
  clinicalResultEl.classList.add('hidden');
  if(!cls || !CLINICAL_HIERARCHY[cls]){
    resetHierarchySelects(false);
    requestAnimationFrame(equalizeTopCards);
    return;
  }
  const systems = Object.keys(CLINICAL_HIERARCHY[cls]);
  if(systems.length===1 && systems[0]==='-'){
    systemSelect.innerHTML='<option value="-">-</option>';
    systemSelect.value='-';
    systemSelect.disabled=true;
    const symptoms=Object.keys(CLINICAL_HIERARCHY[cls]['-']);
    makeOptions(symptomSelect, symptoms, {placeholder:'(症状を選択)'});
    symptomSelect.disabled=false;
    patternSelect.innerHTML='<option value="">(病証を選択)</option>';
    patternSelect.disabled=true;
    requestAnimationFrame(equalizeTopCards);
    return;
  }
  const disabledSet = new Set();
  systems.forEach(s=>{ if(s==='-') disabledSet.add(s); });
  makeOptions(systemSelect, systems, {placeholder:'(系統を選択)', disabledSet});
  systemSelect.disabled=false;
  symptomSelect.innerHTML='<option value="">(症状を選択)</option>';
  symptomSelect.disabled=true;
  patternSelect.innerHTML='<option value="">(病証を選択)</option>';
  patternSelect.disabled=true;
  requestAnimationFrame(equalizeTopCards);
}

function handleSystemChange(){
  const cls = classificationSelect.value;
  const sys = systemSelect.value;
  symptomSelect.innerHTML=''; patternSelect.innerHTML=''; clinicalGroupsEl.innerHTML='';
  clinicalResultEl.classList.add('hidden');
  if(!cls || !sys || !CLINICAL_HIERARCHY[cls][sys]){
    symptomSelect.innerHTML='<option value="">(症状を選択)</option>';
    symptomSelect.disabled=true;
    patternSelect.innerHTML='<option value="">(病証を選択)</option>';
    patternSelect.disabled=true;
    requestAnimationFrame(equalizeTopCards);
    return;
  }
  const symptoms = Object.keys(CLINICAL_HIERARCHY[cls][sys]);
  makeOptions(symptomSelect, symptoms, {placeholder:'(症状を選択)'});
  symptomSelect.disabled=false;
  patternSelect.innerHTML='<option value="">(病証を選択)</option>';
  patternSelect.disabled=true;
  clinicalGroupsEl.innerHTML='';
  clinicalResultEl.classList.add('hidden');
  requestAnimationFrame(equalizeTopCards);
}

function handleSymptomChange(){
  const cls = classificationSelect.value;
  const sys = systemSelect.value || (CLINICAL_HIERARCHY[cls] && CLINICAL_HIERARCHY[cls]['-'] ? '-' : '');
  const sym = symptomSelect.value;
  patternSelect.innerHTML=''; clinicalGroupsEl.innerHTML='';
  clinicalResultEl.classList.add('hidden');
  if(!cls || !sys || !sym || !CLINICAL_HIERARCHY[cls][sys][sym]){
    patternSelect.innerHTML='<option value="">(病証を選択)</option>';
    patternSelect.disabled=true;
    requestAnimationFrame(equalizeTopCards);
    return;
  }
  const patterns = CLINICAL_HIERARCHY[cls][sys][sym].patterns;
  makeOptions(patternSelect, patterns, {placeholder:'(病証を選択)'});
  patternSelect.disabled=false;
  clinicalGroupsEl.innerHTML='';
  clinicalResultEl.classList.add('hidden');
  requestAnimationFrame(equalizeTopCards);
}

function handlePatternChange(){
  hideHomeGallery();
  const cls=classificationSelect.value;
  const sys=systemSelect.value || (CLINICAL_HIERARCHY[cls] && CLINICAL_HIERARCHY[cls]['-'] ? '-' : '');
  const sym=symptomSelect.value;
  const pat=patternSelect.value;
  clinicalResultEl.classList.add('hidden');
  clinicalGroupsEl.innerHTML='';
  const span=clinicalTitleEl.querySelector('.pattern-name-highlight');
  if(span) span.textContent='';
  if(!cls || !sys || !sym || !pat) { requestAnimationFrame(equalizeTopCards); return; }
  const node=CLINICAL_HIERARCHY[cls][sys][sym];
  if(!node || !node.groupsByPattern[pat]){ requestAnimationFrame(equalizeTopCards); return; }
  const groups=node.groupsByPattern[pat];
  if(span) span.textContent=getDisplayPatternName(pat);

  groups.forEach(g=>{
    const tokens=g.tokens||parseTreatmentPoints(g.rawPoints);
    const pointsHtml=buildPointsHTML(g.rawPoints,tokens);
    const comment=g.comment? ensureCommentParens(g.comment):'';
    const div=document.createElement('div');
    div.className='treat-line';
    div.innerHTML=`
      <p class="treat-main">${escapeHTML(g.label)}：${pointsHtml}</p>
      ${comment? `<p class="treat-comment">${escapeHTML(comment)}</p>`:''}`;
    clinicalGroupsEl.appendChild(div);
  });

  clinicalResultEl.classList.remove('hidden');
  clinicalGroupsEl.querySelectorAll('.treat-point-link').forEach(a=>{
    a.addEventListener('click', e=>{
      e.preventDefault();
      const nm=a.dataset.point;
      const p=findAcupointByToken(nm);
      if(p) showPointDetail(p); else showUnknownPoint(nm);
    });
  });

  if(!IS_APPLYING_HISTORY){
    pushState({type:'pattern',classification:cls,system:sys,symptom:sym,pattern:pat});
  }
  requestAnimationFrame(equalizeTopCards);
}

classificationSelect.addEventListener('change', handleClassificationChange);
systemSelect.addEventListener('change', handleSystemChange);
symptomSelect.addEventListener('change', handleSymptomChange);
patternSelect.addEventListener('change', handlePatternChange);

/* 病証リンク (関連リスト) */
document.addEventListener('click', e=>{
  const a=e.target.closest('.acu-pattern-link');
  if(!a) return;
  e.preventDefault();
  const cls=a.dataset.class;
  const sys=a.dataset.system;
  const sym=a.dataset.symptom;
  const pat=a.dataset.pattern;
  if(!cls||!sys||!sym||!pat) return;
  selectHierarchy(cls, sys, sym, pat, false);
});

/* 治療方針内の経穴リンク */
document.addEventListener('click', e=>{
  const a=e.target.closest('.treat-point-link');
  if(!a) return;
  e.preventDefault();
  const nm=a.dataset.point;
  const p=findAcupointByToken(nm);
  if(p) showPointDetail(p); else showUnknownPoint(nm);
});

/* 階層選択一括 (履歴/リンク用) */
function selectHierarchy(cls, sys, sym, pat, suppressHistory){
  if(!CLINICAL_READY) return;
  if(!CLINICAL_HIERARCHY[cls]) return;

  classificationSelect.value=cls;
  classificationSelect.dispatchEvent(new Event('change'));

  if(sys==='-' && CLINICAL_HIERARCHY[cls]['-']){
    systemSelect.innerHTML='<option value="-">-</option>';
    systemSelect.value='-';
    systemSelect.disabled=true;
    const symptoms=Object.keys(CLINICAL_HIERARCHY[cls]['-']);
    makeOptions(symptomSelect, symptoms, {placeholder:'(症状を選択)'});
    symptomSelect.disabled=false;
  } else if(CLINICAL_HIERARCHY[cls][sys]) {
    systemSelect.value=sys;
    systemSelect.dispatchEvent(new Event('change'));
  }

  if(CLINICAL_HIERARCHY[cls][sys] && CLINICAL_HIERARCHY[cls][sys][sym]){
    symptomSelect.value=sym;
    symptomSelect.dispatchEvent(new Event('change'));
  }

  if(CLINICAL_HIERARCHY[cls][sys] && CLINICAL_HIERARCHY[cls][sys][sym] &&
     CLINICAL_HIERARCHY[cls][sys][sym].patterns.includes(pat)){
    patternSelect.value=pat;
    patternSelect.dispatchEvent(new Event('change'));
    if(suppressHistory){
      IS_APPLYING_HISTORY=true;
      pushState({type:'pattern',classification:cls,system:sys,symptom:sym,pattern:pat}, true);
      IS_APPLYING_HISTORY=false;
    }
  }
}

/* ------------ Home ------------ */
function goHome(suppressHistory=false){
  inputEl.value='';
  clearSuggestions();
  inlineAcupointResult.classList.add('hidden');
  hideMeridianImage();
  resetHierarchySelects(false);
  clinicalGroupsEl.innerHTML='';
  clinicalResultEl.classList.add('hidden');
  const span=clinicalTitleEl.querySelector('.pattern-name-highlight');
  if(span) span.textContent='';
  relatedSymptomsEl.innerHTML='<li>-</li>';
  showHomeGallery();
  window.scrollTo({top:0,behavior:'smooth'});
  requestAnimationFrame(()=>{ inputEl.focus(); inputEl.select(); });
  requestAnimationFrame(equalizeTopCards);
  if(!suppressHistory && !IS_APPLYING_HISTORY){
    pushState({type:'home'});
  }
}
homeBtn.addEventListener('click',()=>goHome());

backBtn.addEventListener('click',goBack);
forwardBtn.addEventListener('click',goForward);
document.addEventListener('keydown', e=>{
  if(e.altKey && !e.metaKey && !e.shiftKey && !e.ctrlKey){
    if(e.key==='ArrowLeft') goBack();
    else if(e.key==='ArrowRight') goForward();
  }
});

/* ------------ 検索 ------------ */
function filterPoints(qInput){
  const q=removeAllUnicodeSpaces(qInput);
  if(q.length<MIN_QUERY_LENGTH) return [];
  if(/^[\u3041-\u3096]+$/.test(q)){
    let list=ACUPOINTS.filter(p=>p.reading && p.reading.startsWith(q));
    if(!list.length) list=ACUPOINTS.filter(p=>p.reading && p.reading.includes(q));
    return list.map(p=>({...p,_matchType:'name'}));
  }
  const nm=[]; const seen=new Set();
  for(const p of ACUPOINTS){
    if(p.name.includes(q)){ nm.push({...p,_matchType:'name'}); seen.add(p.name); }
  }
  const mm=[];
  for(const p of ACUPOINTS){
    if(seen.has(p.name)) continue;
    if(p.muscle && p.muscle.includes(q)){ mm.push({...p,_matchType:'muscle'}); seen.add(p.name); }
  }
  return nm.concat(mm);
}
function clearSuggestions(){
  suggestionListEl.innerHTML='';
  suggestionListEl.classList.add('hidden');
  inputEl.setAttribute('aria-expanded','false');
  requestAnimationFrame(equalizeTopCards);
}
function setActive(items,idx){
  items.forEach(li=>{
    li.classList.remove('active');
    li.setAttribute('aria-selected','false');
  });
  if(items[idx]){
    items[idx].classList.add('active');
    items[idx].setAttribute('aria-selected','true');
    items[idx].scrollIntoView({block:'nearest'});
  }
}
function renderSuggestions(list){
  suggestionListEl.innerHTML='';
  const qRaw=removeAllUnicodeSpaces(inputEl.value);
  const hira=/^[\u3041-\u3096]+$/.test(qRaw)? qRaw:'';
  const qRegex=hira? new RegExp(hira.replace(/([.*+?^=!:${}()|[\\]\\])/g,'\\$1'),'g'):null;

  list.slice(0,120).forEach((p,i)=>{
    const li=document.createElement('li');
    li.dataset.id=p.name;
    li.dataset.matchType=p._matchType||'';
    li.setAttribute('role','option');
    li.setAttribute('aria-selected', i===0?'true':'false');

    let readingHTML=escapeHTML(p.reading||'');
    if(qRegex && p.reading){
      readingHTML=readingHTML.replace(qRegex,m=>`<mark>${m}</mark>`);
    }
    const important=!!p.important;
    const badges=[];
    if(important) badges.push('<span class="badge badge-important" title="要穴">★</span>');
    const nameCls=important?'sug-name important':'sug-name';

    li.innerHTML=`
      <span class="${nameCls}">${escapeHTML(p.name)}</span>
      <span class="sug-slash">/</span>
      <span class="sug-reading">${readingHTML}</span>
      <span class="sug-badges">${badges.join('')}</span>`;
    if(i===0) li.classList.add('active');
    li.addEventListener('click',()=>selectPoint(p));
    suggestionListEl.appendChild(li);
  });

  if(!list.length){
    const li=document.createElement('li');
    li.textContent='該当なし';
    li.style.color='#888';
    li.setAttribute('role','option');
    li.setAttribute('aria-selected','false');
    suggestionListEl.appendChild(li);
  }
  suggestionListEl.classList.remove('hidden');
  inputEl.setAttribute('aria-expanded','true');
  requestAnimationFrame(equalizeTopCards);
}
function handleSuggestionKeyboard(e){
  const items=Array.from(suggestionListEl.querySelectorAll('li'));
  if(!items.length) return;
  let current=items.findIndex(li=>li.classList.contains('active'));
  if(e.key==='ArrowDown'){
    e.preventDefault();
    current=(current+1)%items.length;
    setActive(items,current);
  }else if(e.key==='ArrowUp'){
    e.preventDefault();
    current=(current-1+items.length)%items.length;
    setActive(items,current);
  }else if(e.key==='Enter'){
    e.preventDefault();
    const act=items[current>=0?current:0];
    if(act && act.dataset.id){
      const p=ACUPOINTS.find(x=>x.name===act.dataset.id);
      if(p) selectPoint(p);
    }
  }else if(e.key==='Escape'){
    clearSuggestions();
  }
}
function runSearch(){
  if(!DATA_READY) return;
  const q=removeAllUnicodeSpaces(inputEl.value);
  if(!q){ clearSuggestions(); return; }
  const exact=ACUPOINTS.find(p=>p.name===q);
  if(exact){ selectPoint(exact); return; }
  const list=filterPoints(q);
  if(list.length===1) selectPoint(list[0]);
  else renderSuggestions(list);
}
inputEl.addEventListener('keyup', e=>{
  if(['ArrowDown','ArrowUp','Enter','Escape'].includes(e.key)){
    handleSuggestionKeyboard(e); return;
  }
  if(!DATA_READY) return;
  const val=inputEl.value;
  if(removeAllUnicodeSpaces(val).length<MIN_QUERY_LENGTH){
    clearSuggestions(); return;
  }
  renderSuggestions(filterPoints(val));
});
inputEl.addEventListener('keydown', e=>{
  if(e.key==='Enter'){ e.preventDefault(); runSearch(); }
  else if(['ArrowDown','ArrowUp','Escape'].includes(e.key)){
    handleSuggestionKeyboard(e);
  }
});
searchBtn.addEventListener('click',runSearch);
document.addEventListener('click', e=>{
  if(!e.target.closest('.suggestion-wrapper') && !e.target.closest('#acupoint-search-input')){
    clearSuggestions();
  }
});

/* ------------ CSV ロード ------------ */
async function loadAcuCSV(){
  statusEl.textContent='経穴CSV: 読込中';
  try{
    const res=await fetch(`${CSV_PATH}?v=${APP_VERSION}&_=${Date.now()}`);
    if(!res.ok) throw new Error('HTTP '+res.status);
    const text=await res.text();
    ACUPOINTS=parseAcuCSV(text);
    buildNameLookup();
    DATA_READY=true;
    const total=ACUPOINTS.length;
    statusEl.textContent=(total===EXPECTED_TOTAL)
      ? `経穴CSV: ${total}件 / 想定${EXPECTED_TOTAL}`
      : `経穴CSV: ${total}件 (想定${EXPECTED_TOTAL})`;
  }catch(err){
    console.error('[LOAD] acu error',err);
    statusEl.textContent='経穴CSV: 失敗 '+err.message;
  }finally{
    requestAnimationFrame(equalizeTopCards);
  }
}
async function loadClinicalCSV(){
  clinicalStatusEl.textContent='臨床CSV: 読込中';
  try{
    const res=await fetch(`${CLINICAL_CSV_PATH}?v=${APP_VERSION}&_=${Date.now()}`);
    if(!res.ok) throw new Error('HTTP '+res.status);
    const text=await res.text();
    const {hierarchy, classificationsOrder} = parseClinicalHierarchyStateMachine(text);
    CLINICAL_HIERARCHY=hierarchy;
    CLASSIFICATIONS_ORDER=classificationsOrder;
    CLINICAL_READY=true;

    makeOptions(classificationSelect, CLASSIFICATIONS_ORDER, {placeholder:'(分類を選択)'});
    classificationSelect.disabled = !CLASSIFICATIONS_ORDER.length;
    rebuildAcuPointPatternIndex();

    clinicalStatusEl.textContent=`臨床CSV: 分類 ${CLASSIFICATIONS_ORDER.length}件`;
  }catch(err){
    console.error('[LOAD] clinical error',err);
    clinicalStatusEl.textContent='臨床CSV: 失敗 '+err.message;
  }finally{
    requestAnimationFrame(equalizeTopCards);
  }
}

/* ------------ 初期化 ------------ */
function init(){
  try{
    loadAcuCSV();
    loadClinicalCSV();
    initHomeGallery();
    updateNavButtons();
    requestAnimationFrame(equalizeTopCards);
    requestAnimationFrame(()=>{ inputEl.focus(); inputEl.select(); });

    const waitReady=setInterval(()=>{
      if((DATA_READY||CLINICAL_READY) && historyStack.length===0){
        pushState({type:'home'});
        showHomeGallery();
      }
      if(DATA_READY && CLINICAL_READY){
        clearInterval(waitReady);
      }
    },150);
  }catch(err){
    console.error('[INIT] fatal',err);
    statusEl.textContent='経穴CSV: JSエラー';
    clinicalStatusEl.textContent='臨床CSV: JSエラー';
  }
}
window.addEventListener('resize',equalizeTopCards);
init();

/* ------------ 治療方針ポイント HTML ------------ */
function buildPointsHTML(rawPoints,tokens){
  if(!rawPoints) return '';
  const uniqueTokens=Array.from(new Set(tokens||[]));
  const sorted=uniqueTokens.sort((a,b)=> b.length - a.length);
  let i=0,out='',len=rawPoints.length;
  while(i<len){
    const ch=rawPoints[i];
    if(ch==='('||ch==='（'){
      const closeChar= ch==='(' ? ')' : '）';
      let j=i+1; while(j<len && rawPoints[j]!==closeChar) j++;
      if(j<len) j++;
      out+=linkifyParenthesisGroup(rawPoints.slice(i,j));
      i=j; continue;
    }
    if(/[ \u00A0\u1680\u2000-\u200B\u202F\u205F\u3000]/.test(ch)){ out+=escapeHTML(ch); i++; continue; }
    let matched=null, consumed=0;
    for(const tk of sorted){
      const c=matchTokenWithSpaces(rawPoints,i,tk);
      if(c){ matched=tk; consumed=c; break; }
    }
    if(matched){
      const acu=findAcupointByToken(matched);
      if(acu){
        const imp=acu.important?' acu-important':'';
        out+=`<a href="#" class="treat-point-link${imp}" data-point="${escapeHTML(acu.name)}">${escapeHTML(acu.name)}</a>`;
      } else {
        out+=`<a href="#" class="treat-point-link treat-point-unknown" data-point="${escapeHTML(matched)}" data-unknown="1">${escapeHTML(matched)}</a>`;
      }
      i+=consumed; continue;
    }
    out+=escapeHTML(ch); i++;
  }
  return out;
}
