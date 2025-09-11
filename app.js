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
  // 新しく追加する経穴データ
  {
    id: "choukyou",
    name: "長強",
    reading: "ちょうきょう",
    alt: ["ちょうきょう", "長強"],
    location: "尾骨先端と肛門の間",
    effects: ["腰痛", "痔疾", "便秘", "下痢"],
    symptoms: []
  },
  {
    id: "youyu",
    name: "腰兪",
    reading: "ようゆ",
    alt: ["ようゆ", "腰兪"],
    location: "第2後仙骨孔",
    effects: ["腰痛", "坐骨神経痛", "生殖器疾患"],
    symptoms: []
  },
  {
    id: "koshino_youkan",
    name: "腰陽関",
    reading: "こしのようかん",
    alt: ["こしのようかん", "腰陽関"],
    location: "第4腰椎棘突起下",
    effects: ["腰痛", "下肢痛", "生殖器疾患"],
    symptoms: []
  },
  {
    id: "meimon",
    name: "命門",
    reading: "めいもん",
    alt: ["めいもん", "命門"],
    location: "第2腰椎棘突起下",
    effects: ["腰痛", "腎疾患", "生殖器疾患", "精力減退"],
    symptoms: []
  },
  {
    id: "kensuu",
    name: "懸枢",
    reading: "けんすう",
    alt: ["けんすう", "懸枢"],
    location: "第1腰椎棘突起下",
    effects: ["腰痛", "胃腸疾患", "黄疸"],
    symptoms: []
  },
  {
    id: "sekichuu",
    name: "脊中",
    reading: "せきちゅう",
    alt: ["せきちゅう", "脊中"],
    location: "第11胸椎棘突起下",
    effects: ["胃腸疾患", "黄疸", "腰背痛"],
    symptoms: []
  },
  {
    id: "chuusuu",
    name: "中枢",
    reading: "ちゅうすう",
    alt: ["ちゅうすう", "中枢"],
    location: "第10胸椎棘突起下",
    effects: ["胃腸疾患", "肝疾患", "黄疸"],
    symptoms: []
  },
  {
    id: "kinshuku",
    name: "筋縮",
    reading: "きんしゅく",
    alt: ["きんしゅく", "筋縮"],
    location: "第9胸椎棘突起下",
    effects: ["胃腸疾患", "肝疾患", "筋肉の緊張"],
    symptoms: []
  },
  {
    id: "shiyou",
    name: "至陽",
    reading: "しよう",
    alt: ["しよう", "至陽"],
    location: "第7胸椎棘突起下",
    effects: ["胸背痛", "心疾患", "肝疾患"],
    symptoms: []
  },
  {
    id: "reidai",
    name: "霊台",
    reading: "れいだい",
    alt: ["れいだい", "霊台"],
    location: "第6胸椎棘突起下",
    effects: ["咳嗽", "気管支炎", "背部痛"],
    symptoms: []
  },
  {
    id: "shindou",
    name: "神道",
    reading: "しんどう",
    alt: ["しんどう", "神道"],
    location: "第5胸椎棘突起下",
    effects: ["心疾患", "精神不安", "健忘"],
    symptoms: []
  },
  {
    id: "shinchuu",
    name: "身柱",
    reading: "しんちゅう",
    alt: ["しんちゅう", "身柱"],
    location: "第3胸椎棘突起下",
    effects: ["咳嗽", "気管支炎", "小児疾患", "癲癇"],
    symptoms: []
  },
  {
    id: "toudou",
    name: "陶道",
    reading: "とうどう",
    alt: ["とうどう", "陶道"],
    location: "第1胸椎棘突起下",
    effects: ["頸肩痛", "頭痛", "発熱"],
    symptoms: []
  },
  {
    id: "daitsui",
    name: "大椎",
    reading: "だいつい",
    alt: ["だいつい", "大椎"],
    location: "第7頸椎棘突起下",
    effects: ["発熱", "感冒", "頸肩痛", "精神疾患"],
    symptoms: []
  },
  {
    id: "amon",
    name: "瘂門",
    reading: "あもん",
    alt: ["あもん", "瘂門"],
    location: "後髪際正中線上1寸",
    effects: ["言語障害", "精神疾患", "頸部痛"],
    symptoms: []
  },
  {
    id: "fuufu",
    name: "風府",
    reading: "ふうふ",
    alt: ["ふうふ", "風府"],
    location: "後髪際正中線上1寸",
    effects: ["頭痛", "頸部痛", "風邪", "精神疾患"],
    symptoms: []
  },
  {
    id: "nouko",
    name: "脳戸",
    reading: "のうこ",
    alt: ["のうこ", "脳戸"],
    location: "後髪際正中線上2.5寸",
    effects: ["頭痛", "めまい", "精神疾患"],
    symptoms: []
  },
  {
    id: "goukan",
    name: "強間",
    reading: "ごうかん",
    alt: ["ごうかん", "強間"],
    location: "後髪際正中線上4寸",
    effects: ["頭痛", "頸部痛", "精神疾患"],
    symptoms: []
  },
  {
    id: "gochou",
    name: "後頂",
    reading: "ごちょう",
    alt: ["ごちょう", "後頂"],
    location: "百会穴の後1.5寸",
    effects: ["頭痛", "めまい", "精神疾患"],
    symptoms: []
  },
  {
    id: "hyakue",
    name: "百会",
    reading: "ひゃくえ",
    alt: ["ひゃくえ", "百会"],
    location: "頭頂部正中線上",
    effects: ["頭痛", "めまい", "精神疾患", "脱肛", "高血圧"],
    symptoms: []
  },
  {
    id: "zenchou",
    name: "前頂",
    reading: "ぜんちょう",
    alt: ["ぜんちょう", "前頂"],
    location: "百会穴の前1.5寸",
    effects: ["頭痛", "めまい", "鼻疾患"],
    symptoms: []
  },
  {
    id: "shine",
    name: "顖会",
    reading: "しんえ",
    alt: ["しんえ", "顖会"],
    location: "前髪際正中線上2寸",
    effects: ["頭痛", "鼻疾患", "小児疾患"],
    symptoms: []
  },
  {
    id: "jousei",
    name: "上星",
    reading: "じょうせい",
    alt: ["じょうせい", "上星"],
    location: "前髪際正中線上1寸",
    effects: ["鼻疾患", "頭痛", "めまい"],
    symptoms: []
  },
  {
    id: "shintei",
    name: "神庭",
    reading: "しんてい",
    alt: ["しんてい", "神庭"],
    location: "前髪際正中線上0.5寸",
    effects: ["頭痛", "めまい", "精神疾患", "鼻疾患"],
    symptoms: []
  },
  {
    id: "soryou",
    name: "素髎",
    reading: "そりょう",
    alt: ["そりょう", "素髎"],
    location: "鼻尖端",
    effects: ["鼻疾患", "昏睡", "ショック"],
    symptoms: []
  },
  {
    id: "suikou",
    name: "水溝",
    reading: "すいこう",
    alt: ["すいこう", "水溝"],
    location: "鼻中隔下端と上唇の間",
    effects: ["昏睡", "ショック", "精神疾患", "鼻疾患"],
    symptoms: []
  },
  {
    id: "datan",
    name: "兌端",
    reading: "だたん",
    alt: ["だたん", "兌端"],
    location: "上唇中央",
    effects: ["口唇疾患", "歯痛", "精神疾患"],
    symptoms: []
  },
  {
    id: "ginkou",
    name: "齦交",
    reading: "ぎんこう",
    alt: ["ぎんこう", "齦交"],
    location: "上唇小帯と歯茎の境界",
    effects: ["歯痛", "歯茎の病気", "口臭"],
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
const searchDropdown = document.getElementById("search-dropdown");
const symptomSelect = document.getElementById("symptom-select");

const resultNameEl = document.getElementById("result-name");
const resultLocationEl = document.getElementById("result-location");
const resultEffectsEl = document.getElementById("result-effects");
const relatedSymptomsEl = document.getElementById("related-symptoms");

const symptomResultTitleEl = document.getElementById("symptom-result-title");
const symptomAcupointsListEl = document.getElementById("symptom-acupoints-list");

const memoArea = document.getElementById("memo-area");
const saveMemoBtn = document.getElementById("save-memo-btn");

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
    .replace(/\s+/g, "")
    .replace(/[ー−‐-]/g, "")
    .replace(/[ぁ-ん]/g, s => String.fromCharCode(s.charCodeAt(0) + 0x60));
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
  const found = searchAcupoint(value);
  if (!found) {
    alert("該当する経穴が見つかりませんでした。サンプル: ごうこく / ふうち / きょくち");
    return;
  }
  renderAcupoint(found);
});

