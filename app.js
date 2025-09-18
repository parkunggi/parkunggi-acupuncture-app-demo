/******************************************************
 * CSVベース経穴検索システム
 * 既存 UI 構造を維持し、CSV: 経穴・経絡.csv を読み込み
 * ひらがなサジェスト + 漢字部分一致検索
 * 結果表示は「経絡 / 部位 / 要穴」(“経穴”項目は表示しないご要望反映)
 ******************************************************/

const CSV_PATH = '経穴・経絡.csv';
const MIN_QUERY_LENGTH = 1; // 以前 2 文字だったものを 1 に緩和

/******************************************************
 * 読み（ひらがな）辞書
 *  必要に応じて追記してください。
 *  キーは空白除去後の経穴名
 ******************************************************/
const READINGS = {
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
  "禾髎":"かりょう","迎香":"げいこう",

  // 必要に応じて他経穴を継続追加…
};

/******************************************************
 * データ格納
 ******************************************************/
let ACUPOINTS = []; // { id, name (kanji), reading, meridian, region, important }
let DATA_READY = false;

/******************************************************
 * DOM
 ******************************************************/
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

/******************************************************
 * 症状デモ
 ******************************************************/
const SYMPTOMS = {
  symptom_demo1: { label: 'デモ症状: 頭痛', related: ['百会','風府','霊台'] },
  symptom_demo2: { label: 'デモ症状: 首肩こり', related: ['風府','強間'] }
};

/******************************************************
 * 共通ユーティリティ
 ******************************************************/
function trimAllSpaces(s){
  return (s||'').replace(/[\u3000\s]+/g,'');
}
function normalizeQuery(s){
  return trimAllSpaces(s).toLowerCase();
}
function isHiraganaOnly(s){
  return /^[\u3041-\u3096]+$/.test(s);
}
function applyRedMarkup(text){
  if(!text) return '';
  // [[xxx]] -> span
  return text.replace(/\[\[(.+?)\]\]/g,'<span class="bui-red">$1</span>');
}

/******************************************************
 * CSV 解析
 * 想定カラム: 経絡, 経穴, 部位, 要穴
 ******************************************************/
function parseCSV(text){
  const lines = text.split(/\r?\n/);
  const out = [];
  let currentMeridian = '';
  for(let raw of lines){
    if(!raw.trim()) continue;
    const line = raw.replace(/\uFEFF/g,'');
    // 見出し(番号.経絡)形式をスキップしつつ経絡名記憶
    if(/^\d+\./.test(line)){
      currentMeridian = trimAllSpaces(line.split(',')[0].replace(/^\d+\./,''));
      continue;
    }
    const cols = line.split(',');
    if(cols.length < 2) continue;

    let meridian = trimAllSpaces(cols[0]||'') || currentMeridian;
    const pointRaw = cols[1]||'';
    const pointName = trimAllSpaces(pointRaw);
    if(!pointName) continue;

    // 見出し行（経絡,経穴,部位,要穴）
    if(/経穴/.test(pointRaw) && /経絡/.test(cols[0])) continue;

    const region = (cols[2]||'').trim();
    const important = (cols[3]||'').trim();

    const reading = READINGS[pointName] || ''; // 未登録は空
    out.push({
      id: pointName,          // 一意性: 経穴名（重複あれば index 付加検討）
      name: pointName,
      reading,                // ひらがな
      meridian: meridian || '',
      region: applyRedMarkup(region),
      important: important || ''
    });
  }
  return out;
}

/******************************************************
 * 検索フィルタ
 ******************************************************/
function filterPoints(query){
  const q = trimAllSpaces(query);
  if(q.length < MIN_QUERY_LENGTH) return [];
  // ひらがな入力: reading 前方一致
  if(isHiraganaOnly(q)){
    return ACUPOINTS.filter(p => p.reading && p.reading.startsWith(q));
  }
  // それ以外（漢字/混在）: 部分一致（経穴名）
  return ACUPOINTS.filter(p => p.name.includes(q));
}

/******************************************************
 * サジェスト
 ******************************************************/
