/********************************************************************
 * 経穴検索 + 臨床病証 + 4階層(分類/系統/症状/病証) + 治療方針表示
 * Robust Parser / CSV Normalization Hardened
 * APP_VERSION: 20250929-ROBUST-NORMALIZE-R2
 ********************************************************************/
const APP_VERSION='20250929-ROBUST-NORMALIZE-R2';

/* ---------- 設定/デバッグ ---------- */
const DEBUG_CLINICAL_PARSE=true;        // 必要に応じ false
const MAX_DEBUG_WARN=200;
let debugWarnCount=0;
function dbgWarn(...a){
  if(!DEBUG_CLINICAL_PARSE) return;
  if(debugWarnCount<MAX_DEBUG_WARN){
    console.warn('[CLINICAL_PARSE]',...a);
    debugWarnCount++;
    if(debugWarnCount===MAX_DEBUG_WARN) console.warn('[CLINICAL_PARSE] (以降抑制)');
  }
}

/* ---------- 定数 / ファイル ---------- */
const CSV_FILE='経穴・経絡.csv';
const CLINICAL_CSV_FILE='東洋臨床論.csv';
const CSV_PATH=encodeURI(CSV_FILE);
const CLINICAL_CSV_PATH=encodeURI(CLINICAL_CSV_FILE);
const MIN_QUERY_LENGTH=1;
const EXPECTED_TOTAL=361;

/* 読み仮名/筋肉マップ（外部JS） */
const READINGS=window.ACU_READINGS||{};
const MUSCLE_MAP=window.ACU_MUSCLE_MAP||{};

