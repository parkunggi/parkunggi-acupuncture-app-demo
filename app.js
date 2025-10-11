/******************************************************
 * APP_VERSION 20251011-RANK-MINIMAL-ONLY-REQ
 * 要求された最小変更のみ:
 *  - muscle-map.js 依存除去
 *  - 「筋肉」→CSV列「筋肉<神経(筋枝)>」表示
 *  - 「神経(皮枝)」「血管」項目追加
 *  - ランク表示 (経穴名右: ランク：X) / 無ければ非表示
 *  - 空欄は "-" 表示
 *  - 検索は元仕様（経穴名/よみ/ひらがな）のみ。筋肉列検索は行わない
 *  - オリジナルの CSS / DOM 構造は最小限以外変更無し
 ******************************************************/
const APP_VERSION='20251011-RANK-MINIMAL-ONLY-REQ';

const CSV_FILE='経穴・経絡.csv';
const CLINICAL_CSV_FILE='東洋臨床論.csv';
const CSV_PATH=encodeURI(CSV_FILE);
const CLINICAL_CSV_PATH=encodeURI(CLINICAL_CSV_FILE);

const MIN_QUERY_LENGTH=1;
const EXPECTED_TOTAL=361;

const READINGS = window.ACU_READINGS || {};

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

/* ---- DOM ---- */
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

