/******************************************************
 * 経穴検索 + 臨床病証 + 履歴ナビ + 部位内経穴リンク化 + 経絡イメージ + Home全身図ギャラリー
 * 4階層拡張版 (分類 / 系統 / 症状 / 病証)
 *
 * APP_VERSION 20250929-4TIER-FULL
 *
 * 変更概要:
 *  1) 既存 2 セレクト (カテゴリ/病証) を 4 セレクト (分類/系統/症状/病証) に拡張
 *  2) CSV パーサ parseClinicalCSV 拡張: system(系統)・symptom(症状) を行構造から抽出
 *     - Category 行 直後の最初の非空行 → 系統 (例: "1.肝系統" / "-" など)
 *     - その後 Pattern Header ("病証名") 行までの番号付き行 → 症状 (例: "5.頸肩腕痛")
 *     - Pattern 名 "【～】→症状" から症状逆引き補完 (症状行に無い場合も追加)
 *  3) 旧 CLINICAL_DATA は維持 (後方互換) しつつ、新構造 CLINICAL4 を構築
 *  4) Home 戻りで全 disabled 化するバグ回避。"-" の option だけ常に disabled
 *  5) サジェスト上下キーで 2 行飛ぶ問題を修正 (keydown のみで制御)
 *  6) equalizeTopCards で検索/症状カード高さ同期
 *  7) pattern 履歴 state に system / symptom を含める (戻る/進む互換)
 *  8) 既存機能 (履歴・リンク化・画像・Home ギャラリー等) を破壊しない
 *
 * 注意:
 *  - 既存 index.html に clinical-system-select / clinical-symptom-select を追加している前提
 *  - CSV 仕様が想定と異なる場合はフォールバックとして全パターンを症状未分類扱いにまとめる
 ******************************************************/

const APP_VERSION = '20250929-4TIER-FULL';

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

/* 旧構造 (後方互換保持) */
let CLINICAL_DATA = { order:[], cats:{} };

/* 新 4階層構造 */
let CLINICAL4 = {
  order:[], /* category order */
  cats:{}   /* cat -> { systemOrder:[], systems:{ sysName:{ symptomOrder:[], symptoms:{ symName:{ patternOrder:[], patterns:{patternName:Group[]} } } } } } */
};

/* patternName -> groups の既存挙動維持 (CLINICAL_DATA互換も利用) */

/* 逆インデックス: 経穴 -> [{cat,system,symptom,pattern}] */
let ACUPOINT_PATTERN_INDEX = {};

let historyStack = [];
let historyIndex = -1;
let IS_APPLYING_HISTORY = false;
let patternHistory = [];
let pointHistory   = [];
const HISTORY_LIMIT = 300;

/* ------------ DOM 取得 ------------ */
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

const categorySelect = document.getElementById('clinical-category-select');
const systemSelect   = document.getElementById('clinical-system-select');
const symptomSelect  = document.getElementById('clinical-symptom-select');
const patternSelect  = document.getElementById('clinical-pattern-select');

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

/* Home ギャラリー要素 */
const homeGallerySection = document.getElementById('home-gallery-section');
const homeGallerySelect  = document.getElementById('home-gallery-select');
const homeGalleryImage   = document.getElementById('home-gallery-image');
const homeGalleryFallback= document.getElementById('home-gallery-fallback');

/* ------------ Home 全身図ギャラリー ------------ */
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