/* ---------- 正規化ユーティリティ ---------- */
function normalizeNFC(s){ return s? s.normalize('NFC'):''; }
function stripControlSpaces(str){
  return normalizeNFC(str||'')
    .replace(/[\u0000-\u001F\u007F]/g,'')
    .replace(/[\u200B-\u200D\u2060]/g,'')   // ゼロ幅類
    .replace(/\uFEFF/g,'')
    .replace(/[ \u00A0\u1680\u2000-\u200B\u202F\u205F\u3000]/g,' ');
}
function normalizeKey(s){
  return stripControlSpaces(s||'')
    .replace(/[ \u00A0\u3000]+/g,'')
    .replace(/\r?\n/g,'')
    .trim();
}
function normalizeLooseCell(s){
  return stripControlSpaces(s||'')
    .replace(/\r?\n+/g,' / ')
    .replace(/ {2,}/g,' ')
    .trim();
}
function trimOuter(s){ return (s||'').trim(); }
function isHiraganaOnly(s){ return !!s && /^[\u3041-\u3096]+$/.test(s); }
function isSpace(ch){ return /[ \u00A0\u1680\u2000-\u200B\u202F\u205F\u3000]/.test(ch); }
function escapeHTML(s){
  return (s||'').replace(/[&<>"']/g,c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
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
function isShown(el){ return el && !el.classList.contains('hidden'); }

/* ---------- 状態 ---------- */
let ACUPOINTS=[];
let ACUPOINT_NAME_LIST=[];
let ACUPOINT_NAME_SET=new Set();

let DATA_READY=false;
let CLINICAL_READY=false;

let CLINICAL_DATA={ order:[], cats:{} };
let clinicalHierarchy={};
let ACUPOINT_PATTERN_INDEX={};
let rawClinicalCSV='';

let patternNameNormalizeMap=new Map();
let patternNormToOriginals=new Map();

/* 履歴 */
let historyStack=[];
let historyIndex=-1;
let IS_APPLYING_HISTORY=false;
let patternHistory=[];
let pointHistory=[];
const HISTORY_LIMIT=300;

/* ---------- DOM 参照 ---------- */
const inputEl=document.getElementById('acupoint-search-input');
const suggestionListEl=document.getElementById('acupoint-suggestion-list');
const searchBtn=document.getElementById('search-btn');

const statusEl=document.getElementById('data-load-status');
const clinicalStatusEl=document.getElementById('clinical-load-status');

const inlineAcupointResult=document.getElementById('inline-acupoint-result');
const resultNameEl=document.getElementById('result-name');
const resultMeridianEl=document.getElementById('result-meridian');
const resultRegionEl=document.getElementById('result-region');
const resultImportantEl=document.getElementById('result-important');
const resultMuscleEl=document.getElementById('result-muscle');
const relatedSymptomsEl=document.getElementById('related-symptoms');

const classificationSelect=document.getElementById('classification-select');
const systemSelect=document.getElementById('system-select');
const symptomSelect=document.getElementById('symptom-select');
const patternSelect=document.getElementById('clinical-pattern-select');

const clinicalResultEl=document.getElementById('clinical-treatment-result');
const clinicalTitleEl=document.getElementById('clinical-selected-title');
const clinicalGroupsEl=document.getElementById('clinical-treatment-groups');

const searchCard=document.getElementById('search-card');
const symptomCard=document.getElementById('symptom-card');
const meridianImageSection=document.getElementById('meridian-image-section');
const meridianImageEl=document.getElementById('meridian-image');

const homeBtn=document.getElementById('home-btn');
const backBtn=document.getElementById('back-btn');
const forwardBtn=document.getElementById('forward-btn');

const patternHistoryBtn=document.getElementById('pattern-history-btn');
const patternHistoryMenu=document.getElementById('pattern-history-menu');
const patternHistoryMenuList=document.getElementById('pattern-history-menu-list');
const pointHistoryBtn=document.getElementById('point-history-btn');
const pointHistoryMenu=document.getElementById('point-history-menu');
const pointHistoryMenuList=document.getElementById('point-history-menu-list');

/* Home ギャラリー */
const homeGallerySection=document.getElementById('home-gallery-section');
const homeGallerySelect=document.getElementById('home-gallery-select');
const homeGalleryImage=document.getElementById('home-gallery-image');
const homeGalleryFallback=document.getElementById('home-gallery-fallback');
const HOME_GALLERY_IMAGES=[
  { file:'十四経経脈経穴図_1.前面.jpeg', label:'① 前面' },
  { file:'十四経経脈経穴図_2.後面.jpeg', label:'② 後面' },
  { file:'十四経経脈経穴図_3.後面(骨格).jpeg', label:'③ 後面(骨格)' },
  { file:'十四経経脈経穴図_4.側面(筋肉).jpeg', label:'④ 側面 (筋肉)' }
];
const HOME_GALLERY_LS_KEY='homeGallery.lastFile';

/* ---------- 履歴ユーティリティ ---------- */
function statesEqual(a,b){
  if(!a||!b) return false;
  if(a.type!==b.type) return false;
  if(a.type==='home') return true;
  if(a.type==='point'||a.type==='unknownPoint') return a.name===b.name;
  if(a.type==='pattern') return a.path===b.path && a.pattern===b.pattern;
  return false;
}
function updateNavButtons(){
  backBtn.disabled=(historyIndex<=0);
  forwardBtn.disabled=(historyIndex<0||historyIndex>=historyStack.length-1);
  if(!patternHistoryMenu.classList.contains('hidden')) renderPatternHistoryMenuSafely();
  if(!pointHistoryMenu.classList.contains('hidden')) renderPointHistoryMenuSafely();
}
function updateHistoryBadge(){
  if(pointHistoryBtn){
    pointHistoryBtn.dataset.count=pointHistory.length;
    pointHistoryBtn.title=`経穴 履歴 - ${pointHistory.length}件`;
  }
  if(patternHistoryBtn){
    patternHistoryBtn.dataset.count=patternHistory.length;
    patternHistoryBtn.title=`病証 履歴 - ${patternHistory.length}件`;
  }
}
function pushState(state,replace=false){
  if(IS_APPLYING_HISTORY) return;
  const prev=historyStack[historyIndex]||null;
  state.showPoint= state.showPoint ?? isShown(inlineAcupointResult);
  state.showPattern= state.showPattern ?? isShown(clinicalResultEl);
  if(state.type==='home'){ state.showPoint=false; state.showPattern=false; }
  else if(state.type==='point'||state.type==='unknownPoint'){ state.showPoint=true; }
  else if(state.type==='pattern'){ state.showPattern=true; }
  if(prev){
    if(state.type==='pattern' && prev.showPoint) state.showPoint=true;
    if((state.type==='point'||state.type==='unknownPoint') && prev.showPattern) state.showPattern=true;
  }
  if(historyIndex>=0 && statesEqual(historyStack[historyIndex],state)){
    historyStack[historyIndex].showPoint=state.showPoint;
    historyStack[historyIndex].showPattern=state.showPattern;
  }else{
    if(replace){
      if(historyIndex>=0) historyStack[historyIndex]=state;
      else { historyStack.push(state); historyIndex=0;}
    }else{
      if(historyIndex < historyStack.length-1){
        historyStack=historyStack.slice(0,historyIndex+1);
      }
      state.ts=Date.now();
      historyStack.push(state);
      historyIndex=historyStack.length-1;
    }
    if(state.type==='pattern'){
      patternHistory.push({ref:state,idx:historyIndex,ts:state.ts});
      if(patternHistory.length>HISTORY_LIMIT) patternHistory.shift();
    } else if(state.type==='point'||state.type==='unknownPoint'){
      pointHistory.push({ref:state,idx:historyIndex,ts:state.ts});
      if(pointHistory.length>HISTORY_LIMIT) pointHistory.shift();
    }
  }
  updateHistoryBadge();
  updateNavButtons();
}
function formatTime(ts){
  const d=new Date(ts||Date.now());
  const pad=n=>('0'+n).slice(-2);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
function goBack(){
  if(historyIndex>0){
    historyIndex--;
    applyState(historyStack[historyIndex]);
  }
}
function goForward(){
  if(historyIndex < historyStack.length-1){
    historyIndex++;
    applyState(historyStack[historyIndex]);
  }
}

/* ---------- 経穴 CSV ---------- */
function parseAcuCSV(raw){
  if(!raw) return [];
  const text=raw.replace(/\uFEFF/g,'').replace(/\r\n/g,'\n');
  const lines=text.split('\n').filter(l=>l.trim());
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
    if(cols[0]==='経絡' && cols[1]==='経穴') continue;
    if(cols.length<2) continue;
    const meridian=trimOuter(cols[0]);
    const name=trimOuter(cols[1]);
    if(!meridian||!name) continue;
    const region=cols[2]?cols[2].trim():'';
    const important=cols[3]?cols[3].trim():'';
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

/* ---------- 治療方針トークン抽出 ---------- */
const LEADING_SYMBOL_RE=/^[※＊*＋+･・.\-／/\\]+/;
function parseTreatmentPoints(raw){
  if(!raw) return [];
  return raw
    .replace(/（[^）]*）/g,'')
    .replace(/\([^)]*\)/g,'')
    .replace(/\r?\n/g,'/')
    .replace(/[，、]/g,'/')
    .replace(/[＋+･・]/g,'/')
    .replace(/／/g,'/')
    .replace(/\/{2,}/g,'/')
    .split('/')
    .map(t=>t.replace(LEADING_SYMBOL_RE,''))
    .map(t=>t.trim())
    .filter(Boolean)
    .map(t=>t.replace(/[。.,、，;；/]+$/,''))
    .filter(t=>t.length)
    .filter(t=>!/^[-・※＊*+/／\/]+$/.test(t))
    .map(t=>normalizeKey(t));
}
function normalizeAcuLookupName(name){
  return normalizeKey(name);
}
function findAcupointByToken(token){
  const nk=normalizeAcuLookupName(token);
  return ACUPOINTS.find(p=>normalizeKey(p.name)===nk)||null;
}
function buildNameLookup(){
  ACUPOINT_NAME_LIST=ACUPOINTS.map(p=>p.name).sort((a,b)=> b.length - a.length);
  ACUPOINT_NAME_SET=new Set(ACUPOINT_NAME_LIST.map(n=>normalizeKey(n)));
}
function matchTokenWithSpaces(raw,pos,token){
  let i=pos,k=0,len=raw.length;
  while(k<token.length){
    while(i<len && isSpace(raw[i])) i++;
    if(i>=len) return 0;
    if(raw[i]!==token[k]) return 0;
    i++; k++;
  }
  return i-pos;
}

/* ---------- 括弧内リンク化 ---------- */
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
      }else out+=escapeHTML(matched);
      i+=consumed;
    }else{ out+=escapeHTML(ch); i++; }
  }
  return escapeHTML(open)+out+escapeHTML(close);
}

