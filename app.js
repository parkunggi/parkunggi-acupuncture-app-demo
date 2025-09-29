/******************************************************
 * 経穴検索 + 臨床病証 + 履歴ナビ + 部位内経穴リンク化 + 経絡イメージ + Homeギャラリー
 * 4段階ドロップダウン (分類 / 系統 / 症状 / 病証) 追加版
 *  - 系統が存在しない場合は "-" を自動セット & disabled (グレー)
 *  - 既存パターン処理・履歴機能を極力維持
 * APP_VERSION 20250922-NAV-LINK-HOTFIX5-NERVE-VESSEL-REMOVED-IMGFIX14-HOMEGALLERY-FIXPATTERN-HIERARCHY
 ******************************************************/
const APP_VERSION = '20250922-NAV-LINK-HOTFIX5-NERVE-VESSEL-REMOVED-IMGFIX14-HOMEGALLERY-FIXPATTERN-HIERARCHY';

const CSV_FILE = '経穴・経絡.csv';
const CLINICAL_CSV_FILE = '東洋臨床論.csv';
const CSV_PATH = encodeURI(CSV_FILE);
const CLINICAL_CSV_PATH = encodeURI(CLINICAL_CSV_FILE);

const MIN_QUERY_LENGTH = 1;
const EXPECTED_TOTAL = 361;

const READINGS   = window.ACU_READINGS   || {};
const MUSCLE_MAP = window.ACU_MUSCLE_MAP || {};

/* ------------ 全体状態 ------------ */
let ACUPOINTS = [];
let ACUPOINT_NAME_LIST = [];
let ACUPOINT_NAME_SET  = new Set();

let DATA_READY = false;
let CLINICAL_READY = false;
let CLINICAL_DATA = { order:[], cats:{} };   // 既存構造（分類=旧カテゴリ）
let ACUPOINT_PATTERN_INDEX = {};
let clinicalHierarchy = {}; // 新: 分類→系統→症状→ { patterns:[], patternGroups:{pattern:groups[]} }

let historyStack = [];
let historyIndex = -1;
let IS_APPLYING_HISTORY = false;
let patternHistory = [];
let pointHistory   = [];
const HISTORY_LIMIT = 300;

/* ------------ DOM 取得: 検索/詳細 ------------ */
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

/* ------------ 新 4段階セレクト ------------ */
const classificationSelect = document.getElementById('classification-select'); // 分類 (1列目)
const systemSelect         = document.getElementById('system-select');         // 系統 (2列目)
const symptomSelect        = document.getElementById('symptom-select');        // 症状 (3列目)
const patternSelect        = document.getElementById('clinical-pattern-select'); // 病証 (既存パターン)

/* ------------ 治療結果DOM ------------ */
const clinicalResultEl = document.getElementById('clinical-treatment-result');
const clinicalTitleEl  = document.getElementById('clinical-selected-title');
const clinicalGroupsEl = document.getElementById('clinical-treatment-groups');

/* ------------ レイアウト他 ------------ */
const searchCard  = document.getElementById('search-card');
const symptomCard = document.getElementById('symptom-card');
const meridianImageSection = document.getElementById('meridian-image-section');
const meridianImageEl      = document.getElementById('meridian-image');

/* ------------ ナビ/履歴UI ------------ */
const homeBtn    = document.getElementById('home-btn');
const backBtn    = document.getElementById('back-btn');
const forwardBtn = document.getElementById('forward-btn');

const patternHistoryBtn      = document.getElementById('pattern-history-btn');
const patternHistoryMenu     = document.getElementById('pattern-history-menu');
const patternHistoryMenuList = document.getElementById('pattern-history-menu-list');

const pointHistoryBtn      = document.getElementById('point-history-btn');
const pointHistoryMenu     = document.getElementById('point-history-menu');
const pointHistoryMenuList = document.getElementById('point-history-menu-list');

/* Home ギャラリー */
const homeGallerySection = document.getElementById('home-gallery-section');
const homeGallerySelect  = document.getElementById('home-gallery-select');
const homeGalleryImage   = document.getElementById('home-gallery-image');
const homeGalleryFallback= document.getElementById('home-gallery-fallback');

