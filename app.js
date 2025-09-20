/******************************************************
 * 経穴検索 + 臨床病証二段選択
 * APP_VERSION 20250918-37
 * 変更:
 *  - 括弧内/通常行とも空白無視で経穴名リンク化
 *  - 要穴は赤字、通常経穴は青
 *  - プレースホルダ文削除維持
 *  - 病証名/詳細見出し 青
 ******************************************************/

const APP_VERSION = '20250918-37';
const CSV_FILE = '経穴・経絡.csv';
const CLINICAL_CSV_FILE = '東洋臨床論.csv';

const CSV_PATH = encodeURI(CSV_FILE);
const CLINICAL_CSV_PATH = encodeURI(CLINICAL_CSV_FILE);

const MIN_QUERY_LENGTH = 1;
const EXPECTED_TOTAL = 361;

const READINGS   = window.ACU_READINGS   || {};
const MUSCLE_MAP = window.ACU_MUSCLE_MAP || {};

let ACUPOINTS = [];
let ACUPOINT_NAME_LIST = [];
let ACUPOINT_NAME_SET = new Set();

let DATA_READY = false;
let CLINICAL_DATA = { order: [], cats: {} };
let CLINICAL_READY = false;
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
const relatedSymptomsEl = document.getElementById('related-symptoms');

const categorySelect = document.getElementById('clinical-category-select');
const patternSelect  = document.getElementById('clinical-pattern-select');
const clinicalResultEl = document.getElementById('clinical-treatment-result');
const clinicalTitleEl  = document.getElementById('clinical-selected-title');
const clinicalGroupsEl = document.getElementById('clinical-treatment-groups');

const searchCard  = document.getElementById('search-card');
const symptomCard = document.getElementById('symptom-card');

