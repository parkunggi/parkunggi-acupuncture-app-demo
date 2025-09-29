/******************************************************
 * 4段階選択拡張版 app.js
 * 分類 / 系統 / 症状 / 病証
 * APP_VERSION: 20250929-CLASS-SYSTEM-SYMPTOM-PATTERN
 *
 * 仕様:
 *  - 「病証名」行を基点に 3行上=分類, 2行上=系統, その間の番号付き行が症状
 *  - パターン名: "【...】→症状名" の右側（→以降）で症状紐付け
 *  - 症状行に存在しない症状でも、パターン側に現れれば症状selectに追加
 *  - 系統が "-" の場合は選択不可 (disabled)
 *  - 既存: 経穴検索, サジェスト, 履歴, 経絡画像, 関連病証リンクは維持
 ******************************************************/

const APP_VERSION = '20250929-CLASS-SYSTEM-SYMPTOM-PATTERN';

const CSV_FILE = '経穴・経絡.csv';
const CLINICAL_CSV_FILE = '東洋臨床論.csv';
const CSV_PATH = encodeURI(CSV_FILE);
const CLINICAL_CSV_PATH = encodeURI(CLINICAL_CSV_FILE);

const MIN_QUERY_LENGTH = 1;
const EXPECTED_TOTAL = 361;

const READINGS   = window.ACU_READINGS   || {};
const MUSCLE_MAP = window.ACU_MUSCLE_MAP || {};

/* ---------- 状態 ---------- */
let ACUPOINTS = [];
let ACUPOINT_NAME_LIST = [];
let ACUPOINT_NAME_SET  = new Set();

let DATA_READY = false;
let CLINICAL_READY = false;

/*
CLINICAL4:
{
  order:[classification1,...],
  cls:{
    classification1:{
      systemOrder:[system1,...],
      systems:{
        system1:{
          symptomOrder:[symptom1,...],
          symptoms:{
            symptom1:{
              patternOrder:[pattern1,...],
              patterns:{
                pattern1:[ {label,rawPoints,comment,tokens[]} ... ]
              }
            }
          }
        }
      }
    }
  }
}
*/
let CLINICAL4 = { order:[], cls:{} };

let ACUPOINT_PATTERN_INDEX = {}; // pointName -> [{classification,system,symptom,pattern}]

/* 履歴 */
let historyStack = [];
let historyIndex = -1;
let IS_APPLYING_HISTORY = false;
let patternHistory = [];
let pointHistory   = [];
const HISTORY_LIMIT = 300;

/* ---------- DOM ---------- */
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

/* 4段階セレクト */
const classificationSelect = document.getElementById('clinical-classification-select');
const systemSelect         = document.getElementById('clinical-system-select');
const symptomSelect        = document.getElementById('clinical-category-select'); // 旧カテゴリ→症状
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

/* Home ギャラリー要素 */
const homeGallerySection = document.getElementById('home-gallery-section');
const homeGallerySelect  = document.getElementById('home-gallery-select');
const homeGalleryImage   = document.getElementById('home-gallery-image');
const homeGalleryFallback= document.getElementById('home-gallery-fallback');

const HOME_GALLERY_IMAGES = [
  { file: '十四経経脈経穴図_1.前面.jpeg',        label: '① 前面' },
  { file: '十四経経脈経穴図_2.後面.jpeg',        label: '② 後面' },
  { file: '十四経経脈経穴図_3.後面(骨格).jpeg',  label: '③ 後面 (骨格)' },
  { file: '十四経経脈経穴図_4.側面(筋肉).jpeg',  label: '④ 側面 (筋肉)' }
];
const HOME_GALLERY_LS_KEY = 'homeGallery.lastFile';

/* ---------- Home ギャラリー ---------- */
function initHomeGallery(){
  if(!homeGallerySelect) return;
  homeGallerySelect.innerHTML='';
  let initialIdx=0;
  try{
    const saved=localStorage.getItem(HOME_GALLERY_LS_KEY);
    if(saved){
      const idx=HOME_GALLERY_IMAGES.findIndex(i=>i.file===saved);
      if(idx>=0) initialIdx=idx;
    }
  }catch(_){}
  HOME_GALLERY_IMAGES.forEach((img,i)=>{
    const opt=document.createElement('option');
    opt.value=img.file;
    opt.textContent=img.label;
    if(i===initialIdx) opt.selected=true;
    homeGallerySelect.appendChild(opt);
  });
  updateHomeGalleryImage(HOME_GALLERY_IMAGES[initialIdx].file,false);
}
function updateHomeGalleryImage(file,store=true){
  if(!homeGalleryImage) return;
  const url='image/'+encodeURI(file)+'?v='+APP_VERSION;
  homeGalleryFallback.classList.add('hidden');
  homeGalleryImage.classList.remove('hidden');
  homeGalleryImage.alt=file.replace(/\.(jpeg|jpg|png)$/i,'');
  homeGalleryImage.onerror=()=>{
    homeGalleryImage.classList.add('hidden');
    homeGalleryFallback.classList.remove('hidden');
  };
  homeGalleryImage.src=url;
  if(store){
    try{ localStorage.setItem(HOME_GALLERY_LS_KEY,file);}catch(_){}
  }
}
if(homeGallerySelect){
  homeGallerySelect.addEventListener('change',()=>updateHomeGalleryImage(homeGallerySelect.value,true));
}
function showHomeGallery(){ homeGallerySection?.classList.remove('hidden'); }
function hideHomeGallery(){ homeGallerySection?.classList.add('hidden'); }

