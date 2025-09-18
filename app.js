/******************************************************
 * 経穴データ
 *  - meridian: 経絡
 *  - region: 部位
 *  - important: 要穴分類など
 ******************************************************/
const ACUPOINTS = [
  { id: 'chokyo',   kanji: '長強',   kana: 'ちょうきょう', meridian: '督脈', region: '尾骨端付近',          important: '（要穴未設定）' },
  { id: 'yoyu',     kanji: '腰兪',   kana: 'ようゆ',       meridian: '督脈', region: '腰部正中線',          important: '（要穴未設定）' },
  { id: 'yoyokan',  kanji: '腰陽関', kana: 'ようようかん', meridian: '督脈', region: '腰椎部',              important: '（要穴未設定）' },
  { id: 'meimon',   kanji: '命門',   kana: 'めいもん',     meridian: '督脈', region: '腰椎2番棘突起下',      important: '（要穴未設定）' },
  { id: 'kensu',    kanji: '懸枢',   kana: 'けんすう',     meridian: '督脈', region: '腰椎付近',            important: '（要穴未設定）' },
  { id: 'sekichu',  kanji: '脊中',   kana: 'せきちゅう',   meridian: '督脈', region: '背部正中線',          important: '（要穴未設定）' },
  { id: 'chusu',    kanji: '中枢',   kana: 'ちゅうすう',   meridian: '督脈', region: '背部',                important: '（要穴未設定）' },
  { id: 'kinshuku', kanji: '筋縮',   kana: 'きんしゅく',   meridian: '督脈', region: '背部',                important: '（要穴未設定）' },
  { id: 'shiyo',    kanji: '至陽',   kana: 'しよう',       meridian: '督脈', region: '背部胸椎下',          important: '（要穴未設定）' },
  { id: 'reidai',   kanji: '霊台',   kana: 'れいだい',     meridian: '督脈', region: '背部胸椎付近',        important: '（要穴未設定）' },
  { id: 'shindo',   kanji: '神道',   kana: 'しんどう',     meridian: '督脈', region: '背部',                important: '（要穴未設定）' },
  { id: 'shinchuu', kanji: '身柱',   kana: 'しんちゅう',   meridian: '督脈', region: '上背部',              important: '（要穴未設定）' },
  { id: 'toudou',   kanji: '陶道',   kana: 'とうどう',     meridian: '督脈', region: '上背部',              important: '（要穴未設定）' },
  { id: 'daitsui',  kanji: '大椎',   kana: 'だいつい',     meridian: '督脈', region: '第7頸椎棘突起下',     important: '（要穴未設定）' },
  { id: 'amon',     kanji: '瘂門',   kana: 'あもん',       meridian: '督脈', region: '後頸部',              important: '（要穴未設定）' },
  { id: 'fufu',     kanji: '風府',   kana: 'ふうふ',       meridian: '督脈', region: '後頭部中央',          important: '（要穴未設定）' },
  { id: 'nouko',    kanji: '脳戸',   kana: 'のうこ',       meridian: '督脈', region: '後頭上部',            important: '（要穴未設定）' },
  { id: 'kyokan',   kanji: '強間',   kana: 'きょうかん',   meridian: '督脈', region: '頭頂部やや後方',      important: '（要穴未設定）' },
  { id: 'gocho',    kanji: '後頂',   kana: 'ごちょう',     meridian: '督脈', region: '頭頂部',              important: '（要穴未設定）' },
  { id: 'hyakue',   kanji: '百会',   kana: 'ひゃくえ',     meridian: '督脈', region: '頭頂正中',            important: '（要穴未設定）' },
  { id: 'zencho',   kanji: '前頂',   kana: 'ぜんちょう',   meridian: '督脈', region: '頭頂部前寄り',        important: '（要穴未設定）' },
  { id: 'shine',    kanji: '顖会',   kana: 'しんえ',       meridian: '督脈', region: '前頭寄り正中',        important: '（要穴未設定）' },
  { id: 'josei',    kanji: '上星',   kana: 'じょうせい',   meridian: '督脈', region: '前頭部',              important: '（要穴未設定）' },
  { id: 'shintei',  kanji: '神庭',   kana: 'しんてい',     meridian: '督脈', region: '前頭上部',            important: '（要穴未設定）' },
  { id: 'soryo',    kanji: '素髎',   kana: 'そりょう',     meridian: '督脈', region: '鼻尖',                important: '（要穴未設定）' },
  { id: 'suikou',   kanji: '水溝',   kana: 'すいこう',     meridian: '督脈', region: '人中溝中央',          important: '（要穴未設定）' },
  { id: 'datan',    kanji: '兌端',   kana: 'だたん',       meridian: '督脈', region: '上唇正中',            important: '（要穴未設定）' },
  { id: 'ginko',    kanji: '齦交',   kana: 'ぎんこう',     meridian: '督脈', region: '上歯齦裏正中',        important: '（要穴未設定）' }
].map(p => ({
  ...p,
  searchable: (p.kanji + p.kana + (p.meridian || '') + (p.region || '')).replace(/\s+/g, '').toLowerCase()
}));