searchInput.addEventListener("keydown", e => {
  if (e.key === "Enter") searchBtn.click();
});

// ===============================
// ドロップダウン検索機能
// ===============================
function filterAcupointsByReading(query) {
  const q = normalize(query);
  if (!q) return [];
  
  return ACUPOINTS.filter(p => 
    normalize(p.reading).startsWith(q)
  ).slice(0, 10); // 最大10件まで表示
}

function showDropdown(items) {
  if (items.length === 0) {
    hideDropdown();
    return;
  }
  
  searchDropdown.innerHTML = "";
  items.forEach(item => {
    const div = document.createElement("div");
    div.classList.add("search-dropdown-item");
    div.textContent = `${item.name} (${item.reading})`;
    div.addEventListener("click", () => {
      searchInput.value = item.reading;
      hideDropdown();
      renderAcupoint(item);
    });
    searchDropdown.appendChild(div);
  });
  
  searchDropdown.classList.remove("hidden");
}

function hideDropdown() {
  searchDropdown.classList.add("hidden");
}

// 入力時のドロップダウン表示
searchInput.addEventListener("input", e => {
  const value = e.target.value.trim();
  if (value.length > 0) {
    const matches = filterAcupointsByReading(value);
    showDropdown(matches);
  } else {
    hideDropdown();
  }
});

// フォーカス外でドロップダウンを非表示
document.addEventListener("click", e => {
  if (!e.target.closest(".search-input-container")) {
    hideDropdown();
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
  });
});

// ===============================
// 初期化
// ===============================
function init() {
  showScreen(mainScreen);
}

init();