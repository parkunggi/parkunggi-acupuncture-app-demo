/******************************************************
 * 経穴検索 - CSV 全件反映版 (361穴)
 *  - CSV: 経穴・経絡.csv
 *  - 経穴名内部の全 Unicode 空白を除去して正規化
 *  - 見出し行: "1.督脈", "14足の厥陰肝経" など数字開始を検出
 *  - ひらがな入力: 読み前方一致
 *  - 漢字/その他入力: 経穴名部分一致
 *  - 結果画面: 経絡 / 部位 / 要穴 のみ表示
 ******************************************************/

const CSV_FILE = '経穴・経絡.csv';
const CSV_PATH = encodeURI(CSV_FILE);
const MIN_QUERY_LENGTH = 1;
const EXPECTED_TOTAL = 361; // 14経(12正経+任督)の標準経穴数

/* 経穴読み (空白除去後の漢字 -> ひらがな) 全361 */
const READINGS = {
  /* 督脈 (28) */
  "長強":"ちょうきょう","腰兪":"ようゆ","腰陽関":"ようようかん","命門":"めいもん","懸枢":"けんすう","脊中":"せきちゅう",
  "中枢":"ちゅうすう","筋縮":"きんしゅく","至陽":"しよう","霊台":"れいだい","神道":"しんどう","身柱":"しんちゅう",
  "陶道":"とうどう","大椎":"だいつい","瘂門":"あもん","風府":"ふうふ","脳戸":"のうこ","強間":"きょうかん",
  "後頂":"こうちょう","百会":"ひゃくえ","前頂":"ぜんちょう","顖会":"しんえ","上星":"じょうせい","神庭":"しんてい",
  "素髎":"そりょう","水溝":"すいこう","兌端":"だたん","齦交":"ぎんこう",
  /* 任脈 (24) */
  "会陰":"えいん","曲骨":"きょくこつ","中極":"ちゅうきょく","関元":"かんげん","石門":"せきもん","気海":"きかい",
  "陰交":"いんこう","神闕":"しんけつ","水分":"すいぶん","下脘":"げかん","建里":"けんり","中脘":"ちゅうかん",
  "上脘":"じょうかん","巨闕":"こけつ","鳩尾":"きゅうび","中庭":"ちゅうてい","膻中":"だんちゅう","玉堂":"ぎょくどう",
  "紫宮":"しきゅう","華蓋":"かがい","璇璣":"せんき","天突":"てんとつ","廉泉":"れんせん","承漿":"しょうしょう",
  /* 手の太陰肺経 (11) */
  "中府":"ちゅうふ","雲門":"うんもん","天府":"てんぷ","侠白":"きょうはく","尺沢":"しゃくたく","孔最":"こうさい",
  "列欠":"れっけつ","経渠":"けいきょ","太淵":"たいえん","魚際":"ぎょさい","少商":"しょうしょう",
  /* 手の陽明大腸経 (20) */
  "商陽":"しょうよう","二間":"じかん","三間":"さんかん","合谷":"ごうこく","陽渓":"ようけい","偏歴":"へんれき",
  "温溜":"おんる","下廉":"げれん","上廉":"じょうれん","手三里":"てさんり","曲池":"きょくち","肘髎":"ちゅうりょう",
  "手五里":"てごり","臂臑":"ひじゅ","肩髃":"けんぐう","巨骨":"ここつ","天鼎":"てんてい","扶突":"ふとつ",
  "禾髎":"かりょう","迎香":"げいこう",
  /* 足の陽明胃経 (45) */
  "承泣":"しょうきゅう","四白":"しはく","巨髎":"こりょう","地倉":"ちそう","大迎":"たいげい","頬車":"きょうしゃ",
  "下関":"げかん","頭維":"ずい","人迎":"じんげい","水突":"すいとつ","気舎":"きしゃ","欠盆":"けつぼん",
  "気戸":"きこ","庫房":"こぼう","屋翳":"おくえい","膺窓":"ようそう","乳中":"にゅうちゅう","乳根":"にゅうこん",
  "不容":"ふよう","承満":"しょうまん","梁門":"りょうもん","関門":"かんもん","太乙":"たいいつ","滑肉門":"かつにくもん",
  "天枢":"てんすう","外陵":"がいりょう","大巨":"たいこ","水道":"すいどう","帰来":"きらい","気衝":"きしょう",
  "髀関":"ひかん","伏兎":"ふくと","陰市":"いんし","梁丘":"りょうきゅう","犢鼻":"とくび","足三里":"あしさんり",
  "上巨虚":"じょうこきょ","条口":"じょうこう","下巨虚":"げこきょ","豊隆":"ほうりゅう","解渓":"かいけい","衝陽":"しょうよう",
  "陥谷":"かんこく","内庭":"ないてい","厲兌":"れいだ",
  /* 足の太陰脾経 (21) */
  "隠白":"いんぱく","大都":"だいと","太白":"たいはく","公孫":"こうそん","商丘":"しょうきゅう","三陰交":"さんいんこう",
  "漏谷":"ろうこく","地機":"ちき","陰陵泉":"いんりょうせん","血海":"けっかい","箕門":"きもん","衝門":"しょうもん",
  "府舎":"ふしゃ","腹結":"ふっけつ","大横":"だいおう","腹哀":"ふくあい","食竇":"しょくとつ","天渓":"てんけい",
  "胸郷":"きょうきょう","周栄":"しゅうえい","大包":"だいほう",
  /* 手の少陰心経 (9) */
  "極泉":"きょくせん","青霊":"せいれい","少海":"しょうかい","霊道":"れいどう","通里":"つうり","陰郄":"いんげき",
  "神門":"しんもん","少府":"しょうふ","少衝":"しょうしょう",
  /* 手の太陽小腸経 (19) */
  "少沢":"しょうたく","前谷":"ぜんこく","後渓":"こうけい","腕骨":"わんこつ","陽谷":"ようこく","養老":"ようろう",
  "支正":"しせい","小海":"しょうかい","肩貞":"けんてい","臑兪":"じゅゆ","天宗":"てんそう","秉風":"へいふう",
  "曲垣":"きょくえん","肩外兪":"けんがいゆ","肩中兪":"けんちゅうゆ","天窓":"てんそう","天容":"てんよう",
  "顴髎":"けんりょう","聴宮":"ちょうきゅう",
  /* 足の太陽膀胱経 (67) */
  "睛明":"せいめい","攅竹":"さんちく","眉衝":"びしょう","曲差":"きょくさ","五処":"ごしょ","承光":"しょうこう",
  "通天":"つうてん","絡却":"らっきゃく","玉枕":"ぎょくちん","天柱":"てんちゅう","大杼":"だいじょ","風門":"ふうもん",
  "肺兪":"はいゆ","厥陰兪":"けついんゆ","心兪":"しんゆ","督兪":"とくゆ","膈兪":"かくゆ","肝兪":"かんゆ",
  "胆兪":"たんゆ","脾兪":"ひゆ","胃兪":"いゆ","三焦兪":"さんしょうゆ","腎兪":"じんゆ","気海兪":"きかいゆ",
  "大腸兪":"だいちょうゆ","関元兪":"かんげんゆ","小腸兪":"しょうちょうゆ","膀胱兪":"ぼうこうゆ","中膂兪":"ちゅうりょゆ",
  "白環兪":"はくかんゆ","上髎":"じょうりょう","次髎":"じりょう","中髎":"ちゅうりょう","下髎":"げりょう","会陽":"えよう",
  "承扶":"しょうふ","殷門":"いんもん","浮郄":"ふげき","委陽":"いよう","委中":"いちゅう","附分":"ふぶん",
  "魄戸":"はっこ","膏肓":"こうこう","神堂":"しんどう","譩譆":"いき","膈関":"かくかん","魂門":"こんもん",
  "陽綱":"ようこう","意舎":"いしゃ","胃倉":"いそう","肓門":"こうもん","志室":"ししつ","胞肓":"ほうこう",
  "秩辺":"ちっぺん","合陽":"ごうよう","承筋":"しょうきん","承山":"しょうざん","飛揚":"ひよう","跗陽":"ふよう",
  "崑崙":"こんろん","僕参":"ぼくしん","申脈":"しんみゃく","金門":"きんもん","京骨":"けいこつ","束骨":"そっこつ",
  "足通谷":"あしのつうこく","至陰":"しいん",
  /* 足の少陰腎経 (27) */
  "湧泉":"ゆうせん","然谷":"ねんこく","太渓":"たいけい","大鍾":"だいしょう","水泉":"すいせん","照海":"しょうかい",
  "復溜":"ふくりゅう","交信":"こうしん","築賓":"ちくひん","陰谷":"いんこく","横骨":"おうこつ","大赫":"だいかく",
  "気穴":"きけつ","四満":"しまん","中注":"ちゅうちゅう","肓兪":"こうゆ","商曲":"しょうきょく","石関":"せきかん",
  "陰都":"いんと","腹通谷":"はらのつうこく","幽門":"ゆうもん","歩廊":"ほろう","神封":"しんぷう","霊墟":"れいきょ",
  "神蔵":"しんぞう","彧中":"いくちゅう","兪府":"ゆふ",
  /* 手の厥陰心包経 (9) */
  "天池":"てんち","天泉":"てんせん","曲沢":"きょくたく","郄門":"げきもん","間使":"かんし","内関":"ないかん",
  "大陵":"だいりょう","労宮":"ろうきゅう","中衝":"ちゅうしょう",
  /* 手の少陽三焦経 (23) */
  "関衝":"かんしょう","液門":"えきもん","中渚":"ちゅうしょ","陽池":"ようち","外関":"がいかん","支溝":"しこう",
  "会宗":"えそう","三陽絡":"さんようらく","四瀆":"しとく","天井":"てんせい","清冷淵":"せいれいえん","消濼":"しょうれき",
  "臑会":"じゅえ","肩髎":"けんりょう","天髎":"てんりょう","天牖":"てんゆう","翳風":"えいふう","瘈脈":"けいみゃく",
  "顱息":"ろそく","角孫":"かくそん","耳門":"じもん","和髎":"わりょう","糸竹空":"しちくくう",
  /* 足の少陽胆経 (44) */
  "瞳子髎":"どうしりょう","聴会":"ちょうえ","上関":"じょうかん","頷厭":"がんえん","懸顱":"けんろ","懸釐":"けんり",
  "曲鬢":"きょくびん","率谷":"そつこく","天衝":"てんしょう","浮白":"ふはく","頭竅陰":"あたまきょういん","完骨":"かんこつ",
  "本神":"ほんじん","陽白":"ようはく","頭臨泣":"あたまりんきゅう","目窓":"もくそう","正営":"せいえい","承霊":"しょうれい",
  "脳空":"のうくう","風池":"ふうち","肩井":"けんせい","淵腋":"えんえき","輒筋":"ちょうきん","日月":"じつげつ",
  "京門":"けいもん","帯脈":"たいみゃく","五枢":"ごすう","維道":"いどう","居髎":"きょりょう","環跳":"かんちょう",
  "風市":"ふうし","中瀆":"ちゅうとく","膝陽関":"しつようかん","陽陵泉":"ようりょうせん","陽交":"ようこう","外丘":"がいきゅう",
  "光明":"こうめい","陽輔":"ようほ","懸鍾":"けんしょう","丘墟":"きゅうきょ","足臨泣":"そくりんきゅう","地五会":"ちごえ",
  "侠渓":"きょうけい","足竅陰":"そくきょういん",
  /* 足の厥陰肝経 (14) */
  "大敦":"だいとん","行間":"こうかん","太衝":"たいしょう","中封":"ちゅうほう","蠡溝":"れいこう","中都":"ちゅうと",
  "膝関":"しつかん","曲泉":"きょくせん","陰包":"いんぽう","足五里":"あしごり","陰廉":"いんれん","急脈":"きゅうみゃく",
  "章門":"しょうもん","期門":"きもん"
};

