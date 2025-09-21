/******************************************************
 * 経穴検索 + 臨床病証 + 履歴ナビ
 * APP_VERSION 20250922-NAV-LINK-HOTFIX6-REVERT-LINK+HIST-DROP-MUSCLEONLY
 *
 * 最小変更:
 *  - 神経/血管のHTML行を削除したため、参照部分はガード
 *  - 筋肉が空の場合に window.ACU_MUSCLE_MAP から遅延再取得
 *  - それ以外のロジック/構造は変更なし
 ******************************************************/
const APP_VERSION = '20250922-NAV-LINK-HOTFIX6-REVERT-LINK+HIST-DROP-MUSCLEONLY';

const CSV_FILE = '経穴・経絡.csv';
const CLINICAL_CSV_FILE = '東洋臨床論.csv';

const CSV_PATH = encodeURI(CSV_FILE);
const CLINICAL_CSV_PATH = encodeURI(CLINICAL_CSV_FILE);

const MIN_QUERY_LENGTH = 1;
const EXPECTED_TOTAL = 361;

const READINGS    = window.ACU_READINGS    || {};
const MUSCLE_MAP  = window.ACU_MUSCLE_MAP  || {};

const HISTORY_MAX = 300;
const ENABLE_URL_SYNC = true;

const URL_PARAM_POINT   = 'point';
const URL_PARAM_CAT     = 'cat';
const URL_PARAM_PATTERN = 'pattern';

let ACUPOINTS = [];
let ACUPOINT_NAME_LIST = [];
let ACUPOINT_NAME_SET = new Set();

let DATA_READY = false;
let CLINICAL_READY = false;
let CLINICAL_DATA = { order:[], cats:{} };
let ACUPOINT_PATTERN_INDEX = {};

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
// HTMLから神経/血管は削除済みなので null になる
const resultNerveEl     = document.getElementById('result-nerve');
const resultVesselEl    = document.getElementById('result-vessel');

const relatedSymptomsEl = document.getElementById('related-symptoms');

const categorySelect = document.getElementById('clinical-category-select');
const patternSelect  = document.getElementById('clinical-pattern-select');
const clinicalResultEl = document.getElementById('clinical-treatment-result');
const clinicalTitleEl  = document.getElementById('clinical-selected-title');
const clinicalGroupsEl = document.getElementById('clinical-treatment-groups');

const searchCard  = document.getElementById('search-card');
const symptomCard = document.getElementById('symptom-card');

const homeBtn = document.getElementById('home-btn');
const backBtn = document.getElementById('back-btn');
const forwardBtn = document.getElementById('forward-btn');

/* ==== History Dropdown DOM ==== */
const historyToggleBtn = document.getElementById('history-toggle-btn');
const historyPanel     = document.getElementById('history-panel');
const historyFilterEl  = document.getElementById('history-filter');
const historyListEl    = document.getElementById('history-list');
const historyCloseBtn  = document.getElementById('history-close-btn');
const historyClearBtn  = document.getElementById('history-clear-btn');
const historyCountLabel= document.getElementById('history-count-label');

/* ================= History ================= */
let historyStack = [];
let historyIndex = -1;
let IS_APPLYING_HISTORY = false;
let IS_APPLYING_BROWSER_HISTORY = false;
let INITIAL_URL_STATE = null;
let INITIAL_STATE_APPLIED = false;
let IS_APPLYING_FROM_HISTORY_DROPDOWN = false;