/* ---------- Utility ---------- */
function isShown(el){ return el && !el.classList.contains('hidden'); }
function normalizeNFC(s){ return s? s.normalize('NFC'):''; }
function removeAllUnicodeSpaces(str){
  return normalizeNFC(str||'')
    .replace(/[\u0000-\u001F\u007F]/g,'')
    .replace(/[ \u00A0\u1680\u2000-\u200B\u202F\u205F\u3000]/g,'')
    .replace(/\uFEFF/g,'');
}
function trimOuter(s){ return (s||'').trim(); }
function isHiraganaOnly(s){ return !!s && /^[\u3041-\u3096]+$/.test(s); }
function isSpace(ch){ return /[ \u00A0\u1680\u2000-\u200B\u202F\u205F\u3000]/.test(ch); }
function escapeHTML(s){
  return (s||'').replace(/[&<>"']/g,c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}
function applyRedMarkup(text){
  if(!text) return '';
  if(text.includes('bui-red')) return text;
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

/* ---------- 履歴 ---------- */
function statesEqual(a,b){
  if(!a||!b) return false;
  if(a.type!==b.type) return false;
  if(a.type==='home') return true;
  if(a.type==='point'||a.type==='unknownPoint') return a.name===b.name;
  if(a.type==='pattern')
    return a.classification===b.classification &&
           a.system===b.system &&
           a.symptom===b.symptom &&
           a.pattern===b.pattern;
  return false;
}
function updateNavButtons(){
  backBtn.disabled=(historyIndex<=0);
  forwardBtn.disabled=(historyIndex<0||historyIndex>=historyStack.length-1);
}
function updateHistoryBadge(){
  if(patternHistoryBtn) patternHistoryBtn.dataset.count=patternHistory.length;
  if(pointHistoryBtn)   pointHistoryBtn.dataset.count=pointHistory.length;
}
function pushState(state,replace=false){
  if(IS_APPLYING_HISTORY) return;
  const prev=historyStack[historyIndex]||null;
  state.showPoint   = state.showPoint!==undefined? state.showPoint : isShown(inlineAcupointResult);
  state.showPattern = state.showPattern!==undefined? state.showPattern : isShown(clinicalResultEl);

  if(state.type==='home'){ state.showPoint=false; state.showPattern=false; }
  else if(state.type==='point'||state.type==='unknownPoint'){ state.showPoint=true; }
  else if(state.type==='pattern'){ state.showPattern=true; }

  if(prev){
    if(state.type==='pattern' && prev.showPoint) state.showPoint=true;
    if((state.type==='point'||state.type==='unknownPoint') && prev.showPattern) state.showPattern=true;
  }

  if(historyIndex>=0 && statesEqual(historyStack[historyIndex],state)){
    Object.assign(historyStack[historyIndex],{showPoint:state.showPoint,showPattern:state.showPattern});
  }else{
    if(replace){
      if(historyIndex>=0) historyStack[historyIndex]=state; else { historyStack.push(state); historyIndex=0; }
    }else{
      if(historyIndex < historyStack.length-1) historyStack=historyStack.slice(0,historyIndex+1);
      state.ts=Date.now(); historyStack.push(state); historyIndex=historyStack.length-1;
    }
    if(state.type==='pattern'){
      patternHistory.push({ref:state,idx:historyIndex,ts:state.ts});
      if(patternHistory.length>HISTORY_LIMIT) patternHistory.shift();
    }else if(state.type==='point'||state.type==='unknownPoint'){
      pointHistory.push({ref:state,idx:historyIndex,ts:state.ts});
      if(pointHistory.length>HISTORY_LIMIT) pointHistory.shift();
    }
  }
  updateHistoryBadge(); updateNavButtons();
}
function applyState(st){
  IS_APPLYING_HISTORY=true;
  try{
    if(st.type==='home'){
      goHome(true);
    }else if(st.type==='point'){
      const p=ACUPOINTS.find(x=>x.name===st.name);
      p? showPointDetail(p,true): showUnknownPoint(st.name,true);
    }else if(st.type==='unknownPoint'){
      showUnknownPoint(st.name,true);
    }else if(st.type==='pattern' && CLINICAL_READY){
      classificationSelect.value=st.classification||'';
      classificationSelect.dispatchEvent(new Event('change'));
      systemSelect.value=st.system||'';
      systemSelect.dispatchEvent(new Event('change'));
      symptomSelect.value=st.symptom||'';
      symptomSelect.dispatchEvent(new Event('change'));
      patternSelect.value=st.pattern||'';
      patternSelect.dispatchEvent(new Event('change'));
    }
    if(st.showPoint) inlineAcupointResult.classList.remove('hidden');
    else { inlineAcupointResult.classList.add('hidden'); hideMeridianImage(); }
    if(st.showPattern) clinicalResultEl.classList.remove('hidden');
    else clinicalResultEl.classList.add('hidden');
  } finally {
    IS_APPLYING_HISTORY=false;
    updateNavButtons();
  }
}
function goBack(){ if(historyIndex>0){ historyIndex--; applyState(historyStack[historyIndex]); } }
function goForward(){ if(historyIndex < historyStack.length-1){ historyIndex++; applyState(historyStack[historyIndex]); } }

/* ---------- CSV: 経穴 ---------- */
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
      if(ch===',' && !inQ){ out.push(cur); cur=''; }
      else cur+=ch;
    }
    out.push(cur);
    return out.map(c=>c.trim());
  }
  const results=[];
  for(const ln of lines){
    if(/^[0-9０-９]+\./.test(ln.trim())) continue;
    const cols=splitLine(ln);
    if(!cols.length) continue;
    if(cols[0]==='経絡' && cols[1]==='経穴') continue;
    if(cols.length<2) continue;
    const mer=trimOuter(cols[0]);
    const name=trimOuter(cols[1]);
    if(!mer||!name) continue;
    results.push({
      name,
      reading:READINGS[name]||'',
      meridian:mer,
      region:cols[2]?cols[2].trim():'',
      regionRaw:cols[2]?cols[2].trim():'',
      important:cols[3]?cols[3].trim():'',
      muscle:MUSCLE_MAP[name]||''
    });
  }
  return results;
}

/* ---------- CSV: 臨床 4段階 (行相対解析) ---------- */
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
    if(ch===',' && !inQ){ cols.push(cur); cur=''; }
    else cur+=ch;
  }
  cols.push(cur);
  return cols.map(c=>c.replace(/\uFEFF/g,'').trim());
}
function isPatternHeaderRow(cols){
  if(!cols.length) return false;
  return /病証名/.test(cols[0].replace(/\s+/g,''));
}
function dissectTreatmentCell(cell){
  if(!cell) return {label:'',rawPoints:'',comment:''};
  const lines=cell.split(/\n+/).map(l=>l.trim()).filter(Boolean);
  let comment='';
  if(lines.length && /^[（(]/.test(lines[lines.length-1])) comment=lines.pop();
  let main=lines.join(' ')||cell;
  const tail=main.match(/([（(].*?[）)])\s*$/);
  if(tail){
    if(!comment) comment=tail[1];
    main=main.slice(0,tail.index).trim();
  }
  let label='',rawPoints='';
  const p1=main.indexOf('：'); const p2=main.indexOf(':');
  let sep=-1;
  if(p1>=0 && p2>=0) sep=Math.min(p1,p2);
  else sep=p1>=0? p1:p2;
  if(sep>=0){ label=main.slice(0,sep).trim(); rawPoints=main.slice(sep+1).trim(); }
  else label=main.trim();
  return {label,rawPoints,comment};
}
function parseTreatmentPoints(raw){
  if(!raw) return [];
  return raw
    .replace(/（[^）]*）/g,'')
    .replace(/\([^)]*\)/g,'')
    .replace(/\r?\n/g,'/')
    .replace(/[，、＋+･・／]/g,'/')
    .split('/')
    .map(s=>removeAllUnicodeSpaces(s).trim())
    .filter(Boolean)
    .map(s=>s.replace(/[。.,、，;；/]+$/,''))
    .filter(s=>!/^[-・＋+*＊※/／]+$/.test(s));
}
function extractSymptomFromPattern(p){
  const idx=p.indexOf('→');
  if(idx===-1) return '';
  return p.slice(idx+1).trim();
}