/* データ格納 */
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
  symptom_demo2: { label: 'デモ症状: 首肩こり', related: ['風府','強間','肩井'] }
};

/* ユーティリティ */
function removeAllUnicodeSpaces(str){
  return (str||'').replace(/[\u0000-\u001F\u007F]/g,'')      // 制御
                  .replace(/[\u00A0\u1680\u2000-\u200B\u202F\u205F\u3000]/g,'') // 各種空白
                  .replace(/\uFEFF/g,''); // BOM
}
function normalizePointName(raw){
  return removeAllUnicodeSpaces(raw);
}
function trimOuter(s){ return (s||'').trim(); }
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
  let skipped = 0;

  for (let raw of lines){
    if(!raw) { skipped++; continue; }
    let line = raw.replace(/\uFEFF/g,'');
    if(!line.trim()){ skipped++; continue; }

    // 分割（単純: カンマはセル内に出現しない前提）
    const cols = line.split(',');
    // 見出し判定（先頭セル）
    const headCell = cols[0] ? cols[0].trim() : '';

    if(/^\s*\d+(\.|．)?/.test(headCell)){ // 例: 1.督脈 / 14足の厥陰肝経
      // 数字+任意ドット除去
      currentMeridian = headCell.replace(/^\s*\d+(\.|．)?\s*/,'');
      currentMeridian = normalizePointName(currentMeridian);
      continue;
    }

    // ヘッダ行（「経絡,経穴」など）
    if(/経絡/.test(headCell) && /経穴/.test(cols[1]||'')){
      skipped++;
      continue;
    }

    // データ行
    if(cols.length < 2){
      skipped++;
      continue;
    }

    let meridian = normalizePointName(headCell) || currentMeridian;

    let pointRaw = cols[1] || '';
    pointRaw = trimOuter(pointRaw);
    let pointName = normalizePointName(pointRaw);
    if(!pointName){
      skipped++;
      continue;
    }

    // 経穴名が「,,」などで欠損
    if(!pointName || pointName === '0'){
      skipped++;
      continue;
    }

    const region = trimOuter(cols[2] || '');
    const important = trimOuter(cols[3] || '');

    const reading = READINGS[pointName] || ''; // 全361用意済み（追加があれば空→漢字検索で可）

    out.push({
      id: pointName,          // 重複は後で調整
      name: pointName,
      reading,
      meridian: meridian,
      region: applyRedMarkup(region),
      important
    });
  }

  console.log('[parseCSV] total lines=', lines.length, 'parsed=', out.length, 'skipped=', skipped);
  return out;
}