function statesEqual(a,b){
  if(!a||!b) return false;
  if(a.type!==b.type) return false;
  if(a.type==='home') return true;
  if(a.type==='point'||a.type==='unknownPoint') return a.name===b.name;
  if(a.type==='pattern') return a.cat===b.cat && a.pattern===b.pattern;
  return false;
}
function updateNavButtons(){
  backBtn.disabled = false;
  forwardBtn.disabled = false;
}
function trimHistoryIfNeeded(){
  if(historyStack.length <= HISTORY_MAX) return;
  const overflow = historyStack.length - HISTORY_MAX;
  historyStack.splice(0, overflow);
  historyIndex -= overflow;
  if(historyIndex < 0) historyIndex = 0;
}
function stateToLabel(st){
  switch(st.type){
    case 'home': return 'Home';
    case 'point': return `経穴: ${st.name}`;
    case 'unknownPoint': return `未登録: ${st.name}`;
    case 'pattern': return `病証: ${st.cat} / ${getDisplayPatternName(st.pattern)}`;
    default: return st.type;
  }
}
function stateToQueryString(state){
  if(!state || state.type==='home') return '';
  const p = new URLSearchParams();
  switch(state.type){
    case 'point':
    case 'unknownPoint':
      p.set(URL_PARAM_POINT, state.name); break;
    case 'pattern':
      p.set(URL_PARAM_CAT, state.cat);
      p.set(URL_PARAM_PATTERN, state.pattern);
      break;
  }
  const qs = p.toString();
  return qs? '?'+qs : '';
}
function parseStateFromLocation(){
  try{
    const url = new URL(window.location.href);
    const point = url.searchParams.get(URL_PARAM_POINT);
    const cat   = url.searchParams.get(URL_PARAM_CAT);
    const pat   = url.searchParams.get(URL_PARAM_PATTERN);
    if(cat && pat){
      return { type:'pattern', cat, pattern:pat };
    }
    if(point){
      return { type:'point', name:point };
    }
    return { type:'home', _prefillCat: cat || null };
  }catch(e){
    return { type:'home' };
  }
}
function syncBrowserURL(state, replace=false){
  if(!ENABLE_URL_SYNC) return;
  const q = stateToQueryString(state);
  const newURL = window.location.pathname + q;
  const histState = { appState: state, appVersion: APP_VERSION };
  if(replace){
    window.history.replaceState(histState,'',newURL);
  } else {
    window.history.pushState(histState,'',newURL);
  }
}
function pushState(state, replace=false){
  if(IS_APPLYING_HISTORY || IS_APPLYING_BROWSER_HISTORY || IS_APPLYING_FROM_HISTORY_DROPDOWN) return;
  if(historyIndex>=0 && statesEqual(historyStack[historyIndex], state)){
    if(replace && ENABLE_URL_SYNC) syncBrowserURL(state,true);
    return;
  }
  if(!state.ts) state.ts = Date.now();

  if(replace){
    if(historyIndex>=0){
      historyStack[historyIndex]=state;
    } else {
      historyStack.push(state);
      historyIndex=0;
    }
    if(ENABLE_URL_SYNC) syncBrowserURL(state,true);
  } else {
    if(historyIndex < historyStack.length -1){
      historyStack = historyStack.slice(0, historyIndex+1);
    }
    historyStack.push(state);
    historyIndex = historyStack.length -1;
    trimHistoryIfNeeded();
    if(ENABLE_URL_SYNC) syncBrowserURL(state,false);
  }
  updateNavButtons();
  renderHistoryDropdown();
}
function applyState(state){
  if(!state) return;
  IS_APPLYING_HISTORY = true;
  try{
    switch(state.type){
      case 'home':
        goHome(true);
        if(state._prefillCat && CLINICAL_READY){
          if(CLINICAL_DATA.cats[state._prefillCat]){
            categorySelect.value = state._prefillCat;
            categorySelect.dispatchEvent(new Event('change'));
          }
        }
        break;
      case 'point':
        if(!DATA_READY) break;
        {
          const p=ACUPOINTS.find(x=>x.name===state.name);
          if(p) showPointDetail(p,true);
          else showUnknownPoint(state.name,true);
        }
        break;
      case 'unknownPoint':
        showUnknownPoint(state.name,true);
        break;
      case 'pattern':
        if(CLINICAL_READY){
          categorySelect.value=state.cat;
          categorySelect.dispatchEvent(new Event('change'));
          patternSelect.value=state.pattern;
          patternSelect.dispatchEvent(new Event('change'));
        }
        break;
    }
  } finally {
    IS_APPLYING_HISTORY=false;
    updateNavButtons();
    renderHistoryDropdown();
  }
}
backBtn.addEventListener('click', ()=>window.history.back());
forwardBtn.addEventListener('click', ()=>window.history.forward());
window.addEventListener('popstate', (e)=>{
  if(!ENABLE_URL_SYNC) return;
  IS_APPLYING_BROWSER_HISTORY=true;
  try{
    let state = e.state && e.state.appState ? e.state.appState : parseStateFromLocation();
    IS_APPLYING_HISTORY=true;
    if(!(historyIndex>=0 && statesEqual(historyStack[historyIndex], state))){
      historyStack.push(state);
      historyIndex = historyStack.length -1;
      trimHistoryIfNeeded();
    }
    IS_APPLYING_HISTORY=false;
    applyState(state);
  } finally {
    IS_APPLYING_BROWSER_HISTORY=false;
  }
});