function parseClinicalCSV(raw){
  const logical=rebuildLogicalRows(raw);
  const table=logical.map(parseCSVLogicalRow);

  const data={order:[],cls:{}};

  for(let i=0;i<table.length;i++){
    const row=table[i];
    if(!isPatternHeaderRow(row)) continue;

    /* 行位置決定 */
    const headerIndex=i;
    const classificationRowIndex=headerIndex - 3;
    const systemRowIndex=headerIndex - 2;
    const symptomsStartIndex=systemRowIndex + 1;
    const classification = classificationRowIndex>=0 ? trimOuter(table[classificationRowIndex][0]||'') : '';
    const systemRaw = systemRowIndex>=0 ? trimOuter(table[systemRowIndex][0]||'') : '';
    let system = systemRaw || '-';

    if(!classification) continue;

    if(!data.cls[classification]){
      data.cls[classification]={ systemOrder:[], systems:{} };
      data.order.push(classification);
    }
    if(!data.cls[classification].systems[system]){
      data.cls[classification].systems[system]={ symptomOrder:[], symptoms:{} };
      data.cls[classification].systemOrder.push(system);
    }

    /* 症状行 (classificationとsystem行の間の番号行) */
    for(let r=symptomsStartIndex; r<headerIndex; r++){
      const sr=table[r];
      if(!sr || !sr.length) continue;
      const first=sr[0];
      if(/^[0-9０-９]+\.?/.test(removeAllUnicodeSpaces(first))){
        const symptom=trimOuter(first);
        if(symptom && !data.cls[classification].systems[system].symptoms[symptom]){
          data.cls[classification].systems[system].symptoms[symptom]={
            patternOrder:[], patterns:{}
          };
          data.cls[classification].systems[system].symptomOrder.push(symptom);
        }
      }
    }

    /* パターン列名取得 */
    const patternNames=[];
    for(let c=1;c<row.length;c++){
      const name=trimOuter(row[c]);
      if(!name) continue;
      patternNames.push(name);
    }

    /* 次以降の治療方針行を処理 */
    let j=headerIndex+1;
    while(j<table.length){
      const r=table[j];
      if(!r || !r.length){
        j++; continue;
      }
      if(isPatternHeaderRow(r)) break; // 次のブロック開始
      // 「治療方針」タグ行判定
      if(/治療方針/.test(r[0])){
        /* 1行構造: patternNames に対応する列 */
        patternNames.forEach((pName,idx)=>{
          const col=idx+1;
          const cell=r[col]||'';
          if(!cell) return;
          const {label,rawPoints,comment}=dissectTreatmentCell(cell);
          if(!label && !rawPoints) return;
          let symptom=extractSymptomFromPattern(pName);
          if(!symptom) {
            // fallback: 最初の症状 (存在すれば)
            symptom=data.cls[classification].systems[system].symptomOrder[0] || '(未定義)';
          }
          // 症状存在保証
            if(!data.cls[classification].systems[system].symptoms[symptom]){
            data.cls[classification].systems[system].symptoms[symptom]={
              patternOrder:[], patterns:{}
            };
            data.cls[classification].systems[system].symptomOrder.push(symptom);
          }
          const symObj=data.cls[classification].systems[system].symptoms[symptom];
          if(!symObj.patterns[pName]){
            symObj.patterns[pName]=[];
            symObj.patternOrder.push(pName);
          }
          symObj.patterns[pName].push({
            label,rawPoints,comment,tokens:parseTreatmentPoints(rawPoints)
          });
        });
      }
      j++;
      // 次の分類開始を検出（3行先の pattern header 用に安全策: classification行形式）
      // 単純化: 次の "病証名" 行 or EOF で抜ける
    }
  }
  return data;
}

