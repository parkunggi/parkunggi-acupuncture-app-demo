// ===============================
// 仮データ定義
// ===============================
const ACUPOINTS = [
  {
    id: "goukoku",
    name: "合谷",
    reading: "ごうこく",
    alt: ["ごうこく", "合谷", "こうこく"],
    location: "手の甲で第1・第2中手骨の間、第2中手骨中点の橈側",
    effects: ["頭痛", "歯痛", "鼻づまり", "便秘・下痢の調整"],
    symptoms: ["symptom1", "symptom3"]
  },
  {
    id: "fuuchi",
    name: "風池",
    reading: "ふうち",
    alt: ["ふうち", "風池"],
    location: "後頭部、胸鎖乳突筋と僧帽筋上端の間窩",
    effects: ["頭痛", "目の疲れ", "首こり", "風邪症状"],
    symptoms: ["symptom1", "symptom3"]
  },
  {
    id: "kyokuchi",
    name: "曲池",
    reading: "きょくち",
    alt: ["きょくち", "曲池"],
    location: "肘を曲げたとき肘窩外側端の凹み",
    effects: ["肘痛", "上肢の痺れ", "熱症状", "皮膚疾患"],
    symptoms: ["symptom1"]
  },
  // 督脈 (DU) Points
  {
    id: "choukyou",
    name: "長強",
    reading: "ちょうきょう",
    alt: ["ちょうきょう", "長強"],
    location: "",
    effects: [],
    symptoms: []
  },
  {
    id: "youyu",
    name: "腰兪",
    reading: "ようゆ",
    alt: ["ようゆ", "腰兪"],
    location: "",
    effects: [],
    symptoms: []
  },
  {
    id: "youyoukan",
    name: "腰陽関",
    reading: "ようようかん",
    alt: ["ようようかん", "腰陽関"],
    location: "",
    effects: [],
    symptoms: []
  },
  {
    id: "meimon",
    name: "命門",
    reading: "めいもん",
    alt: ["めいもん", "命門"],
    location: "",
    effects: [],
    symptoms: []
  },
  {
    id: "kensuu",
    name: "懸枢",
    reading: "けんすう",
    alt: ["けんすう", "懸枢"],
    location: "",
    effects: [],
    symptoms: []
  },
  {
    id: "sekichuu",
    name: "脊中",
    reading: "せきちゅう",
    alt: ["せきちゅう", "脊中"],
    location: "",
    effects: [],
    symptoms: []
  },
  {
    id: "chuusuu",
    name: "中枢",
    reading: "ちゅうすう",
    alt: ["ちゅうすう", "中枢"],
    location: "",
    effects: [],
    symptoms: []
  },
  {
    id: "kinshuku",
    name: "筋縮",
    reading: "きんしゅく",
    alt: ["きんしゅく", "筋縮"],
    location: "",
    effects: [],
    symptoms: []
  },
  {
    id: "shiyou",
    name: "至陽",
    reading: "しよう",
    alt: ["しよう", "至陽"],
    location: "",
    effects: [],
    symptoms: []
  },
  {
    id: "reidai",
    name: "霊台",
    reading: "れいだい",
    alt: ["れいだい", "霊台"],
    location: "",
    effects: [],
    symptoms: []
  },
  {
    id: "shindou",
    name: "神道",
    reading: "しんどう",
    alt: ["しんどう", "神道"],
    location: "",
    effects: [],
    symptoms: []
  },
  {
    id: "shinchuu",
    name: "身柱",
    reading: "しんちゅう",
    alt: ["しんちゅう", "身柱"],
    location: "",
    effects: [],
    symptoms: []
  },
  {
    id: "toudou",
    name: "陶道",
    reading: "とうどう",
    alt: ["とうどう", "陶道"],
    location: "",
    effects: [],
    symptoms: []
  },
  {
    id: "daitsui",
    name: "大椎",
    reading: "だいつい",
    alt: ["だいつい", "大椎"],
    location: "",
    effects: [],
    symptoms: []
  },
  {
    id: "amon",
    name: "瘂門",
    reading: "あもん",
    alt: ["あもん", "瘂門"],
    location: "",
    effects: [],
    symptoms: []
  },
  {
    id: "fuppu",
    name: "風府",
    reading: "ふうふ",
    alt: ["ふうふ", "風府"],
    location: "",
    effects: [],
    symptoms: []
  },
  {
    id: "nouko",
    name: "脳戸",
    reading: "のうこ",
    alt: ["のうこ", "脳戸"],
    location: "",
    effects: [],
    symptoms: []
  },
  {
    id: "kyoukan",
    name: "強間",
    reading: "きょうかん",
    alt: ["きょうかん", "強間"],
    location: "",
    effects: [],
    symptoms: []
  },
  {
    id: "kouchou",
    name: "後頂",
    reading: "こうちょう",
    alt: ["こうちょう", "後頂"],
    location: "",
    effects: [],
    symptoms: []
  },
  {
    id: "hyakue",
    name: "百会",
    reading: "ひゃくえ",
    alt: ["ひゃくえ", "百会"],
    location: "",
    effects: [],
    symptoms: []
  },
  {
    id: "zenchou",
    name: "前頂",
    reading: "ぜんちょう",
    alt: ["ぜんちょう", "前頂"],
    location: "",
    effects: [],
    symptoms: []
  },
  {
    id: "shinkai",
    name: "顖会",
    reading: "しんかい",
    alt: ["しんかい", "顖会"],
    location: "",
    effects: [],
    symptoms: []
  },
  {
    id: "jouseii",
    name: "上星",
    reading: "じょうせい",
    alt: ["じょうせい", "上星"],
    location: "",
    effects: [],
    symptoms: []
  },
  {
    id: "shintei",
    name: "神庭",
    reading: "しんてい",
    alt: ["しんてい", "神庭"],
    location: "",
    effects: [],
    symptoms: []
  },
  {
    id: "soriyou",
    name: "素髎",
    reading: "そりょう",
    alt: ["そりょう", "素髎"],
    location: "",
    effects: [],
    symptoms: []
  },
  {
    id: "suikou",
    name: "水溝",
    reading: "すいこう",
    alt: ["すいこう", "水溝", "じんちゅう", "人中"],
    location: "",
    effects: [],
    symptoms: []
  },
  {
    id: "taitan",
    name: "兌端",
    reading: "たいたん",
    alt: ["たいたん", "兌端"],
    location: "",
    effects: [],
    symptoms: []
  },
  {
    id: "ginkou",
    name: "齦交",
    reading: "ぎんこう",
    alt: ["ぎんこう", "齦交"],
    location: "",
    effects: [],
    symptoms: []
  }
];