/* ================= Utility ================= */
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
function escapeHTML(s){
  return s.replace(/[&<>"']/g, ch=>{
    switch(ch){
      case '&': return '&amp;';
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '"': return '&quot;';
      case "'": return '&#39;';
    }
  });
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

/* ================= CSVパーサ ================= */
function parseAcuCSV(raw){
  if(!raw) return [];
  const text = raw.replace(/\r\n/g,'\n').replace(/\uFEFF/g,'');
  const lines = text.split('\n').filter(l=>l.trim());
  function split(line){
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
  for(const rawLine of lines){
    if(/^[0-9０-９]+\./.test(rawLine.trim())) continue;
    const cols=split(rawLine);
    if(cols[0]==='経絡' && cols[1]==='経穴') continue;
    if(cols.length<2) continue;
    const meridian=cols[0].trim();
    const name=cols[1].trim();
    if(!meridian||!name) continue;
    const region=cols[2]? cols[2].trim():'';
    const important=cols[3]? cols[3].trim():'';
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

/* ================= Treatment Tokens ================= */
function parseTreatmentPoints(raw){
  if(!raw) return [];
  const stripped = raw
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
    .filter(Boolean);
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
  ACUPOINT_NAME_LIST = ACUPOINTS.map(p=>p.name).sort((a,b)=> b.length - a.length);
  ACUPOINT_NAME_SET = new Set(ACUPOINT_NAME_LIST);
}
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

/* ================= 治療点リンク化 ================= */
function linkifyParenthesisGroup(group){
  if(group.length<2) return escapeHTML(group);
  const open=group[0], close=group[group.length-1];
  const inner=group.slice(1,-1);
  let i=0, out='';
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
    } else {
      out+=escapeHTML(ch);
      i++;
    }
  }
  return escapeHTML(open)+out+escapeHTML(close);
}
function buildPointsHTML(rawPoints, tokens){
  if(!rawPoints) return '';
  const uniqueTokens = Array.from(new Set(tokens||[]));
  const sortedTokens = uniqueTokens.sort((a,b)=> b.length - a.length);
  let i=0, out='', len=rawPoints.length;
  while(i<len){
    const ch=rawPoints[i];
    if(ch==='(' || ch==='（'){
      const closeChar = ch==='(' ? ')' : '）';
      let j=i+1;
      while(j<len && rawPoints[j]!==closeChar) j++;
      if(j<len) j++;
      out+=linkifyParenthesisGroup(rawPoints.slice(i,j));
      i=j;
      continue;
    }
    if(isSpace(ch)){ out+=escapeHTML(ch); i++; continue; }
    let matched=null, consumed=0;
    for(const tk of sortedTokens){
      const c = matchTokenWithSpaces(rawPoints, i, tk);
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
      i+=consumed;
      continue;
    }
    out+=escapeHTML(ch);
    i++;
  }
  return out;
}

/* ================= Clinical CSV Parsing ================= */
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
  const comm=after.filter(c=>c && /^[（(]/.test(c));
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
function parseClinicalCSV(raw){
  const logical=rebuildLogicalRows(raw);
  const table=logical.map(parseCSVLogicalRow);
  const data={order:[],cats:{}};
  let i=0;
  while(i<table.length){
    const row=table[i];
    if(!row.length){ i++; continue; }
    if(isCategoryRow(row)){
      const category=removeAllUnicodeSpaces(row[0]);
      if(!data.cats[category]){
        data.cats[category]={patternOrder:[],patterns:{}};
        data.order.push(category);
      }
      i++;
      if(i>=table.length) break;
      if(!isPatternHeaderRow(table[i])) continue;
      const pRow=table[i];
      const patternNames=[];
      for(let c=1;c<pRow.length;c++){
        const name=trimOuter(pRow[c]);
        if(name){
          patternNames.push(name);
          if(!data.cats[category].patterns[name]){
            data.cats[category].patterns[name]=[];
            data.cats[category].patternOrder.push(name);
          }
        }
      }
      i++;
      while(i<table.length){
        const r=table[i];
        if(isCategoryRow(r)) break;
        if(isPatternHeaderRow(r)){ i++; continue; }
        if(!isTreatmentRow(r)){ i++; continue; }
        const after=r.slice(1);
        const inter=isInterleavedTreatmentRow(after, patternNames.length);
        if(inter){
          const groups=parseInterleavedRow(after, patternNames);
          groups.forEach(g=>{
            data.cats[category].patterns[g.pattern].push({
              label:g.label, rawPoints:g.rawPoints, comment:g.comment
            });
          });
          i++;
        } else {
          const next=table[i+1]||[];
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
            data.cats[category].patterns[pName].push({label,rawPoints,comment:finalComment});
          });
          i+= commentRow?2:1;
        }
      }
      continue;
    }
    i++;
  }
  data.order.forEach(cat=>{
    const catObj=data.cats[cat];
    catObj.patternOrder.forEach(pn=>{
      catObj.patterns[pn].forEach(g=>{
        if(!g.tokens) g.tokens=parseTreatmentPoints(g.rawPoints);
      });
    });
  });
  return data;
}

/* ================= 逆引き ================= */
function rebuildAcuPointPatternIndex(){
  ACUPOINT_PATTERN_INDEX={};
  CLINICAL_DATA.order.forEach(cat=>{
    const catObj=CLINICAL_DATA.cats[cat];
    catObj.patternOrder.forEach(pat=>{
      const groups=catObj.patterns[pat];
      const seen=new Set();
      groups.forEach(g=>{
        (g.tokens||[]).forEach(tk=>{
          if(!tk || seen.has(tk)) return;
          seen.add(tk);
          if(!ACUPOINT_PATTERN_INDEX[tk]) ACUPOINT_PATTERN_INDEX[tk]=[];
          ACUPOINT_PATTERN_INDEX[tk].push({cat,pattern:pat});
        });
      });
    });
  });
  Object.keys(ACUPOINT_PATTERN_INDEX).forEach(k=>{
    const uniq=new Map();
    ACUPOINT_PATTERN_INDEX[k].forEach(e=>{
      const key=e.cat+'||'+e.pattern;
      if(!uniq.has(key)) uniq.set(key,e);
    });
    ACUPOINT_PATTERN_INDEX[k]=Array.from(uniq.values());
  });
}

/* ================= 表示補助 ================= */
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

/* ================= Suggestion ================= */
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
  return nm;
}
function clearSuggestions(){
  suggestionListEl.innerHTML='';
  suggestionListEl.classList.add('hidden');
  inputEl.setAttribute('aria-expanded','false');
  requestAnimationFrame(equalizeTopCards);
}
function setActive(items, idx){
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
  const qRegex=hira? new RegExp(hira.replace(/([.*+?^=!:${}()|[\]\\])/g,'\\$1'),'g'):null;
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
  if(e.key==='ArrowDown'){ e.preventDefault(); current=(current+1)%items.length; setActive(items,current); }
  else if(e.key==='ArrowUp'){ e.preventDefault(); current=(current-1+items.length)%items.length; setActive(items,current); }
  else if(e.key==='Enter'){
    e.preventDefault();
    const act=items[current>=0?current:0];
    if(act && act.dataset.id){
      const p=ACUPOINTS.find(x=>x.name===act.dataset.id);
      if(p) selectPoint(p);
    }
  } else if(e.key==='Escape'){ clearSuggestions(); }
}
inputEl.addEventListener('keyup', e=>{
  if(['ArrowDown','ArrowUp','Enter','Escape'].includes(e.key)){
    handleSuggestionKeyboard(e); return;
  }
  if(!DATA_READY) return;
  const val=inputEl.value;
  if(removeAllUnicodeSpaces(val).length < MIN_QUERY_LENGTH){
    clearSuggestions(); return;
  }
  renderSuggestions(filterPoints(val));
});
searchBtn.addEventListener('click', runSearch);
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
document.addEventListener('click', e=>{
  if(!e.target.closest('.suggestion-wrapper') && !e.target.closest('#acupoint-search-input')){
    clearSuggestions();
  }
});