/* ==== Utility ==== */
function normalizeNFC(s){ return s ? s.normalize('NFC') : ''; }
function removeAllUnicodeSpaces(str){
  return normalizeNFC(str||'')
    .replace(/[\u0000-\u001F\u007F]/g,'')
    .replace(/[ \u00A0\u1680\u2000-\u200B\u202F\u205F\u3000]/g,'')
    .replace(/\uFEFF/g,'');
}
function isSpace(ch){
  return /[ \u00A0\u1680\u2000-\u200B\u202F\u205F\u3000]/.test(ch);
}
function trimOuter(s){ return (s||'').trim(); }
function isHiraganaOnly(s){ return !!s && /^[\u3041-\u3096]+$/.test(s); }
function applyRedMarkup(text){
  if(!text) return '';
  return text.replace(/\[\[(.+?)\]\]/g,'<span class="bui-red">$1</span>');
}
function ensureCommentParens(c){
  if(!c) return '';
  if(/^\s*[（(]/.test(c)) return c;
  return '(' + c + ')';
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

/* ==== CSV ==== */
function parseAcuCSV(text){
  const lines = text.split(/\r?\n/);
  const out = [];
  let currentMeridian = '';
  for(const raw of lines){
    if(!raw) continue;
    const line = raw.replace(/\uFEFF/g,'');
    if(!line.trim()) continue;
    const cols = line.split(',');
    const headCell = cols[0]? cols[0].trim() : '';
    if(/^\s*\d+(\.|．)?/.test(headCell)){
      currentMeridian = removeAllUnicodeSpaces(headCell.replace(/^\s*\d+(\.|．)?\s*/,''));
      continue;
    }
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

/* ==== トークン化 ==== */
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
  return removeAllUnicodeSpaces(name || '').trim();
}
function findAcupointByToken(token){
  const key = normalizeAcuLookupName(token);
  if(!key) return null;
  return ACUPOINTS.find(p=>p.name === key);
}

/* ==== 名称マップ ==== */
function buildNameLookup(){
  ACUPOINT_NAME_LIST = ACUPOINTS.map(p=>p.name)
    .sort((a,b)=> b.length - a.length); // 長い順
  ACUPOINT_NAME_SET = new Set(ACUPOINT_NAME_LIST);
}

/* ==== 空白無視マッチ ==== */
/**
 * 空白(半角/全角)を無視しながら raw[pos..] が token を順番通り含むか判定
 * @returns 消費した raw の文字数 (0=不一致)
 */
function matchTokenWithSpaces(raw, pos, token){
  let i = pos;
  let k = 0;
  const len = raw.length;
  while(k < token.length){
    while(i < len && isSpace(raw[i])) i++; // skip spaces
    if(i >= len) return 0;
    if(raw[i] !== token[k]) return 0;
    i++; k++;
  }
  // token 文字をすべて消費後も後続スペースはマッチ範囲に含めない (呼び出し側でそのまま維持)
  return i - pos;
}

/* ==== 括弧内リンク化 ==== */
function linkifyParenthesisGroup(group){
  if(group.length < 2) return escapeHTML(group);
  const open = group[0];
  const close = group[group.length-1];
  const inner = group.slice(1, -1);
  let i = 0;
  let out = '';
  while(i < inner.length){
    const ch = inner[i];
    if(isSpace(ch)){
      out += escapeHTML(ch);
      i++;
      continue;
    }
    let matched = null;
    let consumed = 0;
    for(const name of ACUPOINT_NAME_LIST){
      const len = matchTokenWithSpaces(inner, i, name);
      if(len){
        matched = name;
        consumed = len;
        break;
      }
    }
    if(matched){
      const p = findAcupointByToken(matched);
      if(p){
        const imp = p.important ? ' acu-important':'';
        out += `<a href="#" class="treat-point-link${imp}" data-point="${escapeHTML(p.name)}">${escapeHTML(p.name)}</a>`;
      } else {
        out += escapeHTML(matched);
      }
      i += consumed;
    } else {
      out += escapeHTML(ch);
      i++;
    }
  }
  return escapeHTML(open) + out + escapeHTML(close);
}

/* ==== 治療ポイント HTML (空白無視マッチ対応) ==== */
function buildPointsHTML(rawPoints, tokens){
  if(!rawPoints) return '';
  const uniqueTokens = Array.from(new Set(tokens||[]));
  // tokens は括弧外の“代表”解析用だが、空白挿入ありでもマッチさせる
  const sortedTokens = uniqueTokens.sort((a,b)=> b.length - a.length);

  let i = 0;
  let out = '';
  const len = rawPoints.length;

  while(i < len){
    const ch = rawPoints[i];

    // 括弧開始
    if(ch === '(' || ch === '（'){
      const closeChar = (ch === '(') ? ')' : '）';
      let j = i + 1;
      while(j < len && rawPoints[j] !== closeChar) j++;
      if(j < len) j++; // close 含める
      const group = rawPoints.slice(i, j);
      out += linkifyParenthesisGroup(group);
      i = j;
      continue;
    }

    // 空白はそのまま出力（リンク判定は次へ）
    if(isSpace(ch)){
      out += escapeHTML(ch);
      i++;
      continue;
    }

    // 空白無視マッチ: 最長一致
    let matched = null;
    let consumed = 0;
    for(const tk of sortedTokens){
      const lenConsumed = matchTokenWithSpaces(rawPoints, i, tk);
      if(lenConsumed){
        matched = tk;
        consumed = lenConsumed;
        break;
      }
    }
    if(matched){
      const acu = findAcupointByToken(matched);
      if(acu){
        const importantClass = acu.important ? ' acu-important' : '';
        out += `<a href="#" class="treat-point-link${importantClass}" data-point="${escapeHTML(acu.name)}">${escapeHTML(acu.name)}</a>`;
      } else {
        out += `<a href="#" class="treat-point-link treat-point-unknown" data-point="${escapeHTML(matched)}" data-unknown="1">${escapeHTML(matched)}</a>`;
      }
      i += consumed;
      continue;
    }

    // マッチしなければ 1 文字出力
    out += escapeHTML(ch);
    i++;
  }

  return out;
}

/* ==== Clinical CSV Parser (前回と同様ロジック) ==== */
function rebuildLogicalRows(raw){
  const physical = raw.replace(/\r\n/g,'\n').split('\n');
  const rows=[]; let buf=''; let quotes=0;
  for(const line of physical){
    if(buf) buf+='\n'+line; else buf=line;
    quotes=(buf.match(/"/g)||[]).length;
    if(quotes % 2 === 0){
      rows.push(buf);
      buf='';
      quotes=0;
    }
  }
  if(buf) rows.push(buf);
  return rows;
}
function parseCSVLogicalRow(row){
  const cols=[]; let cur=''; let inQ=false;
  for(let i=0;i<row.length;i++){
    const ch=row[i];
    if(ch === '"'){
      if(inQ && row[i+1] === '"'){ cur+='"'; i++; }
      else inQ=!inQ;
      continue;
    }
    if(ch === ',' && !inQ){
      cols.push(cur); cur='';
    } else cur+=ch;
  }
  cols.push(cur);
  return cols.map(c=>c.replace(/\uFEFF/g,'').replace(/\u00A0/g,' ').trim());
}
function isCategoryRow(cols){
  if(!cols.length) return false;
  const c0=removeAllUnicodeSpaces(cols[0]);
  return /^[0-9０-９][0-9０-９-]*\./.test(c0) && cols.slice(1).every(c=>!c);
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
  if(!cell) return { label:'', rawPoints:'', comment:'' };
  const lines = cell.split(/\n+/).map(l=>l.trim()).filter(Boolean);
  let comment='';
  if(lines.length && /^[（(]/.test(lines[lines.length-1])) comment=lines.pop();
  let main = lines.join(' ');
  if(!main) main = cell;
  const tail = main.match(/([（(].*?[）)])\s*$/);
  if(tail){
    comment = comment || tail[1];
    main = main.slice(0, tail.index).trim();
  }
  let label='', rawPoints='';
  const p1=main.indexOf('：'); const p2=main.indexOf(':');
  let sep=-1;
  if(p1>=0 && p2>=0) sep=Math.min(p1,p2);
  else sep=p1>=0? p1 : p2;
  if(sep>=0){ label=main.slice(0,sep).trim(); rawPoints=main.slice(sep+1).trim();}
  else label=main.trim();
  return { label, rawPoints, comment };
}
function isInterleavedTreatmentRow(after, patternCount){
  if(!after.length) return false;
  const treat=after.filter(c=>c && (c.includes('：')||c.includes(':')));
  const comm=after.filter(c=>c && /^[（(]/.test(c));
  if(!comm.length) return false;
  if(!treat.length) return false;
  return (treat.length + comm.length) >= patternCount;
}
function parseInterleavedRow(after, patternNames){
  const results=[]; let pIndex=0; let i=0;
  while(i<after.length && pIndex < patternNames.length){
    while(i<after.length &&
          (!after[i] ||
           /^[（(]/.test(after[i]) ||
           !(after[i].includes('：')||after[i].includes(':')))){
      i++;
    }
    if(i>=after.length) break;
    const treatCell=after[i]; i++;
    let commentCell='';
    if(i<after.length && /^[（(]/.test(after[i])){ commentCell=after[i]; i++; }
    const {label,rawPoints,comment}=dissectTreatmentCell(treatCell);
    if(label||rawPoints){
      results.push({pattern:patternNames[pIndex], label, rawPoints, comment:commentCell||comment||''});
      pIndex++;
    }
  }
  return results;
}
function parseClinicalCSV(raw){
  const logical=rebuildLogicalRows(raw);
  const table=logical.map(parseCSVLogicalRow);
  const data={order:[], cats:{}};
  let i=0;
  while(i<table.length){
    const row=table[i];
    if(!row.length){ i++; continue; }
    if(isCategoryRow(row)){
      const category=removeAllUnicodeSpaces(row[0]);
      if(!data.cats[category]){
        data.cats[category]={ patternOrder:[], patterns:{} };
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
            const commentRow=isPotentialCommentRow(next)? next : null;
            patternNames.forEach((pName, idx)=>{
            const col=idx+1;
            const cell=r[col]||'';
            if(!cell) return;
            const {label, rawPoints, comment}=dissectTreatmentCell(cell);
            if(!label && !rawPoints) return;
            let finalComment=comment;
            if(!finalComment && commentRow){
              const cc=commentRow[col]||'';
              if(/^[（(]/.test(cc)) finalComment=cc;
            }
            data.cats[category].patterns[pName].push({
              label, rawPoints, comment:finalComment
            });
          });
          i += commentRow? 2:1;
        }
      }
      continue;
    }
    i++;
  }
  // tokens
  data.order.forEach(cat=>{
    const catObj=data.cats[cat];
    catObj.patternOrder.forEach(pn=>{
      catObj.patterns[pn].forEach(g=>{
        if(!g.tokens) g.tokens=parseTreatmentPoints(g.rawPoints);
      });
    });
  });
  console.log('[ClinicalParser v37]', data.order);
  return data;
}

/* ==== 逆引き ==== */
function rebuildAcuPointPatternIndex(){
  ACUPOINT_PATTERN_INDEX = {};
  CLINICAL_DATA.order.forEach(cat=>{
    const catObj=CLINICAL_DATA.cats[cat];
    catObj.patternOrder.forEach(pat=>{
      const groups=catObj.patterns[pat];
      const seen=new Set();
      groups.forEach(g=>{
        (g.tokens||[]).forEach(tk=>{
          if(!tk) return;
          if(seen.has(tk)) return;
          seen.add(tk);
          if(!ACUPOINT_PATTERN_INDEX[tk]) ACUPOINT_PATTERN_INDEX[tk]=[];
          ACUPOINT_PATTERN_INDEX[tk].push({cat, pattern:pat});
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

/* ==== 高さ同期 ==== */
function equalizeTopCards(){
  if(window.innerWidth < 860){
    searchCard.style.height='';
    symptomCard.style.height='';
    return;
  }
  searchCard.style.height='';
  symptomCard.style.height='';
  const h1=searchCard.scrollHeight;
  const h2=symptomCard.scrollHeight;
  const maxH=Math.max(h1,h2);
  searchCard.style.height=maxH+'px';
  symptomCard.style.height=maxH+'px';
}

/* ==== Suggestion ==== */
function filterPoints(qInput){
  const q=removeAllUnicodeSpaces(qInput);
  if(q.length < MIN_QUERY_LENGTH) return [];
  if(isHiraganaOnly(q)){
    let list=ACUPOINTS.filter(p=>p.reading && p.reading.startsWith(q));
    if(!list.length) list=ACUPOINTS.filter(p=>p.reading && p.reading.includes(q));
    return list.map(p=>({...p,_matchType:'name'}));
  }
  const nameMatches=[]; const seen=new Set();
  for(const p of ACUPOINTS){
    if(p.name.includes(q)){ nameMatches.push({...p,_matchType:'name'}); seen.add(p.id); }
  }
  const muscleMatches=[];
  for(const p of ACUPOINTS){
    if(!p.muscle) continue;
    if(seen.has(p.id)) continue;
    if(p.muscle.includes(q)) muscleMatches.push({...p,_matchType:'muscle'});
  }
  return nameMatches.concat(muscleMatches);
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
  const hiraQuery=isHiraganaOnly(qRaw)? qRaw : '';
  const qRegex = hiraQuery
    ? new RegExp(hiraQuery.replace(/([.*+?^=!:${}()|[\\]\\])/g,'\\$1'),'g')
    : null;
  list.slice(0,120).forEach((p,i)=>{
    const li=document.createElement('li');
    li.dataset.id=p.id;
    if(p._matchType) li.dataset.matchType=p._matchType;
    li.setAttribute('role','option');
    li.setAttribute('aria-selected', i===0?'true':'false');
    let readingHTML=escapeHTML(p.reading||'');
    if(qRegex && p.reading){
      readingHTML=readingHTML.replace(qRegex,m=>`<mark>${m}</mark>`);
    }
    const important=!!p.important;
    const nameClass=important?'sug-name important':'sug-name';
    const badges=[];
    if(important) badges.push('<span class="badge badge-important" title="要穴">★</span>');
    if(p._matchType==='muscle') badges.push('<span class="badge badge-muscle" title="筋肉で一致">M</span>');
    li.innerHTML=`
      <span class="${nameClass}">${escapeHTML(p.name)}</span>
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
      const p=ACUPOINTS.find(x=>x.id===act.dataset.id);
      if(p) selectPoint(p);
    }
  } else if(e.key==='Escape'){ clearSuggestions(); }
}

/* ==== 詳細 ==== */
function showPointDetail(p){
  resultNameEl.textContent = `${p.name}${p.reading?` (${p.reading})`:''}`;
  resultMeridianEl.textContent = p.meridian || '（経絡未登録）';
  resultRegionEl.innerHTML = p.region || '（部位未登録）';
  if(p.important){
    resultImportantEl.innerHTML = `<span class="acu-important-flag">${escapeHTML(p.important)}</span>`;
  } else {
    resultImportantEl.textContent='-';
  }
  resultMuscleEl.textContent = p.muscle || '（筋肉未登録）';
  renderRelatedPatterns(p.name);
  inlineAcupointResult.classList.remove('hidden');
}
function renderRelatedPatterns(pointName){
  relatedSymptomsEl.innerHTML='';
  if(!CLINICAL_READY || !ACUPOINT_PATTERN_INDEX[pointName] || !ACUPOINT_PATTERN_INDEX[pointName].length){
    relatedSymptomsEl.innerHTML='<li>-</li>'; return;
  }
  ACUPOINT_PATTERN_INDEX[pointName].forEach(entry=>{
    const li=document.createElement('li');
    li.innerHTML=`<a href="#" class="acu-pattern-link" data-cat="${escapeHTML(entry.cat)}" data-pattern="${escapeHTML(entry.pattern)}">${escapeHTML(entry.pattern)}</a>`;
    relatedSymptomsEl.appendChild(li);
  });
}
function showUnknownPoint(name){
  resultNameEl.textContent = `${name}（未登録）`;
  resultMeridianEl.textContent='（経絡未登録）';
  resultRegionEl.innerHTML='（部位未登録）';
  resultImportantEl.textContent='-';
  resultMuscleEl.textContent='（筋肉未登録）';
  relatedSymptomsEl.innerHTML='<li>-</li>';
  inlineAcupointResult.classList.remove('hidden');
}
function selectPoint(p){
  clearSuggestions();
  inputEl.value=p.name;
  showPointDetail(p);
  requestAnimationFrame(equalizeTopCards);
}

/* ==== 臨床 UI ==== */
categorySelect.addEventListener('change', ()=>{
  const cat=categorySelect.value;
  patternSelect.innerHTML='<option value="">--</option>';
  patternSelect.disabled=true;
  clinicalResultEl.classList.add('hidden');
  clinicalGroupsEl.innerHTML='';
  if(!cat || !CLINICAL_DATA.cats[cat]){ requestAnimationFrame(equalizeTopCards); return; }
  CLINICAL_DATA.cats[cat].patternOrder.forEach(pat=>{
    const opt=document.createElement('option');
    opt.value=pat; opt.textContent=pat;
    patternSelect.appendChild(opt);
  });
  patternSelect.disabled=false;
  requestAnimationFrame(equalizeTopCards);
});

patternSelect.addEventListener('change', ()=>{
  const cat=categorySelect.value;
  const pat=patternSelect.value;
  clinicalResultEl.classList.add('hidden');
  clinicalGroupsEl.innerHTML='';
  if(!cat || !pat || !CLINICAL_DATA.cats[cat] || !CLINICAL_DATA.cats[cat].patterns[pat]){ requestAnimationFrame(equalizeTopCards); return; }
  const groups=CLINICAL_DATA.cats[cat].patterns[pat];

  // 病証名（青）
  const span = clinicalTitleEl.querySelector('.pattern-name-highlight');
  if(span) span.textContent = pat;

  groups.forEach(g=>{
    const tokens = g.tokens || parseTreatmentPoints(g.rawPoints);
    const pointsHtml = buildPointsHTML(g.rawPoints, tokens);
    const comment = g.comment ? ensureCommentParens(g.comment) : '';
    const div=document.createElement('div');
    div.className='treat-line';
    div.innerHTML = `
      <p class="treat-main">${escapeHTML(g.label)}：${pointsHtml}</p>
      ${comment ? `<p class="treat-comment">${escapeHTML(comment)}</p>` : ''}`;
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

  requestAnimationFrame(equalizeTopCards);
});

/* ==== 病証リンク (右→左) ==== */
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
  clinicalResultEl.scrollIntoView({behavior:'smooth', block:'start'});
});

/* ==== 検索実行 ==== */
function runSearch(){
  if(!DATA_READY) return;
  const q=removeAllUnicodeSpaces(inputEl.value);
  if(!q){ clearSuggestions(); return; }
  const exact=ACUPOINTS.find(p=>p.name===q);
  if(exact){ selectPoint(exact); return; }
  const list=filterPoints(q);
  if(list.length===1) selectPoint(list[0]); else renderSuggestions(list);
}

/* ==== 入力イベント ==== */
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
  if(!e.target.closest('.suggestion-wrapper') &&
     !e.target.closest('#acupoint-search-input')){
    clearSuggestions();
  }
});

/* ==== データ読み込み ==== */
async function loadAcuCSV(){
  try{
    statusEl.textContent='経穴CSV: 読込中';
    const res=await fetch(`${CSV_PATH}?v=${APP_VERSION}&_=${Date.now()}`);
    if(!res.ok) throw new Error('HTTP '+res.status);
    const text=await res.text();
    let parsed=parseAcuCSV(text);
    const nameCount={};
    parsed=parsed.map(p=>{
      nameCount[p.name]=(nameCount[p.name]||0)+1;
      return {...p, id: nameCount[p.name]>1 ? `${p.name}__${nameCount[p.name]}`:p.name};
    });
    ACUPOINTS=parsed;
    buildNameLookup();
    DATA_READY=true;
    const total=ACUPOINTS.length;
    statusEl.textContent=`経穴CSV: ${total}件 (${total===EXPECTED_TOTAL?'正常':`想定${EXPECTED_TOTAL}`})`;
  }catch(err){
    console.error(err);
    statusEl.textContent='経穴CSV: 失敗 '+err.message;
  } finally {
    requestAnimationFrame(equalizeTopCards);
  }
}
async function loadClinicalCSV(){
  try{
    clinicalStatusEl.textContent='臨床CSV: 読込中';
    const res=await fetch(`${CLINICAL_CSV_PATH}?v=${APP_VERSION}&_=${Date.now()}`);
    if(!res.ok) throw new Error('HTTP '+res.status);
    const text=await res.text();
    CLINICAL_DATA=parseClinicalCSV(text);
    CLINICAL_READY=true;
    categorySelect.innerHTML='<option value="">--</option>';
    CLINICAL_DATA.order.forEach(cat=>{
      const opt=document.createElement('option');
      opt.value=cat; opt.textContent=cat;
      categorySelect.appendChild(opt);
    });
    rebuildAcuPointPatternIndex();
    clinicalStatusEl.textContent=`臨床CSV: ${CLINICAL_DATA.order.length}カテゴリ`;
  }catch(err){
    console.error(err);
    clinicalStatusEl.textContent='臨床CSV: 失敗 '+err.message;
  } finally {
    requestAnimationFrame(equalizeTopCards);
  }
}

/* ==== リサイズ ==== */
window.addEventListener('resize', equalizeTopCards);

/* ==== 初期化 ==== */
(function init(){
  loadAcuCSV();
  loadClinicalCSV();
  requestAnimationFrame(equalizeTopCards);
})();
