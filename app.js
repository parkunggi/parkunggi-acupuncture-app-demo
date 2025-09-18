/******************************************************
 * CSVベース経穴検索システム（改良版）
 * - CSV: 経穴・経絡.csv を fetch（日本語ファイル名対策で encodeURI）
 * - ひらがな前方一致 + 漢字部分一致
 * - 検索ボタン / Enter / サジェスト選択で詳細表示
 * - “経穴” 項目は表示しない（経穴名はタイトルにのみ表示）
 ******************************************************/

const CSV_FILE_NAME = '経穴・経絡.csv';
const CSV_PATH = encodeURI(CSV_FILE_NAME); // 日本語ファイル名対策
const MIN_QUERY_LENGTH = 1;

const READINGS = {
  // ここに読み辞書（空白除去後の経穴名 -> ひらがな）
  "長強":"ちょうきょう","腰兪":"ようゆ","腰陽関":"ようようかん","命門":"めいもん","懸枢":"けんすう","脊中":"せきちゅう",
  "中枢":"ちゅうすう","筋縮":"きんしゅく","至陽":"しよう","霊台":"れいだい","神道":"しんどう","身柱":"しんちゅう",
  "陶道":"とうどう","大椎":"だいつい","瘂門":"あもん","風府":"ふうふ","脳戸":"のうこ","強間":"きょうかん",
  "後頂":"こうちょう","百会":"ひゃくえ","前頂":"ぜんちょう","顖会":"しんえ","上星":"じょうせい","神庭":"しんてい",
  "素髎":"そりょう","水溝":"すいこう","兌端":"だたん","齦交":"ぎんこう",
  "会陰":"えいん","曲骨":"きょくこつ","中極":"ちゅうきょく","関元":"かんげん","石門":"せきもん","気海":"きかい",
  "陰交":"いんこう","神闕":"しんけつ","水分":"すいぶん","下脘":"げかん","建里":"けんり","中脘":"ちゅうかん",
  "上脘":"じょうかん","巨闕":"こけつ","鳩尾":"きゅうび","中庭":"ちゅうてい","膻中":"だんちゅう","玉堂":"ぎょくどう",
  "紫宮":"しきゅう","華蓋":"かがい","璇璣":"せんき","天突":"てんとつ","廉泉":"れんせん","承漿":"しょうしょう",
  "中府":"ちゅうふ","雲門":"うんもん","天府":"てんぷ","侠白":"きょうはく","尺沢":"しゃくたく","孔最":"こうさい",
  "列欠":"れっけつ","経渠":"けいきょ","太淵":"たいえん","魚際":"ぎょさい","少商":"しょうしょう",
  "商陽":"しょうよう","二間":"じかん","三間":"さんかん","合谷":"ごうこく","陽渓":"ようけい","偏歴":"へんれき",
  "温溜":"おんる","下廉":"げれん","上廉":"じょうれん","手三里":"てさんり","曲池":"きょくち","肘髎":"ちゅうりょう",
  "手五里":"てごり","臂臑":"ひじゅ","肩髃":"けんぐう","巨骨":"ここつ","天鼎":"てんてい","扶突":"ふとつ",
  "禾髎":"かりょう","迎香":"げいこう"
  // TODO: 続きを必要に応じ追加
};

let ACUPOINTS = [];
let DATA_READY = false;

/* DOM 要素 */
const inputEl = document.getElementById('acupoint-search-input');
const suggestionListEl = document.getElementById('acupoint-suggestion-list');
const searchBtn = document.getElementById('search-btn');
const statusEl = document.getElementById('data-load-status');

const mainScreen = document.getElementById('main-screen');
const acupointResultScreen = document.getElementById('acupoint-result-screen');
const symptomResultScreen = document.getElementById('symptom-result-screen');

const resultNameEl      = document.getElementById('result-name');
const resultMeridianEl  = document.getElementById('result-meridian');
const resultRegionEl    = document.getElementById('result-region');
const resultImportantEl = document.getElementById('result-important');
const relatedSymptomsEl = document.getElementById('related-symptoms');

const symptomSelect          = document.getElementById('symptom-select');
const symptomResultTitleEl   = document.getElementById('symptom-result-title');
const symptomAcupointsListEl = document.getElementById('symptom-acupoints-list');

/* 症状デモ */
const SYMPTOMS = {
  symptom_demo1: { label: 'デモ症状: 頭痛', related: ['百会','風府','霊台'] },
  symptom_demo2: { label: 'デモ症状: 首肩こり', related: ['風府','強間'] }
};