/* ---------- 逆インデックス ---------- */
function rebuildAcuPointPatternIndex(){
  ACUPOINT_PATTERN_INDEX={};
  CLINICAL4.order.forEach(cl=>{
    const cObj=CLINICAL4.cls[cl];
    cObj.systemOrder.forEach(sys=>{
      const sObj=cObj.systems[sys];
      sObj.symptomOrder.forEach(sym=>{
        const symObj=sObj.symptoms[sym];
        symObj.patternOrder.forEach(pn=>{
          symObj.patterns[pn].forEach(group=>{
            (group.tokens||[]).forEach(tk=>{
              if(!tk) return;
              if(!ACUPOINT_PATTERN_INDEX[tk]) ACUPOINT_PATTERN_INDEX[tk]=[];
              ACUPOINT_PATTERN_INDEX[tk].push({classification:cl,system:sys,symptom:sym,pattern:pn});
            });
          });
        });
      });
    });
  });
  // 重複排除
  Object.keys(ACUPOINT_PATTERN_INDEX).forEach(k=>{
    const uniq=new Map();
    ACUPOINT_PATTERN_INDEX[k].forEach(e=>{
      const key=[e.classification,e.system,e.symptom,e.pattern].join('||');
      if(!uniq.has(key)) uniq.set(key,e);
    });
    ACUPOINT_PATTERN_INDEX[k]=[...uniq.values()];
  });
}