/* ================= 部位内経穴リンク化 (従来方式) ================= */
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
        } else i++;
      }
      if(cursor<work.length) frag.appendChild(document.createTextNode(work.slice(cursor)));
      if(frag.childNodes.length) node.replaceWith(frag);
    } else if(node.nodeType===Node.ELEMENT_NODE){
      if(node.tagName.toLowerCase()==='a') return;
      Array.from(node.childNodes).forEach(process);
    }
  }
  Array.from(wrapper.childNodes).forEach(process);
  return wrapper.innerHTML;
}

/* ================= 詳細表示 ================= */
function showPointDetail(p, suppressHistory=false){
  // 追加: 筋肉が空なら遅延取得
  if(!p.muscle && window.ACU_MUSCLE_MAP){
    const late = window.ACU_MUSCLE_MAP[p.name];
    if(late) p.muscle = late;
  }

  let regionHTML=p.region||'';
  if(regionHTML.includes('[[')){
    regionHTML = p.regionRaw? applyRedMarkup(p.regionRaw): applyRedMarkup(regionHTML);
  }
  regionHTML=linkifyRegionAcupoints(regionHTML);
  resultNameEl.textContent=`${p.name}${p.reading?` (${p.reading})`:''}`;
  resultMeridianEl.textContent=p.meridian||'（経絡未登録）';
  resultRegionEl.innerHTML=regionHTML||'（部位未登録）';
  if(p.important){
    resultImportantEl.innerHTML=`<span class="acu-important-flag">${escapeHTML(p.important)}</span>`;
  } else resultImportantEl.textContent='-';
  resultMuscleEl.textContent=p.muscle||'（筋肉未登録）';
  if(resultNerveEl) resultNerveEl.textContent='';
  if(resultVesselEl) resultVesselEl.textContent='';
  renderRelatedPatterns(p.name);
  inlineAcupointResult.classList.remove('hidden');
  if(!suppressHistory && !IS_APPLYING_HISTORY && !IS_APPLYING_BROWSER_HISTORY && !IS_APPLYING_FROM_HISTORY_DROPDOWN){
    pushState({type:'point', name:p.name});
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
    li.innerHTML=`<a href="#" class="acu-pattern-link" data-cat="${escapeHTML(entry.cat)}" data-pattern="${escapeHTML(entry.pattern)}">${escapeHTML(display)}</a>`;
    relatedSymptomsEl.appendChild(li);
  });
}
function showUnknownPoint(name, suppressHistory=false){
  resultNameEl.textContent=`${name}（未登録）`;
  resultMeridianEl.textContent='（経絡未登録）';
  resultRegionEl.innerHTML='（部位未登録）';
  resultImportantEl.textContent='-';
  resultMuscleEl.textContent='（筋肉未登録）';
  if(resultNerveEl) resultNerveEl.textContent='';
  if(resultVesselEl) resultVesselEl.textContent='';
  relatedSymptomsEl.innerHTML='<li>-</li>';
  inlineAcupointResult.classList.remove('hidden');
  if(!suppressHistory && !IS_APPLYING_HISTORY && !IS_APPLYING_BROWSER_HISTORY && !IS_APPLYING_FROM_HISTORY_DROPDOWN){
    pushState({type:'unknownPoint',name});
  }
  requestAnimationFrame(equalizeTopCards);
}
function selectPoint(p){
  clearSuggestions();
  inputEl.value=p.name;
  showPointDetail(p);
}

