/******************************************************
 * 経穴検索 + 臨床病証 + 神経/血管 + 履歴ナビ + 部位内経穴リンク化
 * APP_VERSION 20250922-NAV-LINK-HOTFIX5-HISTURL-POINTCAT
 * 変更:
 *  - 4列CSVパーサ (経絡,経穴,部位,要穴)
 *  - 履歴サイズ制限 HISTORY_MAX
 *  - URLパラメータ同期 (?point / ?cat / ?cat&point / ?cat&pattern)
 *  - カテゴリのみ / 経穴のみ / カテゴリ+経穴 / 病証 / Home の履歴化
 *  - 部位内リンク語境界厳密化 (漢字・仮名・英数字等連結抑制)
 ******************************************************/
const APP_VERSION = '20250922-NAV-LINK-HOTFIX5-HISTURL-POINTCAT';

const CSV_FILE = '経穴・経絡.csv';
const CLINICAL_CSV_FILE = '東洋臨床論.csv';

const CSV_PATH = encodeURI(CSV_FILE);
const CLINICAL_CSV_PATH = encodeURI(CLINICAL_CSV_FILE);

const MIN_QUERY_LENGTH = 1;
const EXPECTED_TOTAL = 361;

const READINGS    = window.ACU_READINGS    || {};
const MUSCLE_MAP  = window.ACU_MUSCLE_MAP  || {};
const NERVE_MAP   = window.ACU_NERVE_MAP   || {};
const VESSEL_MAP  = window.ACU_VESSEL_MAP  || {};

// 設定フラグ
const HISTORY_MAX = 300;
const ENABLE_CATEGORY_ONLY_HISTORY   = true;
const ENABLE_CATEGORY_POINT_HISTORY  = true; // NEW: category+point 中間状態
const ENABLE_URL_SYNC                = true;

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

/* ================= History (internal + URL sync) ================= */
let historyStack = [];
let historyIndex = -1;
let IS_APPLYING_HISTORY = false;
let IS_APPLYING_BROWSER_HISTORY = false;
let INITIAL_URL_STATE = null;
let INITIAL_STATE_APPLIED = false;

function statesEqual(a,b){
  if(!a||!b) return false;
  if(a.type!==b.type) return false;
  if(a.type==='home') return true;
  if(a.type==='point'||a.type==='unknownPoint') return a.name===b.name;
  if(a.type==='pattern') return a.cat===b.cat && a.pattern===b.pattern;
  if(a.type==='category') return a.cat===b.cat;
  if(a.type==='categoryPoint') return a.cat===b.cat && a.name===b.name;
  return false;
}
function updateNavButtons(){
  backBtn.disabled = false; // ブラウザ履歴へ委譲
  forwardBtn.disabled = false;
}
function trimHistoryIfNeeded(){
  if(historyStack.length <= HISTORY_MAX) return;
  const overflow = historyStack.length - HISTORY_MAX;
  historyStack.splice(0, overflow);
  historyIndex -= overflow;
  if(historyIndex < 0) historyIndex = 0;
}

/* URL 生成 */
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
    case 'category':
      p.set(URL_PARAM_CAT, state.cat);
      break;
    case 'categoryPoint':
      p.set(URL_PARAM_CAT, state.cat);
      p.set(URL_PARAM_POINT, state.name);
      break;
  }
  const qs = p.toString();
  return qs? '?'+qs : '';
}