/* ユーティリティ */
function trimAllSpaces(s){ return (s||'').replace(/[\u3000\s]+/g,''); }
function normalizeQuery(s){ return trimAllSpaces(s).toLowerCase(); }
function isHiraganaOnly(s){ return /^[\u3041-\u3096]+$/.test(s); }
function applyRedMarkup(text){
  if(!text) return '';
  return text.replace(/\[\[(.+?)\]\]/g,'<span class="bui-red">$1</span>');
}

/* CSV パース */
function parseCSV(text){
  const lines = text.split(/\r?\n/);
  const out = [];
  let currentMeridian = '';
  lines.forEach(raw=>{
    if(!raw.trim()) return;
    const line = raw.replace(/\uFEFF/g,'');
    if(/^\d+\./.test(line)){
      currentMeridian = trimAllSpaces(line.split(',')[0].replace(/^\d+\./,''));
      return;
    }
    const cols = line.split(',');
    if(cols.length < 2) return;
    const meridianRaw = cols[0]||'';
    const meridian = trimAllSpaces(meridianRaw) || currentMeridian;
    const pointRaw = cols[1]||'';
    const pointName = trimAllSpaces(pointRaw);
    if(!pointName) return;
    if(/経穴/.test(pointRaw) && /経絡/.test(meridianRaw)) return; // ヘッダ除外
    const region = (cols[2]||'').trim();
    const important = (cols[3]||'').trim();
    out.push({
      id: pointName, // 後で index 付加
      name: pointName,
      reading: READINGS[pointName] || '',
      meridian: meridian || '',
      region: applyRedMarkup(region),
      important: important
    });
  });
  return out;
}

/* 検索ロジック */
function filterPoints(qInput){
  const q = trimAllSpaces(qInput);
  if(q.length < MIN_QUERY_LENGTH) return [];
  if(isHiraganaOnly(q)){
    return ACUPOINTS.filter(p => p.reading && p.reading.startsWith(q));
  }
  return ACUPOINTS.filter(p => p.name.includes(q));
}

/* サジェスト */
function clearSuggestions(){
  suggestionListEl.innerHTML = '';
  suggestionListEl.classList.add('hidden');
  inputEl.setAttribute('aria-expanded','false');
}
function renderSuggestions(list){
  suggestionListEl.innerHTML = '';
  list.slice(0,80).forEach((p,i)=>{
    const li = document.createElement('li');
    li.dataset.id = p.id;
    li.innerHTML = `<span>${p.name}</span><span class="kana">${p.reading||''}</span>`;
    if(i===0) li.classList.add('active');
    li.addEventListener('click', ()=> selectPoint(p));
    suggestionListEl.appendChild(li);
  });
  if(!list.length){
    const li = document.createElement('li');
    li.textContent = '該当なし';
    li.style.color = '#888';
    suggestionListEl.appendChild(li);
  }
  suggestionListEl.classList.remove('hidden');
  inputEl.setAttribute('aria-expanded','true');
}
function setActive(items, idx){
  items.forEach(li=>li.classList.remove('active'));
  if(items[idx]){
    items[idx].classList.add('active');
    items[idx].scrollIntoView({block:'nearest'});
  }
}
function handleSuggestionKeyboard(e){
  const items = Array.from(suggestionListEl.querySelectorAll('li'));
  if(!items.length) return;
  let current = items.findIndex(li=>li.classList.contains('active'));
  if(e.key==='ArrowDown'){
    e.preventDefault();
    current = (current + 1) % items.length;
    setActive(items,current);
  } else if(e.key==='ArrowUp'){
    e.preventDefault();
    current = (current - 1 + items.length) % items.length;
    setActive(items,current);
  } else if(e.key==='Enter'){
    e.preventDefault();
    const active = items[current>=0?current:0];
    if(active && active.dataset.id){
      const obj = ACUPOINTS.find(p=>p.id===active.dataset.id);
      if(obj) selectPoint(obj);
    }
  } else if(e.key==='Escape'){
    clearSuggestions();
  }
}

/* 詳細表示 */
function showPointDetail(p){
  resultNameEl.textContent = `${p.name}${p.reading?` (${p.reading})`:''}`;
  resultMeridianEl.textContent = p.meridian || '（経絡未登録）';
  resultRegionEl.innerHTML = p.region || '（部位未登録）';
  resultImportantEl.textContent = p.important || '（要穴未登録）';
  relatedSymptomsEl.innerHTML = '<li>（関連症状未登録）</li>';
  showScreen(acupointResultScreen);
}
function selectPoint(p){
  clearSuggestions();
  inputEl.value = p.name;
  showPointDetail(p);
}

