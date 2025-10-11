/******************************************************
 * APP_VERSION 20251011-RANK-FULLRESTORE1
 * 既存 (f2922d18) ベース最小改変:
 *  - muscle-map.js 依存削除 (MUSCLE_MAP 廃止)
 *  - CSV ヘッダから筋肉<神経(筋枝)>, 神経(皮枝), 血管(血菅), ランク列を取得
 *  - 詳細表示に3項目+ランク追加 (空値は "-")
 *  - ランクは経穴名右に「ランク：X」
 *  - 検索: p.muscleBranch を筋肉マッチ対象
 *  - 旧コード構造・他機能は不変更
 ******************************************************/
const APP_VERSION='20251011-RANK-FULLRESTORE1';

const CSV_FILE='経穴・経絡.csv';
const CLINICAL_CSV_FILE='東洋臨床論.csv';
const CSV_PATH=encodeURI(CSV_FILE);
const CLINICAL_CSV_PATH=encodeURI(CLINICAL_CSV_FILE);

const MIN_QUERY_LENGTH=1;
const EXPECTED_TOTAL=361;

const READINGS = window.ACU_READINGS || {};
/* MUSCLE_MAP 削除 */

let ACUPOINTS=[];
let ACUPOINT_NAME_LIST=[];
let ACUPOINT_NAME_SET=new Set();

let DATA_READY=false;
let CLINICAL_READY=false;

let CLINICAL_HIERARCHY={};
let CLASSIFICATIONS_ORDER=[];
let ACUPOINT_PATTERN_INDEX={};

let historyStack=[];
let historyIndex=-1;
let IS_APPLYING_HISTORY=false;
let patternHistory=[];
let pointHistory=[];
const HISTORY_LIMIT=300;

/* DOM 参照 */
const inputEl=document.getElementById('acupoint-search-input');
const suggestionListEl=document.getElementById('acupoint-suggestion-list');
const searchBtn=document.getElementById('search-btn');

const statusEl=document.getElementById('data-load-status');
const clinicalStatusEl=document.getElementById('clinical-load-status');

const inlineAcupointResult=document.getElementById('inline-acupoint-result');
const resultNameEl=document.getElementById('result-name');
const resultNameTextEl=document.getElementById('result-name-text');
const resultRankEl=document.getElementById('result-rank');
const resultMeridianEl=document.getElementById('result-meridian');
const resultRegionEl=document.getElementById('result-region');
const resultImportantEl=document.getElementById('result-important');
const resultMuscleBranchEl=document.getElementById('result-muscle-branch');
const resultNerveCutaneousEl=document.getElementById('result-nerve-cutaneous');
const resultBloodVesselEl=document.getElementById('result-blood-vessel');
const relatedSymptomsEl=document.getElementById('related-symptoms');

const classificationSelect=document.getElementById('clinical-classification-select');
const systemSelect=document.getElementById('clinical-system-select');
const symptomSelect=document.getElementById('clinical-symptom-select');
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

const homeGallerySection=document.getElementById('home-gallery-section');
const homeGallerySelect=document.getElementById('home-gallery-select');
const homeGalleryImage=document.getElementById('home-gallery-image');
const homeGalleryFallback=document.getElementById('home-gallery-fallback');