/* 検索ロジック */
function filterPoints(qInput){
  const q = removeAllUnicodeSpaces(qInput);
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
  list.slice(0,120).forEach((p,i)=>{
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
    current = (current+1)%items.length;
    setActive(items,current);
  } else if(e.key==='ArrowUp'){
    e.preventDefault();
    current = (current-1+items.length)%items.length;
    setActive(items,current);
  } else if(e.key==='Enter'){
    e.preventDefault();
    const act = items[current>=0?current:0];
    if(act && act.dataset.id){
      const p = ACUPOINTS.find(x=>x.id===act.dataset.id);
      if(p) selectPoint(p);
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

/* 検索トリガ */
function runSearch(){
  if(!DATA_READY) return;
  const q = removeAllUnicodeSpaces(inputEl.value);
  if(!q){ clearSuggestions(); return; }
  // 完全一致優先
  const exact = ACUPOINTS.find(p=>p.name===q);
  if(exact){ selectPoint(exact); return; }
  const list = filterPoints(q);
  if(list.length===1){
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
  if(removeAllUnicodeSpaces(val).length < MIN_QUERY_LENGTH){
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

    // 重複名対策
    const nameCount = {};
    parsed = parsed.map(p=>{
      nameCount[p.name] = (nameCount[p.name]||0)+1;
      return {
        ...p,
        id: nameCount[p.name] > 1 ? `${p.name}__${nameCount[p.name]}` : p.name
      };
    });

    ACUPOINTS = parsed;

    DATA_READY = true;

    // 経絡別件数
    const byMeridian = {};
    for(const p of ACUPOINTS){
      byMeridian[p.meridian] = (byMeridian[p.meridian]||0)+1;
    }
    const summary = Object.entries(byMeridian)
      .map(([m,c])=>`${m}:${c}`).join(' / ');

    const total = ACUPOINTS.length;
    const okMark = total === EXPECTED_TOTAL ? '（正常）' : '（想定: '+EXPECTED_TOTAL+'）';
    statusEl.textContent = `CSV 読み込み完了: ${total} 件 ${okMark}`;
    statusEl.title = `内訳: ${summary}`;

    console.log('[ACUPOINTS] total=', total, byMeridian);

    // 読み未登録チェック（今回は全件登録済の想定）
    const missingReadings = ACUPOINTS.filter(p=>!p.reading).map(p=>p.name);
    if(missingReadings.length){
      console.warn('読み未登録経穴:', missingReadings);
    }

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