/* URL から state 推定 (pattern > cat+point > point > cat > home) */
function parseStateFromLocation(){
  try{
    const url = new URL(window.location.href);
    const point = url.searchParams.get(URL_PARAM_POINT);
    const cat   = url.searchParams.get(URL_PARAM_CAT);
    const pat   = url.searchParams.get(URL_PARAM_PATTERN);
    if(cat && pat){
      return { type:'pattern', cat, pattern:pat };
    }
    if(cat && point){
      return { type:'categoryPoint', cat, name:point };
    }
    if(point){
      return { type:'point', name:point };
    }
    if(cat){
      return { type:'category', cat };
    }
    return { type:'home' };
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
  if(IS_APPLYING_HISTORY || IS_APPLYING_BROWSER_HISTORY) return;
  if(historyIndex>=0 && statesEqual(historyStack[historyIndex], state)){
    if(replace && ENABLE_URL_SYNC) syncBrowserURL(state,true);
    return;
  }
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
}

function applyState(state){
  if(!state) return;
  IS_APPLYING_HISTORY = true;
  try{
    switch(state.type){
      case 'home': goHome(true); break;
      case 'point': {
        if(!DATA_READY){ /* postpone? */ break; }
        const p=ACUPOINTS.find(x=>x.name===state.name);
        if(p) showPointDetail(p,true);
        else showUnknownPoint(state.name,true);
        break;
      }
      case 'unknownPoint':
        showUnknownPoint(state.name,true);
        break;
      case 'category':
        if(CLINICAL_READY){
          categorySelect.value=state.cat;
          categorySelect.dispatchEvent(new Event('change'));
        }
        break;
      case 'categoryPoint':
        if(CLINICAL_READY){
          categorySelect.value=state.cat;
          categorySelect.dispatchEvent(new Event('change'));
        }
        if(DATA_READY){
          const cp=ACUPOINTS.find(x=>x.name===state.name);
          if(cp) showPointDetail(cp,true);
          else showUnknownPoint(state.name,true);
        }
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
  }
}

backBtn.addEventListener('click', ()=>window.history.back());
forwardBtn.addEventListener('click', ()=>window.history.forward());

window.addEventListener('popstate', (e)=>{
  if(!ENABLE_URL_SYNC) return;
  IS_APPLYING_BROWSER_HISTORY=true;
  try{
    let state = e.state && e.state.appState ? e.state.appState : parseStateFromLocation();
    // 内部履歴には push (URL は既に変化済なので pushState は URL push 再実行)
    // → pushState 呼ぶと二重 push なので一時無効化処理
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

/* ================= 経穴CSVパーサ (4列仕様) ================= */
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
    if(/^[0-9０-９]+\./.test(rawLine.trim())) continue; // カテゴリ
    const cols = split(rawLine);
    if(cols[0]==='経絡' && cols[1]==='経穴') continue; // ヘッダ
    if(cols.length < 2) continue;
    const meridian = cols[0].trim();
    const name     = cols[1].trim();
    if(!meridian || !name) continue;
    const region   = cols[2]? cols[2].trim() : '';
    const important= cols[3]? cols[3].trim() : '';
    const reading  = READINGS[name] || '';
    const muscle   = MUSCLE_MAP[name] || '';
    const nerve    = NERVE_MAP[name] || '';
    const vessel   = VESSEL_MAP[name] || '';
    results.push({
      name, reading, meridian, region, regionRaw: region,
      important, muscle, nerve, vessel
    });
  }
  return results;
}

/* ================= Token / Lookup ================= */
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

/* ================= 語境界判定（部位内リンク用） ================= */
function isWordCharJP(ch){
  if(!ch) return false;
  return /[A-Za-z0-9\u3400-\u9FFF\u3040-\u309F\u30A0-\u30FF\u3005\u30FC]/.test(ch);
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
      } else {
        out+=escapeHTML(matched);
      }
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

/* ================= Clinical CSV パース ================= (既存流用) */
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
  const mm=[],nv=[],vs=[];
  for(const p of ACUPOINTS){
    if(seen.has(p.name)) continue;
    if(p.muscle && p.muscle.includes(q)){ mm.push({...p,_matchType:'muscle'}); seen.add(p.name); }
  }
  for(const p of ACUPOINTS){
    if(seen.has(p.name)) continue;
    if(p.nerve && p.nerve.includes(q)){ nv.push({...p,_matchType:'nerve'}); seen.add(p.name); }
  }
  for(const p of ACUPOINTS){
    if(seen.has(p.name)) continue;
    if(p.vessel && p.vessel.includes(q)){ vs.push({...p,_matchType:'vessel'}); seen.add(p.name); }
  }
  return nm.concat(mm,nv,vs);
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
    if(p._matchType==='muscle') badges.push('<span class="badge badge-muscle" title="筋肉で一致">M</span>');
    if(p._matchType==='nerve') badges.push('<span class="badge badge-nerve" title="神経で一致">N</span>');
    if(p._matchType==='vessel') badges.push('<span class="badge badge-vessel" title="血管で一致">V</span>');
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

/* ================= 部位内経穴リンク化（語境界強化） ================= */
function linkifyRegionAcupoints(html){
  if(!html || !ACUPOINT_NAME_LIST.length) return html;
  const wrapper=document.createElement('div');
  wrapper.innerHTML=html;
  function process(node){
    if(node.nodeType===Node.TEXT_NODE){
      const text=node.nodeValue;
      if(!text.trim()) return;
      let outFrag=document.createDocumentFragment();
      let i=0;
      while(i<text.length){
        let matched=null;
        for(const name of ACUPOINT_NAME_LIST){
          if(text.startsWith(name,i)){
            // 前後境界チェック
            const prev=text[i-1];
            const next=text[i+name.length];
            if(isWordCharJP(prev) || isWordCharJP(next)){
              // 連結される語の一部と判断し今回はリンク化しない
              continue;
            }
            matched=name;
            break;
          }
        }
        if(matched){
          if(outFrag.lastTextPos!==undefined && outFrag.lastTextPos<i){
            // (未使用の補助) - ここでは不要
          }
          const before=text.slice(outFrag.cursor||0, i);
          if(before) outFrag.appendChild(document.createTextNode(before));
          const a=document.createElement('a');
            a.href='#';
          a.className='treat-point-link';
          const p=findAcupointByToken(matched);
          if(p && p.important) a.classList.add('acu-important');
          a.dataset.point=matched;
          a.textContent=matched;
          outFrag.appendChild(a);
          i+=matched.length;
          outFrag.cursor=i;
        } else {
          i++;
        }
      }
      const restStart = outFrag.cursor||0;
      if(restStart < text.length){
        outFrag.appendChild(document.createTextNode(text.slice(restStart)));
      }
      if(outFrag.childNodes.length){
        node.replaceWith(outFrag);
      }
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
  resultNerveEl.textContent=p.nerve||'（神経未登録）';
  resultVesselEl.textContent=p.vessel||'（血管未登録）';
  renderRelatedPatterns(p.name);
  inlineAcupointResult.classList.remove('hidden');

  if(!suppressHistory && !IS_APPLYING_HISTORY && !IS_APPLYING_BROWSER_HISTORY){
    // category が選ばれていて pattern 未選択 → categoryPoint 状態
    const cat = categorySelect.value;
    if(ENABLE_CATEGORY_POINT_HISTORY && cat && !patternSelect.value){
      pushState({type:'categoryPoint', cat, name:p.name});
    } else {
      pushState({type:'point', name:p.name});
    }
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
  resultNerveEl.textContent='（神経未登録）';
  resultVesselEl.textContent='（血管未登録）';
  relatedSymptomsEl.innerHTML='<li>-</li>';
  inlineAcupointResult.classList.remove('hidden');
  if(!suppressHistory && !IS_APPLYING_HISTORY && !IS_APPLYING_BROWSER_HISTORY){
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
    requestAnimationFrame(equalizeTopCards);
    return;
  }
  CLINICAL_DATA.cats[cat].patternOrder.forEach(pat=>{
    const opt=document.createElement('option');
    opt.value=pat;
    opt.textContent=getDisplayPatternName(pat);
    patternSelect.appendChild(opt);
  });
  patternSelect.disabled=false;

  if(!IS_APPLYING_HISTORY && !IS_APPLYING_BROWSER_HISTORY){
    // 既に point 表示中 & pattern 未選択なら categoryPoint
    const currentPointName = resultNameEl.textContent.split(/[\s(（]/)[0] || '';
    const hasPointVisible = !inlineAcupointResult.classList.contains('hidden') && currentPointName && ACUPOINTS.find(p=>p.name===currentPointName);
    if(ENABLE_CATEGORY_POINT_HISTORY && hasPointVisible){
      pushState({type:'categoryPoint', cat, name: currentPointName});
    } else if(ENABLE_CATEGORY_ONLY_HISTORY){
      pushState({type:'category', cat});
    }
  }
  requestAnimationFrame(equalizeTopCards);
});

patternSelect.addEventListener('change', ()=>{
  try{
    const cat=categorySelect.value;
    const pat=patternSelect.value;
    clinicalResultEl.classList.add('hidden');
    clinicalGroupsEl.innerHTML='';
    if(!cat || !pat || !CLINICAL_DATA.cats[cat] || !CLINICAL_DATA.cats[cat].patterns[pat]){
      requestAnimationFrame(equalizeTopCards);
      return;
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
    if(!IS_APPLYING_HISTORY && !IS_APPLYING_BROWSER_HISTORY){
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

/* ==== 部位/治療点リンク ==== */
document.addEventListener('click', e=>{
  const a=e.target.closest('.treat-point-link');
  if(!a) return;
  e.preventDefault();
  const nm=a.dataset.point;
  const p=findAcupointByToken(nm);
  if(p) showPointDetail(p); else showUnknownPoint(nm);
});

/* ================= ホーム ================= */
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
  if(!suppressHistory && !IS_APPLYING_HISTORY && !IS_APPLYING_BROWSER_HISTORY){
    pushState({type:'home'});
  }
  requestAnimationFrame(equalizeTopCards);
}
homeBtn.addEventListener('click', ()=>goHome());

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
inputEl.addEventListener('keydown', e=>{
  if(e.key==='Enter'){ e.preventDefault(); runSearch(); }
  else if(['ArrowDown','ArrowUp','Escape'].includes(e.key)){
    handleSuggestionKeyboard(e);
  }
});
searchBtn.addEventListener('click', runSearch);
document.addEventListener('click', e=>{
  if(!e.target.closest('.suggestion-wrapper') && !e.target.closest('#acupoint-search-input')){
    clearSuggestions();
  }
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
    if(ENABLE_URL_SYNC){
      INITIAL_URL_STATE = parseStateFromLocation();
    }
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
        // 初回 URL 状態適用
        if(INITIAL_URL_STATE){
          pushState(INITIAL_URL_STATE,true);
          applyState(INITIAL_URL_STATE);
        } else {
          pushState({type:'home'},true);
          applyState({type:'home'});
        }
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

/* ================= [[ ]] Fallback ================= */
(function installRegionFallback(){
  document.addEventListener('DOMContentLoaded', ()=>{
    const container=document.getElementById('inline-acupoint-result');
    if(!container) return;
    const patch=()=>{
      const el=document.getElementById('result-region');
      if(el && el.innerHTML && el.innerHTML.includes('[[')){
        el.innerHTML=applyRedMarkup(el.innerHTML);
        el.innerHTML=linkifyRegionAcupoints(el.innerHTML);
      }
    };
    const mo=new MutationObserver(patch);
    mo.observe(container,{childList:true,subtree:true,characterData:true});
    patch();
  });
})();

/* ================= Version 表示（任意） ================= */
(function showVersion(){
  const sf=document.getElementById('status-float');
  if(sf){
    const span=document.createElement('span');
    span.style.marginLeft='8px';
    span.textContent='Version: '+APP_VERSION;
    sf.appendChild(span);
  }
})();