/* Home ギャラリー（元通り） */
const HOME_GALLERY_IMAGES=[
  {file:'十四経経脈経穴図_1.前面.jpeg',label:'① 前面'},
  {file:'十四経経脈経穴図_2.後面.jpeg',label:'② 後面'},
  {file:'十四経経脈経穴図_3.後面(骨格).jpeg',label:'③ 後面(骨格)'},
  {file:'十四経経脈経穴図_4.側面(筋肉).jpeg',label:'④ 側面(筋肉)'}
];
const HOME_GALLERY_LS_KEY='homeGallery.lastFile';
function initHomeGallery(){
  if(!homeGallerySelect) return;
  homeGallerySelect.innerHTML='';
  const saved=localStorage.getItem(HOME_GALLERY_LS_KEY);
  let idx0=0;
  if(saved){
    const i=HOME_GALLERY_IMAGES.findIndex(x=>x.file===saved);
    if(i>=0) idx0=i;
  }
  HOME_GALLERY_IMAGES.forEach((img,i)=>{
    const opt=document.createElement('option');
    opt.value=img.file; opt.textContent=img.label;
    if(i===idx0) opt.selected=true;
    homeGallerySelect.appendChild(opt);
  });
  updateHomeGalleryImage(HOME_GALLERY_IMAGES[idx0].file,false);
}
function updateHomeGalleryImage(f,store=true){
  const url='image/'+encodeURI(f)+'?v='+APP_VERSION;
  homeGalleryFallback.classList.add('hidden');
  homeGalleryImage.classList.remove('hidden');
  homeGalleryImage.alt=f.replace(/\.(jpeg|jpg|png)$/i,'');
  homeGalleryImage.onerror=()=>{
    homeGalleryImage.classList.add('hidden');
    homeGalleryFallback.classList.remove('hidden');
  };
  homeGalleryImage.src=url;
  if(store){ try{localStorage.setItem(HOME_GALLERY_LS_KEY,f);}catch{} }
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
function escapeHTML(s){ return (s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function applyRedMarkup(t){
  if(!t) return '';
  if(t.includes('<span class="bui-red">')) return t;
  return t.replace(/\[\[([^\[\]\r\n]{1,120})\]\]/g,'<span class="bui-red">$1</span>');
}
function ensureCommentParens(c){
  if(!c) return '';
  if(/^\s*[（(]/.test(c)) return c;
  return '('+c+')';
}
function isShown(el){ return el && !el.classList.contains('hidden'); }
function getDisplayPatternName(original){
  if(!original) return '';
  const idx=original.indexOf('→');
  if(idx===-1) return original;
  const left=original.slice(0,idx).trim(), right=original.slice(idx+1).trim();
  if(/^【[^】]+】$/.test(left)) return `${right}→${left}`;
  return original;
}

/* Name lookup */
function buildNameLookup(){
  ACUPOINT_NAME_LIST=ACUPOINTS.map(p=>p.name).sort((a,b)=> b.length-a.length);
  ACUPOINT_NAME_SET=new Set(ACUPOINT_NAME_LIST);
}
function findAcupointByToken(token){
  const key=removeAllUnicodeSpaces(token||'').trim();
  return ACUPOINTS.find(p=>p.name===key)||null;
}

/* 履歴（元仕様） */
function statesEqual(a,b){
  if(!a||!b) return false;
  if(a.type!==b.type) return false;
  if(a.type==='home') return true;
  if(a.type==='point'||a.type==='unknownPoint') return a.name===b.name;
  if(a.type==='pattern') return a.classification===b.classification&&a.system===b.system&&a.symptom===b.symptom&&a.pattern===b.pattern;
  return false;
}
function updateNavButtons(){
  backBtn.disabled=(historyIndex<=0);
  forwardBtn.disabled=(historyIndex<0||historyIndex>=historyStack.length-1);
}
function pushState(st,replace=false){
  if(IS_APPLYING_HISTORY) return;
  const prev=historyStack[historyIndex]||null;
  st.showPoint=st.showPoint!==undefined?st.showPoint:isShown(inlineAcupointResult);
  st.showPattern=st.showPattern!==undefined?st.showPattern:isShown(clinicalResultEl);
  if(st.type==='home'){ st.showPoint=false; st.showPattern=false; }
  else if(st.type==='point'||st.type==='unknownPoint') st.showPoint=true;
  else if(st.type==='pattern') st.showPattern=true;
  if(prev){
    if(st.type==='pattern' && prev.showPoint) st.showPoint=true;
    if((st.type==='point'||st.type==='unknownPoint') && prev.showPattern) st.showPattern=true;
  }
  if(historyIndex>=0 && statesEqual(historyStack[historyIndex],st)){
    Object.assign(historyStack[historyIndex],{showPoint:st.showPoint,showPattern:st.showPattern});
  }else{
    if(replace){
      if(historyIndex>=0) historyStack[historyIndex]=st;
      else{ historyStack.push(st); historyIndex=0; }
    }else{
      if(historyIndex < historyStack.length-1) historyStack=historyStack.slice(0,historyIndex+1);
      st.ts=Date.now();
      historyStack.push(st);
      historyIndex=historyStack.length-1;
      if(st.type==='pattern'){
        patternHistory.push(st); if(patternHistory.length>HISTORY_LIMIT) patternHistory.shift();
      }else if(st.type==='point'||st.type==='unknownPoint'){
        pointHistory.push(st); if(pointHistory.length>HISTORY_LIMIT) pointHistory.shift();
      }
    }
  }
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
  }finally{
    IS_APPLYING_HISTORY=false;
    updateNavButtons();
  }
}
function goBack(){ if(historyIndex>0){ historyIndex--; applyState(historyStack[historyIndex]); } }
function goForward(){ if(historyIndex<historyStack.length-1){ historyIndex++; applyState(historyStack[historyIndex]); } }

/* CSV 経穴パース（追加列対応） */
function parseAcuCSV(raw){
  if(!raw) return [];
  const text=raw.replace(/\r\n/g,'\n').replace(/\uFEFF/g,'');
  const lines=text.split('\n').filter(l=>l.trim());
  const norm=s=>(s||'').replace(/[ \u00A0\u1680\u2000-\u200B\u202F\u205F\u3000]/g,'').toLowerCase();
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
  let header=null;
  const res=[];
  for(const rawLine of lines){
    if(/^[0-9０-９]+\./.test(rawLine.trim())) continue;
    const cols=split(rawLine);
    if(!cols.length) continue;
    if(!header && cols[0]==='経絡' && cols[1] && cols[1].startsWith('経穴')){
      header={};
      cols.forEach((h,i)=>{
        const n=norm(h);
        if(n.startsWith('経絡')) header.meridian=i;
        else if(n.startsWith('経穴')) header.name=i;
        else if(n.startsWith('部位')) header.region=i;
        else if(n.startsWith('要穴')) header.important=i;
        else if(n.startsWith('筋肉<神経(筋枝)>')) header.muscleBranch=i;
        else if(n.startsWith('神経(皮枝)')) header.nerveCutaneous=i;
        else if(n.startsWith('血管')||n.startsWith('血菅')) header.bloodVessel=i;
        else if(n.startsWith('ランク')) header.rank=i;
      });
      continue;
    }
    if(!header) continue;
    const meridian=header.meridian!=null? trimOuter(cols[header.meridian]||''):'';
    const rawName =header.name!=null? trimOuter(cols[header.name]||''):'';
    if(!meridian||!rawName) continue;
    const name=removeAllUnicodeSpaces(rawName);
    const region=header.region!=null? (cols[header.region]||'').trim():'';
    const important=header.important!=null? (cols[header.important]||'').trim():'';
    const muscleBranch=header.muscleBranch!=null? (cols[header.muscleBranch]||'').trim():'';
    const nerveCutaneous=header.nerveCutaneous!=null? (cols[header.nerveCutaneous]||'').trim():'';
    const bloodVessel=header.bloodVessel!=null? (cols[header.bloodVessel]||'').trim():'';
    const rank=header.rank!=null? (cols[header.rank]||'').trim():'';
    res.push({
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
  return res;
}

/* 臨床 CSV パーサ（元処理） */
function parseTreatmentPoints(raw){
  if(!raw) return [];
  const stripped=raw.replace(/（[^）]*）/g,'').replace(/\([^)]*\)/g,'');
  return stripped.replace(/\r?\n/g,'/')
    .replace(/[，、＋+･・／/]/g,'/')
    .replace(/\/{2,}/g,'/')
    .split('/')
    .map(t=>removeAllUnicodeSpaces(t).trim())
    .filter(t=>t.length && !/^[-・※＊*+/／\/]+$/.test(t))
    .map(t=>t.replace(/[。.,、，;；/]+$/,''))
    .map(t=>t.replace(/^[※＊*]+/,''));
}
function rebuildLogicalRows(raw){
  const phys=raw.replace(/\r\n/g,'\n').split('\n');
  const rows=[]; let buf=''; let q=0;
  for(const line of phys){
    buf=buf?buf+'\n'+line:line;
    q=(buf.match(/"/g)||[]).length;
    if(q%2===0){ rows.push(buf); buf=''; }
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
const CLASSIFICATION_WHITELIST=new Set(['1.疼痛','2.臓腑と関連する症候','3.全身の症候']);
function removeAllUnicodeSpacesSimple(s){ return (s||'').replace(/[ \u00A0\u1680\u2000-\u200B\u202F\u205F\u3000]/g,''); }
function isPatternHeader(row){ return row && /病証名/.test(removeAllUnicodeSpacesSimple(row[0]||'')); }
function isTreatmentHeaderCell(cell){ return /治療方針/.test(removeAllUnicodeSpacesSimple(cell||'')); }
function normalizeFirst(cell){ return trimOuter(cell||'').replace(/\u3000/g,' '); }
function isSystemLine(firstCell){
  const fc=removeAllUnicodeSpacesSimple(firstCell||''); if(fc==='-') return true;
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
  if(isClassificationLine(f)||isSystemLine(f)||isTreatmentHeaderCell(f)||/病証名/.test(removeAllUnicodeSpacesSimple(f))||removeAllUnicodeSpacesSimple(f)==='-') return false;
  return isNumberedLine(f);
}
function dissectTreatmentCell(cell){
  if(!cell) return {label:'',rawPoints:'',comment:''};
  const lines=cell.split(/\n+/).map(l=>l.trim()).filter(Boolean);
  let comment='';
  if(lines.length && /^[（(]/.test(lines[lines.length-1])) comment=lines.pop();
  let main=lines.join(' '); if(!main) main=cell;
  const tail=main.match(/([（(].*?[）)])\s*$/);
  if(tail){ comment=comment||tail[1]; main=main.slice(0,tail.index).trim(); }
  let label='',rawPoints='';
  const p1=main.indexOf('：'), p2=main.indexOf(':'); let sep=-1;
  if(p1>=0&&p2>=0) sep=Math.min(p1,p2); else sep=p1>=0?p1:p2;
  if(sep>=0){ label=main.slice(0,sep).trim(); rawPoints=main.slice(sep+1).trim(); }
  else label=main.trim();
  return {label,rawPoints,comment};
}
function parseClinicalHierarchyStateMachine(raw){
  const logical=rebuildLogicalRows(raw);
  const table=logical.map(parseCSVLogicalRow);
  const hierarchy={};
  const classificationsOrder=[];
  let currentClassification=null,currentSystem=null,currentSymptom=null;
  for(let i=0;i<table.length;i++){
    const row=table[i]; if(!row.length) continue;
    const first=row[0].trim();
    if(isClassificationLine(first)){
      currentClassification=normalizeFirst(first);
      if(!hierarchy[currentClassification]){
        hierarchy[currentClassification]={};
        classificationsOrder.push(currentClassification);
      }
      currentSystem=null; currentSymptom=null; continue;
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
        if(!hierarchy[currentClassification][currentSystem]) hierarchy[currentClassification][currentSystem]={};
      }
      currentSymptom=normalizeFirst(first);
      if(!hierarchy[currentClassification][currentSystem][currentSymptom]){
        hierarchy[currentClassification][currentSystem][currentSymptom]={patterns:[],groupsByPattern:{}};
      }
      continue;
    }
    if(isPatternHeader(row) && currentClassification && currentSymptom){
      if(!currentSystem){
        currentSystem='-';
        if(!hierarchy[currentClassification][currentSystem]) hierarchy[currentClassification][currentSystem]={};
        if(!hierarchy[currentClassification][currentSystem][currentSymptom]) hierarchy[currentClassification][currentSystem][currentSymptom]={patterns:[],groupsByPattern:{}};
      }
      const node=hierarchy[currentClassification][currentSystem][currentSymptom];
      const patterns=row.slice(1).map(c=>c.trim()).filter(c=>c && !/^治療方針/.test(c));
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
        const nf=nr[0]?nr[0].trim():'';
        if(isPatternHeader(nr) || isClassificationLine(nf) || isSystemLine(nf) || isSymptomLine(nf)) break;
        if(isTreatmentHeaderCell(nf)){
          const after=nr.slice(1);
          after.forEach((cell,k)=>{
            const pat=patterns[k]; if(!pat||!cell) return;
            const parsed=dissectTreatmentCell(cell);
            if(parsed.label||parsed.rawPoints){
              if(!parsed.tokens) parsed.tokens=parseTreatmentPoints(parsed.rawPoints);
              node.groupsByPattern[pat].push(parsed);
            }
          });
        }
        j++;
      }
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
              if(!tk||seen.has(tk)) return;
              seen.add(tk);
              (ACUPOINT_PATTERN_INDEX[tk] ||= []).push({classification:cls,system:sys,symptom:sym,pattern:pat});
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
    ACUPOINT_PATTERN_INDEX[k]=[...uniq.values()];
  });
}

/* 経穴表示 */
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
function showPointDetail(p,suppressHistory=false){
  hideHomeGallery();
  let regionHTML=p.region||'';
  if(regionHTML.includes('[[')){
    regionHTML=p.regionRaw? applyRedMarkup(p.regionRaw): applyRedMarkup(regionHTML);
  }
  regionHTML=linkifyRegionAcupoints(regionHTML);

  if(resultNameTextEl) resultNameTextEl.textContent=`${p.name}${p.reading?` (${p.reading})`:''}`;
  resultNameEl.classList.toggle('is-important', !!p.important);

  if(p.rank){
    resultRankEl.style.display='inline-block';
    resultRankEl.textContent=`ランク：${p.rank}`;
  } else {
    resultRankEl.style.display='none';
    resultRankEl.textContent='';
  }

  resultMeridianEl.textContent=p.meridian||'-';
  resultRegionEl.innerHTML=regionHTML||'-';
  resultImportantEl.innerHTML=p.important? `<span class="acu-important-flag">${escapeHTML(p.important)}</span>`:'-';
  resultMuscleBranchEl.textContent=p.muscleBranch||'-';
  resultNerveCutaneousEl.textContent=p.nerveCutaneous||'-';
  resultBloodVesselEl.textContent=p.bloodVessel||'-';

  renderRelatedPatterns(p.name);
  inlineAcupointResult.classList.remove('hidden');
  updateMeridianImage(p.meridian||'');

  if(!suppressHistory && !IS_APPLYING_HISTORY) pushState({type:'point',name:p.name});
  requestAnimationFrame(equalizeTopCards);
}
function showUnknownPoint(name,suppressHistory=false){
  hideHomeGallery();
  if(resultNameTextEl) resultNameTextEl.textContent=`${name}（未登録）`;
  resultNameEl.classList.remove('is-important');
  resultRankEl.style.display='none'; resultRankEl.textContent='';
  resultMeridianEl.textContent='-';
  resultRegionEl.textContent='-';
  resultImportantEl.textContent='-';
  resultMuscleBranchEl.textContent='-';
  resultNerveCutaneousEl.textContent='-';
  resultBloodVesselEl.textContent='-';
  relatedSymptomsEl.innerHTML='<li>-</li>';
  inlineAcupointResult.classList.remove('hidden');
  hideMeridianImage();
  if(!suppressHistory && !IS_APPLYING_HISTORY) pushState({type:'unknownPoint',name});
  requestAnimationFrame(equalizeTopCards);
}
function selectPoint(p){
  clearSuggestions();
  inputEl.value=p.name;
  showPointDetail(p);
}

/* Region linkify */
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
  const open=group[0], close=group[group.length-1], inner=group.slice(1,-1);
  let i=0,out='';
  while(i<inner.length){
    if(/[ \u00A0\u1680\u2000-\u200B\u202F\u205F\u3000]/.test(inner[i])){ out+=escapeHTML(inner[i]); i++; continue; }
    let matched=null,consumed=0;
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
    } else { out+=escapeHTML(inner[i]); i++; }
  }
  return escapeHTML(open)+out+escapeHTML(close);
}
function linkifyRegionAcupoints(html){
  if(!html||!ACUPOINT_NAME_LIST.length) return html;
  const wrapper=document.createElement('div'); wrapper.innerHTML=html;
  function process(node){
    if(node.nodeType===Node.TEXT_NODE){
      const text=node.nodeValue;
      if(!text.trim()) return;
      let work=text, frag=document.createDocumentFragment(), cursor=0;
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

function hideMeridianImage(){
  meridianImageSection.classList.add('hidden');
  meridianImageEl.removeAttribute('src');
  meridianImageEl.alt='';
}
function updateMeridianImage(meridian){
  if(!meridian){ hideMeridianImage(); return; }
  const url='image/'+encodeURI(meridian)+'.png?v='+APP_VERSION;
  meridianImageEl.onload=()=>meridianImageSection.classList.remove('hidden');
  meridianImageEl.onerror=()=>hideMeridianImage();
  meridianImageEl.alt=meridian;
  meridianImageEl.src=url;
}

/* 治療方針 HTML */
function buildPointsHTML(rawPoints,tokens){
  if(!rawPoints) return '';
  const uniq=[...new Set(tokens||[])].sort((a,b)=> b.length-a.length);
  let i=0,out='',len=rawPoints.length;
  while(i<len){
    const ch=rawPoints[i];
    if(ch==='('||ch==='（'){
      const close= ch==='(' ? ')' : '）';
      let j=i+1; while(j<len && rawPoints[j]!==close) j++;
      if(j<len) j++;
      out+=linkifyParenthesisGroup(rawPoints.slice(i,j));
      i=j; continue;
    }
    if(/[ \u00A0\u1680\u2000-\u200B\u202F\u205F\u3000]/.test(ch)){ out+=escapeHTML(ch); i++; continue; }
    let matched=null,cons=0;
    for(const tk of uniq){
      const c=matchTokenWithSpaces(rawPoints,i,tk);
      if(c){ matched=tk; cons=c; break; }
    }
    if(matched){
      const acu=findAcupointByToken(matched);
      if(acu){
        const imp=acu.important?' acu-important':'';
        out+=`<a href="#" class="treat-point-link${imp}" data-point="${escapeHTML(acu.name)}">${escapeHTML(acu.name)}</a>`;
      }else{
        out+=escapeHTML(matched);
      }
      i+=cons; continue;
    }
    out+=escapeHTML(ch); i++;
  }
  return out;
}

/* 階層セレクト */
function makeOptions(sel,values,{placeholder}={}){
  sel.innerHTML='';
  if(placeholder){
    const opt=document.createElement('option');
    opt.value=''; opt.textContent=placeholder;
    opt.disabled=true; opt.selected=true;
    sel.appendChild(opt);
  }
  values.forEach(v=>{
    const o=document.createElement('option');
    o.value=v; o.textContent=v;
    sel.appendChild(o);
  });
  sel.disabled=!values.length;
}
function resetHierarchySelects(){
  systemSelect.innerHTML='<option value="">(系統を選択)</option>'; systemSelect.disabled=true;
  symptomSelect.innerHTML='<option value="">(症状を選択)</option>'; symptomSelect.disabled=true;
  patternSelect.innerHTML='<option value="">(病証を選択)</option>'; patternSelect.disabled=true;
  clinicalResultEl.classList.add('hidden');
  clinicalGroupsEl.innerHTML='';
}
classificationSelect.addEventListener('change', handleClassificationChange);
systemSelect.addEventListener('change', handleSystemChange);
symptomSelect.addEventListener('change', handleSymptomChange);
patternSelect.addEventListener('change', handlePatternChange);
function handleClassificationChange(){
  const cls=classificationSelect.value;
  systemSelect.innerHTML=''; symptomSelect.innerHTML=''; patternSelect.innerHTML='';
  clinicalGroupsEl.innerHTML=''; clinicalResultEl.classList.add('hidden');
  if(!cls||!CLINICAL_HIERARCHY[cls]){ resetHierarchySelects(); requestAnimationFrame(equalizeTopCards); return; }
  const systems=Object.keys(CLINICAL_HIERARCHY[cls]);
  if(systems.length===1 && systems[0]==='-'){
    systemSelect.innerHTML='<option value="-">-</option>';
    systemSelect.disabled=true;
    const symptoms=Object.keys(CLINICAL_HIERARCHY[cls]['-']);
    makeOptions(symptomSelect,symptoms,{placeholder:'(症状を選択)'});
    symptomSelect.disabled=false;
    patternSelect.innerHTML='<option value="">(病証を選択)</option>';
    patternSelect.disabled=true;
  } else {
    makeOptions(systemSelect,systems,{placeholder:'(系統を選択)'});
    systemSelect.disabled=false;
    symptomSelect.innerHTML='<option value="">(症状を選択)</option>'; symptomSelect.disabled=true;
    patternSelect.innerHTML='<option value="">(病証を選択)</option>'; patternSelect.disabled=true;
  }
  requestAnimationFrame(equalizeTopCards);
}
function handleSystemChange(){
  const cls=classificationSelect.value;
  const sys=systemSelect.value;
  symptomSelect.innerHTML=''; patternSelect.innerHTML=''; clinicalGroupsEl.innerHTML=''; clinicalResultEl.classList.add('hidden');
  if(!cls||!sys||!CLINICAL_HIERARCHY[cls][sys]){
    symptomSelect.innerHTML='<option value="">(症状を選択)</option>'; symptomSelect.disabled=true;
    patternSelect.innerHTML='<option value="">(病証を選択)</option>'; patternSelect.disabled=true;
    requestAnimationFrame(equalizeTopCards); return;
  }
  const symptoms=Object.keys(CLINICAL_HIERARCHY[cls][sys]);
  makeOptions(symptomSelect,symptoms,{placeholder:'(症状を選択)'}); symptomSelect.disabled=false;
  patternSelect.innerHTML='<option value="">(病証を選択)</option>'; patternSelect.disabled=true;
  clinicalResultEl.classList.add('hidden'); clinicalGroupsEl.innerHTML='';
  requestAnimationFrame(equalizeTopCards);
}
function handleSymptomChange(){
  const cls=classificationSelect.value;
  const sys=systemSelect.value || (CLINICAL_HIERARCHY[cls] && CLINICAL_HIERARCHY[cls]['-']?'-':'');
  const sym=symptomSelect.value;
  patternSelect.innerHTML=''; clinicalGroupsEl.innerHTML=''; clinicalResultEl.classList.add('hidden');
  if(!cls||!sys||!sym||!CLINICAL_HIERARCHY[cls][sys][sym]){
    patternSelect.innerHTML='<option value="">(病証を選択)</option>'; patternSelect.disabled=true;
    requestAnimationFrame(equalizeTopCards); return;
  }
  const patterns=CLINICAL_HIERARCHY[cls][sys][sym].patterns;
  makeOptions(patternSelect,patterns,{placeholder:'(病証を選択)'}); patternSelect.disabled=false;
  Array.from(patternSelect.options).forEach(o=>{ if(o.value) o.textContent=getDisplayPatternName(o.value); });
  clinicalGroupsEl.innerHTML=''; clinicalResultEl.classList.add('hidden');
  requestAnimationFrame(equalizeTopCards);
}
function handlePatternChange(){
  hideHomeGallery();
  const cls=classificationSelect.value;
  const sys=systemSelect.value || (CLINICAL_HIERARCHY[cls] && CLINICAL_HIERARCHY[cls]['-']?'-':'');
  const sym=symptomSelect.value;
  const pat=patternSelect.value;
  clinicalGroupsEl.innerHTML=''; clinicalResultEl.classList.add('hidden');
  const titleSpan=clinicalTitleEl.querySelector('.pattern-name-highlight');
  if(titleSpan) titleSpan.textContent='';
  if(!cls||!sys||!sym||!pat){ requestAnimationFrame(equalizeTopCards); return; }
  const node=CLINICAL_HIERARCHY[cls][sys][sym];
  if(!node||!node.groupsByPattern[pat]){ requestAnimationFrame(equalizeTopCards); return; }
  const groups=node.groupsByPattern[pat];
  if(titleSpan) titleSpan.textContent=getDisplayPatternName(pat);
  groups.forEach(g=>{
    const tokens=g.tokens||parseTreatmentPoints(g.rawPoints);
    const points=buildPointsHTML(g.rawPoints,tokens);
    const comment=g.comment? ensureCommentParens(g.comment):'';
    const div=document.createElement('div');
    div.className='treat-line';
    div.innerHTML=`<p class="treat-main">${escapeHTML(g.label)}：${points}</p>${comment? `<p class="treat-comment">${escapeHTML(comment)}</p>`:''}`;
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
  if(!IS_APPLYING_HISTORY) pushState({type:'pattern',classification:cls,system:sys,symptom:sym,pattern:pat});
  requestAnimationFrame(equalizeTopCards);
}
function selectHierarchy(cls,sys,sym,pat,suppress){
  if(!CLINICAL_READY) return;
  if(!CLINICAL_HIERARCHY[cls]) return;
  classificationSelect.value=cls;
  classificationSelect.dispatchEvent(new Event('change'));
  if(sys==='-' && CLINICAL_HIERARCHY[cls]['-']){
    systemSelect.innerHTML='<option value="-">-</option>';
    systemSelect.value='-';
    systemSelect.disabled=true;
    const symptoms=Object.keys(CLINICAL_HIERARCHY[cls]['-']);
    makeOptions(symptomSelect,symptoms,{placeholder:'(症状を選択)'});
    symptomSelect.disabled=false;
  }else if(CLINICAL_HIERARCHY[cls][sys]){
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
    Array.from(patternSelect.options).forEach(o=>{
      if(o.value) o.textContent=getDisplayPatternName(o.value);
    });
    patternSelect.dispatchEvent(new Event('change'));
    if(suppress){
      IS_APPLYING_HISTORY=true;
      pushState({type:'pattern',classification:cls,system:sys,symptom:sym,pattern:pat},true);
      IS_APPLYING_HISTORY=false;
    }
  }
}

/* Home */
function goHome(suppress=false){
  inputEl.value='';
  clearSuggestions();
  inlineAcupointResult.classList.add('hidden');
  hideMeridianImage();
  resetHierarchySelects();
  clinicalGroupsEl.innerHTML='';
  clinicalResultEl.classList.add('hidden');
  relatedSymptomsEl.innerHTML='<li>-</li>';
  showHomeGallery();
  if(!suppress && !IS_APPLYING_HISTORY) pushState({type:'home'});
  requestAnimationFrame(equalizeTopCards);
}
homeBtn.addEventListener('click',()=>goHome());
backBtn.addEventListener('click',goBack);
forwardBtn.addEventListener('click',goForward);
document.addEventListener('keydown',e=>{
  if(e.altKey && !e.metaKey && !e.shiftKey && !e.ctrlKey){
    if(e.key==='ArrowLeft') goBack();
    else if(e.key==='ArrowRight') goForward();
  }
});

/* 検索 (経穴名 / 読み / ひらがな のみ) */
function filterPoints(qInput){
  const q=removeAllUnicodeSpaces(qInput);
  if(q.length<MIN_QUERY_LENGTH) return [];
  // ひらがな（読み）
  if(/^[\u3041-\u3096]+$/.test(q)){
    let list=ACUPOINTS.filter(p=>p.reading && p.reading.startsWith(q));
    if(!list.length) list=ACUPOINTS.filter(p=>p.reading && p.reading.includes(q));
    return list;
  }
  // 漢字部分一致
  return ACUPOINTS.filter(p=>p.name.includes(q));
}
let suggestionIndex=-1;
function showSuggestions(list){
  suggestionListEl.innerHTML='';
  if(!list.length){ clearSuggestions(); return; }
  list.slice(0,200).forEach(p=>{
    const li=document.createElement('li');
    li.dataset.name=p.name;
    li.innerHTML=`
      <span class="sug-name ${p.important?'important':''}">${escapeHTML(p.name)}</span>
      <span class="sug-slash">/</span>
      <span class="sug-reading">${escapeHTML(p.reading||'')}</span>
      <span style="font-size:.55rem;color:#555;"></span>`;
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
  const items=[...suggestionListEl.querySelectorAll('li')];
  if(!items.length) return;
  if(e.key==='ArrowDown'){
    e.preventDefault();
    suggestionIndex=(suggestionIndex+1)%items.length;
  }else if(e.key==='ArrowUp'){
    e.preventDefault();
    suggestionIndex=(suggestionIndex-1+items.length)%items.length;
  }else if(e.key==='Enter'){
    if(suggestionIndex>=0){
      e.preventDefault(); items[suggestionIndex].click(); return;
    }
  }else return;
  items.forEach((li,i)=>li.classList.toggle('active',i===suggestionIndex));
}
inputEl.addEventListener('input',()=>{
  const q=inputEl.value.trim();
  if(!q){ clearSuggestions(); return; }
  showSuggestions(filterPoints(q));
});
inputEl.addEventListener('keydown',handleArrowNavigation);
searchBtn.addEventListener('click',()=>{
  const q=inputEl.value.trim();
  if(!q){ inputEl.focus(); return; }
  const list=filterPoints(q);
  if(list.length===1){ selectPoint(list[0]); return; }
  showSuggestions(list);
});

/* 画像 */
function equalizeTopCards(){
  if(window.innerWidth<860){
    searchCard.style.height='';
    symptomCard.style.height='';
    return;
  }
  searchCard.style.height='';
  symptomCard.style.height='';
  const h=Math.max(searchCard.scrollHeight,symptomCard.scrollHeight);
  searchCard.style.height=h+'px';
  symptomCard.style.height=h+'px';
}

/* CSV Load */
async function loadAcuCSV(){
  statusEl.textContent='経穴CSV: 読込中...';
  try{
    const res=await fetch(`${CSV_PATH}?v=${APP_VERSION}&_=${Date.now()}`,{cache:'no-store'});
    if(!res.ok) throw new Error('HTTP '+res.status);
    const txt=await res.text();
    ACUPOINTS=parseAcuCSV(txt);
    buildNameLookup();
    DATA_READY=true;
    statusEl.textContent='経穴CSV: '+ACUPOINTS.length+'件';
  }catch(e){
    statusEl.textContent='経穴CSV: 失敗 '+e.message;
    console.error(e);
  }finally{ requestAnimationFrame(equalizeTopCards); }
}
async function loadClinicalCSV(){
  clinicalStatusEl.textContent='臨床CSV: 読込中...';
  try{
    const res=await fetch(`${CLINICAL_CSV_PATH}?v=${APP_VERSION}&_=${Date.now()}`,{cache:'no-store'});
    if(!res.ok) throw new Error('HTTP '+res.status);
    const txt=await res.text();
    const {hierarchy,classificationsOrder}=parseClinicalHierarchyStateMachine(txt);
    CLINICAL_HIERARCHY=hierarchy;
    CLASSIFICATIONS_ORDER=classificationsOrder;
    CLINICAL_READY=true;
    makeOptions(classificationSelect,CLASSIFICATIONS_ORDER,{placeholder:'(分類を選択)'});
    classificationSelect.disabled=!CLASSIFICATIONS_ORDER.length;
    rebuildAcuPointPatternIndex();
    clinicalStatusEl.textContent='臨床CSV: OK';
  }catch(e){
    clinicalStatusEl.textContent='臨床CSV: 失敗 '+e.message;
    console.error(e);
  }finally{ requestAnimationFrame(equalizeTopCards); }
}

/* 関連リンククリック */
document.addEventListener('click',e=>{
  const pat=e.target.closest('.acu-pattern-link');
  if(pat){
    e.preventDefault();
    selectHierarchy(pat.dataset.class,pat.dataset.system,pat.dataset.symptom,pat.dataset.pattern,false);
    return;
  }
  const pt=e.target.closest('.treat-point-link');
  if(pt){
    e.preventDefault();
    const nm=pt.dataset.point;
    const p=findAcupointByToken(nm);
    p? showPointDetail(p): showUnknownPoint(nm);
  }
});

/* 初期化 */
function init(){
  loadAcuCSV();
  loadClinicalCSV();
  initHomeGallery();
  goHome(true);
  pushState({type:'home'},true);
  updateNavButtons();
  requestAnimationFrame(equalizeTopCards);
  requestAnimationFrame(()=>{ inputEl.focus(); inputEl.select(); });
}
window.addEventListener('resize',equalizeTopCards);
init();