const SYMPTOMS = {
  symptom1: { label: "サンプル症状1: 頭痛・発熱", related: ["goukoku", "fuuchi", "kyokuchi"] },
  symptom2: { label: "サンプル症状2: 胃腸の不調", related: [] },
  symptom3: { label: "サンプル症状3: 肩こり・首の痛み", related: ["goukoku", "fuuchi"] }
};

// ===============================
// 要素取得
// ===============================
const mainScreen = document.getElementById("main-screen");
const acupointResultScreen = document.getElementById("acupoint-result-screen");
const symptomResultScreen = document.getElementById("symptom-result-screen");

const searchInput = document.getElementById("acupoint-search-input");
const searchBtn = document.getElementById("search-btn");
const symptomSelect = document.getElementById("symptom-select");

const resultNameEl = document.getElementById("result-name");
const resultLocationEl = document.getElementById("result-location");
const resultEffectsEl = document.getElementById("result-effects");
const relatedSymptomsEl = document.getElementById("related-symptoms");

const symptomResultTitleEl = document.getElementById("symptom-result-title");
const symptomAcupointsListEl = document.getElementById("symptom-acupoints-list");

const memoArea = document.getElementById("memo-area");
const saveMemoBtn = document.getElementById("save-memo-btn");

// Suggestion management
const suggestionsContainer = document.getElementById("acupoint-suggestions");
let currentSuggestions = [];
let suggestionIndex = -1;