/* ---------- レイアウト高さ同期 ---------- */
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
window.addEventListener('resize',equalizeTopCards);

/* ---------- サジェスト ---------- */
function filterPoints(qInput){
  const q=removeAllUnicodeSpaces(qInput);
  if(q.length<MIN_QUERY_LENGTH) return [];
  if(isHiraganaOnly(q)){
    let list=ACUPOINTS.filter(p=>p.reading && p.reading.startsWith(q));
    if(!list.length) list=ACUPOINTS.filter(p=>p.reading && p.reading.includes(q));
    return list;
  }
  const seen=new Set(); const nm=[];
  ACUPOINTS.forEach(p=>{ if(p.name.includes(q)){ nm.push(p); seen.add(p.name);} });
  ACUPOINTS.forEach(p=>{ if(!seen.has(p.name) && p.muscle && p.muscle.includes(q)){ nm.push(p); seen.add(p.name);} });
  return nm;
}
function clearSuggestions(){
  suggestionListEl.innerHTML='';
  suggestionListEl.classList.add('hidden');
  inputEl.setAttribute('aria-expanded','false');
  requestAnimationFrame(equalizeTopCards);
}
function setActive(items,idx){
  items.forEach(li=>{ li.classList.remove('active'); li.setAttribute('aria-selected','false'); });
  if(items[idx]){
    items[idx].classList.add('active');
    items[idx].setAttribute('aria-selected','true');
    items[idx].scrollIntoView({block:'nearest'});
  }
}
function renderSuggestions(list){
  suggestionListEl.innerHTML='';
  const hira=isHiraganaOnly(removeAllUnicodeSpaces(inputEl.value))? removeAllUnicodeSpaces(inputEl.value):'';
  const rx=hira? new RegExp(hira.replace(/([.*+?^=!:${}()|[\\]\\])/g,'\\$1'),'g'):null;
  list.slice(0,120).forEach((p,i)=>{
    const li=document.createElement('li');
    li.dataset.id=p.name;
    li.setAttribute('role','option');
    li.setAttribute('aria-selected',i===0?'true':'false');
    let readingHTML=escapeHTML(p.reading||'');
    if(rx && p.reading) readingHTML=readingHTML.replace(rx,m=>`<mark>${m}</mark>`);
    li.innerHTML=`
      <span class="sug-name${p.important?' important':''}">${escapeHTML(p.name)}</span>
      <span class="sug-slash">/</span>
      <span class="sug-reading">${readingHTML}</span>
      <span class="sug-badges">${p.important?'<span class="badge badge-important" title="要穴">★</span>':''}</span>`;
    if(i===0) li.classList.add('active');
    li.addEventListener('click',()=>selectPoint(p));
    suggestionListEl.appendChild(li);
  });
  if(!list.length){
    const li=document.createElement('li');
    li.textContent='該当なし';
    li.setAttribute('role','option');
    li.setAttribute('aria-selected','false');
    suggestionListEl.appendChild(li);
  }
  suggestionListEl.classList.remove('hidden');
  inputEl.setAttribute('aria-expanded','true');
  requestAnimationFrame(equalizeTopCards);
}
function handleSuggestionKeyboard(e){
  const items=[...suggestionListEl.querySelectorAll('li')];
  if(!items.length) return;
  let cur=items.findIndex(li=>li.classList.contains('active'));
  if(e.key==='ArrowDown'){
    e.preventDefault(); cur=(cur+1)%items.length; setActive(items,cur);
  }else if(e.key==='ArrowUp'){
    e.preventDefault(); cur=(cur-1+items.length)%items.length; setActive(items,cur);
  }else if(e.key==='Enter'){
    e.preventDefault();
    const act=items[cur>=0?cur:0];
    if(act && act.dataset.id){
      const p=ACUPOINTS.find(x=>x.name===act.dataset.id);
      if(p) selectPoint(p);
    }
  }else if(e.key==='Escape'){
    clearSuggestions();
  }
}

/* ---------- Regionリンク化 (簡易) ---------- */
function linkifyRegionAcupoints(html){
  if(!html || !ACUPOINT_NAME_LIST.length) return html;
  const frag=document.createElement('div');
  frag.innerHTML=html;
  function walk(node){
    if(node.nodeType===3){
      let text=node.nodeValue;
      if(!text.trim()) return;
      const parent=node.parentNode;
      let idx=0;
      while(idx<text.length){
        let matched=null;
        for(const name of ACUPOINT_NAME_LIST){
          if(text.startsWith(name,idx)){ matched=name; break; }
        }
        if(matched){
          const before=text.slice(0,idx);
          const after=text.slice(idx+matched.length);
          if(before) parent.insertBefore(document.createTextNode(before),node);
          const a=document.createElement('a');
          a.href='#'; a.className='treat-point-link'; a.dataset.point=matched; a.textContent=matched;
          parent.insertBefore(a,node);
          text=after; idx=0;
        }else{
          idx++;
        }
      }
      node.nodeValue=text;
    }else if(node.nodeType===1 && node.tagName.toLowerCase()!=='a'){
      [...node.childNodes].forEach(walk);
    }
  }
  [...frag.childNodes].forEach(walk);
  return frag.innerHTML;
}