/******************************************************
 * 症状デモデータ
 ******************************************************/
const SYMPTOMS = {
  symptom_demo1: { label: 'デモ症状: 頭痛', related: ['hyakue', 'fufu', 'reidai'] },
  symptom_demo2: { label: 'デモ症状: 首肩こり', related: ['fufu', 'kyokan'] }
};

/******************************************************
 * DOM 取得
 ******************************************************/
const inputEl = document.getElementById('acupoint-search-input');
const suggestionListEl = document.getElementById('acupoint-suggestion-list');
const searchBtn = document.getElementById('search-btn');

const mainScreen = document.getElementById('main-screen');
const acupointResultScreen = document.getElementById('acupoint-result-screen');
const symptomResultScreen = document.getElementById('symptom-result-screen');

const resultNameEl = document.getElementById('result-name');
const resultMeridianEl  = document.getElementById('result-meridian');
const resultPointEl     = document.getElementById('result-point');
const resultRegionEl    = document.getElementById('result-region');
const resultImportantEl = document.getElementById('result-important');
const relatedSymptomsEl = document.getElementById('related-symptoms');

const symptomSelect = document.getElementById('symptom-select');
const symptomResultTitleEl = document.getElementById('symptom-result-title');
const symptomAcupointsListEl = document.getElementById('symptom-acupoints-list');

/******************************************************
 * 画面切替
 ******************************************************/