/* Home ギャラリー (元コード保持) */
const HOME_GALLERY_IMAGES=[
  { file:'十四経経脈経穴図_1.前面.jpeg',        label:'① 前面' },
  { file:'十四経経脈経穴図_2.後面.jpeg',        label:'② 後面' },
  { file:'十四経経脈経穴図_3.後面(骨格).jpeg',  label:'③ 後面(骨格)' },
  { file:'十四経経脈経穴図_4.側面(筋肉).jpeg',  label:'④ 側面(筋肉)' }
];
const HOME_GALLERY_LS_KEY='homeGallery.lastFile';
function initHomeGallery(){
  if(!homeGallerySelect) return;
  homeGallerySelect.innerHTML='';
  const saved=localStorage.getItem(HOME_GALLERY_LS_KEY);
  let initialIdx=0;
  if(saved){
    const idx=HOME_GALLERY_IMAGES.findIndex(i=>i.file===saved);
    if(idx>=0) initialIdx=idx;
  }
  HOME_GALLERY_IMAGES.forEach((img,idx)=>{
    const opt=document.createElement('option');
    opt.value=img.file; opt.textContent=img.label;
    if(idx===initialIdx) opt.selected=true;
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
  if(store){ try{localStorage.setItem(HOME_GALLERY_LS_KEY,file);}catch(_){ } }
}
homeGallerySelect?.addEventListener('change',()=>{
  if(homeGallerySelect.value) updateHomeGalleryImage(homeGallerySelect.value,true);
});
function showHomeGallery(){ homeGallerySection?.classList.remove('hidden'); }
function hideHomeGallery(){ homeGallerySection?.classList.add('hidden'); }

/* Utility */
function normalizeNFC(s){ return s? s.normalize('NFC'):''; }
function removeAllUnicodeSpaces(str){
  return normalizeNFC(str||'')
    .replace(/[\u0000-\u001F\u007F]/g,'')
    .replace(/[ \u00A0\u1680\u2000-\u200B\u202F\u205F\u3000]/g,'')
    .replace(/\uFEFF/g,'');
}
function trimOuter(s){ return (s||'').trim(); }
function escapeHTML(s){ return (s||'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch])); }
function applyRedMarkup(text){
  if(!text) return '';
  if(text.includes('<span class="bui-red">')) return text;
  return text.replace(/\[\[([^\[\]\r\n]{1,120})\]\]/g,'<span class="bui-red">$1</span>');
}
function isShown(el){ return el && !el.classList.contains('hidden'); }

function getDisplayPatternName(original){
  if(!original) return '';
  const idx=original.indexOf('→');
  if(idx===-1) return original;
  const left=original.slice(0,idx).trim();
  const right=original.slice(idx+1).trim();
  if(/^【[^】]+】$/.test(left)) return `${right}→${left}`;
  return original;
}

/* 履歴 関連 (原版維持 / 必要部のみ) */
function statesEqual(a,b){
  if(!a||!b) return false;
  if(a.type!==b.type) return false;
  if(a.type==='home') return true;
  if(a.type==='point'||a.type==='unknownPoint') return a.name===b.name;
  if(a.type==='pattern')
    return a.classification===b.classification && a.system===b.system && a.symptom===b.symptom && a.pattern===b.pattern;
  return false;
}
function updateNavButtons(){
  backBtn.disabled=(historyIndex<=0);
  forwardBtn.disabled=(historyIndex<0||historyIndex>=historyStack.length-1);
}
function updateHistoryBadge(){
  if(pointHistoryBtn){ pointHistoryBtn.dataset.count=pointHistory.length; }
  if(patternHistoryBtn){ patternHistoryBtn.dataset.count=patternHistory.length; }
}
function pushState(state,replace=false){
  if(IS_APPLYING_HISTORY) return;
  const prev=historyStack[historyIndex]||null;
  state.showPoint = state.showPoint!==undefined?state.showPoint: isShown(inlineAcupointResult);
  state.showPattern = state.showPattern!==undefined?state.showPattern: isShown(clinicalResultEl);
  if(state.type==='home'){ state.showPoint=false; state.showPattern=false; }
  else if(state.type==='point'||state.type==='unknownPoint') state.showPoint=true;
  else if(state.type==='pattern') state.showPattern=true;
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
      else{ historyStack.push(state); historyIndex=0; }
    }else{
      if(historyIndex < historyStack.length-1) historyStack=historyStack.slice(0,historyIndex+1);
      state.ts=Date.now();
      historyStack.push(state);
      historyIndex=historyStack.length-1;
      if(state.type==='pattern'){
        patternHistory.push(state); if(patternHistory.length>HISTORY_LIMIT) patternHistory.shift();
      }else if(state.type==='point'||state.type==='unknownPoint'){
        pointHistory.push(state); if(pointHistory.length>HISTORY_LIMIT) pointHistory.shift();
      }
    }
  }
  updateHistoryBadge();
  updateNavButtons();
}
function applyState(st){
  if(!st) return;
  IS_APPLYING_HISTORY=true;
  try{
    switch(st.type){
      case 'home':
        resetHierarchySelects();
        inputEl.value='';
        inlineAcupointResult.classList.add('hidden');
        hideMeridianImage();
        clinicalResultEl.classList.add('hidden');
        relatedSymptomsEl.innerHTML='<li>-</li>';
        showHomeGallery();
        break;
      case 'point': {
        const p=ACUPOINTS.find(x=>x.name===st.name);
        p? showPointDetail(p,true): showUnknownPoint(st.name,true);
        hideHomeGallery();
        break;
      }
      case 'unknownPoint':
        showUnknownPoint(st.name,true); hideHomeGallery(); break;
      case 'pattern':
        if(CLINICAL_READY){
          selectHierarchy(st.classification,st.system,st.symptom,st.pattern,true);
          hideHomeGallery();
        }
        break;
    }
    inlineAcupointResult.classList.toggle('hidden', !st.showPoint);
    clinicalResultEl.classList.toggle('hidden', !st.showPattern);
  } finally {
    IS_APPLYING_HISTORY=false;
    updateNavButtons();
  }
}
function goBack(){ if(historyIndex>0){ historyIndex--; applyState(historyStack[historyIndex]); } }
function goForward(){ if(historyIndex<historyStack.length-1){ historyIndex++; applyState(historyStack[historyIndex]); } }

/* ==== CSV (経穴) パース：ヘッダマッピング ==== */
function parseAcuCSV(raw){
  if(!raw) return [];
  const text=raw.replace(/\r\n/g,'\n').replace(/\uFEFF/g,'');
  const lines=text.split('\n').filter(l=>l.trim().length>0);
  const norm=s=>(s||'').replace(/[ \u00A0\u1680\u2000-\u200B\u202F\u205F\u3000]/g,'').toLowerCase();

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

  let headerMap=null;
  const results=[];
  for(const rawLine of lines){
    if(/^[0-9０-９]+\./.test(rawLine.trim())) continue; // 節見出しスキップ
    const cols=splitLine(rawLine);
    if(!cols.length) continue;
    // ヘッダ検出
    if(!headerMap && cols[0]==='経絡' && cols[1] && cols[1].startsWith('経穴')){
      headerMap={};
      cols.forEach((h,i)=>{
        const n=norm(h);
        if(n.startsWith('経絡')) headerMap.meridian=i;
        else if(n.startsWith('経穴')) headerMap.name=i;
        else if(n.startsWith('部位')) headerMap.region=i;
        else if(n.startsWith('要穴')) headerMap.important=i;
        else if(n.startsWith('筋肉<神経(筋枝)>')) headerMap.muscleBranch=i;
        else if(n.startsWith('神経(皮枝)')) headerMap.nerveCutaneous=i;
        else if(n.startsWith('血管')||n.startsWith('血菅')) headerMap.bloodVessel=i;
        else if(n.startsWith('ランク')) headerMap.rank=i;
      });
      continue;
    }
    // 旧フォーマット（ヘッダが「経絡,経穴,部位,要穴」で以降省略）も許容
    if(!headerMap && cols.length>=4 && cols[0]!=='経絡'){
      headerMap={ meridian:0, name:1, region:2, important:3 };
    }
    if(!headerMap) continue;
    const meridian=headerMap.meridian!=null? trimOuter(cols[headerMap.meridian]||''):'';
    const rawName =headerMap.name!=null? trimOuter(cols[headerMap.name]||''):'';
    if(!meridian||!rawName) continue;
    const name=removeAllUnicodeSpaces(rawName);
    const region =headerMap.region!=null? (cols[headerMap.region]||'').trim():'';
    const important=headerMap.important!=null? (cols[headerMap.important]||'').trim():'';
    const muscleBranch=headerMap.muscleBranch!=null? (cols[headerMap.muscleBranch]||'').trim():'';
    const nerveCutaneous=headerMap.nerveCutaneous!=null? (cols[headerMap.nerveCutaneous]||'').trim():'';
    const bloodVessel=headerMap.bloodVessel!=null? (cols[headerMap.bloodVessel]||'').trim():'';
    const rank=headerMap.rank!=null? (cols[headerMap.rank]||'').trim():'';
    results.push({
      name,
      reading:READINGS[name]||'',
      meridian,
      region,
      regionRaw:region,
      important,
      muscleBranch,
      nerveCutaneous,
      bloodVessel,
      rank
    });
  }
  return results;
}

/* 逆引きインデックス用補助 */
function parseTreatmentPoints(raw){
  if(!raw) return [];
  const stripped=raw.replace(/（[^）]*）/g,'').replace(/\([^)]*\)/g,'');
  return stripped
    .replace(/\r?\n/g,'/')
    .replace(/[，、＋+･・／/]/g,'/')
    .replace(/\/{2,}/g,'/')
    .split('/')
    .map(t=>removeAllUnicodeSpaces(t).trim())
    .filter(t=>t.length && !/^[-・※＊*+/／\/]+$/.test(t))
    .map(t=>t.replace(/[。.,、，;；/]+$/,''))
    .map(t=>t.replace(/^[※＊*]+/,'' ));
}
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
    }else cur+=ch;
  }
  cols.push(cur);
  return cols.map(c=>c.replace(/\uFEFF/g,'').replace(/\u00A0/g,' ').trim());
}
const CLASSIFICATION_WHITELIST=new Set(['1.疼痛','2.臓腑と関連する症候','3.全身の症候']);
function removeAllUnicodeSpacesSimple(s){ return (s||'').replace(/[ \u00A0\u1680\u2000-\u200B\u202F\u205F\u3000]/g,''); }
function isPatternHeader(row){ return row && /病証名/.test(removeAllUnicodeSpacesSimple(row[0]||'')); }
function isTreatmentHeaderCell(cell){ return /治療方針/.test(removeAllUnicodeSpacesSimple(cell||'')); }
function normalizeFirst(cell){ return trimOuter(cell||'').replace(/\u3000/g,' '); }
function isSystemLine(firstCell){
  const fc=removeAllUnicodeSpacesSimple(firstCell||'');
  if(fc==='-') return true;
  return /系統/.test(fc);
}
function isClassificationLine(firstCell){
  const norm=normalizeFirst(firstCell);
  return CLASSIFICATION_WHITELIST.has(removeAllUnicodeSpacesSimple(norm));
}
function isNumberedLine(firstCell){
  return /^[0-9０-９]+\.?.*/.test(removeAllUnicodeSpacesSimple(firstCell||''));
}
function isSymptomLine(firstCell){
  if(!firstCell) return false;
  const f=normalizeFirst(firstCell);
  if(isClassificationLine(f)) return false;
  if(isSystemLine(f)) return false;
  if(isTreatmentHeaderCell(f)) return false;
  if(/病証名/.test(removeAllUnicodeSpacesSimple(f))) return false;
  if(removeAllUnicodeSpacesSimple(f)==='-') return false;
  if(!isNumberedLine(f)) return false;
  return true;
}
function dissectTreatmentCell(cell){
  if(!cell) return {label:'',rawPoints:'',comment:''};
  const lines=cell.split(/\n+/).map(l=>l.trim()).filter(Boolean);
  let comment='';
  if(lines.length && /^[（(]/.test(lines[lines.length-1])) comment=lines.pop();
  let main=lines.join(' ')||cell;
  const tail=main.match(/([（(].*?[）)])\s*$/);
  if(tail){ if(!comment) comment=tail[1]; main=main.slice(0,tail.index).trim(); }
  let label='',rawPoints='';
  const p1=main.indexOf('：'); const p2=main.indexOf(':');
  let sep=-1;
  if(p1>=0&&p2>=0) sep=Math.min(p1,p2); else sep=p1>=0?p1:p2;
  if(sep>=0){
    label=main.slice(0,sep).trim();
    rawPoints=main.slice(sep+1).trim();
  }else label=main.trim();
  return {label,rawPoints,comment};
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
    if(!row.length) continue;
    const first=row[0].trim();
    if(isClassificationLine(first)){
      currentClassification=normalizeFirst(first);
      if(!hierarchy[currentClassification]){
        hierarchy[currentClassification]={};
        classificationsOrder.push(currentClassification);
      }
      currentSystem=null;
      currentSymptom=null;
      continue;
    }
    if(isSystemLine(first) && currentClassification){
      currentSystem=normalizeFirst(first);
      currentSymptom=null;
      if(!hierarchy[currentClassification][currentSystem]){
        hierarchy[currentClassification][currentSystem]={};
      }
      continue;
    }
    if(isSymptomLine(first) && currentClassification){
      if(!currentSystem){
        currentSystem='-';
        if(!hierarchy[currentClassification][currentSystem]){
          hierarchy[currentClassification][currentSystem]={};
        }
      }
      currentSymptom=normalizeFirst(first);
      if(!hierarchy[currentClassification][currentSystem][currentSymptom]){
        hierarchy[currentClassification][currentSystem][currentSymptom]={
          patterns:[],
          groupsByPattern:{}
        };
      }
      continue;
    }
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
      const node=hierarchy[currentClassification][currentSystem][currentSymptom];
      const patterns=row.slice(1)
        .map(c=>c.trim())
        .filter(c=>c && !/^治療方針/.test(c));
      patterns.forEach(p=>{
        if(!node.patterns.includes(p)){
          node.patterns.push(p);
          node.groupsByPattern[p]=[];
        }
      });
      let j=i+1;
      while(j<table.length){
        const nr=table[j];
        if(!nr.length){ j++; continue; }
        const nf=nr[0]? nr[0].trim():'';
        if(isPatternHeader(nr)) break;
        if(isClassificationLine(nf)) break;
        if(isSystemLine(nf)) break;
        if(isSymptomLine(nf)) break;
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
  }
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

/* Name lookup build */
function buildNameLookup(){
  ACUPOINT_NAME_LIST=ACUPOINTS.map(p=>p.name).sort((a,b)=> b.length - a.length);
  ACUPOINT_NAME_SET=new Set(ACUPOINT_NAME_LIST);
}
function findAcupointByToken(token){
  const key=removeAllUnicodeSpaces(token||'').trim();
  return ACUPOINTS.find(p=>p.name===key)||null;
}

function renderRelatedPatterns(name){
  relatedSymptomsEl.innerHTML='';
  const list=ACUPOINT_PATTERN_INDEX[name];
  if(!CLINICAL_READY || !list || !list.length){
    relatedSymptomsEl.innerHTML='<li>-</li>'; return;
  }
  list.forEach(e=>{
    const li=document.createElement('li');
    li.innerHTML=`<a href="#" class="acu-pattern-link"
      data-class="${escapeHTML(e.classification)}"
      data-system="${escapeHTML(e.system)}"
      data-symptom="${escapeHTML(e.symptom)}"
      data-pattern="${escapeHTML(e.pattern)}">${escapeHTML(getDisplayPatternName(e.pattern))}</a>`;
    relatedSymptomsEl.appendChild(li);
  });
}

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

/* 経穴表示 (改変ポイント: 新列 + rank) */
function showPointDetail(p,suppressHistory=false){
  hideHomeGallery();
  let regionHTML=p.region||'';
  if(regionHTML.includes('[[')){
    regionHTML = p.regionRaw? applyRedMarkup(p.regionRaw): applyRedMarkup(regionHTML);
  }
  regionHTML = linkifyRegionAcupoints(regionHTML);

  if(resultNameTextEl) resultNameTextEl.textContent = `${p.name}${p.reading?` (${p.reading})`:''}`;
  if(p.important) resultNameEl.classList.add('is-important'); else resultNameEl.classList.remove('is-important');

  if(p.rank){
    resultRankEl.style.display='inline-block';
    resultRankEl.textContent=`ランク：${p.rank}`;
  }else{
    resultRankEl.style.display='none';
    resultRankEl.textContent='';
  }

  resultMeridianEl.textContent = p.meridian || '-';
  resultRegionEl.innerHTML = regionHTML || '-';
  resultImportantEl.innerHTML = p.important? `<span class="acu-important-flag">${escapeHTML(p.important)}</span>`:'-';
  resultMuscleBranchEl.textContent = p.muscleBranch || '-';
  resultNerveCutaneousEl.textContent = p.nerveCutaneous || '-';
  resultBloodVesselEl.textContent = p.bloodVessel || '-';

  renderRelatedPatterns(p.name);
  inlineAcupointResult.classList.remove('hidden');
  updateMeridianImage(p.meridian||'');

  if(!suppressHistory && !IS_APPLYING_HISTORY){
    pushState({type:'point',name:p.name});
  }
  requestAnimationFrame(equalizeTopCards);
}
function showUnknownPoint(name,suppressHistory=false){
  hideHomeGallery();
  if(resultNameTextEl) resultNameTextEl.textContent=`${name}（未登録）`;
  resultNameEl.classList.remove('is-important');
  resultRankEl.style.display='none';
  resultRankEl.textContent='';
  resultMeridianEl.textContent='-';
  resultRegionEl.textContent='-';
  resultImportantEl.textContent='-';
  resultMuscleBranchEl.textContent='-';
  resultNerveCutaneousEl.textContent='-';
  resultBloodVesselEl.textContent='-';
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

/* 治療方針表示（原版） */
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

/* 階層セレクト (原版) */
function makeOptions(selectEl,values,{placeholder,disabledSet}={}){
  selectEl.innerHTML='';
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
  selectEl.disabled=!values.length;
}
function resetHierarchySelects(){
  systemSelect.innerHTML='<option value="">(系統を選択)</option>'; systemSelect.disabled=true;
  symptomSelect.innerHTML='<option value="">(症状を選択)</option>'; symptomSelect.disabled=true;
  patternSelect.innerHTML='<option value="">(病証を選択)</option>'; patternSelect.disabled=true;
  clinicalResultEl.classList.add('hidden');
  clinicalGroupsEl.innerHTML='';
}
function handleClassificationChange(){
  const cls=classificationSelect.value;
  systemSelect.innerHTML=''; symptomSelect.innerHTML=''; patternSelect.innerHTML='';
  clinicalGroupsEl.innerHTML=''; clinicalResultEl.classList.add('hidden');
  if(!cls||!CLINICAL_HIERARCHY[cls]){
    resetHierarchySelects();
    requestAnimationFrame(equalizeTopCards);
    return;
  }
  const systems=Object.keys(CLINICAL_HIERARCHY[cls]);
  if(systems.length===1 && systems[0]==='-'){
    systemSelect.innerHTML='<option value="-">-</option>';
    systemSelect.value='-';
    systemSelect.disabled=true;
    const symptoms=Object.keys(CLINICAL_HIERARCHY[cls]['-']);
    makeOptions(symptomSelect, symptoms,{placeholder:'(症状を選択)'});
    symptomSelect.disabled=false;
    patternSelect.innerHTML='<option value="">(病証を選択)</option>';
    patternSelect.disabled=true;
    requestAnimationFrame(equalizeTopCards);
    return;
  }
  const disabledSet=new Set();
  systems.forEach(s=>{ if(s==='-') disabledSet.add(s); });
  makeOptions(systemSelect, systems,{placeholder:'(系統を選択)', disabledSet});
  systemSelect.disabled=false;
  symptomSelect.innerHTML='<option value="">(症状を選択)</option>';
  symptomSelect.disabled=true;
  patternSelect.innerHTML='<option value="">(病証を選択)</option>';
  patternSelect.disabled=true;
  requestAnimationFrame(equalizeTopCards);
}
function handleSystemChange(){
  const cls=classificationSelect.value;
  const sys=systemSelect.value;
  symptomSelect.innerHTML=''; patternSelect.innerHTML=''; clinicalGroupsEl.innerHTML='';
  clinicalResultEl.classList.add('hidden');
  if(!cls||!sys||!CLINICAL_HIERARCHY[cls][sys]){
    symptomSelect.innerHTML='<option value="">(症状を選択)</option>';
    symptomSelect.disabled=true;
    patternSelect.innerHTML='<option value="">(病証を選択)</option>';
    patternSelect.disabled=true;
    requestAnimationFrame(equalizeTopCards);
    return;
  }
  const symptoms=Object.keys(CLINICAL_HIERARCHY[cls][sys]);
  makeOptions(symptomSelect, symptoms,{placeholder:'(症状を選択)'});
  symptomSelect.disabled=false;
  patternSelect.innerHTML='<option value="">(病証を選択)</option>';
  patternSelect.disabled=true;
  clinicalGroupsEl.innerHTML='';
  clinicalResultEl.classList.add('hidden');
  requestAnimationFrame(equalizeTopCards);
}
function handleSymptomChange(){
  const cls=classificationSelect.value;
  const sys=systemSelect.value || (CLINICAL_HIERARCHY[cls] && CLINICAL_HIERARCHY[cls]['-'] ? '-' : '');
  const sym=symptomSelect.value;
  patternSelect.innerHTML=''; clinicalGroupsEl.innerHTML='';
  clinicalResultEl.classList.add('hidden');
  if(!cls||!sys||!sym||!CLINICAL_HIERARCHY[cls][sys][sym]){
    patternSelect.innerHTML='<option value="">(病証を選択)</option>';
    patternSelect.disabled=true;
    requestAnimationFrame(equalizeTopCards);
    return;
  }
  const patterns=CLINICAL_HIERARCHY[cls][sys][sym].patterns;
  makeOptions(patternSelect, patterns,{placeholder:'(病証を選択)'});
  patternSelect.disabled=false;
  Array.from(patternSelect.options).forEach(opt=>{
    if(opt.value) opt.textContent=getDisplayPatternName(opt.value);
  });
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
  if(!cls||!sys||!sym||!pat){
    requestAnimationFrame(equalizeTopCards);
    return;
  }
  const node=CLINICAL_HIERARCHY[cls][sys][sym];
  if(!node || !node.groupsByPattern[pat]){
    requestAnimationFrame(equalizeTopCards);
    return;
  }
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
    a.addEventListener('click',e=>{
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

document.addEventListener('click', e=>{
  const a=e.target.closest('.acu-pattern-link');
  if(a){
    e.preventDefault();
    selectHierarchy(a.dataset.class,a.dataset.system,a.dataset.symptom,a.dataset.pattern,false);
    return;
  }
  const pt=e.target.closest('.treat-point-link');
  if(pt){
    e.preventDefault();
    const nm=pt.dataset.point;
    const p=findAcupointByToken(nm);
    if(p) showPointDetail(p); else showUnknownPoint(nm);
  }
});

function selectHierarchy(cls,sys,sym,pat,suppressHistory){
  if(!CLINICAL_READY) return;
  if(!CLINICAL_HIERARCHY[cls]) return;
  classificationSelect.value=cls;
  classificationSelect.dispatchEvent(new Event('change'));
  if(sys==='-' && CLINICAL_HIERARCHY[cls]['-']){
    systemSelect.innerHTML='<option value="-">-</option>';
    systemSelect.value='-';
    systemSelect.disabled=true;
    const symptoms=Object.keys(CLINICAL_HIERARCHY[cls]['-']);
    makeOptions(symptomSelect, symptoms,{placeholder:'(症状を選択)'});
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
    Array.from(patternSelect.options).forEach(opt=>{
      if(opt.value) opt.textContent=getDisplayPatternName(opt.value);
    });
    patternSelect.dispatchEvent(new Event('change'));
    if(suppressHistory){
      IS_APPLYING_HISTORY=true;
      pushState({type:'pattern',classification:cls,system:sys,symptom:sym,pattern:pat},true);
      IS_APPLYING_HISTORY=false;
    }
  }
}

/* Home */
function goHome(suppressHistory=false){
  inputEl.value='';
  clearSuggestions();
  inlineAcupointResult.classList.add('hidden');
  hideMeridianImage();
  resetHierarchySelects();
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

/* 検索 & サジェスト */
function filterPoints(qInput){
  const q=removeAllUnicodeSpaces(qInput);
  if(q.length<MIN_QUERY_LENGTH) return [];
  if(/^[\u3041-\u3096]+$/.test(q)){
    let list=ACUPOINTS.filter(p=>p.reading && p.reading.startsWith(q));
    if(!list.length) list=ACUPOINTS.filter(p=>p.reading && p.reading.includes(q));
    return list.map(p=>({...p,_matchType:'name'}));
  }
  const nameMatches=[], seen=new Set();
  for(const p of ACUPOINTS){
    if(p.name.includes(q)){ nameMatches.push({...p,_matchType:'name'}); seen.add(p.name); }
  }
  const muscleMatches=[];
  for(const p of ACUPOINTS){
    if(seen.has(p.name)) continue;
    if(p.muscleBranch && p.muscleBranch.includes(q)){
      muscleMatches.push({...p,_matchType:'muscle'});
      seen.add(p.name);
    }
  }
  return nameMatches.concat(muscleMatches);
}
let suggestionIndex=-1;
function showSuggestions(list){
  suggestionListEl.innerHTML='';
  if(!list.length){ clearSuggestions(); return; }
  list.slice(0,200).forEach((p,i)=>{
    const li=document.createElement('li');
    li.setAttribute('role','option');
    li.dataset.name=p.name;
    li.innerHTML=`
      <span class="sug-name ${p.important?'important':''}">${escapeHTML(p.name)}</span>
      <span class="sug-slash">/</span>
      <span class="sug-reading">${escapeHTML(p.reading||'')}</span>
      <span style="font-size:.55rem;color:#555;">${p._matchType==='muscle'?'M':''}</span>
    `;
    li.addEventListener('click',()=>selectPoint(p));
    suggestionListEl.appendChild(li);
  });
  suggestionListEl.classList.remove('hidden');
  suggestionIndex=-1;
}
function clearSuggestions(){
  suggestionListEl.innerHTML='';
  suggestionListEl.classList.add('hidden');
  suggestionIndex=-1;
}
function handleArrowNavigation(e){
  if(suggestionListEl.classList.contains('hidden')) return;
  const items=Array.from(suggestionListEl.querySelectorAll('li'));
  if(!items.length) return;
  if(e.key==='ArrowDown'){
    e.preventDefault(); suggestionIndex=(suggestionIndex+1)%items.length;
  }else if(e.key==='ArrowUp'){
    e.preventDefault(); suggestionIndex=(suggestionIndex-1+items.length)%items.length;
  }else if(e.key==='Enter'){
    if(suggestionIndex>=0){
      e.preventDefault(); items[suggestionIndex].click(); return;
    }
  }else return;
  items.forEach((li,i)=>li.classList.toggle('active', i===suggestionIndex));
}
inputEl.addEventListener('input', ()=>{
  const q=inputEl.value.trim();
  if(!q){ clearSuggestions(); return; }
  const list=filterPoints(q);
  showSuggestions(list);
});
inputEl.addEventListener('keydown', handleArrowNavigation);
searchBtn.addEventListener('click', ()=>{
  const q=inputEl.value.trim();
  if(!q){ inputEl.focus(); return; }
  const list=filterPoints(q);
  if(list.length===1){ selectPoint(list[0]); return; }
  showSuggestions(list);
});

/* レイアウト揃え */
function equalizeTopCards(){
  if(window.innerWidth<860){
    searchCard.style.height='';
    symptomCard.style.height='';
    return;
  }
  searchCard.style.height='';
  symptomCard.style.height='';
  const h=Math.max(searchCard.scrollHeight, symptomCard.scrollHeight);
  searchCard.style.height=h+'px';
  symptomCard.style.height=h+'px';
}

/* データロード */
async function loadAcuCSV(){
  statusEl.textContent='経穴CSV: 読込中...';
  try{
    const res=await fetch(`${CSV_PATH}?v=${APP_VERSION}&_=${Date.now()}`,{cache:'no-store'});
    if(!res.ok) throw new Error('HTTP '+res.status);
    const text=await res.text();
    ACUPOINTS=parseAcuCSV(text);
    buildNameLookup();
    DATA_READY=true;
    statusEl.textContent=`経穴CSV: ${ACUPOINTS.length}件 (想定${EXPECTED_TOTAL})`;
    if(ACUPOINTS.length<EXPECTED_TOTAL) statusEl.textContent+=' *件数注意';
  }catch(e){
    console.error(e);
    statusEl.textContent='経穴CSV: 失敗 '+e.message;
  }finally{
    requestAnimationFrame(equalizeTopCards);
  }
}
async function loadClinicalCSV(){
  clinicalStatusEl.textContent='臨床CSV: 読込中...';
  try{
    const res=await fetch(`${CLINICAL_CSV_PATH}?v=${APP_VERSION}&_=${Date.now()}`,{cache:'no-store'});
    if(!res.ok) throw new Error('HTTP '+res.status);
    const text=await res.text();
    const {hierarchy,classificationsOrder}=parseClinicalHierarchyStateMachine(text);
    CLINICAL_HIERARCHY=hierarchy;
    CLASSIFICATIONS_ORDER=classificationsOrder;
    CLINICAL_READY=true;
    makeOptions(classificationSelect, CLASSIFICATIONS_ORDER,{placeholder:'(分類を選択)'});
    classificationSelect.disabled=!CLASSIFICATIONS_ORDER.length;
    rebuildAcuPointPatternIndex();
    clinicalStatusEl.textContent='臨床CSV: OK';
  }catch(e){
    console.error(e);
    clinicalStatusEl.textContent='臨床CSV: 失敗 '+e.message;
  }finally{
    requestAnimationFrame(equalizeTopCards);
  }
}

/* 初期化 */
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
window.addEventListener('resize', equalizeTopCards);
init();

/* Home button etc already set above */