/* ------------ Utility 基本 ------------ */
function isShown(el){ return el && !el.classList.contains('hidden'); }
function statesEqual(a,b){
  if(!a||!b) return false;
  if(a.type!==b.type) return false;
  if(a.type==='home') return true;
  if(a.type==='point'||a.type==='unknownPoint') return a.name===b.name;
  if(a.type==='pattern')
    return a.cat===b.cat && a.system===b.system && a.symptom===b.symptom && a.pattern===b.pattern;
  return false;
}
function normalizeNFC(s){ return s? s.normalize('NFC'):''; }
function removeAllUnicodeSpaces(str){
  return normalizeNFC(str||'')
    .replace(/[\u0000-\u001F\u007F]/g,'')
    .replace(/[ \u00A0\u1680\u2000-\u200B\u202F\u205F\u3000]/g,'')
    .replace(/\uFEFF/g,'');
}
function isSpace(ch){ return /[ \u00A0\u1680\u2000-\u200B\u202F\u205F\u3000]/.test(ch); }
function trimOuter(s){ return (s||'').trim(); }
function isHiraganaOnly(s){ return !!s && /^[\u3041-\u3096]+$/.test(s); }
function escapeHTML(s){
  return (s||'').replace(/[&<>"']/g,ch=>{
    switch(ch){
      case '&':return'&amp;'; case '<':return'&lt;'; case '>':return'&gt;';
      case '"':return'&quot;'; case "'":return'&#39;';
    }
  });
}
function applyRedMarkup(text){
  if(!text) return '';
  if(text.includes('<span class="bui-red">')) return text;
  return text.replace(/\[\[([^\[\]\r\n]{1,120})\]\]/g,'<span class="bui-red">$1</span>');
}
function ensureCommentParens(c){
  if(!c) return '';
  if(/^\s*[（(]/.test(c)) return c;
  return '('+c+')';
}
function transformPatternDisplay(original){
  const idx=original.indexOf('→');
  if(idx===-1) return original;
  const left=original.slice(0,idx).trim();
  const right=original.slice(idx+1).trim();
  if(/^【.+】$/.test(left)&&right&&!/^【.+】$/.test(right)){
    return `${right}→${left}`;
  }
  return original;
}
function getDisplayPatternName(n){ return transformPatternDisplay(n); }

/* ------------ 履歴管理 ------------ */
function updateNavButtons(){
  backBtn.disabled = (historyIndex <= 0);
  forwardBtn.disabled = (historyIndex < 0 || historyIndex >= historyStack.length - 1);
  if(!patternHistoryMenu.classList.contains('hidden')) safeRenderPatternHistoryMenu();
  if(!pointHistoryMenu.classList.contains('hidden')) safeRenderPointHistoryMenu();
}
function updateHistoryBadge(){
  if(pointHistoryBtn){
    pointHistoryBtn.title = `経穴 履歴 (Acupoint) - ${pointHistory.length}件`;
    pointHistoryBtn.dataset.count = pointHistory.length;
  }
  if(patternHistoryBtn){
    patternHistoryBtn.title = `治療方針 履歴 (Pattern) - ${patternHistory.length}件`;
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
        goHome(true);
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
          if(state.cat){
            categorySelect.value=state.cat;
            categorySelect.dispatchEvent(new Event('change'));
          }
          if(state.system){
            systemSelect.value=state.system;
            systemSelect.dispatchEvent(new Event('change'));
          }
          if(state.symptom){
            symptomSelect.value=state.symptom;
            symptomSelect.dispatchEvent(new Event('change'));
          }
          if(state.pattern){
            patternSelect.value=state.pattern;
            patternSelect.dispatchEvent(new Event('change'));
          }
        }
        break;
    }

    if(showPointFlag){
      inlineAcupointResult.classList.remove('hidden');
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

/* ------------ 履歴メニュー ------------ */
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
    const label = transformPatternDisplay(st.pattern);
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
        const label = transformPatternDisplay(st?.pattern||'?');
        return `<li><div style="display:flex;align-items:center;gap:6px;">
          <span class="hist-time">${formatTime(h.ts)}</span></div>
          <div class="hist-label">${escapeHTML(label)}</div></li>`;
      }).join('')
    : '<li>履歴なし</li>';
}

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
     !e.target.closest('#pattern-history-btn-wrapper') &&
     !e.target.closest('#pattern-history-btn')){
    patternHistoryMenu.classList.add('hidden');
  }
  if(!pointHistoryMenu.classList.contains('hidden') &&
     !e.target.closest('#point-history-btn-wrapper') &&
     !e.target.closest('#point-history-btn')){
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

/* トークン照合(空白許容) */
function matchTokenWithSpaces(raw,pos,token){
  let i=pos,k=0,len=raw.length;
  while(k<token.length){
    while(i<len && isSpace(raw[i])) i++;
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
    if(isSpace(ch)){ out+=escapeHTML(ch); i++; continue; }
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
    if(isSpace(ch)){ out+=escapeHTML(ch); i++; continue; }
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

/* ------------ 臨床 CSV 再構成 & 解析 (4階層) ------------ */
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
function isCategoryRow(cols){
  if(!cols.length) return false;
  const c0=removeAllUnicodeSpaces(cols[0]);
  return /^[0-9０-９][0-9０-９-]*\./.test(c0)&&cols.slice(1).every(c=>!c);
}
function isPatternHeaderRow(cols){
  if(!cols.length) return false;
  return /病証名/.test(cols[0].replace(/\s+/g,''));
}
function isTreatmentRow(cols){
  if(!cols.length) return false;
  return /治療方針/.test(cols[0]);
}
function isPotentialCommentRow(cols){
  if(!cols.length) return false;
  if(isCategoryRow(cols)||isPatternHeaderRow(cols)||isTreatmentRow(cols)) return false;
  return cols.slice(1).some(c=>/^[（(]/.test(c));
}
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
function isInterleavedTreatmentRow(after, patternCount){
  if(!after.length) return false;
  const treat=after.filter(c=>c && (c.includes('：')||c.includes(':')));
  const comm =after.filter(c=>c && /^[（(]/.test(c));
  if(!comm.length) return false;
  if(!treat.length) return false;
  return (treat.length+comm.length)>=patternCount;
}
function parseInterleavedRow(after, patternNames){
  const results=[]; let pIndex=0; let i=0;
  while(i<after.length && pIndex<patternNames.length){
    while(i<after.length && (!after[i] || /^[（(]/.test(after[i]) || !(after[i].includes('：')||after[i].includes(':')))) i++;
    if(i>=after.length) break;
    const treatCell=after[i]; i++;
    let commentCell='';
    if(i<after.length && /^[（(]/.test(after[i])){ commentCell=after[i]; i++; }
    const {label,rawPoints,comment}=dissectTreatmentCell(treatCell);
    if(label||rawPoints){
      results.push({pattern:patternNames[pIndex],label,rawPoints,comment:commentCell||comment||''});
      pIndex++;
    }
  }
  return results;
}

/* メインパーサ拡張 */
function parseClinicalCSV(raw){
  const logical=rebuildLogicalRows(raw);
  const table=logical.map(parseCSVLogicalRow);

  /* 旧形式構築 (後方互換) */
  const legacy={order:[],cats:{}};

  /* 新構造 */
  const four={order:[],cats:{}};

  let i=0;
  while(i<table.length){
    const row=table[i];
    if(!row.length){ i++; continue; }

    if(isCategoryRow(row)){
      const category=removeAllUnicodeSpaces(row[0]);
      if(!legacy.cats[category]){
        legacy.cats[category]={patternOrder:[],patterns:{}};
        legacy.order.push(category);
      }
      if(!four.cats[category]){
        four.cats[category]={
          systemOrder:[],
          systems:{}
        };
        four.order.push(category);
      }

      i++;
      if(i>=table.length) break;

      /* 系統 & 症状候補抽出フェーズ */
      let systemName='-';
      let symptomCandidates=[];
      let j=i;
      while(j<table.length && !isPatternHeaderRow(table[j]) && !isCategoryRow(table[j])){
        const rr=table[j];
        if(rr[0] && !isTreatmentRow(rr)){
          const token=trimOuter(rr[0]);
          if(token){
            if(systemName==='-'){
              systemName=token;
            }else{
              symptomCandidates.push(token);
            }
          }
        }
        j++;
      }
      /* system init */
      if(!four.cats[category].systems[systemName]){
        four.cats[category].systems[systemName]={
          symptomOrder:[],
          symptoms:{}
        };
        four.cats[category].systemOrder.push(systemName);
      }
      /* register explicit symptoms */
      symptomCandidates.forEach(sc=>{
        if(!four.cats[category].systems[systemName].symptoms[sc]){
          four.cats[category].systems[systemName].symptoms[sc]={
            patternOrder:[],
            patterns:{}
          };
          four.cats[category].systems[systemName].symptomOrder.push(sc);
        }
      });

      /* 次がパターンヘッダでなければスキップ扱い */
      if(j>=table.length){
        i=j; continue;
      }
      if(!isPatternHeaderRow(table[j])){
        i=j; continue;
      }
      /* パターンヘッダ行 */
      const pRow=table[j];
      const patternNames=[];
      for(let col=1; col<pRow.length; col++){
        const name=trimOuter(pRow[col]);
        if(!name) continue;
        patternNames.push(name);
        if(!legacy.cats[category].patterns[name]){
          legacy.cats[category].patterns[name]=[];
          legacy.cats[category].patternOrder.push(name);
        }
        /* 4階層: パターン→症状推定 */
        const symptomInPattern = extractSymptomFromPattern(name);
        const targetSymptom = symptomInPattern || (symptomCandidates[0]||'-');
        if(!four.cats[category].systems[systemName].symptoms[targetSymptom]){
          four.cats[category].systems[systemName].symptoms[targetSymptom]={
            patternOrder:[],
            patterns:{}
          };
          four.cats[category].systems[systemName].symptomOrder.push(targetSymptom);
        }
        if(!four.cats[category].systems[systemName].symptoms[targetSymptom].patterns[name]){
          four.cats[category].systems[systemName].symptoms[targetSymptom].patterns[name]=[];
          four.cats[category].systems[systemName].symptoms[targetSymptom].patternOrder.push(name);
        }
      }
      j++;

      while(j<table.length){
        const r=table[j];
        if(isCategoryRow(r)) break;
        if(isPatternHeaderRow(r)){ j++; continue; }
        if(!isTreatmentRow(r)){ j++; continue; }

        const after=r.slice(1);
        const inter=isInterleavedTreatmentRow(after, patternNames.length);
        if(inter){
          const groups=parseInterleavedRow(after, patternNames);
          groups.forEach(g=>{
            /* legacy push */
            legacy.cats[category].patterns[g.pattern].push({
              label:g.label, rawPoints:g.rawPoints, comment:g.comment
            });

            /* 4層 push: 再度症状推定 (冪等) */
            const symptomInPattern = extractSymptomFromPattern(g.pattern);
            const targetSymptom = symptomInPattern
              || locateSymptomAlreadyContaining(category, systemName, g.pattern)
              || symptomCandidates[0]
              || '-';
            if(!four.cats[category].systems[systemName].symptoms[targetSymptom]){
              four.cats[category].systems[systemName].symptoms[targetSymptom]={
                patternOrder:[],
                patterns:{}
              };
              four.cats[category].systems[systemName].symptomOrder.push(targetSymptom);
            }
            if(!four.cats[category].systems[systemName].symptoms[targetSymptom].patterns[g.pattern]){
              four.cats[category].systems[systemName].symptoms[targetSymptom].patterns[g.pattern]=[];
              four.cats[category].systems[systemName].symptoms[targetSymptom].patternOrder.push(g.pattern);
            }
            four.cats[category].systems[systemName].symptoms[targetSymptom].patterns[g.pattern].push({
              label:g.label, rawPoints:g.rawPoints, comment:g.comment
            });
          });
          j++;
        }else{
          const next=table[j+1]||[];
          const commentRow=isPotentialCommentRow(next)? next:null;

          patternNames.forEach((pName,idx)=>{
            const col=idx+1;
            const cell=r[col]||'';
            if(!cell) return;
            const {label,rawPoints,comment}=dissectTreatmentCell(cell);
            if(!label && !rawPoints) return;

            let finalComment=comment;
            if(!finalComment && commentRow){
              const cc=commentRow[col]||'';
              if(/^[（(]/.test(cc)) finalComment=cc;
            }

            legacy.cats[category].patterns[pName].push({label,rawPoints,comment:finalComment});

            const symptomInPattern=extractSymptomFromPattern(pName);
            const targetSymptom = symptomInPattern
              || locateSymptomAlreadyContaining(category, systemName, pName)
              || symptomCandidates[0]
              || '-';
            if(!four.cats[category].systems[systemName].symptoms[targetSymptom]){
              four.cats[category].systems[systemName].symptoms[targetSymptom]={
                patternOrder:[],
                patterns:{}
              };
              four.cats[category].systems[systemName].symptomOrder.push(targetSymptom);
            }
            if(!four.cats[category].systems[systemName].symptoms[targetSymptom].patterns[pName]){
              four.cats[category].systems[systemName].symptoms[targetSymptom].patterns[pName]=[];
              four.cats[category].systems[systemName].symptoms[targetSymptom].patternOrder.push(pName);
            }
            four.cats[category].systems[systemName].symptoms[targetSymptom].patterns[pName].push({
              label,rawPoints,comment:finalComment
            });
          });
          j+= commentRow?2:1;
        }
      }
      i=j;
      continue;
    }
    i++;
  }

  /* トークン生成 */
  legacy.order.forEach(cat=>{
    legacy.cats[cat].patternOrder.forEach(pn=>{
      legacy.cats[cat].patterns[pn].forEach(g=>{
        if(!g.tokens) g.tokens=parseTreatmentPoints(g.rawPoints);
      });
    });
  });
  four.order.forEach(cat=>{
    const catObj=four.cats[cat];
    catObj.systemOrder.forEach(sys=>{
      const sysObj=catObj.systems[sys];
      sysObj.symptomOrder.forEach(sym=>{
        const symObj=sysObj.symptoms[sym];
        symObj.patternOrder.forEach(pn=>{
          symObj.patterns[pn].forEach(g=>{
            if(!g.tokens) g.tokens=parseTreatmentPoints(g.rawPoints);
          });
        });
      });
    });
  });

  return {legacy,four};
}

/* パターン中から症状候補を抽出 (右側) */
function extractSymptomFromPattern(pattern){
  const idx=pattern.indexOf('→');
  if(idx===-1) return '';
  const right=pattern.slice(idx+1).trim();
  if(!right) return '';
  return right;
}
/* 既にどこかの症状に含まれているかチェック */
function locateSymptomAlreadyContaining(cat, systemName, patternName){
  const sysObj=CLINICAL4?.cats?.[cat]?.systems?.[systemName];
  if(!sysObj) return '';
  for(const sym of sysObj.symptomOrder){
    const symObj=sysObj.symptoms[sym];
    if(symObj.patterns[patternName]) return sym;
  }
  return '';
}

/* ------------ 逆インデックス ------------ */
function rebuildAcuPointPatternIndex(){
  ACUPOINT_PATTERN_INDEX={};
  /* 4階層優先 */
  CLINICAL4.order.forEach(cat=>{
    const catObj=CLINICAL4.cats[cat];
    catObj.systemOrder.forEach(sys=>{
      const sysObj=catObj.systems[sys];
      sysObj.symptomOrder.forEach(sym=>{
        const symObj=sysObj.symptoms[sym];
        symObj.patternOrder.forEach(pat=>{
          const groups=symObj.patterns[pat];
          const seen=new Set();
          groups.forEach(g=>{
            (g.tokens||[]).forEach(tk=>{
              if(!tk||seen.has(tk)) return;
              seen.add(tk);
              if(!ACUPOINT_PATTERN_INDEX[tk]) ACUPOINT_PATTERN_INDEX[tk]=[];
              ACUPOINT_PATTERN_INDEX[tk].push({cat,system:sys,symptom:sym,pattern:pat});
            });
          });
        });
      });
    });
  });
  Object.keys(ACUPOINT_PATTERN_INDEX).forEach(k=>{
    const uniq=new Map();
    ACUPOINT_PATTERN_INDEX[k].forEach(e=>{
      const key=[e.cat,e.system,e.symptom,e.pattern].join('||');
      if(!uniq.has(key)) uniq.set(key,e);
    });
    ACUPOINT_PATTERN_INDEX[k]=Array.from(uniq.values());
  });
}

/* ------------ レイアウト調整 ------------ */
function equalizeTopCards(){
  if(!searchCard||!symptomCard) return;
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

/* ------------ サジェスト ------------ */
function filterPoints(qInput){
  const q=removeAllUnicodeSpaces(qInput);
  if(q.length<MIN_QUERY_LENGTH) return [];
  if(isHiraganaOnly(q)){
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
  const hira=isHiraganaOnly(qRaw)? qRaw:'';
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

/* ------------ Region 内リンク化 ------------ */
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

/* ------------ 経絡画像表示 ------------ */
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

/* ------------ 経穴表示 ------------ */
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
    li.innerHTML=`<a href="#" class="acu-pattern-link" data-cat="${escapeHTML(entry.cat)}" data-system="${escapeHTML(entry.system)}" data-symptom="${escapeHTML(entry.symptom)}" data-pattern="${escapeHTML(entry.pattern)}">${escapeHTML(display)}</a>`;
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

/* ------------ 4階層 UI ユーティリティ ------------ */
function disableDashOptions(selectEl){
  if(!selectEl) return;
  Array.from(selectEl.options).forEach(o=>{
    if(o.value==='-'){
      o.disabled=true;
      o.classList.add('is-system-disabled');
    }else{
      o.classList.remove('is-system-disabled');
    }
  });
}
function resetSelect(selectEl, placeholder='--', disable=true){
  if(!selectEl) return;
  selectEl.innerHTML=`<option value="">${placeholder}</option>`;
  if(disable) selectEl.disabled=true; else selectEl.disabled=false;
}

/* ------------ 4階層 セレクト構築 ------------ */
function populateCategory(){
  resetSelect(categorySelect,'--',false);
  CLINICAL4.order.forEach(cat=>{
    const opt=document.createElement('option');
    opt.value=cat; opt.textContent=cat;
    if(cat==='-'){ opt.disabled=true; opt.classList.add('is-system-disabled'); }
    categorySelect.appendChild(opt);
  });
  disableDashOptions(categorySelect);
}
function populateSystem(cat){
  resetSelect(systemSelect,'--');
  resetSelect(symptomSelect,'--');
  resetSelect(patternSelect,'--');
  if(!cat || !CLINICAL4.cats[cat]) return;
  systemSelect.disabled=false;
  CLINICAL4.cats[cat].systemOrder.forEach(sys=>{
    const opt=document.createElement('option');
    opt.value=sys; opt.textContent=sys;
    if(sys==='-'){ opt.disabled=true; opt.classList.add('is-system-disabled'); }
    systemSelect.appendChild(opt);
  });
  disableDashOptions(systemSelect);
}
function populateSymptom(cat,sys){
  resetSelect(symptomSelect,'--');
  resetSelect(patternSelect,'--');
  if(!cat||!sys||!CLINICAL4.cats[cat]||!CLINICAL4.cats[cat].systems[sys]) return;
  symptomSelect.disabled=false;
  CLINICAL4.cats[cat].systems[sys].symptomOrder.forEach(sym=>{
    const opt=document.createElement('option');
    opt.value=sym; opt.textContent=sym;
    if(sym==='-'){ opt.disabled=true; opt.classList.add('is-system-disabled'); }
    symptomSelect.appendChild(opt);
  });
  disableDashOptions(symptomSelect);
}
function populatePattern(cat,sys,sym){
  resetSelect(patternSelect,'--');
  if(!cat||!sys||!sym) return;
  const symObj=CLINICAL4?.cats?.[cat]?.systems?.[sys]?.symptoms?.[sym];
  if(!symObj) return;
  patternSelect.disabled=false;
  symObj.patternOrder.forEach(pat=>{
    const opt=document.createElement('option');
    opt.value=pat;
    opt.textContent=getDisplayPatternName(pat);
    patternSelect.appendChild(opt);
  });
  disableDashOptions(patternSelect);
}

/* ------------ 4階層 イベント ------------ */
categorySelect.addEventListener('change',()=>{
  const cat=categorySelect.value;
  clinicalResultEl.classList.add('hidden');
  clinicalGroupsEl.innerHTML='';
  populateSystem(cat);
  requestAnimationFrame(equalizeTopCards);
});
systemSelect.addEventListener('change',()=>{
  const cat=categorySelect.value;
  const sys=systemSelect.value;
  clinicalResultEl.classList.add('hidden');
  clinicalGroupsEl.innerHTML='';
  populateSymptom(cat,sys);
  requestAnimationFrame(equalizeTopCards);
});
symptomSelect.addEventListener('change',()=>{
  const cat=categorySelect.value;
  const sys=systemSelect.value;
  const sym=symptomSelect.value;
  clinicalResultEl.classList.add('hidden');
  clinicalGroupsEl.innerHTML='';
  populatePattern(cat,sys,sym);
  requestAnimationFrame(equalizeTopCards);
});
patternSelect.addEventListener('change',()=>{
  try{
    hideHomeGallery();
    const cat=categorySelect.value;
    const sys=systemSelect.value;
    const sym=symptomSelect.value;
    const pat=patternSelect.value;
    clinicalResultEl.classList.add('hidden');
    clinicalGroupsEl.innerHTML='';
    if(!cat||!sys||!sym||!pat) { requestAnimationFrame(equalizeTopCards); return; }
    const symObj=CLINICAL4?.cats?.[cat]?.systems?.[sys]?.symptoms?.[sym];
    const groups = symObj?.patterns?.[pat];
    if(!groups){ requestAnimationFrame(equalizeTopCards); return; }

    const span=clinicalTitleEl?.querySelector('.pattern-name-highlight');
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
      pushState({type:'pattern',cat,system:sys,symptom:sym,pattern:pat});
    }
  }catch(err){
    console.error('[patternSelect change] error',err);
    clinicalStatusEl.textContent='臨床CSV: 表示処理エラー '+err.message;
  }finally{
    requestAnimationFrame(equalizeTopCards);
  }
});

/* ------------ リンクイベント (関連病証クリック) ------------ */
document.addEventListener('click', e=>{
  const a=e.target.closest('.acu-pattern-link');
  if(!a) return;
  e.preventDefault();
  const cat=a.dataset.cat;
  const sys=a.dataset.system;
  const sym=a.dataset.symptom;
  const pat=a.dataset.pattern;
  if(!CLINICAL4.cats[cat]) return;
  categorySelect.value=cat;
  categorySelect.dispatchEvent(new Event('change'));
  systemSelect.value=sys;
  systemSelect.dispatchEvent(new Event('change'));
  symptomSelect.value=sym;
  symptomSelect.dispatchEvent(new Event('change'));
  patternSelect.value=pat;
  patternSelect.dispatchEvent(new Event('change'));
});

/* ------------ Home 遷移 ------------ */
function resetUISelections(){
  categorySelect.value='';
  resetSelect(systemSelect,'--');
  resetSelect(symptomSelect,'--');
  resetSelect(patternSelect,'--');
  populateCategory(); /* 再構築 */
  disableDashOptions(categorySelect);
}
function goHome(suppressHistory=false){
  inputEl.value='';
  clearSuggestions();
  inlineAcupointResult.classList.add('hidden');
  hideMeridianImage();
  resetUISelections();
  clinicalGroupsEl.innerHTML='';
  clinicalResultEl.classList.add('hidden');
  const span=clinicalTitleEl?.querySelector('.pattern-name-highlight');
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

/* ------------ ナビキー ------------ */
backBtn.addEventListener('click',goBack);
forwardBtn.addEventListener('click',goForward);
document.addEventListener('keydown', e=>{
  if(e.altKey && !e.metaKey && !e.shiftKey && !e.ctrlKey){
    if(e.key==='ArrowLeft') goBack();
    else if(e.key==='ArrowRight') goForward();
  }
});

/* ------------ 検索 ------------ */
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
    /* keydown で処理するので無視 */
    return;
  }
  if(!DATA_READY) return;
  const val=inputEl.value;
  if(removeAllUnicodeSpaces(val).length<MIN_QUERY_LENGTH){
    clearSuggestions(); return;
  }
  renderSuggestions(filterPoints(val));
});
inputEl.addEventListener('keydown', e=>{
  if(['ArrowDown','ArrowUp','Enter','Escape'].includes(e.key)){
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

    const parsed=parseClinicalCSV(text);
    CLINICAL_DATA = parsed.legacy;
    CLINICAL4      = parsed.four;

    CLINICAL_READY=true;
    populateCategory();
    rebuildAcuPointPatternIndex();
    clinicalStatusEl.textContent=`臨床CSV: ${CLINICAL4.order.length}分類`;
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

/* NOTE: [[ ]] MutationObserver fallback 不要 */