/* ================= 臨床 UI ================= */
categorySelect.addEventListener('change', ()=>{
  const cat=categorySelect.value;
  patternSelect.innerHTML='<option value="">--</option>';
  patternSelect.disabled=true;
  clinicalResultEl.classList.add('hidden');
  clinicalGroupsEl.innerHTML='';
  if(!cat || !CLINICAL_DATA.cats[cat]){
    requestAnimationFrame(equalizeTopCards); return;
  }
  CLINICAL_DATA.cats[cat].patternOrder.forEach(pat=>{
    const opt=document.createElement('option');
    opt.value=pat;
    opt.textContent=getDisplayPatternName(pat);
    patternSelect.appendChild(opt);
  });
  patternSelect.disabled=false;
  requestAnimationFrame(equalizeTopCards);
});
patternSelect.addEventListener('change', ()=>{
  try{
    const cat=categorySelect.value;
    const pat=patternSelect.value;
    clinicalResultEl.classList.add('hidden');
    clinicalGroupsEl.innerHTML='';
    if(!cat || !pat || !CLINICAL_DATA.cats[cat] || !CLINICAL_DATA.cats[cat].patterns[pat]){
      requestAnimationFrame(equalizeTopCards); return;
    }
    const groups=CLINICAL_DATA.cats[cat].patterns[pat];
    const span=clinicalTitleEl.querySelector('.pattern-name-highlight');
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
    if(!IS_APPLYING_HISTORY && !IS_APPLYING_BROWSER_HISTORY && !IS_APPLYING_FROM_HISTORY_DROPDOWN){
      pushState({type:'pattern',cat,pattern:pat});
    }
  }catch(err){
    console.error('[patternSelect change] error', err);
    clinicalStatusEl.textContent='臨床CSV: 表示処理エラー '+err.message;
  } finally {
    requestAnimationFrame(equalizeTopCards);
  }
});