/* ---------- 治療方針本文リンク化 ---------- */
function buildPointsHTML(rawPoints,tokens){
  if(!rawPoints) return '';
  const uniq=[...new Set(tokens||[])];
  const sorted=uniq.sort((a,b)=> b.length - a.length);
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
    if(/[※＊*＋+・･.\-]/.test(ch)){ out+=escapeHTML(ch); i++; continue; }
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
      }else{
        out+=`<a href="#" class="treat-point-link treat-point-unknown" data-point="${escapeHTML(matched)}">${escapeHTML(matched)}</a>`;
      }
      i+=consumed; continue;
    }
    out+=escapeHTML(ch);
    i++;
  }
  return out;
}

/* ---------- Clinical CSV Robust Parser ---------- */
function rebuildLogicalRows(raw){
  const physical=raw.replace(/\uFEFF/g,'').replace(/\r\n/g,'\n').split('\n');
  const rows=[]; let buf=''; let quotes=0;
  for(const line of physical){
    const ln=line.replace(/\uFEFF/g,'');
    if(buf) buf+='\n'+ln; else buf=ln;
    quotes=(buf.match(/"/g)||[]).length;
    if(quotes%2===0){
      rows.push(buf); buf=''; quotes=0;
    }
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
  return cols.map(c=>normalizeLooseCell(c));
}
function isCategoryRow(cols){
  if(!cols.length) return false;
  const c0=normalizeKey(cols[0]);
  return /^[0-9０-９][0-9０-９.-]*\.$/.test(c0);
}
function findHeaderIndex(cols,keywordPattern){
  for(let i=0;i<cols.length;i++){
    const raw=cols[i];
    if(!raw) continue;
    const norm=normalizeKey(raw);
    if(keywordPattern.test(norm)) return i;
  }
  return -1;
}
function isPatternHeaderRow(cols){
  return findHeaderIndex(cols,/病証名/)>=0;
}
function isTreatmentRow(cols){
  return findHeaderIndex(cols,/治療方針/)>=0;
}
function isPotentialCommentRow(cols){
  if(!cols.length) return false;
  if(isCategoryRow(cols)||isPatternHeaderRow(cols)||isTreatmentRow(cols)) return false;
  return cols.some((c,i)=> i>0 && /^[（(]/.test(c||''));
}
function dissectTreatmentCell(cell){
  if(!cell) return {label:'',rawPoints:'',comment:''};
  const lines=cell.split(/[\/\n]+/).map(l=>l.trim()).filter(Boolean);
  let comment='';
  if(lines.length && /^[（(]/.test(lines[lines.length-1])) comment=lines.pop();
  let main=lines.join(' ');
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
  }else label=main.trim();
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
  patternNameNormalizeMap.clear();
  patternNormToOriginals.clear();
  const logical=rebuildLogicalRows(raw);
  const table=logical.map(parseCSVLogicalRow);
  const data={order:[],cats:{}};
  let i=0;
  while(i<table.length){
    const row=table[i];
    if(!row.length){ i++; continue; }
    if(isCategoryRow(row)){
      const category=normalizeKey(row[0]);
      if(!data.cats[category]){
        data.cats[category]={patternOrder:[],patterns:{}};
        data.order.push(category);
      }
      i++;
      if(i>=table.length) break;
      if(!isPatternHeaderRow(table[i])) continue;
      const pRow=table[i];
      const headerIdx=findHeaderIndex(pRow,/病証名/);
      if(headerIdx<0){ i++; continue; }
      const patternNames=[];
      for(let c=headerIdx+1;c<pRow.length;c++){
        const name=trimOuter(pRow[c]);
        if(name){
          patternNames.push(name);
          if(!data.cats[category].patterns[name]){
            data.cats[category].patterns[name]=[];
            data.cats[category].patternOrder.push(name);
          }
          const norm=normalizeKey(name);
          patternNameNormalizeMap.set(name,norm);
          if(!patternNormToOriginals.has(norm)) patternNormToOriginals.set(norm,new Set());
          patternNormToOriginals.get(norm).add(name);
        }
      }
      i++;
      while(i<table.length){
        const r=table[i];
        if(isCategoryRow(r)) break;
        if(isPatternHeaderRow(r)){ i++; continue; }
        if(!isTreatmentRow(r)){
          if(r.some(c=>/治療方針|病証名/.test(c))) dbgWarn('疑似治療方針行だが検出失敗',r);
          i++; continue;
        }
        const treatIdx=findHeaderIndex(r,/治療方針/);
        if(treatIdx===-1){ i++; continue; }
        const after=r.slice(treatIdx+1);
        const inter=isInterleavedTreatmentRow(after,patternNames.length);
        if(inter){
          const groups=parseInterleavedRow(after,patternNames);
          groups.forEach(g=>{
            data.cats[category].patterns[g.pattern].push({
              label:g.label,
              rawPoints:g.rawPoints,
              comment:g.comment,
              tokens:parseTreatmentPoints(g.rawPoints)
            });
          });
          i++;
        }else{
          const next=table[i+1]||[];
          const commentRow=isPotentialCommentRow(next)? next:null;
            patternNames.forEach((pName,idx)=>{
              const col=treatIdx+1+idx;
              const cell=r[col]||'';
              if(!cell) return;
              const {label,rawPoints,comment}=dissectTreatmentCell(cell);
              if(!label && !rawPoints) return;
              let finalComment=comment;
              if(!finalComment && commentRow){
                const cc=commentRow[col]||'';
                if(/^[（(]/.test(cc)) finalComment=cc;
              }
              data.cats[category].patterns[pName].push({
                label,
                rawPoints,
                comment:finalComment,
                tokens:parseTreatmentPoints(rawPoints)
              });
            });
          i+= commentRow?2:1;
        }
      }
      continue;
    }
    i++;
  }
  return data;
}

/* ---------- 階層構築 ---------- */
function buildClinicalHierarchyFromRaw(raw){
  const logical=rebuildLogicalRows(raw);
  const table=logical.map(parseCSVLogicalRow);
  clinicalHierarchy={};
  let currentClassification=null;
  let currentSystem=null;
  let currentSymptom=null;
  for(const row of table){
    if(!row.length) continue;
    if(isCategoryRow(row)){
      currentClassification=normalizeKey(row[0]);
      if(!clinicalHierarchy[currentClassification]){
        clinicalHierarchy[currentClassification]={systems:{},order:[]};
      }
      currentSystem=null; currentSymptom=null;
      continue;
    }
    if(!currentClassification) continue;

    if(row[1] && !row[2]){
      currentSystem=row[1];
      if(!clinicalHierarchy[currentClassification].systems[currentSystem]){
        clinicalHierarchy[currentClassification].systems[currentSystem]={symptoms:{},order:[]};
        clinicalHierarchy[currentClassification].order.push(currentSystem);
      }
      currentSymptom=null;
      continue;
    }
    if(row[2] && /^[0-9０-９]+\.?/.test(normalizeKey(row[2]))){
      currentSymptom=row[2];
      const sys=currentSystem && currentSystem.trim()? currentSystem:'-';
      if(!clinicalHierarchy[currentClassification].systems[sys]){
        clinicalHierarchy[currentClassification].systems[sys]={symptoms:{},order:[]};
        clinicalHierarchy[currentClassification].order.push(sys);
      }
      const sysNode=clinicalHierarchy[currentClassification].systems[sys];
      if(!sysNode.symptoms[currentSymptom]){
        sysNode.symptoms[currentSymptom]={patterns:[],patternGroups:{}};
        sysNode.order.push(currentSymptom);
      }
      continue;
    }
    if(row[2] && normalizeKey(row[2]).startsWith('病証名')){
      if(!currentClassification||!currentSymptom) continue;
      const sys=currentSystem && currentSystem.trim()? currentSystem:'-';
      const symNode=clinicalHierarchy[currentClassification].systems[sys]?.symptoms?.[currentSymptom];
      if(!symNode) continue;
      for(let c=3;c<row.length;c++){
        const pat=trimOuter(row[c]||'');
        if(!pat) continue;
        if(!symNode.patterns.includes(pat)){
          symNode.patterns.push(pat);
          const groups=CLINICAL_DATA.cats[currentClassification]?.patterns?.[pat]||[];
          symNode.patternGroups[pat]=groups;
        }
      }
    }
  }
  Object.keys(clinicalHierarchy).forEach(cf=>{
    clinicalHierarchy[cf].order=[...new Set(clinicalHierarchy[cf].order)].map(x=>x&&x.trim()?x:'-');
    Object.values(clinicalHierarchy[cf].systems).forEach(sysNode=>{
      sysNode.order=[...new Set(sysNode.order)];
    });
  });
}

/* ---------- 逆インデックス ---------- */
function rebuildAcuPointPatternIndex(){
  ACUPOINT_PATTERN_INDEX={};
  CLINICAL_DATA.order.forEach(cat=>{
    const catObj=CLINICAL_DATA.cats[cat];
    if(!catObj) return;
    catObj.patternOrder.forEach(pat=>{
      const normPat=patternNameNormalizeMap.get(pat)||normalizeKey(pat);
      const groups=catObj.patterns[pat]||[];
      const seen=new Set();
      groups.forEach(g=>{
        const toks=g.tokens||[];
        toks.forEach(tk=>{
          const tkNorm=normalizeKey(tk);
          if(!tkNorm || seen.has(tkNorm)) return;
          seen.add(tkNorm);
          if(!ACUPOINT_PATTERN_INDEX[tkNorm]) ACUPOINT_PATTERN_INDEX[tkNorm]=[];
          ACUPOINT_PATTERN_INDEX[tkNorm].push({cat,pattern:pat,patternNorm:normPat});
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
    ACUPOINT_PATTERN_INDEX[k]=[...uniq.values()];
  });
}

/* ---------- レイアウト ---------- */
function equalizeTopCards(){
  if(window.innerWidth<860){
    searchCard.style.height='';
    symptomCard.style.height='';
    return;
  }
  searchCard.style.height='';
  symptomCard.style.height='';
  const maxH=Math.max(searchCard.scrollHeight,symptomCard.scrollHeight);
  searchCard.style.height=maxH+'px';
  symptomCard.style.height=maxH+'px';
}

/* ---------- サジェスト ---------- */
function filterPoints(qInput){
  const q=normalizeKey(qInput);
  if(q.length<MIN_QUERY_LENGTH) return [];
  if(isHiraganaOnly(q)){
    let list=ACUPOINTS.filter(p=>p.reading && p.reading.startsWith(q));
    if(!list.length) list=ACUPOINTS.filter(p=>p.reading && p.reading.includes(q));
    return list.map(p=>({...p,_matchType:'name'}));
  }
  const nm=[]; const seen=new Set();
  for(const p of ACUPOINTS){
    if(normalizeKey(p.name).includes(q)){ nm.push({...p,_matchType:'name'}); seen.add(p.name);}
  }
  const mm=[];
  for(const p of ACUPOINTS){
    if(seen.has(p.name)) continue;
    if(p.muscle && p.muscle.includes(q)){ mm.push({...p,_matchType:'muscle'}); seen.add(p.name);}
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
  const qRaw=normalizeKey(inputEl.value);
  const hira=isHiraganaOnly(qRaw)? qRaw:'';
  const qRegex=hira? new RegExp(hira.replace(/([.*+?^=!:${}()|[\\]\\])/g,'\\$1'),'g'):null;
  list.slice(0,120).forEach((p,i)=>{
    const li=document.createElement('li');
    li.dataset.id=p.name;
    li.dataset.matchType=p._matchType||'';
    li.setAttribute('role','option');
    li.setAttribute('aria-selected',i===0?'true':'false');
    let readingHTML=escapeHTML(p.reading||'');
    if(qRegex && p.reading){
      readingHTML=readingHTML.replace(qRegex,m=>`<mark>${m}</mark>`);
    }
    const important=!!p.important;
    li.innerHTML=`
      <span class="sug-name ${important?'important':''}">${escapeHTML(p.name)}</span>
      <span class="sug-slash">/</span>
      <span class="sug-reading">${readingHTML}</span>
      <span class="sug-badges">${important?'<span class="badge badge-important">★</span>':''}</span>`;
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
  const items=[...suggestionListEl.querySelectorAll('li')];
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

/* ---------- Region 内リンク化 ---------- */
function linkifyRegionAcupoints(html){
  if(!html||!ACUPOINT_NAME_LIST.length) return html;
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
          a.href='#'; a.className='treat-point-link';
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
      [...node.childNodes].forEach(process);
    }
  }
  [...wrapper.childNodes].forEach(process);
  return wrapper.innerHTML;
}

/* ---------- 画像 ---------- */
function hideMeridianImage(){
  meridianImageSection.classList.add('hidden');
  meridianImageEl.removeAttribute('src');
  meridianImageEl.alt='';
}
function updateMeridianImage(meridian){
  if(!meridian){ hideMeridianImage(); return; }
  const url='image/'+encodeURI(meridian+'.png')+'?v='+APP_VERSION;
  meridianImageEl.onload=()=>meridianImageSection.classList.remove('hidden');
  meridianImageEl.onerror=()=>hideMeridianImage();
  meridianImageEl.alt=meridian;
  meridianImageEl.src=url;
}

/* ---------- 経穴詳細 ---------- */
function showPointDetail(p, suppressHistory=false){
  hideHomeGallery();
  let regionHTML=p.region||'';
  if(regionHTML.includes('[[')){
    regionHTML=p.regionRaw? applyRedMarkup(p.regionRaw): applyRedMarkup(regionHTML);
  }
  regionHTML=linkifyRegionAcupoints(regionHTML);
  resultNameEl.textContent=`${p.name}${p.reading?` (${p.reading})`:''}`;
  if(p.important) resultNameEl.classList.add('is-important'); else resultNameEl.classList.remove('is-important');
  resultMeridianEl.textContent=p.meridian||'（経絡未登録）';
  resultRegionEl.innerHTML=regionHTML||'（部位未登録）';
  if(p.important){
    resultImportantEl.innerHTML=`<span class="acu-important-flag">${escapeHTML(p.important)}</span>`;
  }else resultImportantEl.textContent='-';
  resultMuscleEl.textContent=p.muscle||'（筋肉未登録）';
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
  const normPoint=normalizeKey(pointName);
  if(!ACUPOINT_PATTERN_INDEX[normPoint] && CLINICAL_READY){
    rebuildAcuPointPatternIndex();
  }
  const arr=ACUPOINT_PATTERN_INDEX[normPoint];
  if(!CLINICAL_READY || !arr || !arr.length){
    relatedSymptomsEl.innerHTML='<li>-</li>'; return;
  }
  arr.forEach(entry=>{
    const display=getDisplayPatternName(entry.pattern);
    const li=document.createElement('li');
    li.innerHTML=`<a href="#" class="acu-pattern-link" data-cat="${escapeHTML(entry.cat)}" data-pattern="${escapeHTML(entry.pattern)}">${escapeHTML(display)}</a>`;
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
  resultMuscleEl.textContent='（筋肉未登録）';
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

/* ---------- 4段階セレクト ---------- */
function resetHierarchySelects(keepClassification=true){
  if(!keepClassification){
    classificationSelect.value='';
  }
  systemSelect.innerHTML='<option value="">--</option>';
  symptomSelect.innerHTML='<option value="">--</option>';
  patternSelect.innerHTML='<option value="">--</option>';
  systemSelect.disabled=true;
  systemSelect.classList.remove('is-system-disabled');
  symptomSelect.disabled=true;
  patternSelect.disabled=true;
  clinicalResultEl.classList.add('hidden');
  clinicalGroupsEl.innerHTML='';
}
function populateClassification(){
  classificationSelect.innerHTML='<option value="">--</option>';
  Object.keys(clinicalHierarchy).forEach(cf=>{
    const opt=document.createElement('option');
    opt.value=cf; opt.textContent=cf;
    classificationSelect.appendChild(opt);
  });
  classificationSelect.disabled=false;
}
function renderSystemOptions(cf){
  systemSelect.innerHTML='';
  systemSelect.classList.remove('is-system-disabled');
  systemSelect.disabled=false;
  symptomSelect.innerHTML='<option value="">--</option>'; symptomSelect.disabled=true;
  patternSelect.innerHTML='<option value="">--</option>'; patternSelect.disabled=true;
  const cls=clinicalHierarchy[cf];
  if(!cls){
    systemSelect.innerHTML='<option value="">--</option>';
    systemSelect.disabled=true;
    return;
  }
  let systems=cls.order && cls.order.length ? cls.order : ['-'];
  systems=systems.map(s=>s && s.trim()? s:'-');
  systems=[...new Set(systems)];
  if(systems.length===1 && systems[0]==='-'){
    const opt=document.createElement('option');
    opt.value='-'; opt.textContent='-';
    systemSelect.appendChild(opt);
    systemSelect.value='-';
    systemSelect.disabled=true;
    systemSelect.classList.add('is-system-disabled');
    renderSymptomOptions(cf,'-');
    return;
  }
  const blank=document.createElement('option');
  blank.value=''; blank.textContent='--';
  systemSelect.appendChild(blank);
  systems.forEach(s=>{
    const opt=document.createElement('option');
    opt.value=s; opt.textContent=s;
    systemSelect.appendChild(opt);
  });
}
function renderSymptomOptions(cf,sys){
  symptomSelect.innerHTML='';
  patternSelect.innerHTML='<option value="">--</option>'; patternSelect.disabled=true;
  const sysNode=clinicalHierarchy[cf]?.systems?.[sys];
  if(!sysNode){
    symptomSelect.innerHTML='<option value="">--</option>';
    symptomSelect.disabled=true;
    return;
  }
  const blank=document.createElement('option');
  blank.value=''; blank.textContent='--';
  symptomSelect.appendChild(blank);
  sysNode.order.forEach(sym=>{
    const opt=document.createElement('option');
    opt.value=sym; opt.textContent=sym;
    symptomSelect.appendChild(opt);
  });
  symptomSelect.disabled=false;
}
function renderPatternOptions(cf,sys,sym){
  patternSelect.innerHTML='';
  const symNode=clinicalHierarchy[cf]?.systems?.[sys]?.symptoms?.[sym];
  if(!symNode){
    patternSelect.innerHTML='<option value="">--</option>'; patternSelect.disabled=true; return;
  }
  const blank=document.createElement('option');
  blank.value=''; blank.textContent='--';
  patternSelect.appendChild(blank);
  symNode.patterns.forEach(pn=>{
    const opt=document.createElement('option');
    opt.value=pn; opt.textContent=getDisplayPatternName(pn);
    patternSelect.appendChild(opt);
  });
  patternSelect.disabled=false;
}
function renderPatternDetail(cf,sys,sym,pat,fromHistory=false){
  clinicalGroupsEl.innerHTML='';
  clinicalResultEl.classList.add('hidden');
  if(!cf||!sym||!pat) return;
  const symNode=clinicalHierarchy[cf]?.systems?.[sys]?.symptoms?.[sym];
  const groups=symNode?.patternGroups?.[pat]||[];
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
  clinicalGroupsEl.querySelectorAll('.treat-point-link').forEach(a=>{
    a.addEventListener('click',e=>{
      e.preventDefault();
      const nm=a.dataset.point;
      const p=findAcupointByToken(nm);
      if(p) showPointDetail(p); else showUnknownPoint(nm);
    });
  });
  clinicalResultEl.classList.remove('hidden');
  if(!fromHistory && !IS_APPLYING_HISTORY){
    pushState({
      type:'pattern',
      classification:cf,
      system:sys,
      symptom:sym,
      pattern:pat,
      path:`${cf}||${sys}||${sym}`
    });
  }
  requestAnimationFrame(equalizeTopCards);
}

/* 関連病証クリック */
document.addEventListener('click',e=>{
  const a=e.target.closest('.acu-pattern-link');
  if(!a) return;
  e.preventDefault();
  const cat=a.dataset.cat;
  const pat=a.dataset.pattern;
  if(!cat||!pat) return;
  if(!clinicalHierarchy[cat]) return;
  let found=null;
  Object.entries(clinicalHierarchy[cat].systems).some(([sys,sysNode])=>{
    return Object.entries(sysNode.symptoms).some(([sym,sNode])=>{
      if(sNode.patterns.includes(pat)){ found={sys,sym}; return true; }
      return false;
    });
  });
  if(!found){
    classificationSelect.value=cat;
    classificationSelect.dispatchEvent(new Event('change'));
    return;
  }
  IS_APPLYING_HISTORY=true;
  applyPatternPathSilently(cat,found.sys,found.sym,pat);
  IS_APPLYING_HISTORY=false;
  pushState({
    type:'pattern',
    classification:cat,
    system:found.sys,
    symptom:found.sym,
    pattern:pat,
    path:`${cat}||${found.sys}||${found.sym}`
  });
});

/* 治療方針内経穴クリック */
document.addEventListener('click',e=>{
  const a=e.target.closest('.treat-point-link');
  if(!a) return;
  e.preventDefault();
  const nm=a.dataset.point;
  const p=findAcupointByToken(nm);
  if(p) showPointDetail(p); else showUnknownPoint(nm);
});

/* Home */
function showHomeGallery(){ homeGallerySection.classList.remove('hidden'); }
function hideHomeGallery(){ homeGallerySection.classList.add('hidden'); }
function goHome(suppress=false){
  inputEl.value='';
  clearSuggestions();
  inlineAcupointResult.classList.add('hidden');
  hideMeridianImage();
  clinicalGroupsEl.innerHTML='';
  clinicalResultEl.classList.add('hidden');
  const span=clinicalTitleEl.querySelector('.pattern-name-highlight');
  if(span) span.textContent='';
  relatedSymptomsEl.innerHTML='<li>-</li>';
  showHomeGallery();
  classificationSelect.value='';
  systemSelect.innerHTML='<option value="">--</option>';
  symptomSelect.innerHTML='<option value="">--</option>';
  patternSelect.innerHTML='<option value="">--</option>';
  systemSelect.disabled=true; systemSelect.classList.remove('is-system-disabled');
  symptomSelect.disabled=true; patternSelect.disabled=true;
  window.scrollTo({top:0,behavior:'smooth'});
  requestAnimationFrame(()=>{ inputEl.focus(); inputEl.select(); });
  requestAnimationFrame(equalizeTopCards);
  if(!suppress && !IS_APPLYING_HISTORY){
    pushState({type:'home'});
  }
}
homeBtn.addEventListener('click',()=>goHome());

/* ナビキー */
backBtn.addEventListener('click',goBack);
forwardBtn.addEventListener('click',goForward);
document.addEventListener('keydown',e=>{
  if(e.altKey && !e.metaKey && !e.shiftKey && !e.ctrlKey){
    if(e.key==='ArrowLeft'){ e.preventDefault(); goBack(); }
    else if(e.key==='ArrowRight'){ e.preventDefault(); goForward(); }
  }
});

/* 検索 */
function runSearch(){
  if(!DATA_READY) return;
  const q=normalizeKey(inputEl.value);
  if(!q){ clearSuggestions(); return; }
  const exact=ACUPOINTS.find(p=>normalizeKey(p.name)===q);
  if(exact){ selectPoint(exact); return; }
  const list=filterPoints(q);
  if(list.length===1) selectPoint(list[0]);
  else renderSuggestions(list);
}
inputEl.addEventListener('keydown',e=>{
  if(['ArrowDown','ArrowUp','Enter','Escape'].includes(e.key)){
    handleSuggestionKeyboard(e); return;
  }
});
inputEl.addEventListener('input',()=>{
  if(!DATA_READY) return;
  const val=inputEl.value;
  if(normalizeKey(val).length<MIN_QUERY_LENGTH){ clearSuggestions(); return; }
  renderSuggestions(filterPoints(val));
});
searchBtn.addEventListener('click',runSearch);
document.addEventListener('click',e=>{
  if(!e.target.closest('.suggestion-wrapper') && !e.target.closest('#acupoint-search-input')){
    clearSuggestions();
  }
});

/* Home ギャラリー */
function initHomeGallery(){
  if(!homeGallerySelect) return;
  homeGallerySelect.innerHTML='';
  let idx=0;
  try{
    const saved=localStorage.getItem(HOME_GALLERY_LS_KEY);
    if(saved){
      const p=HOME_GALLERY_IMAGES.findIndex(i=>i.file===saved);
      if(p>=0) idx=p;
    }
  }catch(_){}
  HOME_GALLERY_IMAGES.forEach((img,i)=>{
    const opt=document.createElement('option');
    opt.value=img.file; opt.textContent=img.label;
    if(i===idx) opt.selected=true;
    homeGallerySelect.appendChild(opt);
  });
  updateHomeGalleryImage(HOME_GALLERY_IMAGES[idx].file,false);
}
function updateHomeGalleryImage(file,store=true){
  if(!homeGalleryImage) return;
  const url='image/'+encodeURI(file)+'?v='+APP_VERSION;
  homeGalleryFallback.classList.add('hidden');
  homeGalleryImage.classList.remove('hidden');
  homeGalleryImage.alt=file.replace(/\.(jpeg|jpg|png)$/i,'');
  homeGalleryImage.onload=()=>{};
  homeGalleryImage.onerror=()=>{
    homeGalleryImage.classList.add('hidden');
    homeGalleryFallback.classList.remove('hidden');
  };
  homeGalleryImage.src=url;
  if(store){
    try{ localStorage.setItem(HOME_GALLERY_LS_KEY,file);}catch(_){}
  }
}
homeGallerySelect?.addEventListener('change',()=>{
  if(homeGallerySelect.value) updateHomeGalleryImage(homeGallerySelect.value,true);
});

/* 初期化 */
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
  }catch(err){
    statusEl.textContent='経穴CSV: 失敗 '+err.message;
    console.error(err);
  }finally{
    requestAnimationFrame(equalizeTopCards);
  }
}
async function loadClinicalCSV(){
  clinicalStatusEl.textContent='臨床CSV: 読込中';
  try{
    const res=await fetch(`${CLINICAL_CSV_PATH}?v=${APP_VERSION}&_=${Date.now()}`);
    if(!res.ok) throw new Error('HTTP '+res.status);
    rawClinicalCSV=await res.text();
    CLINICAL_DATA=parseClinicalCSV(rawClinicalCSV);
    CLINICAL_DATA.order.forEach(cat=>{
      const catObj=CLINICAL_DATA.cats[cat];
      if(!catObj) return;
      catObj.patternOrder.forEach(pat=>{
        catObj.patterns[pat].forEach(g=>{
          if(!g.tokens) g.tokens=parseTreatmentPoints(g.rawPoints);
        });
      });
    });
    CLINICAL_READY=true;
    rebuildAcuPointPatternIndex();
    buildClinicalHierarchyFromRaw(rawClinicalCSV);
    populateClassification();
    clinicalStatusEl.textContent=`臨床CSV: 分類 ${Object.keys(clinicalHierarchy).length}件`;
    if(DEBUG_CLINICAL_PARSE){
      console.log('CLINICAL_DATA',CLINICAL_DATA);
      console.log('ACUPOINT_PATTERN_INDEX sample',Object.entries(ACUPOINT_PATTERN_INDEX).slice(0,5));
    }
    requestAnimationFrame(()=>{
      equalizeTopCards();
      setTimeout(equalizeTopCards,60);
      setTimeout(equalizeTopCards,250);
    });
  }catch(err){
    clinicalStatusEl.textContent='臨床CSV: 失敗 '+err.message;
    console.error(err);
  }finally{
    requestAnimationFrame(equalizeTopCards);
  }
}
function init(){
  loadAcuCSV();
  loadClinicalCSV();
  initHomeGallery();
  updateNavButtons();
  requestAnimationFrame(equalizeTopCards);
  requestAnimationFrame(()=>{ inputEl.focus(); inputEl.select(); });
  const wait=setInterval(()=>{
    if((DATA_READY||CLINICAL_READY) && historyStack.length===0){
      pushState({type:'home'});
      showHomeGallery();
    }
    if(DATA_READY && CLINICAL_READY){
      clearInterval(wait);
    }
  },150);
  requestAnimationFrame(()=>{
    equalizeTopCards();
    setTimeout(equalizeTopCards,120);
  });
}
window.addEventListener('resize',equalizeTopCards);
init();

/* NOTE: MutationObserver 不要 */
