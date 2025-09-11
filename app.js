/******************************************************
 * 経穴データ（督脈 / 指定リスト）空白除去済み
 * location / effects はプレースホルダ
 ******************************************************/
const ACUPOINTS = [
  { id: 'chokyo',   kanji: '長強',   kana: 'ちょうきょう' },
  { id: 'yoyu',     kanji: '腰兪',   kana: 'ようゆ' },
  { id: 'yoyokan',  kanji: '腰陽関', kana: 'ようようかん' }, // 別読み追加時は kanaVariants を検討
  { id: 'meimon',   kanji: '命門',   kana: 'めいもん' },
  { id: 'kensu',    kanji: '懸枢',   kana: 'けんすう' },
  { id: 'sekichu',  kanji: '脊中',   kana: 'せきちゅう' },
  { id: 'chusu',    kanji: '中枢',   kana: 'ちゅうすう' },
  { id: 'kinshuku', kanji: '筋縮',   kana: 'きんしゅく' },
  { id: 'shiyo',    kanji: '至陽',   kana: 'しよう' },
  { id: 'reidai',   kanji: '霊台',   kana: 'れいだい' },
  { id: 'shindo',   kanji: '神道',   kana: 'しんどう' },
  { id: 'shinchuu', kanji: '身柱',   kana: 'しんちゅう' },
  { id: 'toudou',   kanji: '陶道',   kana: 'とうどう' },
  { id: 'daitsui',  kanji: '大椎',   kana: 'だいつい' },
  { id: 'amon',     kanji: '瘂門',   kana: 'あもん' },
  { id: 'fufu',     kanji: '風府',   kana: 'ふうふ' },
  { id: 'nouko',    kanji: '脳戸',   kana: 'のうこ' },
  { id: 'kyokan',   kanji: '強間',   kana: 'きょうかん' },
  { id: 'gocho',    kanji: '後頂',   kana: 'ごちょう' },
  { id: 'hyakue',   kanji: '百会',   kana: 'ひゃくえ' },
  { id: 'zencho',   kanji: '前頂',   kana: 'ぜんちょう' },
  { id: 'shine',    kanji: '顖会',   kana: 'しんえ' },
  { id: 'josei',    kanji: '上星',   kana: 'じょうせい' },
  { id: 'shintei',  kanji: '神庭',   kana: 'しんてい' },
  { id: 'soryo',    kanji: '素髎',   kana: 'そりょう' },
  { id: 'suikou',   kanji: '水溝',   kana: 'すいこう' },
  { id: 'datan',    kanji: '兌端',   kana: 'だたん' },
  { id: 'ginko',    kanji: '齦交',   kana: 'ぎんこう' }
].map(p => ({
  ...p,
  searchable: p.kanji + p.kana
}));

/******************************************************
 * 症状デモデータ
 ******************************************************/
const SYMPTOMS = {
  symptom_demo1: { label: 'デモ症状: 頭痛', related: ['hyakue', 'fufu', 'reidai'] },
  symptom_demo2: { label: 'デモ症状: 首肩こり', related: ['fufu', 'kyokan'] }
};

/******************************************************
 * DOM
 ******************************************************/
const inputEl = document.getElementById('acupoint-search-input');
const suggestionListEl = document.getElementById('acupoint-suggestion-list');
const searchBtn = document.getElementById('search-btn');

const mainScreen = document.getElementById('main-screen');
const acupointResultScreen = document.getElementById('acupoint-result-screen');
const symptomResultScreen = document.getElementById('symptom-result-screen');

const resultNameEl = document.getElementById('result-name');
const resultLocationEl = document.getElementById('result-location');
const resultEffectsEl = document.getElementById('result-effects');
const relatedSymptomsEl = document.getElementById('related-symptoms');

const symptomSelect = document.getElementById('symptom-select');
const symptomResultTitleEl = document.getElementById('symptom-result-title');
const symptomAcupointsListEl = document.getElementById('symptom-acupoints-list');

const memoArea = document.getElementById('memo-area');
const saveMemoBtn = document.getElementById('save-memo-btn');

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
  if (!query) return [];
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
  if (list.length === 0) {
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
  resultNameEl.textContent = `${point.kanji} (${point.kana})`;
  resultLocationEl.textContent = '（位置データ未登録）';
  resultEffectsEl.innerHTML = '<li>（効果データ未登録）</li>';
  relatedSymptomsEl.innerHTML = '<li>（関連症状未登録）</li>';
  memoArea.value = localStorage.getItem(`memo_${point.id}`) || '';
  showScreen(acupointResultScreen);
}

/******************************************************
 * 症状（デモ）
 ******************************************************/
symptomSelect.addEventListener('change', () => {
  const v = symptomSelect.value;
  if (!v) return;
  renderSymptom(v);
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
 * メモ保存
 ******************************************************/
if (saveMemoBtn) {
  saveMemoBtn.addEventListener('click', () => {
    const current = resultNameEl.textContent;
    const point = ACUPOINTS.find(p => current.startsWith(p.kanji));
    if (!point) return;
    localStorage.setItem(`memo_${point.id}`, memoArea.value);
    const old = saveMemoBtn.textContent;
    saveMemoBtn.textContent = '保存しました';
    setTimeout(() => (saveMemoBtn.textContent = old), 1500);
  });
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
  const list = filterAcupoints(val);
  renderSuggestions(list);
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
  if (!e.target.closest('.suggestion-wrapper')) {
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