function showScreen(screen) {
  [mainScreen, acupointResultScreen, symptomResultScreen].forEach(s => s.classList.add('hidden'));
  screen.classList.remove('hidden');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/******************************************************
 * 検索ロジック
 ******************************************************/
function normalizeInput(str) {
  return (str || '').replace(/\s+/g, '').toLowerCase();
}

function filterAcupoints(query) {
  const q = normalizeInput(query);
  if (q.length < 2) return [];
  return ACUPOINTS.filter(p => p.searchable.includes(q));
}

/******************************************************
 * サジェスト
 ******************************************************/
function clearSuggestions() {
  suggestionListEl.innerHTML = '';
  suggestionListEl.classList.add('hidden');
}

function renderSuggestions(list) {
  suggestionListEl.innerHTML = '';
  if (!list.length) {
    const li = document.createElement('li');
    li.textContent = '該当なし';
    li.style.color = '#888';
    suggestionListEl.appendChild(li);
  } else {
    list.forEach((p, idx) => {
      const li = document.createElement('li');
      li.dataset.id = p.id;
      li.innerHTML = `<span>${p.kanji}</span><span class="kana">${p.kana}</span>`;
      li.addEventListener('click', () => selectAcupoint(p));
      if (idx === 0) li.classList.add('active');
      suggestionListEl.appendChild(li);
    });
  }
  suggestionListEl.classList.remove('hidden');
}

function setActive(items, index) {
  items.forEach(li => li.classList.remove('active'));
  if (items[index]) {
    items[index].classList.add('active');
    items[index].scrollIntoView({ block: 'nearest' });
  }
}

function handleSuggestionKeyboard(e) {
  const items = Array.from(suggestionListEl.querySelectorAll('li'));
  if (!items.length) return;
  let current = items.findIndex(li => li.classList.contains('active'));

  if (e.key === 'ArrowDown') {
    e.preventDefault();
    current = (current + 1) % items.length;
    setActive(items, current);
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    current = (current - 1 + items.length) % items.length;
    setActive(items, current);
  } else if (e.key === 'Enter') {
    e.preventDefault();
    const active = items[current >= 0 ? current : 0];
    if (active && active.dataset.id) {
      const point = ACUPOINTS.find(p => p.id === active.dataset.id);
      if (point) selectAcupoint(point);
    }
  } else if (e.key === 'Escape') {
    clearSuggestions();
  }
}

/******************************************************
 * 詳細表示
 ******************************************************/
function selectAcupoint(point) {
  clearSuggestions();
  inputEl.value = point.kanji;
  showAcupointDetail(point);
}

function showAcupointDetail(point) {
  resultNameEl.textContent      = `${point.kanji} (${point.kana})`;
  resultMeridianEl.textContent  = point.meridian  || '（経絡未登録）';
  resultPointEl.textContent     = point.kanji     || '（経穴未登録）';
  resultRegionEl.textContent    = point.region    || '（部位未登録）';
  resultImportantEl.textContent = point.important || '（要穴未登録）';
  relatedSymptomsEl.innerHTML   = '<li>（関連症状未登録）</li>';
  showScreen(acupointResultScreen);
}

/******************************************************
 * 症状（デモ）
 ******************************************************/
symptomSelect.addEventListener('change', () => {
  if (!symptomSelect.value) return;
  renderSymptom(symptomSelect.value);
});

function renderSymptom(id) {
  const sym = SYMPTOMS[id];
  if (!sym) return;
  symptomResultTitleEl.textContent = sym.label;
  symptomAcupointsListEl.innerHTML = '';

  if (!sym.related.length) {
    symptomAcupointsListEl.innerHTML = '<li>関連経穴なし</li>';
  } else {
    sym.related.forEach(rid => {
      const ap = ACUPOINTS.find(p => p.id === rid);
      if (!ap) return;
      const li = document.createElement('li');
      const a = document.createElement('a');
      a.href = '#';
      a.textContent = `${ap.kanji} (${ap.kana})`;
      a.addEventListener('click', e => {
        e.preventDefault();
        showAcupointDetail(ap);
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
inputEl.addEventListener('keyup', e => {
  if (['ArrowDown', 'ArrowUp', 'Enter', 'Escape'].includes(e.key)) {
    handleSuggestionKeyboard(e);
    return;
  }
  const val = inputEl.value;
  if (normalizeInput(val).length < 2) {
    clearSuggestions();
    return;
  }
  renderSuggestions(filterAcupoints(val));
});

inputEl.addEventListener('keydown', e => {
  if (['ArrowDown', 'ArrowUp', 'Enter', 'Escape'].includes(e.key)) {
    handleSuggestionKeyboard(e);
  }
});

searchBtn.addEventListener('click', () => {
  const val = inputEl.value;
  const list = filterAcupoints(val);
  if (list.length === 1) {
    selectAcupoint(list[0]);
  } else {
    renderSuggestions(list);
  }
});

/******************************************************
 * クリック外でサジェスト閉じる
 ******************************************************/
document.addEventListener('click', e => {
  if (!e.target.closest('.suggestion-wrapper') &&
      !e.target.closest('#acupoint-search-input')) {
    clearSuggestions();
  }
});

/******************************************************
 * 戻るボタン
 ******************************************************/
document.querySelectorAll('.back-to-main-btn').forEach(btn => {
  btn.addEventListener('click', () => showScreen(mainScreen));
});

/******************************************************
 * 初期化
 ******************************************************/
(function init() {
  showScreen(mainScreen);
})();