/* ---------- 経絡画像 ---------- */
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
  if(!meridian){ hideMeridianImage(); return; }
  const url='image/'+encodeURI(meridian+'.png')+'?v='+APP_VERSION;
  meridianImageEl.onload=()=>meridianImageSection.classList.remove('hidden');
  meridianImageEl.onerror=()=>hideMeridianImage();
  meridianImageEl.alt=meridian;
  meridianImageEl.src=url;
}

/* ---------- 経穴表示 ---------- */
function showPointDetail(p,suppress=false){
  hideHomeGallery();
  let regionHTML=p.region||'';
  if(regionHTML.includes('[[')) regionHTML=applyRedMarkup(p.regionRaw||regionHTML);
  regionHTML=linkifyRegionAcupoints(regionHTML);
  resultNameEl.textContent=`${p.name}${p.reading?` (${p.reading})`:''}`;
  resultNameEl.classList.toggle('is-important',!!p.important);
  resultMeridianEl.textContent=p.meridian||'（経絡未登録）';
  resultRegionEl.innerHTML=regionHTML||'（部位未登録）';
  if(p.important) resultImportantEl.innerHTML=`<span class="acu-important-flag">${escapeHTML(p.important)}</span>`;
  else resultImportantEl.textContent='-';
  if(resultMuscleEl) resultMuscleEl.textContent=p.muscle||'（筋肉未登録）';
  renderRelatedPatterns(p.name);
  inlineAcupointResult.classList.remove('hidden');
  updateMeridianImage(p.meridian||'');
  if(!suppress && !IS_APPLYING_HISTORY) pushState({type:'point',name:p.name});
  requestAnimationFrame(equalizeTopCards);
}
function renderRelatedPatterns(pointName){
  relatedSymptomsEl.innerHTML='';
  if(!CLINICAL_READY || !ACUPOINT_PATTERN_INDEX[pointName] || !ACUPOINT_PATTERN_INDEX[pointName].length){
    relatedSymptomsEl.innerHTML='<li>-</li>'; return;
  }
  ACUPOINT_PATTERN_INDEX[pointName].forEach(entry=>{
    const label=getDisplayPatternName(entry.pattern);
    const li=document.createElement('li');
    li.innerHTML=`<a href="#" class="acu-pattern-link" data-class="${escapeHTML(entry.classification)}" data-system="${escapeHTML(entry.system)}" data-symptom="${escapeHTML(entry.symptom)}" data-pattern="${escapeHTML(entry.pattern)}">${escapeHTML(label)}</a>`;
    relatedSymptomsEl.appendChild(li);
  });
}
function showUnknownPoint(name,suppress=false){
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
  if(!suppress && !IS_APPLYING_HISTORY) pushState({type:'unknownPoint',name});
  requestAnimationFrame(equalizeTopCards);
}
function selectPoint(p){
  clearSuggestions();
  inputEl.value=p.name;
  showPointDetail(p);
}

/* ---------- 4段階 select utility ---------- */
function resetSelect(sel,ph='--',dis=true){
  if(!sel) return;
  sel.innerHTML=`<option value="">${ph}</option>`;
  sel.disabled=dis;
}
function disableDashOption(sel){
  if(!sel) return;
  [...sel.options].forEach(o=>{
    if(o.value==='-'){
      o.disabled=true;
      o.classList.add('is-system-disabled');
    }
  });
}