// ===============================
// 画面切り替え
// ===============================
function showScreen(screen) {
  [mainScreen, acupointResultScreen, symptomResultScreen].forEach(s => s.classList.add("hidden"));
  screen.classList.remove("hidden");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// ===============================
// メイン: 経穴検索処理
// ===============================
function normalize(str) {
  return (str || "")
    .toLowerCase()
    // Remove all whitespace including full-width spaces
    .replace(/[\s\u3000]+/g, "")
    // Remove prolonged sound marks, middle dots, hyphens (escape the dash properly)
    .replace(/[ー−‐\-・]/g, "")
    // Convert full-width alphanumerics to half-width
    .replace(/[Ａ-Ｚａ-ｚ０-９]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xFEE0))
    // Convert katakana to hiragana (ァ-ヶ -> ぁ-ゖ)
    .replace(/[ァ-ヶ]/g, s => String.fromCharCode(s.charCodeAt(0) - 0x60));
}

// ===============================
// Suggestion management functions
// ===============================
function buildSuggestions(query) {
  const q = normalize(query);
  if (!q) return [];
  
  const matches = ACUPOINTS.filter(p =>
    p.alt.some(a => {
      const n = normalize(a);
      return n.includes(q) || q.includes(n);
    })
  );
  
  return matches.slice(0, 10); // Max 10 suggestions
}

function showSuggestions(suggestions) {
  if (!suggestionsContainer || suggestions.length === 0) {
    hideSuggestions();
    return;
  }
  
  currentSuggestions = suggestions;
  suggestionIndex = -1;
  
  suggestionsContainer.innerHTML = "";
  suggestions.forEach((acupoint, index) => {
    const item = document.createElement("div");
    item.classList.add("suggestion-item");
    item.dataset.index = index;
    
    item.innerHTML = `
      <span class="sg-name">${acupoint.name}</span>
      <span class="sg-reading">${acupoint.reading}</span>
    `;
    
    item.addEventListener("click", () => {
      selectSuggestion(index);
    });
    
    suggestionsContainer.appendChild(item);
  });
  
  suggestionsContainer.classList.add("visible");
}

function hideSuggestions() {
  if (suggestionsContainer) {
    suggestionsContainer.classList.remove("visible");
    suggestionsContainer.innerHTML = "";
  }
  currentSuggestions = [];
  suggestionIndex = -1;
}

function navigateSuggestions(direction) {
  if (currentSuggestions.length === 0) return;
  
  // Clear previous highlight
  if (suggestionIndex >= 0) {
    const prevItem = suggestionsContainer.children[suggestionIndex];
    if (prevItem) prevItem.classList.remove("active");
  }
  
  // Update index with wrap-around
  if (direction === "up") {
    suggestionIndex = suggestionIndex <= 0 ? currentSuggestions.length - 1 : suggestionIndex - 1;
  } else if (direction === "down") {
    suggestionIndex = suggestionIndex >= currentSuggestions.length - 1 ? 0 : suggestionIndex + 1;
  }
  
  // Highlight new item
  if (suggestionIndex >= 0) {
    const currentItem = suggestionsContainer.children[suggestionIndex];
    if (currentItem) currentItem.classList.add("active");
  }
}

function selectSuggestion(index) {
  if (index >= 0 && index < currentSuggestions.length) {
    const selectedAcupoint = currentSuggestions[index];
    searchInput.value = selectedAcupoint.reading;
    hideSuggestions();
    renderAcupoint(selectedAcupoint);
  }
}

function searchAcupoint(query) {
  const q = normalize(query);
  if (!q) return null;
  return ACUPOINTS.find(p =>
    p.alt.some(a => {
      const n = normalize(a);
      return n.includes(q) || q.includes(n);
    })
  );
}

function renderAcupoint(acupoint) {
  if (!acupoint) return;
  resultNameEl.textContent = `${acupoint.name} (${acupoint.reading})`;
  resultLocationEl.textContent = acupoint.location;

  resultEffectsEl.innerHTML = "";
  acupoint.effects.forEach(e => {
    const li = document.createElement("li");
    li.textContent = e;
    resultEffectsEl.appendChild(li);
  });

  relatedSymptomsEl.innerHTML = "";
  acupoint.symptoms.forEach(symId => {
    const sym = SYMPTOMS[symId];
    if (!sym) return;
    const li = document.createElement("li");
    const a = document.createElement("a");
    a.href = "#";
    a.textContent = sym.label;
    a.addEventListener("click", e => {
      e.preventDefault();
      renderSymptom(symId);
    });
    li.appendChild(a);
    relatedSymptomsEl.appendChild(li);
  });

  memoArea.value = localStorage.getItem(`memo_${acupoint.id}`) || "";

  showScreen(acupointResultScreen);
}