/* ==== 病証リンク ==== */
document.addEventListener('click', e=>{
  const a=e.target.closest('.acu-pattern-link');
  if(!a) return;
  e.preventDefault();
  const cat=a.dataset.cat;
  const pat=a.dataset.pattern;
  if(!cat || !pat) return;
  if(!CLINICAL_DATA.cats[cat]) return;
  categorySelect.value=cat;
  categorySelect.dispatchEvent(new Event('change'));
  patternSelect.value=pat;
  patternSelect.dispatchEvent(new Event('change'));
});

/* ==== 治療点リンク ==== */
document.addEventListener('click', e=>{
  const a=e.target.closest('.treat-point-link');
  if(!a) return;
  e.preventDefault();
  const nm=a.dataset.point;
  const p=findAcupointByToken(nm);
  if(p) showPointDetail(p); else showUnknownPoint(nm);
});

/* ================= ホーム ================= */
homeBtn.addEventListener('click', ()=>goHome());
function goHome(suppressHistory=false){
  inputEl.value='';
  clearSuggestions();
  inlineAcupointResult.classList.add('hidden');
  categorySelect.value='';
  categorySelect.dispatchEvent(new Event('change'));
  patternSelect.value='';
  patternSelect.disabled=true;
  clinicalGroupsEl.innerHTML='';
  clinicalResultEl.classList.add('hidden');
  const span=clinicalTitleEl.querySelector('.pattern-name-highlight');
  if(span) span.textContent='';
  relatedSymptomsEl.innerHTML='<li>-</li>';
  window.scrollTo({top:0,behavior:'smooth'});
  requestAnimationFrame(()=>{
    inputEl.focus();
    inputEl.select();
  });
  if(!suppressHistory && !IS_APPLYING_HISTORY && !IS_APPLYING_BROWSER_HISTORY && !IS_APPLYING_FROM_HISTORY_DROPDOWN){
    pushState({type:'home'});
  }
  requestAnimationFrame(equalizeTopCards);
}