/* ---------- populate ---------- */
function populateClassification(){
  resetSelect(classificationSelect,'--',false);
  CLINICAL4.order.forEach(cl=>{
    const opt=document.createElement('option');
    opt.value=cl; opt.textContent=cl;
    classificationSelect.appendChild(opt);
  });
  disableDashOption(classificationSelect);
}
function populateSystem(cl){
  resetSelect(systemSelect,'--');
  resetSelect(symptomSelect,'--');
  resetSelect(patternSelect,'--');
  if(!cl||!CLINICAL4.cls[cl]) return;
  systemSelect.disabled=false;
  CLINICAL4.cls[cl].systemOrder.forEach(sys=>{
    const opt=document.createElement('option');
    opt.value=sys; opt.textContent=sys;
    systemSelect.appendChild(opt);
  });
  disableDashOption(systemSelect);
}
function populateSymptom(cl,sys){
  resetSelect(symptomSelect,'--');
  resetSelect(patternSelect,'--');
  if(!cl||!sys) return;
  const sysObj=CLINICAL4.cls[cl]?.systems[sys];
  if(!sysObj) return;
  symptomSelect.disabled=false;
  sysObj.symptomOrder.forEach(sym=>{
    const opt=document.createElement('option');
    opt.value=sym; opt.textContent=sym;
    symptomSelect.appendChild(opt);
  });
  disableDashOption(symptomSelect);
}
function populatePattern(cl,sys,sym){
  resetSelect(patternSelect,'--');
  if(!cl||!sys||!sym) return;
  const symObj=CLINICAL4.cls[cl]?.systems[sys]?.symptoms[sym];
  if(!symObj) return;
  patternSelect.disabled=false;
  symObj.patternOrder.forEach(pn=>{
    const opt=document.createElement('option');
    opt.value=pn; opt.textContent=getDisplayPatternName(pn);
    patternSelect.appendChild(opt);
  });
  disableDashOption(patternSelect);
}

/* ---------- events: 4段階 ---------- */
classificationSelect.addEventListener('change',()=>{
  populateSystem(classificationSelect.value);
  clinicalResultEl.classList.add('hidden');
  clinicalGroupsEl.innerHTML='';
  requestAnimationFrame(equalizeTopCards);
});
systemSelect.addEventListener('change',()=>{
  populateSymptom(classificationSelect.value,systemSelect.value);
  clinicalResultEl.classList.add('hidden');
  clinicalGroupsEl.innerHTML='';
  requestAnimationFrame(equalizeTopCards);
});
symptomSelect.addEventListener('change',()=>{
  populatePattern(classificationSelect.value,systemSelect.value,symptomSelect.value);
  clinicalResultEl.classList.add('hidden');
  clinicalGroupsEl.innerHTML='';
  requestAnimationFrame(equalizeTopCards);
});
patternSelect.addEventListener('change',()=>{
  const cl=classificationSelect.value;
  const sys=systemSelect.value;
  const sym=symptomSelect.value;
  const pat=patternSelect.value;
  clinicalGroupsEl.innerHTML='';
  clinicalResultEl.classList.add('hidden');
  if(!cl||!sys||!sym||!pat) return;
  const groups=CLINICAL4.cls[cl]?.systems[sys]?.symptoms[sym]?.patterns[pat];
  if(!groups) return;
  const span=clinicalTitleEl?.querySelector('.pattern-name-highlight');
  if(span) span.textContent=getDisplayPatternName(pat);
  groups.forEach(g=>{
    const pointsHtml=buildPointsHTML(g.rawPoints,g.tokens);
    const comment=g.comment? ensureCommentParens(g.comment):'';
    const div=document.createElement('div');
    div.className='treat-line';
    div.innerHTML=`
      <p class="treat-main">${escapeHTML(g.label)}：${pointsHtml}</p>
      ${comment?`<p class="treat-comment">${escapeHTML(comment)}</p>`:''}`;
    clinicalGroupsEl.appendChild(div);
  });
  clinicalResultEl.classList.remove('hidden');
  clinicalGroupsEl.querySelectorAll('.treat-point-link').forEach(a=>{
    a.addEventListener('click',e=>{
      e.preventDefault();
      const nm=a.dataset.point;
      const p=findAcupointByToken(nm);
      p? showPointDetail(p): showUnknownPoint(nm);
    });
  });
  if(!IS_APPLYING_HISTORY){
    pushState({type:'pattern',classification:cl,system:sys,symptom:sym,pattern:pat});
  }
  requestAnimationFrame(equalizeTopCards);
});

/* ---------- 関連病証リンク ---------- */
document.addEventListener('click',e=>{
  const a=e.target.closest('.acu-pattern-link');
  if(!a) return;
  e.preventDefault();
  const cl=a.dataset.class;
  const sys=a.dataset.system;
  const sym=a.dataset.symptom;
  const pat=a.dataset.pattern;
  classificationSelect.value=cl;
  classificationSelect.dispatchEvent(new Event('change'));
  systemSelect.value=sys;
  systemSelect.dispatchEvent(new Event('change'));
  symptomSelect.value=sym;
  symptomSelect.dispatchEvent(new Event('change'));
  patternSelect.value=pat;
  patternSelect.dispatchEvent(new Event('change'));
});

/* ---------- Home ---------- */
function resetUISelections(){
  classificationSelect.value='';
  resetSelect(systemSelect,'--');
  resetSelect(symptomSelect,'--');
  resetSelect(patternSelect,'--');
  populateClassification();
}
function goHome(suppress=false){
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
  if(!suppress && !IS_APPLYING_HISTORY) pushState({type:'home'});
}
homeBtn.addEventListener('click',()=>goHome());