searchBtn.addEventListener("click", () => {
  const value = searchInput.value.trim();
  
  // If suggestions are visible and an item is highlighted, select it
  if (currentSuggestions.length > 0 && suggestionIndex >= 0) {
    selectSuggestion(suggestionIndex);
    return;
  }
  
  // Otherwise, perform normal search
  const found = searchAcupoint(value);
  if (!found) {
    alert("該当する経穴が見つかりませんでした。サンプル: ごうこく / ふうち / きょくち");
    return;
  }
  renderAcupoint(found);
  hideSuggestions();
});

searchInput.addEventListener("keydown", e => {
  if (e.key === "ArrowUp") {
    e.preventDefault();
    navigateSuggestions("up");
  } else if (e.key === "ArrowDown") {
    e.preventDefault();
    navigateSuggestions("down");
  } else if (e.key === "Enter") {
    e.preventDefault();
    // If suggestions are visible and an item is highlighted, select it
    if (currentSuggestions.length > 0 && suggestionIndex >= 0) {
      selectSuggestion(suggestionIndex);
    } else {
      // Otherwise, trigger search button click
      searchBtn.click();
    }
  } else if (e.key === "Escape") {
    hideSuggestions();
  }
});

searchInput.addEventListener("input", () => {
  const query = searchInput.value.trim();
  if (query) {
    const suggestions = buildSuggestions(query);
    showSuggestions(suggestions);
  } else {
    hideSuggestions();
  }
});

// ===============================
// 症状選択 → 症状別結果
// ===============================
symptomSelect.addEventListener("change", () => {
  const val = symptomSelect.value;
  if (!val) return;
  renderSymptom(val);
});

function renderSymptom(symptomId) {
  const s = SYMPTOMS[symptomId];
  if (!s) {
    alert("症状データが見つかりません。");
    return;
  }
  symptomResultTitleEl.textContent = s.label;

  symptomAcupointsListEl.innerHTML = "";
  if (s.related.length === 0) {
    symptomAcupointsListEl.innerHTML = "<li>関連する経穴データは現在ありません（サンプル）</li>";
  } else {
    s.related.forEach(id => {
      const ap = ACUPOINTS.find(p => p.id === id);
      if (!ap) return;
      const li = document.createElement("li");
      const a = document.createElement("a");
      a.href = "#";
      a.classList.add("acupoint-link");
      a.dataset.acupointId = ap.id;
      a.textContent = `${ap.name} (${ap.reading})`;
      a.addEventListener("click", e => {
        e.preventDefault();
        renderAcupoint(ap);
      });
      li.appendChild(a);
      symptomAcupointsListEl.appendChild(li);
    });
  }

  showScreen(symptomResultScreen);
}

// ===============================
// メモ保存
// ===============================
saveMemoBtn.addEventListener("click", () => {
  const currentName = resultNameEl.textContent;
  const acupoint = ACUPOINTS.find(p => currentName.startsWith(p.name));
  if (!acupoint) {
    alert("経穴特定に失敗しました。");
    return;
  }
  localStorage.setItem(`memo_${acupoint.id}`, memoArea.value);
  saveMemoBtn.textContent = "保存しました";
  setTimeout(() => (saveMemoBtn.textContent = "メモを保存"), 1500);
});

// ===============================
// 戻るボタン
// ===============================
document.querySelectorAll(".back-to-main-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    showScreen(mainScreen);
    hideSuggestions(); // Hide suggestions when returning to main screen
  });
});

// ===============================
// Click outside to hide suggestions
// ===============================
document.addEventListener("click", (e) => {
  if (!searchInput.contains(e.target) && 
      !suggestionsContainer.contains(e.target)) {
    hideSuggestions();
  }
});

// ===============================
// 初期化
// ===============================
function init() {
  showScreen(mainScreen);
}

init();