/* ================= 検索 ================= */
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

/* ================= 履歴ドロップダウン ================= */
function formatTime(ts){
  const d=new Date(ts);
  const pad=n=>('0'+n).slice(-2);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
function currentHistoryState(){
  return historyStack[historyIndex] || null;
}
function filteredHistoryData(){
  const filter = (historyFilterEl?.value || '').trim().toLowerCase();
  const raw = historyStack.slice().reverse();
  const limit = 60;
  const sliced = raw.slice(0, limit);
  if(!filter) return sliced;
  return sliced.filter(st=>{
    const label = stateToLabel(st).toLowerCase();
    if(label.includes(filter)) return true;
    if(st.type==='point' || st.type==='unknownPoint'){
      return st.name.toLowerCase().includes(filter);
    }
    if(st.type==='pattern'){
      return (st.cat.toLowerCase().includes(filter) || st.pattern.toLowerCase().includes(filter));
    }
    return false;
  });
}
function renderHistoryDropdown(){
  if(!historyListEl) return;
  const data = filteredHistoryData();
  historyListEl.innerHTML='';
  const cur = currentHistoryState();
  data.forEach(st=>{
    const li=document.createElement('li');
    if(cur && statesEqual(cur, st)) li.classList.add('active');
    const typeLbl = st.type;
    const label = stateToLabel(st);
    const timePart = st.ts? formatTime(st.ts): '';
    li.innerHTML = `
      <div class="hist-item-head">
        <span class="hist-item-type">${escapeHTML(typeLbl)}</span>
        <span class="hist-time">${escapeHTML(timePart)}</span>
      </div>
      <div class="hist-item-label">${escapeHTML(label)}</div>
    `;
    li.addEventListener('click', ()=>{
      IS_APPLYING_FROM_HISTORY_DROPDOWN = true;
      try{
        applyState(st);
        if(ENABLE_URL_SYNC){
          const q = stateToQueryString(st);
          const histState = { appState: st, appVersion: APP_VERSION };
          window.history.pushState(histState,'', window.location.pathname + q);
        }
      } finally {
        IS_APPLYING_FROM_HISTORY_DROPDOWN = false;
        renderHistoryDropdown();
      }
    });
    historyListEl.appendChild(li);
  });
  if(historyCountLabel){
    historyCountLabel.textContent = `表示 ${data.length} / 総計 ${historyStack.length}`;
  }
}
function openHistoryPanel(){
  if(!historyPanel) return;
  historyPanel.classList.remove('hist-hidden');
  historyToggleBtn?.setAttribute('aria-expanded','true');
  renderHistoryDropdown();
  historyFilterEl?.focus();
}
function closeHistoryPanel(){
  if(!historyPanel) return;
  historyPanel.classList.add('hist-hidden');
  historyToggleBtn?.setAttribute('aria-expanded','false');
}
historyToggleBtn?.addEventListener('click', ()=>{
  if(historyPanel.classList.contains('hist-hidden')) openHistoryPanel();
  else closeHistoryPanel();
});
historyCloseBtn?.addEventListener('click', ()=>closeHistoryPanel());
historyFilterEl?.addEventListener('input', ()=>renderHistoryDropdown());
document.addEventListener('keydown', e=>{
  if(e.key==='Escape' && !historyPanel.classList.contains('hist-hidden')){
    closeHistoryPanel();
  }
});
document.addEventListener('click', e=>{
  if(!historyPanel) return;
  if(historyPanel.classList.contains('hist-hidden')) return;
  if(e.target===historyPanel || e.target===historyToggleBtn || historyPanel.contains(e.target)) return;
  closeHistoryPanel();
});
historyClearBtn?.addEventListener('click', ()=>{
  if(!confirm('履歴を全て削除しますか？')) return;
  historyStack=[];
  historyIndex=-1;
  goHome(false);
  renderHistoryDropdown();
});

/* ================= ロード ================= */
async function loadAcuCSV(){
  statusEl.textContent='経穴CSV: 読込中';
  try{
    const res=await fetch(`${CSV_PATH}?v=${APP_VERSION}&_=${Date.now()}`);
    if(!res.ok) throw new Error('HTTP '+res.status);
    const text=await res.text();
    let parsed=parseAcuCSV(text);
    ACUPOINTS=parsed;
    buildNameLookup();
    DATA_READY=true;
    const total=ACUPOINTS.length;
    statusEl.textContent=(total===EXPECTED_TOTAL)
      ? `経穴CSV: ${total}件 / 想定${EXPECTED_TOTAL}`
      : `経穴CSV: ${total}件 (想定${EXPECTED_TOTAL})`;
  }catch(err){
    console.error('[LOAD] acu error', err);
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
    CLINICAL_DATA=parseClinicalCSV(text);
    CLINICAL_READY=true;
    categorySelect.innerHTML='<option value="">--</option>';
    CLINICAL_DATA.order.forEach(cat=>{
      const opt=document.createElement('option'); opt.value=cat; opt.textContent=cat;
      categorySelect.appendChild(opt);
    });
    rebuildAcuPointPatternIndex();
    clinicalStatusEl.textContent=`臨床CSV: ${CLINICAL_DATA.order.length}カテゴリ`;
  }catch(err){
    console.error('[LOAD] clinical error', err);
    clinicalStatusEl.textContent='臨床CSV: 失敗 '+err.message;
  }finally{
    requestAnimationFrame(equalizeTopCards);
  }
}

/* ================= 初期化 ================= */
function init(){
  try{
    INITIAL_URL_STATE = ENABLE_URL_SYNC? parseStateFromLocation(): {type:'home'};
    loadAcuCSV();
    loadClinicalCSV();
    updateNavButtons();
    requestAnimationFrame(equalizeTopCards);
    requestAnimationFrame(()=>{
      inputEl.focus();
      inputEl.select();
    });
    const waitReady=setInterval(()=>{
      if((DATA_READY || CLINICAL_READY) && !INITIAL_STATE_APPLIED){
        pushState(INITIAL_URL_STATE,true);
        applyState(INITIAL_URL_STATE);
        INITIAL_STATE_APPLIED=true;
      }
      if(DATA_READY && CLINICAL_READY){
        clearInterval(waitReady);
      }
    },120);
  }catch(err){
    console.error('[INIT] fatal', err);
    statusEl.textContent='経穴CSV: JSエラー';
    clinicalStatusEl.textContent='臨床CSV: JSエラー';
  }
}
window.addEventListener('resize', equalizeTopCards);
init();

/* ================= Version 表示 ================= */
(function showVersion(){
  const sf=document.getElementById('status-float');
  if(sf){
    const span=document.createElement('span');
    span.style.marginLeft='8px';
    span.textContent='Version: '+APP_VERSION;
    sf.appendChild(span);
  }
})();