/* ------------ Home ギャラリー定義 ------------ */
const HOME_GALLERY_IMAGES = [
  { file: '十四経経脈経穴図_1.前面.jpeg',        label: '① 前面' },
  { file: '十四経経脈経穴図_2.後面.jpeg',        label: '② 後面' },
  { file: '十四経経脈経穴図_3.後面(骨格).jpeg',  label: '③ 後面 (骨格)' },
  { file: '十四経経脈経穴図_4.側面(筋肉).jpeg',  label: '④ 側面 (筋肉)' }
];
const HOME_GALLERY_LS_KEY = 'homeGallery.lastFile';

function initHomeGallery(){
  if(!homeGallerySelect) return;
  homeGallerySelect.innerHTML='';
  const saved=localStorage.getItem(HOME_GALLERY_LS_KEY);
  let idx0=0;
  if(saved){
    const f=HOME_GALLERY_IMAGES.findIndex(x=>x.file===saved);
    if(f>=0) idx0=f;
  }
  HOME_GALLERY_IMAGES.forEach((img,idx)=>{
    const opt=document.createElement('option');
    opt.value=img.file;
    opt.textContent=img.label;
    if(idx===idx0) opt.selected=true;
    homeGallerySelect.appendChild(opt);
  });
  updateHomeGalleryImage(HOME_GALLERY_IMAGES[idx0].file,false);
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
if(homeGallerySelect){
  homeGallerySelect.addEventListener('change',()=>{
    const f=homeGallerySelect.value;
    if(f) updateHomeGalleryImage(f,true);
  });
}
function showHomeGallery(){ homeGallerySection?.classList.remove('hidden'); }
function hideHomeGallery(){ homeGallerySection?.classList.add('hidden'); }

/* ------------ Utils ------------ */
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
  const idx = original.indexOf('→');
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
function statesEqual(a,b){
  if(!a||!b) return false;
  if(a.type!==b.type) return false;
  if(a.type==='home') return true;
  if(a.type==='point'||a.type==='unknownPoint') return a.name===b.name;
  if(a.type==='pattern') return a.path===b.path && a.pattern===b.pattern;
  return false;
}
function updateNavButtons(){
  backBtn.disabled = (historyIndex<=0);
  forwardBtn.disabled = (historyIndex<0 || historyIndex>=historyStack.length-1);
  if(!patternHistoryMenu.classList.contains('hidden')) safeRenderPatternHistoryMenu();
  if(!pointHistoryMenu.classList.contains('hidden')) safeRenderPointHistoryMenu();
}
function updateHistoryBadge(){
  if(pointHistoryBtn){
    pointHistoryBtn.dataset.count = pointHistory.length;
    pointHistoryBtn.title = `経穴 履歴 - ${pointHistory.length}件`;
  }
  if(patternHistoryBtn){
    patternHistoryBtn.dataset.count = patternHistory.length;
    patternHistoryBtn.title = `病証 履歴 - ${patternHistory.length}件`;
  }
}
function pushState(state, replace=false){
  if(IS_APPLYING_HISTORY) return;
  const prev = historyStack[historyIndex] || null;
  state.showPoint   = state.showPoint   ?? isShown(inlineAcupointResult);
  state.showPattern = state.showPattern ?? isShown(clinicalResultEl);

  if(state.type==='home'){ state.showPoint=false; state.showPattern=false; }
  else if(state.type==='point'||state.type==='unknownPoint'){ state.showPoint=true; }
  else if(state.type==='pattern'){ state.showPattern=true; }

  if(prev){
    if(state.type==='pattern' && prev.showPoint) state.showPoint=true;
    if((state.type==='point'||state.type==='unknownPoint')&& prev.showPattern) state.showPattern=true;
  }

  if(historyIndex>=0 && statesEqual(historyStack[historyIndex],state)){
    historyStack[historyIndex].showPoint=state.showPoint;
    historyStack[historyIndex].showPattern=state.showPattern;
  } else {
    if(replace){
      if(historyIndex>=0) historyStack[historyIndex]=state;
      else { historyStack.push(state); historyIndex=0; }
    } else {
      if(historyIndex < historyStack.length-1){
        historyStack = historyStack.slice(0, historyIndex+1);
      }
      state.ts = Date.now();
      historyStack.push(state);
      historyIndex = historyStack.length-1;
    }
    if(state.type==='pattern'){
      patternHistory.push({ref:state, idx:historyIndex, ts:state.ts});
      if(patternHistory.length>HISTORY_LIMIT) patternHistory.shift();
    } else if(state.type==='point'||state.type==='unknownPoint'){
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
        inlineAcupointResult.classList.add('hidden');
        hideMeridianImage();
        clinicalResultEl.classList.add('hidden');
        clinicalGroupsEl.innerHTML='';
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
          // state.path = classification||system||symptom
            const parts = (state.path||'').split('||');
            const [cf, sys, sym] = parts;
            if(cf){
              classificationSelect.value = cf;
              classificationSelect.dispatchEvent(new Event('change'));
            }
            // system may be disabled; set after possible rendering
            requestAnimationFrame(()=>{
              if(sys){
                if(systemSelect.disabled){
                  // should be '-' already
                } else {
                  systemSelect.value = sys;
                  systemSelect.dispatchEvent(new Event('change'));
                }
              }
              if(sym){
                symptomSelect.value = sym;
                symptomSelect.dispatchEvent(new Event('change'));
              }
              // final pattern
              patternSelect.value = state.pattern;
              patternSelect.dispatchEvent(new Event('change'));
            });
        }
        break;
    }

    if(state.type==='home') showHomeGallery(); else hideHomeGallery();

    if(showPointFlag){
      inlineAcupointResult.classList.remove('hidden');
      if((state.type!=='point'&&state.type!=='unknownPoint')
        && !meridianImageEl.src
        && resultMeridianEl.textContent
        && !/未登録/.test(resultMeridianEl.textContent)){
          updateMeridianImage(resultMeridianEl.textContent.trim());
      }
    } else {
      inlineAcupointResult.classList.add('hidden');
      hideMeridianImage();
    }
    if(showPatternFlag){
      clinicalResultEl.classList.remove('hidden');
    } else {
      clinicalResultEl.classList.add('hidden');
    }
  } finally {
    IS_APPLYING_HISTORY=false;
    updateNavButtons();
    requestAnimationFrame(equalizeTopCards);
  }
}
function goBack(){ if(historyIndex>0){ historyIndex--; applyState(historyStack[historyIndex]); } }
function goForward(){ if(historyIndex < historyStack.length-1){ historyIndex++; applyState(historyStack[historyIndex]); } }
function formatTime(ts){
  const d = new Date(ts||Date.now());
  const pad = n=>('0'+n).slice(-2);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/* ------------ 履歴メニュー (Pattern: カテゴリ非表示) ------------ */
function renderPatternHistoryMenu(){
  patternHistoryMenuList.innerHTML='';
  const arr=[...patternHistory].reverse();
  if(!arr.length){
    const li=document.createElement('li'); li.textContent='履歴なし';
    patternHistoryMenuList.appendChild(li); return;
  }
  const current=historyStack[historyIndex];
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
    li.addEventListener('click',()=>{
      patternHistoryMenu.classList.add('hidden');
      historyIndex = entry.idx;
      const clone={...st};
      clone.showPoint = isShown(inlineAcupointResult);
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
    const label = (st.type==='unknownPoint')? `未登録: ${st.name}`:`経穴: ${st.name}`;
    li.innerHTML=`
      <div style="display:flex;align-items:center;gap:6px;">
        <span class="hist-time">${formatTime(entry.ts)}</span>
      </div>
      <div class="hist-label">${escapeHTML(label)}</div>`;
    li.addEventListener('click',()=>{
      pointHistoryMenu.classList.add('hidden');
      historyIndex = entry.idx;
      const clone={...st};
      clone.showPattern = isShown(clinicalResultEl);
      clone.showPoint = true;
      applyState(clone);
    });
    pointHistoryMenuList.appendChild(li);
  });
}
function fallbackRenderPointHistoryMenu(){
  pointHistoryMenuList.innerHTML = pointHistory.length
    ? pointHistory.slice().reverse().map(h=>{
        const st=h.ref||{};
        const label = st && st.type==='unknownPoint' ? `未登録: ${st.name}` : `経穴: ${st?.name||'(不明)'}`;
        return `<li><div style="display:flex;align-items:center;gap:6px;">
          <span class="hist-time">${formatTime(h.ts)}</span></div>
          <div class="hist-label">${escapeHTML(label)}</div></li>`;
      }).join('')
    : '<li>履歴なし</li>';
}
function guardRender(renderFn,fallbackFn,kind){
  try{
    if(typeof renderFn!=='function' || !/innerHTML/.test(renderFn.toString())){
      console.warn(`[HISTORY-GUARD] ${kind} renderer mismatch -> fallback`);
      fallbackFn(); return;
    }
    renderFn();
    const listEl = kind==='point'? pointHistoryMenuList: patternHistoryMenuList;
    const arr = kind==='point'? pointHistory: patternHistory;
    if(arr.length && !listEl.querySelector('li')){
      console.warn(`[HISTORY-GUARD] ${kind} menu empty after render -> fallback`);
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
patternHistoryBtn?.addEventListener('click',()=>{
  pointHistoryMenu.classList.add('hidden');
  if(patternHistoryMenu.classList.contains('hidden')){
    safeRenderPatternHistoryMenu();
    patternHistoryMenu.classList.remove('hidden');
  } else patternHistoryMenu.classList.add('hidden');
});
pointHistoryBtn?.addEventListener('click',()=>{
  patternHistoryMenu.classList.add('hidden');
  if(pointHistoryMenu.classList.contains('hidden')){
    safeRenderPointHistoryMenu();
    pointHistoryMenu.classList.remove('hidden');
  } else pointHistoryMenu.classList.add('hidden');
});
document.addEventListener('click',e=>{
  if(!patternHistoryMenu.classList.contains('hidden') && !e.target.closest('#pattern-history-btn-wrapper')){
    patternHistoryMenu.classList.add('hidden');
  }
  if(!pointHistoryMenu.classList.contains('hidden') && !e.target.closest('#point-history-btn-wrapper')){
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
    if(/^[0-9０-９]+\./.test(rawLine.trim())) continue; // 使わない番号行
    const cols=splitLine(rawLine);
    if(!cols.length) continue;
    if(cols[0]==='経絡' && cols[1]==='経穴') continue;
    if(cols.length<2) continue;
    const meridian=trimOuter(cols[0]);
    const name=trimOuter(cols[1]);
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

/* トークン一致（空白許容） */
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
  const uniq=Array.from(new Set(tokens||[]));
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

/* ------------ 既存臨床 CSV パーサ (保持) ------------ */
/* （前バージョンの複雑パースは省略し簡略: “病証名” 行を拾うシンプル推定）
   ここでは最低限パターン->治療グループ構造が得られればOK */
function parseClinicalCSV(raw){
  const text = raw.replace(/\r\n/g,'\n').replace(/\uFEFF/g,'');
  const lines = text.split('\n');

  const rows = lines.map(l=>{
    // 簡易CSV split（既存ファイル構造仮定：カンマのみ / 引用は扱わない簡略）
    return l.split(',').map(c=>c.replace(/\u00A0/g,' ').trim());
  });

  const data = { order:[], cats:{} };
  let currentCat = null;

  for(let i=0;i<rows.length;i++){
    const r=rows[i];
    if(!r.length) continue;
    const c0=r[0];
    // 分類行: 第1列に "数字." で他列ほぼ空
    if(/^[0-9０-９]+\.?/.test(removeAllUnicodeSpaces(c0)) && r.slice(1).every(x=>!x)){
      currentCat = removeAllUnicodeSpaces(c0);
      if(!data.cats[currentCat]){
        data.cats[currentCat]={patternOrder:[],patterns:{}};
        data.order.push(currentCat);
      }
      continue;
    }
    if(!currentCat) continue;
    // “病証名” 行： 第3列 (index2) が '病証名' っぽい
    if(r[2] && r[2].replace(/\s+/g,'').startsWith('病証名')){
      // パターン名は列3以降（index 3..）
      for(let col=3; col<r.length; col++){
        const name = trimOuter(r[col]||'');
        if(!name) continue;
        if(!data.cats[currentCat].patterns[name]){
          data.cats[currentCat].patterns[name]=[];
          data.cats[currentCat].patternOrder.push(name);
        }
      }
      // 次以降の治療方針行を取り込む（“治療方針” 含む行を続けて見る）
      let j=i+1;
      while(j<rows.length){
        const rr=rows[j];
        if(!rr.length){ j++; continue; }
        // 次の分類や次の "病証名" で抜ける
        if(rr[0] && /^[0-9０-９]+\.?/.test(removeAllUnicodeSpaces(rr[0])) && rr.slice(1).every(x=>!x)) break;
        if(rr[2] && rr[2].replace(/\s+/g,'').startsWith('病証名')) break;
        if(rr[2] && rr[2].includes('治療方針')){
          // グループ行：列3以降 pattern に対応（コメント別行は続行）
          // 内容をそのまま label/rawPoints として簡便格納
          for(let col=3; col<rr.length; col++){
            const pn = data.cats[currentCat].patternOrder[col-3];
            if(!pn) continue;
            const cell = rr[col]||'';
            if(!cell.trim()) continue;
            const label = cell.split('：')[0] || cell;
            const rawPts = cell.includes('：')? cell.slice(cell.indexOf('：')+1).trim(): cell.trim();
            const groupObj = {
              label: trimOuter(label),
              rawPoints: rawPts,
              comment: '',
              tokens: parseTreatmentPoints(rawPts)
            };
            data.cats[currentCat].patterns[pn].push(groupObj);
          }
        }
        j++;
      }
    }
  }
  return data;
}

/* ------------ 階層構築 (分類 / 系統 / 症状) ------------ */
function buildClinicalHierarchy(raw){
  const text = raw.replace(/\r\n/g,'\n').replace(/\uFEFF/g,'');
  const lines = text.split('\n');
  const rows = lines.map(l=> l.split(',').map(c=>c.replace(/\u00A0/g,' ').trim()));

  clinicalHierarchy={};
  let currentClassification=null;
  let currentSystem=null;
  let currentSymptom=null;

  for(let i=0;i<rows.length;i++){
    const r=rows[i];
    if(!r.length) continue;
    const c1=r[0];
    const c2=r[1];
    const c3=r[2];

    // 分類行
    if(c1 && /^[0-9０-９]+\.?/.test(removeAllUnicodeSpaces(c1)) && r.slice(1).every(x=>!x)){
      currentClassification = removeAllUnicodeSpaces(c1);
      if(!clinicalHierarchy[currentClassification]){
        clinicalHierarchy[currentClassification]={ systems:{}, order:[] };
      }
      currentSystem=null;
      currentSymptom=null;
      continue;
    }
    if(!currentClassification) continue;

    // 系統行: 第2列に値, 第3列空
    if(c2 && !c3){
      currentSystem = c2;
      if(!clinicalHierarchy[currentClassification].systems[currentSystem]){
        clinicalHierarchy[currentClassification].systems[currentSystem]={ symptoms:{} , order:[] };
        clinicalHierarchy[currentClassification].order.push(currentSystem);
      }
      currentSymptom=null;
      continue;
    }

    // 症状行: 第3列に "数字.名称" 形式
    if(c3 && /^[0-9０-９]+\.?/.test(removeAllUnicodeSpaces(c3))){
      currentSymptom = c3;
      // 系統存在しない場合 placeholder
      let sys = currentSystem && currentSystem.trim()? currentSystem : '-';
      if(!clinicalHierarchy[currentClassification].systems[sys]){
        clinicalHierarchy[currentClassification].systems[sys]={ symptoms:{}, order:[] };
        clinicalHierarchy[currentClassification].order.push(sys);
      }
      const sysNode = clinicalHierarchy[currentClassification].systems[sys];
      if(!sysNode.symptoms[currentSymptom]){
        sysNode.symptoms[currentSymptom]={ patterns:[], patternGroups:{} };
        sysNode.order.push(currentSymptom);
      }
      continue;
    }

    // 病証名行: 第3列に '病証名' (空白込み)
    if(c3 && c3.replace(/\s+/g,'').startsWith('病証名')){
      let sys = (currentSystem && currentSystem.trim())? currentSystem : '-';
      if(!currentClassification || !sys || !currentSymptom) continue;
      const symNode = clinicalHierarchy[currentClassification].systems[sys].symptoms[currentSymptom];
      // パターン名列 (index 3以降)
      for(let col=3; col<r.length; col++){
        const pn = trimOuter(r[col]||'');
        if(!pn) continue;
        if(!symNode.patterns.includes(pn)){
          symNode.patterns.push(pn);
          // 既存 CLINICAL_DATA から group を再利用
          const g = (CLINICAL_DATA.cats[currentClassification]?.patterns?.[pn]) || [];
          symNode.patternGroups[pn] = g;
        }
      }
      continue;
    }
  }

  // 系統 order のユニーク化＆空補正
  Object.keys(clinicalHierarchy).forEach(cf=>{
    const o = clinicalHierarchy[cf].order;
    clinicalHierarchy[cf].order = [...new Set(o)].map(x=> x&&x.trim()? x:'-');
    // systems 内 symptoms order uniq
    Object.values(clinicalHierarchy[cf].systems).forEach(sysNode=>{
      sysNode.order=[...new Set(sysNode.order)];
    });
  });
}

/* ------------ 逆インデックス (従来) ------------ */
function rebuildAcuPointPatternIndex(){
  ACUPOINT_PATTERN_INDEX={};
  CLINICAL_DATA.order.forEach(cat=>{
    const catObj = CLINICAL_DATA.cats[cat];
    catObj.patternOrder.forEach(pat=>{
      const groups = catObj.patterns[pat] || [];
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

/* ------------ レイアウト高さ同期 ------------ */
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
    li.setAttribute('aria-selected',i===0?'true':'false');
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

/* ------------ Region 内経穴リンク化 ------------ */
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
    } else if(node.nodeType===Node.ELEMENT_NODE){
      if(node.tagName.toLowerCase()==='a') return;
      Array.from(node.childNodes).forEach(process);
    }
  }
  Array.from(wrapper.childNodes).forEach(process);
  return wrapper.innerHTML;
}

/* ------------ 経絡画像 ------------ */
function hideMeridianImage(){
  meridianImageSection?.classList.add('hidden');
  if(meridianImageEl){
    meridianImageEl.removeAttribute('src');
    meridianImageEl.alt='';
  }
}
function updateMeridianImage(meridian){
  if(!meridian) return hideMeridianImage();
  const url='image/'+encodeURI(meridian+'.png')+'?v='+APP_VERSION;
  meridianImageEl.onload=()=>meridianImageSection.classList.remove('hidden');
  meridianImageEl.onerror=()=>hideMeridianImage();
  meridianImageEl.alt=meridian;
  meridianImageEl.src=url;
}

/* ------------ 経穴詳細表示 ------------ */
function showPointDetail(p, suppressHistory=false){
  hideHomeGallery();
  let regionHTML=p.region||'';
  if(regionHTML.includes('[['])){
    regionHTML = p.regionRaw? applyRedMarkup(p.regionRaw): applyRedMarkup(regionHTML);
  }
  regionHTML=linkifyRegionAcupoints(regionHTML);
  resultNameEl.textContent=`${p.name}${p.reading?` (${p.reading})`:''}`;
  if(p.important) resultNameEl.classList.add('is-important'); else resultNameEl.classList.remove('is-important');
  resultMeridianEl.textContent=p.meridian||'（経絡未登録）';
  resultRegionEl.innerHTML=regionHTML||'（部位未登録）';
  if(p.important){
    resultImportantEl.innerHTML=`<span class="acu-important-flag">${escapeHTML(p.important)}</span>`;
  } else resultImportantEl.textContent='-';
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

/* ------------ 新 4段階セレクト ロジック ------------ */
function resetHierarchySelects(full=false){
  if(full){
    classificationSelect.innerHTML='<option value="">--</option>';
    systemSelect.innerHTML='<option value="">--</option>';
    symptomSelect.innerHTML='<option value="">--</option>';
    patternSelect.innerHTML='<option value="">--</option>';
    classificationSelect.disabled=true;
    systemSelect.disabled=true;
    symptomSelect.disabled=true;
    patternSelect.disabled=true;
    systemSelect.classList.remove('is-system-disabled');
  } else {
    systemSelect.innerHTML='<option value="">--</option>';
    symptomSelect.innerHTML='<option value="">--</option>';
    patternSelect.innerHTML='<option value="">--</option>';
    systemSelect.disabled=true;
    symptomSelect.disabled=true;
    patternSelect.disabled=true;
    systemSelect.classList.remove('is-system-disabled');
  }
}

function populateClassification(){
  classificationSelect.innerHTML='<option value="">--</option>';
  Object.keys(clinicalHierarchy).forEach(cf=>{
    const opt=document.createElement('option');
    opt.value=cf;
    opt.textContent=cf;
    classificationSelect.appendChild(opt);
  });
  classificationSelect.disabled=false;
}

function renderSystemOptions(classification){
  systemSelect.innerHTML='';
  systemSelect.classList.remove('is-system-disabled');
  systemSelect.disabled=false;
  symptomSelect.innerHTML='<option value="">--</option>';
  symptomSelect.disabled=true;
  patternSelect.innerHTML='<option value="">--</option>';
  patternSelect.disabled=true;

  const cls = clinicalHierarchy[classification];
  if(!cls){
    systemSelect.innerHTML='<option value="">--</option>';
    systemSelect.disabled=true;
    return;
  }
  let systems = cls.order && cls.order.length ? cls.order : ['-'];
  systems = systems.map(s=> (s&&s.trim())? s.trim(): '-');
  systems = [...new Set(systems)];

  if(systems.length===1 && systems[0]==='-'){
    const opt=document.createElement('option');
    opt.value='-';
    opt.textContent='-';
    systemSelect.appendChild(opt);
    systemSelect.value='-';
    systemSelect.disabled=true;
    systemSelect.classList.add('is-system-disabled');
    // 直ちに症状描画
    renderSymptomOptions(classification,'-');
    return;
  }
  const blank=document.createElement('option');
  blank.value=''; blank.textContent='--';
  systemSelect.appendChild(blank);
  systems.forEach(s=>{
    const opt=document.createElement('option');
    opt.value=s;
    opt.textContent=s;
    systemSelect.appendChild(opt);
  });
}

function renderSymptomOptions(classification, system){
  symptomSelect.innerHTML='';
  patternSelect.innerHTML='<option value="">--</option>';
  patternSelect.disabled=true;

  const sysNode = clinicalHierarchy[classification]?.systems?.[system];
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
    opt.value=sym;
    opt.textContent=sym;
    symptomSelect.appendChild(opt);
  });
  symptomSelect.disabled=false;
}

function renderPatternOptions(classification, system, symptom){
  patternSelect.innerHTML='';
  const symNode = clinicalHierarchy[classification]?.systems?.[system]?.symptoms?.[symptom];
  if(!symNode){
    patternSelect.innerHTML='<option value="">--</option>';
    patternSelect.disabled=true;
    return;
  }
  const blank=document.createElement('option');
  blank.value=''; blank.textContent='--';
  patternSelect.appendChild(blank);
  symNode.patterns.forEach(pn=>{
    const opt=document.createElement('option');
    opt.value=pn;
    opt.textContent=getDisplayPatternName(pn);
    patternSelect.appendChild(opt);
  });
  patternSelect.disabled=false;
}

/* ------------ イベント: 4段階 ------------ */
classificationSelect.addEventListener('change', ()=>{
  const cf=classificationSelect.value;
  resetLowerAfterClassification();
  if(!cf){
    requestAnimationFrame(equalizeTopCards); return;
  }
  renderSystemOptions(cf);
  requestAnimationFrame(equalizeTopCards);
});
function resetLowerAfterClassification(){
  systemSelect.innerHTML='<option value="">--</option>';
  symptomSelect.innerHTML='<option value="">--</option>';
  patternSelect.innerHTML='<option value="">--</option>';
  systemSelect.disabled=true;
  symptomSelect.disabled=true;
  patternSelect.disabled=true;
  systemSelect.classList.remove('is-system-disabled');
}

systemSelect.addEventListener('change', ()=>{
  const cf=classificationSelect.value;
  const sys = systemSelect.disabled ? '-' : systemSelect.value;
  symptomSelect.innerHTML='<option value="">--</option>';
  patternSelect.innerHTML='<option value="">--</option>';
  patternSelect.disabled=true;
  if(!cf || !sys){
    symptomSelect.disabled=true;
    requestAnimationFrame(equalizeTopCards);
    return;
  }
  renderSymptomOptions(cf, sys);
  requestAnimationFrame(equalizeTopCards);
});

symptomSelect.addEventListener('change', ()=>{
  const cf=classificationSelect.value;
  const sys= systemSelect.disabled ? '-' : systemSelect.value;
  const sym=symptomSelect.value;
  patternSelect.innerHTML='<option value="">--</option>';
  if(!cf || !sys || !sym){
    patternSelect.disabled=true;
    requestAnimationFrame(equalizeTopCards);
    return;
  }
  renderPatternOptions(cf, sys, sym);
  requestAnimationFrame(equalizeTopCards);
});

/* パターン選択 => 治療方針表示 */
patternSelect.addEventListener('change', ()=>{
  try{
    hideHomeGallery();
    const cf=classificationSelect.value;
    const sys= systemSelect.disabled ? '-' : systemSelect.value;
    const sym=symptomSelect.value;
    const pat=patternSelect.value;
    clinicalResultEl.classList.add('hidden');
    clinicalGroupsEl.innerHTML='';
    if(!cf || !sym || !pat){
      requestAnimationFrame(equalizeTopCards);
      return;
    }
    const symNode = clinicalHierarchy[cf]?.systems?.[sys]?.symptoms?.[sym];
    const groups = symNode?.patternGroups?.[pat] || [];
    const span=clinicalTitleEl.querySelector('.pattern-name-highlight');
    if(span) span.textContent=getDisplayPatternName(pat);

    groups.forEach(g=>{
      const tokens=g.tokens || parseTreatmentPoints(g.rawPoints);
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
      a.addEventListener('click', e=>{
        e.preventDefault();
        const nm=a.dataset.point;
        const p=findAcupointByToken(nm);
        if(p) showPointDetail(p); else showUnknownPoint(nm);
      });
    });
    clinicalResultEl.classList.remove('hidden');

    if(!IS_APPLYING_HISTORY){
      pushState({
        type:'pattern',
        classification:cf,
        system:sys,
        symptom:sym,
        pattern:pat,
        path:`${cf}||${sys}||${sym}`
      });
    }
  }catch(err){
    console.error('[patternSelect change] error',err);
    clinicalStatusEl.textContent='臨床CSV: 表示エラー '+err.message;
  } finally {
    requestAnimationFrame(equalizeTopCards);
  }
});

/* ------------ クリックリンク（関連病証 / 治療方針内経穴） ------------ */
document.addEventListener('click', e=>{
  const a=e.target.closest('.acu-pattern-link');
  if(!a) return;
  e.preventDefault();
  // 既存構造: cat & pattern しか無いので階層復元困難 → 簡易: 分類=cat とみなす & system='-' & symptom='(直指定不可)'
  const cat=a.dataset.cat;
  const pat=a.dataset.pattern;
  if(!cat||!pat) return;
  if(!CLINICAL_DATA.cats[cat]) return;
  // 分類選択
  classificationSelect.value=cat;
  classificationSelect.dispatchEvent(new Event('change'));
  // system '-' 仮
  if(systemSelect.disabled){
    // proceed
  } else if(systemSelect.querySelector('option[value="-"]')){
    systemSelect.value='-';
    systemSelect.dispatchEvent(new Event('change'));
  }
  // 症状候補からパターン含む症状を探す
  const cfNode=clinicalHierarchy[cat];
  let targetSys='-';
  let targetSym=null;
  outer: for(const sysKey of Object.keys(cfNode.systems)){
    const sysNode=cfNode.systems[sysKey];
    for(const symKey of Object.keys(sysNode.symptoms)){
      const sNode=sysNode.symptoms[symKey];
      if(sNode.patterns.includes(pat)){
        targetSys=sysKey;
        targetSym=symKey;
        break outer;
      }
    }
  }
  if(targetSys && !systemSelect.disabled){
    systemSelect.value=targetSys;
    systemSelect.dispatchEvent(new Event('change'));
  }
  if(targetSym){
    symptomSelect.value=targetSym;
    symptomSelect.dispatchEvent(new Event('change'));
    patternSelect.value=pat;
    patternSelect.dispatchEvent(new Event('change'));
  }
});
document.addEventListener('click', e=>{
  const a=e.target.closest('.treat-point-link');
  if(!a) return;
  e.preventDefault();
  const nm=a.dataset.point;
  const p=findAcupointByToken(nm);
  if(p) showPointDetail(p); else showUnknownPoint(nm);
});

/* ------------ Home ------------ */
function goHome(suppressHistory=false){
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
  resetHierarchySelects(true);
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
    statusEl.textContent = (total===EXPECTED_TOTAL)
      ? `経穴CSV: ${total}件 / 想定${EXPECTED_TOTAL}`
      : `経穴CSV: ${total}件 (想定${EXPECTED_TOTAL})`;
  }catch(err){
    console.error('[LOAD] acu error',err);
    statusEl.textContent='経穴CSV: 失敗 '+err.message;
  }finally{
    requestAnimationFrame(equalizeTopCards);
  }
}
let rawClinicalCSV='';
async function loadClinicalCSV(){
  clinicalStatusEl.textContent='臨床CSV: 読込中';
  try{
    const res=await fetch(`${CLINICAL_CSV_PATH}?v=${APP_VERSION}&_=${Date.now()}`);
    if(!res.ok) throw new Error('HTTP '+res.status);
    rawClinicalCSV=await res.text();
    CLINICAL_DATA=parseClinicalCSV(rawClinicalCSV);
    CLINICAL_READY=true;
    rebuildAcuPointPatternIndex();
    buildClinicalHierarchy(rawClinicalCSV);
    populateClassification();
    clinicalStatusEl.textContent=`臨床CSV: 分類 ${Object.keys(clinicalHierarchy).length}件`;
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