/* 画面切替 */
function showScreen(screen){
  [mainScreen, acupointResultScreen, symptomResultScreen].forEach(s=>s.classList.add('hidden'));
  screen.classList.remove('hidden');
  window.scrollTo({top:0,behavior:'smooth'});
}

/* 症状デモ */
symptomSelect.addEventListener('change',()=>{
  if(!symptomSelect.value) return;
  renderSymptom(symptomSelect.value);
});
function renderSymptom(id){
  const sym = SYMPTOMS[id];
  if(!sym) return;
  symptomResultTitleEl.textContent = sym.label;
  symptomAcupointsListEl.innerHTML = '';
  if(!sym.related.length){
    symptomAcupointsListEl.innerHTML = '<li>関連経穴なし</li>';
  } else {
    sym.related.forEach(name=>{
      const p = ACUPOINTS.find(pt=>pt.name===name);
      if(!p) return;
      const li = document.createElement('li');
      const a = document.createElement('a');
      a.href='#';
      a.textContent = `${p.name}${p.reading?` (${p.reading})`:''}`;
      a.addEventListener('click',e=>{
        e.preventDefault();
        showPointDetail(p);
      });
      li.appendChild(a);
      symptomAcupointsListEl.appendChild(li);
    });
  }
  showScreen(symptomResultScreen);
}

/* 検索実行（検索ボタン / Enter 共通） */
function runSearch(){
  if(!DATA_READY){
    console.warn('データ未読込');
    return;
  }
  const q = inputEl.value;
  const eq = trimAllSpaces(q);
  if(!eq){
    clearSuggestions();
    return;
  }
  // 完全一致優先
  const exact = ACUPOINTS.find(p=>p.name===eq);
  if(exact){
    selectPoint(exact);
    return;
  }
  const list = filterPoints(q);
  if(list.length === 1){
    selectPoint(list[0]);
  } else {
    renderSuggestions(list);
  }
}

/* 入力イベント */
inputEl.addEventListener('keyup',e=>{
  if(['ArrowDown','ArrowUp','Enter','Escape'].includes(e.key)){
    handleSuggestionKeyboard(e);
    return;
  }
  if(!DATA_READY) return;
  const val = inputEl.value;
  if(trimAllSpaces(val).length < MIN_QUERY_LENGTH){
    clearSuggestions();
    return;
  }
  renderSuggestions(filterPoints(val));
});
inputEl.addEventListener('keydown',e=>{
  if(e.key==='Enter'){
    e.preventDefault();
    runSearch();
  } else if(['ArrowDown','ArrowUp','Escape'].includes(e.key)){
    handleSuggestionKeyboard(e);
  }
});

/* 検索ボタン */
searchBtn.addEventListener('click', runSearch);

/* 外側クリックでサジェスト閉じる */
document.addEventListener('click',e=>{
  if(!e.target.closest('.suggestion-wrapper') &&
     !e.target.closest('#acupoint-search-input')){
    clearSuggestions();
  }
});

/* 戻るボタン */
document.querySelectorAll('.back-to-main-btn').forEach(btn=>{
  btn.addEventListener('click',()=>showScreen(mainScreen));
});

/* CSV 読込 */
async function loadCSV(){
  try{
    statusEl.textContent = 'CSV 読み込み中...';
    const res = await fetch(CSV_PATH + '?_=' + Date.now());
    if(!res.ok) throw new Error('HTTP ' + res.status);
    const text = await res.text();
    let parsed = parseCSV(text);
    // 重複名対策: 同名があればインデックス付加
    const nameCount = {};
    parsed = parsed.map(p=>{
      nameCount[p.name] = (nameCount[p.name]||0)+1;
      const dupIndex = nameCount[p.name];
      return {
        ...p,
        id: dupIndex>1 ? `${p.name}__${dupIndex}` : p.name
      };
    });
    ACUPOINTS = parsed;
    DATA_READY = true;
    statusEl.textContent = `CSV 読み込み完了（${ACUPOINTS.length} 件）`;
    console.log('Loaded acupoints:', ACUPOINTS.slice(0,5),'...');
  }catch(err){
    console.error(err);
    statusEl.textContent = 'CSV 読み込み失敗: ' + err.message;
  }
}

/* 初期化 */
(function init(){
  showScreen(mainScreen);
  loadCSV();
})();
