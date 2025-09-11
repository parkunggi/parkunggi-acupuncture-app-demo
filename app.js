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