/* ---------- ナビ ---------- */
backBtn.addEventListener('click',goBack);
forwardBtn.addEventListener('click',goForward);
document.addEventListener('keydown',e=>{
  if(e.altKey && !e.metaKey && !e.shiftKey && !e.ctrlKey){
    if(e.key==='ArrowLeft') goBack();
    else if(e.key==='ArrowRight') goForward();
  }
});

/* ---------- 検索イベント ---------- */
function runSearch(){
  if(!DATA_READY) return;
  const q=removeAllUnicodeSpaces(inputEl.value);
  if(!q){ clearSuggestions(); return; }
  const exact=ACUPOINTS.find(p=>p.name===q);
  if(exact){ selectPoint(exact); return; }
  const list=filterPoints(q);
  if(list.length===1) selectPoint(list[0]); else renderSuggestions(list);
}
inputEl.addEventListener('keyup',e=>{
  if(['ArrowDown','ArrowUp','Enter','Escape'].includes(e.key)) return;
  if(!DATA_READY) return;
  const val=inputEl.value;
  if(removeAllUnicodeSpaces(val).length<MIN_QUERY_LENGTH){
    clearSuggestions(); return;
  }
  renderSuggestions(filterPoints(val));
});
inputEl.addEventListener('keydown',e=>{
  if(['ArrowDown','ArrowUp','Enter','Escape'].includes(e.key)){
    handleSuggestionKeyboard(e);
  }
});
searchBtn.addEventListener('click',runSearch);
document.addEventListener('click',e=>{
  if(!e.target.closest('#acupoint-search-input') && !e.target.closest('.suggestion-wrapper')){
    clearSuggestions();
  }
});

/* ---------- Token / Lookup ---------- */
function findAcupointByToken(token){
  const key=removeAllUnicodeSpaces(token||'').trim();
  if(!key) return null;
  return ACUPOINTS.find(p=>p.name===key);
}
function buildNameLookup(){
  ACUPOINT_NAME_LIST=ACUPOINTS.map(p=>p.name).sort((a,b)=>b.length-a.length);
  ACUPOINT_NAME_SET=new Set(ACUPOINT_NAME_LIST);
}
function buildPointsHTML(rawPoints,tokens){
  if(!rawPoints) return '';
  const uniq=[...new Set(tokens||[])].sort((a,b)=>b.length-a.length);
  let i=0; const text=rawPoints; let out='';
  while(i<text.length){
    let matched=null;
    for(const tk of uniq){
      if(text.startsWith(tk,i)){ matched=tk; break; }
    }
    if(matched){
      const point=findAcupointByToken(matched);
      if(point){
        out+=`<a href="#" class="treat-point-link${point.important?' acu-important':''}" data-point="${escapeHTML(point.name)}">${escapeHTML(point.name)}</a>`;
      }else{
        out+=escapeHTML(matched);
      }
      i+=matched.length;
    }else{
      out+=escapeHTML(text[i]);
      i++;
    }
  }
  return out;
}

/* ---------- CSV ロード ---------- */
async function loadAcuCSV(){
  statusEl.textContent='経穴CSV: 読込中';
  try{
    const res=await fetch(`${CSV_PATH}?v=${APP_VERSION}&_=${Date.now()}`);
    if(!res.ok) throw new Error('HTTP '+res.status);
    const text=await res.text();
    ACUPOINTS=parseAcuCSV(text);
    buildNameLookup();
    DATA_READY=true;
    statusEl.textContent=`経穴CSV: ${ACUPOINTS.length}件${ACUPOINTS.length===EXPECTED_TOTAL?'':' (想定'+EXPECTED_TOTAL+')'}`;
  }catch(e){
    statusEl.textContent='経穴CSV: 失敗 '+e.message;
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
    CLINICAL4=parseClinicalCSV(text);
    CLINICAL_READY=true;
    populateClassification();
    rebuildAcuPointPatternIndex();
    clinicalStatusEl.textContent=`臨床CSV: ${CLINICAL4.order.length}分類`;
  }catch(e){
    clinicalStatusEl.textContent='臨床CSV: 失敗 '+e.message;
  }finally{
    requestAnimationFrame(equalizeTopCards);
  }
}

/* ---------- 初期化 ---------- */
function init(){
  loadAcuCSV();
  loadClinicalCSV();
  initHomeGallery();
  requestAnimationFrame(equalizeTopCards);
  requestAnimationFrame(()=>{ inputEl.focus(); inputEl.select(); });
  const wait=setInterval(()=>{
    if((DATA_READY||CLINICAL_READY) && historyStack.length===0){
      goHome();
    }
    if(DATA_READY && CLINICAL_READY) clearInterval(wait);
  },150);
}
window.addEventListener('resize',equalizeTopCards);
init();

/* NOTE: MutationObserver 不要 */