function clearSuggestions(){
  suggestionListEl.innerHTML = '';
  suggestionListEl.classList.add('hidden');
}
function renderSuggestions(list){
  suggestionListEl.innerHTML = '';
  if(!list.length){
    const li = document.createElement('li');
    li.textContent = '該当なし';
    li.style.color = '#888';
    suggestionListEl.appendChild(li);
  } else {
    list.slice(0,80).forEach((p,i)=>{
      const li = document.createElement('li');
      li.dataset.id = p.id;
      li.innerHTML = `<span>${p.name}</span><span class="kana">${p.reading||''}</span>`;
      if(i===0) li.classList.add('active');
      li.addEventListener('click', ()=> selectPoint(p));
      suggestionListEl.appendChild(li);
    });
  }
  suggestionListEl.classList.remove('hidden');
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
    current = (current+1)%items.length;
    setActive(items,current);
  }else if(e.key==='ArrowUp'){
    e.preventDefault();
    current = (current-1+items.length)%items.length;
    setActive(items,current);
  }else if(e.key==='Enter'){
    e.preventDefault();
    const active = items[current>=0?current:0];
    if(active && active.dataset.id){
      const obj = ACUPOINTS.find(p=>p.id===active.dataset.id);
      if(obj) selectPoint(obj);
    }
  }else if(e.key==='Escape'){
    clearSuggestions();
  }
}

/******************************************************
 * 詳細表示
 ******************************************************/
function showPointDetail(p){
  resultNameEl.textContent     = `${p.name}${p.reading?` (${p.reading})`:''}`;
  resultMeridianEl.textContent = p.meridian || '（経絡未登録）';
  resultRegionEl.innerHTML     = p.region   || '（部位未登録）';
  resultImportantEl.textContent= p.important|| '（要穴未登録）';
  relatedSymptomsEl.innerHTML  = '<li>（関連症状未登録）</li>';
  showScreen(acupointResultScreen);
}
function selectPoint(p){
  clearSuggestions();
  inputEl.value = p.name;
  showPointDetail(p);
}

/******************************************************
 * 画面切替
 ******************************************************/
function showScreen(screen){
  [mainScreen, acupointResultScreen, symptomResultScreen].forEach(s=>s.classList.add('hidden'));
  screen.classList.remove('hidden');
  window.scrollTo({top:0,behavior:'smooth'});
}

/******************************************************
 * 症状デモ
 ******************************************************/
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
    sym.related.forEach(n=>{
      // CSV からロード済み経穴を検索
      const p = ACUPOINTS.find(pt=>pt.name===n);
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

/******************************************************
 * 入力イベント
 ******************************************************/
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
  const list = filterPoints(val);
  renderSuggestions(list);
});
inputEl.addEventListener('keydown',e=>{
  if(['ArrowDown','ArrowUp','Enter','Escape'].includes(e.key)){
    handleSuggestionKeyboard(e);
  }
});

searchBtn.addEventListener('click',()=>{
  if(!DATA_READY) return;
  const val = inputEl.value;
  const list = filterPoints(val);
  if(list.length===1){
    selectPoint(list[0]);
  }else{
    renderSuggestions(list);
  }
});

/******************************************************
 * 外側クリックでサジェスト閉
 ******************************************************/
document.addEventListener('click',e=>{
  if(!e.target.closest('.suggestion-wrapper') &&
     !e.target.closest('#acupoint-search-input')){
    clearSuggestions();
  }
});

/******************************************************
 * 戻るボタン
 ******************************************************/
document.querySelectorAll('.back-to-main-btn').forEach(btn=>{
  btn.addEventListener('click',()=>showScreen(mainScreen));
});

/******************************************************
 * CSV 読込
 ******************************************************/
async function loadCSV(){
  try{
    statusEl.textContent = 'CSV 読み込み中...';
    const res = await fetch(CSV_PATH + '?t=' + Date.now());
    if(!res.ok) throw new Error('HTTP ' + res.status);
    const text = await res.text();
    ACUPOINTS = parseCSV(text).map((p,i)=>({
      ...p,
      // id は重複回避のため name + index を利用（同名経穴が無ければそのまま name でも可）
      id: p.name + '_' + i
    }));
    if(!ACUPOINTS.length){
      statusEl.textContent = 'CSV に有効な経穴が見つかりません。';
      return;
    }
    DATA_READY = true;
    statusEl.textContent = `CSV 読み込み完了 (${ACUPOINTS.length} 件)`;
  }catch(err){
    console.error(err);
    statusEl.textContent = 'CSV 読み込み失敗: ' + err.message;
  }
}

/******************************************************
 * 初期化
 ******************************************************/
(function init(){
  showScreen(mainScreen);
  loadCSV();
})();
