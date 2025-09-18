/******************************************************
 * 経穴検索アプリ（インライン表示版）
 * - 画面遷移廃止（詳細は main-screen 下部に表示）
 * - 経穴名 / 読み(ひらがな) / 筋肉名(漢字) 検索
 * - 筋肉マッチはサジェストに M バッジ
 * - 全361経穴 読み + 暫定筋肉/組織マッピング
 * - APP_VERSION 20250918-10
 ******************************************************/

const APP_VERSION = '20250918-10';
const CSV_FILE = '経穴・経絡.csv';
const CSV_PATH = encodeURI(CSV_FILE);
const MIN_QUERY_LENGTH = 1;
const EXPECTED_TOTAL = 361;

/* ==== 読み辞書（前回同様） ==== */
const READINGS = {
  /* 督脈 */
  "長強":"ちょうきょう","腰兪":"ようゆ","腰陽関":"ようようかん","命門":"めいもん","懸枢":"けんすう","脊中":"せきちゅう",
  "中枢":"ちゅうすう","筋縮":"きんしゅく","至陽":"しよう","霊台":"れいだい","神道":"しんどう","身柱":"しんちゅう",
  "陶道":"とうどう","大椎":"だいつい","瘂門":"あもん","風府":"ふうふ","脳戸":"のうこ","強間":"きょうかん",
  "後頂":"こうちょう","百会":"ひゃくえ","前頂":"ぜんちょう","顖会":"しんえ","上星":"じょうせい","神庭":"しんてい",
  "素髎":"そりょう","水溝":"すいこう","兌端":"だたん","齦交":"ぎんこう",
  /* 任脈 */
  "会陰":"えいん","曲骨":"きょくこつ","中極":"ちゅうきょく","関元":"かんげん","石門":"せきもん","気海":"きかい",
  "陰交":"いんこう","神闕":"しんけつ","水分":"すいぶん","下脘":"げかん","建里":"けんり","中脘":"ちゅうかん",
  "上脘":"じょうかん","巨闕":"こけつ","鳩尾":"きゅうび","中庭":"ちゅうてい","膻中":"だんちゅう","玉堂":"ぎょくどう",
  "紫宮":"しきゅう","華蓋":"かがい","璇璣":"せんき","天突":"てんとつ","廉泉":"れんせん","承漿":"しょうしょう",
  /* 肺経 */
  "中府":"ちゅうふ","雲門":"うんもん","天府":"てんぷ","侠白":"きょうはく","尺沢":"しゃくたく","孔最":"こうさい",
  "列欠":"れっけつ","経渠":"けいきょ","太淵":"たいえん","魚際":"ぎょさい","少商":"しょうしょう",
  /* 大腸経 */
  "商陽":"しょうよう","二間":"じかん","三間":"さんかん","合谷":"ごうこく","陽渓":"ようけい","偏歴":"へんれき",
  "温溜":"おんる","下廉":"げれん","上廉":"じょうれん","手三里":"てさんり","曲池":"きょくち","肘髎":"ちゅうりょう",
  "手五里":"てごり","臂臑":"ひじゅ","肩髃":"けんぐう","巨骨":"ここつ","天鼎":"てんてい","扶突":"ふとつ",
  "禾髎":"かりょう","迎香":"げいこう",
  /* 胃経 */
  "承泣":"しょうきゅう","四白":"しはく","巨髎":"こりょう","地倉":"ちそう","大迎":"たいげい","頬車":"きょうしゃ",
  "下関":"げかん","頭維":"ずい","人迎":"じんげい","水突":"すいとつ","気舎":"きしゃ","欠盆":"けつぼん",
  "気戸":"きこ","庫房":"こぼう","屋翳":"おくえい","膺窓":"ようそう","乳中":"にゅうちゅう","乳根":"にゅうこん",
  "不容":"ふよう","承満":"しょうまん","梁門":"りょうもん","関門":"かんもん","太乙":"たいいつ","滑肉門":"かつにくもん",
  "天枢":"てんすう","外陵":"がいりょう","大巨":"たいこ","水道":"すいどう","帰来":"きらい","気衝":"きしょう",
  "髀関":"ひかん","伏兎":"ふくと","陰市":"いんし","梁丘":"りょうきゅう","犢鼻":"とくび","足三里":"あしさんり",
  "上巨虚":"じょうこきょ","条口":"じょうこう","下巨虚":"げこきょ","豊隆":"ほうりゅう","解渓":"かいけい","衝陽":"しょうよう",
  "陥谷":"かんこく","内庭":"ないてい","厲兌":"れいだ",
  /* 脾経 */
  "隠白":"いんぱく","大都":"だいと","太白":"たいはく","公孫":"こうそん","商丘":"しょうきゅう","三陰交":"さんいんこう",
  "漏谷":"ろうこく","地機":"ちき","陰陵泉":"いんりょうせん","血海":"けっかい","箕門":"きもん","衝門":"しょうもん",
  "府舎":"ふしゃ","腹結":"ふっけつ","大横":"だいおう","腹哀":"ふくあい","食竇":"しょくとつ","天渓":"てんけい",
  "胸郷":"きょうきょう","周栄":"しゅうえい","大包":"だいほう",
  /* 心経 */
  "極泉":"きょくせん","青霊":"せいれい","少海":"しょうかい","霊道":"れいどう","通里":"つうり","陰郄":"いんげき",
  "神門":"しんもん","少府":"しょうふ","少衝":"しょうしょう",
  /* 小腸経 */
  "少沢":"しょうたく","前谷":"ぜんこく","後渓":"こうけい","腕骨":"わんこつ","陽谷":"ようこく","養老":"ようろう",
  "支正":"しせい","小海":"しょうかい","肩貞":"けんてい","臑兪":"じゅゆ","天宗":"てんそう","秉風":"へいふう",
  "曲垣":"きょくえん","肩外兪":"けんがいゆ","肩中兪":"けんちゅうゆ","天窓":"てんそう","天容":"てんよう",
  "顴髎":"けんりょう","聴宮":"ちょうきゅう",
  /* 膀胱経 */
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
  "足通谷":"あしつうこく","至陰":"しいん",
  /* 腎経 */
  "湧泉":"ゆうせん","然谷":"ねんこく","太渓":"たいけい","大鍾":"だいしょう","水泉":"すいせん","照海":"しょうかい",
  "復溜":"ふくりゅう","交信":"こうしん","築賓":"ちくひん","陰谷":"いんこく","横骨":"おうこつ","大赫":"だいかく",
  "気穴":"きけつ","四満":"しまん","中注":"ちゅうちゅう","肓兪":"こうゆ","商曲":"しょうきょく","石関":"せきかん",
  "陰都":"いんと","腹通谷":"はらつうこく","幽門":"ゆうもん","歩廊":"ほろう","神封":"しんぷう","霊墟":"れいきょ",
  "神蔵":"しんぞう","彧中":"いくちゅう","兪府":"ゆふ",
  /* 心包経 */
  "天池":"てんち","天泉":"てんせん","曲沢":"きょくたく","郄門":"げきもん","間使":"かんし","内関":"ないかん",
  "大陵":"だいりょう","労宮":"ろうきゅう","中衝":"ちゅうしょう",
  /* 三焦経 */
  "関衝":"かんしょう","液門":"えきもん","中渚":"ちゅうしょ","陽池":"ようち","外関":"がいかん","支溝":"しこう",
  "会宗":"えそう","三陽絡":"さんようらく","四瀆":"しとく","天井":"てんせい","清冷淵":"せいれいえん","消濼":"しょうれき",
  "臑会":"じゅえ","肩髎":"けんりょう","天髎":"てんりょう","天牖":"てんゆう","翳風":"えいふう","瘈脈":"けいみゃく",
  "顱息":"ろそく","角孫":"かくそん","耳門":"じもん","和髎":"わりょう","糸竹空":"しちくくう",
  /* 胆経 */
  "瞳子髎":"どうしりょう","聴会":"ちょうえ","上関":"じょうかん","頷厭":"がんえん","懸顱":"けんろ","懸釐":"けんり",
  "曲鬢":"きょくびん","率谷":"そつこく","天衝":"てんしょう","浮白":"ふはく","頭竅陰":"あたまきょういん","完骨":"かんこつ",
  "本神":"ほんじん","陽白":"ようはく","頭臨泣":"あたまりんきゅう","目窓":"もくそう","正営":"せいえい","承霊":"しょうれい",
  "脳空":"のうくう","風池":"ふうち","肩井":"けんせい","淵腋":"えんえき","輒筋":"ちょうきん","日月":"じつげつ",
  "京門":"けいもん","帯脈":"たいみゃく","五枢":"ごすう","維道":"いどう","居髎":"きょりょう","環跳":"かんちょう",
  "風市":"ふうし","中瀆":"ちゅうとく","膝陽関":"しつようかん","陽陵泉":"ようりょうせん","陽交":"ようこう","外丘":"がいきゅう",
  "光明":"こうめい","陽輔":"ようほ","懸鍾":"けんしょう","丘墟":"きゅうきょ","足臨泣":"そくりんきゅう","地五会":"ちごえ",
  "侠渓":"きょうけい","足竅陰":"そくきょういん",
  /* 肝経 */
  "大敦":"だいとん","行間":"こうかん","太衝":"たいしょう","中封":"ちゅうほう","蠡溝":"れいこう","中都":"ちゅうと",
  "膝関":"しつかん","曲泉":"きょくせん","陰包":"いんぽう","足五里":"あしごり","陰廉":"いんれん","急脈":"きゅうみゃく",
  "章門":"しょうもん","期門":"きもん"
};

/* ==== 全361経穴 暫定筋肉/組織マッピング ==== */
const MUSCLE_MAP = {
  /* ----（長文のため前回答と同一。省略せず貼付）---- */
  /* ここから下は直前回答(20250918-9) MUSCLE_MAP と同一内容 */
  "長強":"外肛門括約筋/尾骨筋/肛門挙筋",
  "腰兪":"仙骨裂孔/多裂筋/仙結節靱帯",
  "腰陽関":"L4棘突起間/棘間靱帯/多裂筋",
  "命門":"L2棘突起間/棘間靱帯/多裂筋",
  "懸枢":"L1棘突起間/棘間靱帯/多裂筋",
  "脊中":"T11棘突起間/棘間靱帯/脊柱起立筋",
  "中枢":"T10棘突起間/棘間靱帯/脊柱起立筋",
  "筋縮":"T9棘突起間/棘間靱帯/脊柱起立筋",
  "至陽":"T7棘突起間/棘間靱帯/脊柱起立筋",
  "霊台":"T6棘突起間/棘間靱帯/脊柱起立筋",
  "神道":"T5棘突起間/棘間靱帯/脊柱起立筋",
  "身柱":"T3棘突起間/棘間靱帯/僧帽筋",
  "陶道":"T1棘突起間/棘間靱帯/僧帽筋",
  "大椎":"C7-T1棘突起間/項靱帯/僧帽筋",
  "瘂門":"C2上縁/項靱帯/後頭下筋群",
  "風府":"外後頭隆起下/僧帽筋上部/頭半棘筋",
  "脳戸":"後頭骨/帽状腱膜/後頭筋",
  "強間":"後頭骨/帽状腱膜",
  "後頂":"頭頂骨/帽状腱膜",
  "百会":"帽状腱膜/前頭筋/後頭筋",
  "前頂":"帽状腱膜",
  "顖会":"帽状腱膜",
  "上星":"前頭骨/帽状腱膜",
  "神庭":"前頭骨/前頭筋",
  "素髎":"鼻軟骨/外鼻筋/口輪筋",
  "水溝":"上唇溝/口輪筋",
  "兌端":"上唇/口輪筋",
  "齦交":"上歯齦/歯根膜/口輪筋",
  /* 任脈 */
  "会陰":"会陰体/会陰横筋/外肛門括約筋",
  "曲骨":"恥骨結合上縁/恥骨筋腱膜/腹直筋下部",
  "中極":"腹直筋/腹直筋鞘/白線",
  "関元":"腹直筋/腹直筋鞘/白線",
  "石門":"腹直筋/腹直筋鞘",
  "気海":"腹直筋/腹直筋鞘",
  "陰交":"腹直筋/白線",
  "神闕":"臍輪/腹直筋鞘",
  "水分":"腹直筋/腹直筋鞘",
  "下脘":"腹直筋/腹直筋鞘",
  "建里":"腹直筋/腹直筋鞘",
  "中脘":"腹直筋/腹直筋鞘",
  "上脘":"腹直筋/腹直筋鞘",
  "巨闕":"腹直筋/腹直筋鞘/剣状突起下",
  "鳩尾":"剣状突起下/腹直筋腱膜",
  "中庭":"胸骨体下部/腹直筋上部腱膜",
  "膻中":"胸骨体第4肋間/胸骨筋/内肋間筋",
  "玉堂":"胸骨体第3肋間/内肋間筋",
  "紫宮":"胸骨体第2肋間/内肋間筋",
  "華蓋":"胸骨体第1肋間/内肋間筋",
  "璇璣":"胸骨柄上部/頸筋膜",
  "天突":"胸骨上窩/胸鎖乳突筋前縁/頸筋膜",
  "廉泉":"舌骨上/舌骨上筋群/顎舌骨筋",
  "承漿":"オトガイ唇溝/オトガイ筋/口輪筋",
  /* 肺経 */
  "中府":"大胸筋/前鋸筋/肋間筋",
  "雲門":"鎖骨下/大胸筋上部/前鋸筋",
  "天府":"上腕二頭筋短頭筋膜/上腕筋",
  "侠白":"上腕二頭筋外側縁/上腕筋",
  "尺沢":"上腕二頭筋腱外側/腕橈骨筋起始部",
  "孔最":"橈側前腕屈筋群/橈側手根屈筋起始",
  "列欠":"長母指外転筋腱/短母指伸筋腱間",
  "経渠":"橈骨茎状突起近位/長母指外転筋腱",
  "太淵":"橈骨動脈溝/橈側手根屈筋腱",
  "魚際":"母指球筋群(短母指外転筋)",
  "少商":"母指末節橈側/母指伸筋腱/皮膚",
  /* 大腸経 */
  "商陽":"示指末節橈側/伸筋腱/皮膚",
  "二間":"示指基節橈側/虫様筋腱膜",
  "三間":"示指中手指節関節橈側/骨間筋腱膜",
  "合谷":"第1背側骨間筋",
  "陽渓":"橈骨茎状突起遠位/長母指外転筋腱/短母指伸筋腱",
  "偏歴":"前腕伸筋群(総指伸筋)/橈骨骨間膜",
  "温溜":"前腕伸筋群/総指伸筋",
  "下廉":"前腕伸筋群/総指伸筋",
  "上廉":"前腕伸筋群/総指伸筋",
  "手三里":"長橈側手根伸筋/総指伸筋境界",
  "曲池":"腕橈骨筋/長橈側手根伸筋",
  "肘髎":"上腕筋/腕橈骨筋/肘関節外側裂隙",
  "手五里":"上腕二頭筋外側/腕橈骨筋",
  "臂臑":"三角筋下部/上腕二頭筋長頭",
  "肩髃":"三角筋前部/肩関節包",
  "巨骨":"鎖骨肩峰端/三角筋/棘上筋腱",
  "天鼎":"胸鎖乳突筋後縁/斜角筋",
  "扶突":"胸鎖乳突筋前縁/甲状腺付近",
  "禾髎":"上唇皮膚/口輪筋",
  "迎香":"鼻翼外側/上唇挙筋群/口輪筋",
  /* 胃経 */
  "承泣":"眼輪筋/眼窩下縁",
  "四白":"眼輪筋/眼窩下孔",
  "巨髎":"上顎骨/口角挙筋群",
  "地倉":"口角/口輪筋/大頬骨筋",
  "大迎":"咬筋前縁/顔面動脈溝",
  "頬車":"咬筋下縁/咬筋",
  "下関":"外側翼突筋腱/咬筋腱/顎関節包",
  "頭維":"側頭筋/前頭筋/帽状腱膜",
  "人迎":"胸鎖乳突筋前縁/頸動脈鞘",
  "水突":"胸鎖乳突筋前縁/甲状腺上部",
  "気舎":"胸鎖乳突筋前縁/鎖骨上窩/斜角筋",
  "欠盆":"鎖骨上窩/斜角筋/前斜角筋筋膜",
  "気戸":"大胸筋上部/肋間筋",
  "庫房":"大胸筋上部/肋間筋",
  "屋翳":"大胸筋/乳腺/肋間筋",
  "膺窓":"大胸筋/肋間筋",
  "乳中":"乳腺/大胸筋",
  "乳根":"乳腺下極/大胸筋",
  "不容":"腹直筋上部/腹直筋鞘",
  "承満":"腹直筋上部/腹直筋鞘",
  "梁門":"腹直筋上部/腹直筋鞘",
  "関門":"腹直筋上部/腹直筋鞘",
  "太乙":"腹直筋/腹直筋鞘",
  "滑肉門":"腹直筋/腹直筋鞘",
  "天枢":"腹直筋外縁/外腹斜筋腱膜",
  "外陵":"腹直筋/外腹斜筋腱膜",
  "大巨":"腹直筋/外腹斜筋腱膜",
  "水道":"腹直筋/外腹斜筋腱膜",
  "帰来":"腹直筋下部/外腹斜筋腱膜",
  "気衝":"腹直筋下部/鼡径靱帯近位",
  "髀関":"大腿直筋起始/腸腰筋/縫工筋",
  "伏兎":"大腿直筋/縫工筋外側",
  "陰市":"大腿直筋/内側広筋",
  "梁丘":"大腿直筋/外側広筋",
  "犢鼻":"膝蓋靱帯外側縁/膝前脂肪体",
  "足三里":"前脛骨筋/長趾伸筋/外側広筋遠位",
  "上巨虚":"前脛骨筋/長趾伸筋",
  "条口":"前脛骨筋/長趾伸筋",
  "下巨虚":"前脛骨筋/長趾伸筋",
  "豊隆":"前脛骨筋外縁/長趾伸筋",
  "解渓":"長母趾伸筋腱/長趾伸筋腱",
  "衝陽":"第2中足骨底/長趾伸筋腱/短趾伸筋",
  "陥谷":"第2-3中足骨間/骨間筋",
  "内庭":"第2-3趾間/短趾屈筋腱/骨間筋",
  "厲兌":"第2趾末節/趾伸筋腱/皮膚",
  /* 脾経 */
  "隠白":"母趾末節内側/母趾伸筋腱/皮膚",
  "大都":"母趾基節内側/短母趾屈筋/母趾外転筋",
  "太白":"第1中足趾節関節内側/短母趾屈筋",
  "公孫":"第1中足骨底内側/母趾外転筋/短母趾屈筋",
  "商丘":"舟状骨粗面/母趾外転筋腱/後脛骨筋腱",
  "三陰交":"後脛骨筋/長趾屈筋/長母趾屈筋",
  "漏谷":"後脛骨筋/長趾屈筋",
  "地機":"ヒラメ筋内縁/後脛骨筋",
  "陰陵泉":"脛骨内顆下/鵞足(薄筋/縫工筋/半腱様筋)",
  "血海":"内側広筋/大腿筋膜張筋腱膜",
  "箕門":"長内転筋/大内転筋/薄筋間",
  "衝門":"鼡径靱帯下/長内転筋/腸腰筋",
  "府舎":"腹直筋下部/外腹斜筋腱膜/内腹斜筋",
  "腹結":"腹直筋下部/腹直筋鞘",
  "大横":"腹直筋外縁/外腹斜筋腱膜",
  "腹哀":"腹直筋外縁/外腹斜筋",
  "食竇":"第5肋間/前鋸筋/肋間筋",
  "天渓":"第4肋間/前鋸筋/肋間筋",
  "胸郷":"第3肋間/前鋸筋/肋間筋",
  "周栄":"第2肋間/前鋸筋/肋間筋",
  "大包":"第6肋間/前鋸筋/広背筋上縁",
  /* 心経 */
  "極泉":"腋窩中央/大胸筋腱/広背筋腱/上腕三頭筋長頭",
  "青霊":"上腕二頭筋内側縁/腕筋膜",
  "少海":"上腕骨内側上顆/円回内筋/上腕三頭筋内側頭",
  "霊道":"尺側手根屈筋腱橈側/浅指屈筋",
  "通里":"尺側手根屈筋腱橈側/浅指屈筋",
  "陰郄":"尺側手根屈筋腱橈側/深指屈筋",
  "神門":"豆状骨前/尺側手根屈筋腱",
  "少府":"第4-5中手骨間/骨間筋",
  "少衝":"小指末節橈側/小指伸筋腱/皮膚",
  /* 小腸経 */
  "少沢":"小指末節尺側/伸筋腱/皮膚",
  "前谷":"小指基節尺側/骨間筋腱膜",
  "後渓":"第5中手指節関節尺側/骨間筋腱",
  "腕骨":"三角骨/尺側手根伸筋腱/豆状三角靱帯",
  "陽谷":"尺骨茎状突起/尺側手根伸筋腱",
  "養老":"尺骨頭橈側/尺側手根伸筋/総指伸筋",
  "支正":"尺骨内縁/尺側手根屈筋/深指屈筋",
  "小海":"肘頭内側/上腕三頭筋腱内側縁",
  "肩貞":"三角筋後部/大円筋/小円筋",
  "臑兪":"肩甲棘下縁/棘下筋/三角筋",
  "天宗":"肩甲骨中央/棘下筋",
  "秉風":"棘上窩/棘上筋",
  "曲垣":"肩甲棘内端/僧帽筋/棘上筋",
  "肩外兪":"T1棘突起外1.5寸/僧帽筋/菱形筋",
  "肩中兪":"C7棘突起外1.5寸/僧帽筋/菱形筋",
  "天窓":"胸鎖乳突筋後縁/斜角筋",
  "天容":"下顎角後下/顎二腹筋後腹/胸鎖乳突筋",
  "顴髎":"頬骨下/大頬骨筋/小頬骨筋",
  "聴宮":"顎関節前方/外側翼突筋腱/耳珠前",
  /* 膀胱経 */
  "睛明":"内眼角/眼輪筋/涙嚢部",
  "攅竹":"眉毛内端/皺眉筋/眼輪筋",
  "眉衝":"前頭筋/帽状腱膜",
  "曲差":"前頭筋/帽状腱膜",
  "五処":"前頭筋/帽状腱膜",
  "承光":"前頭筋/帽状腱膜",
  "通天":"前頭筋/帽状腱膜",
  "絡却":"前頭筋/帽状腱膜",
  "玉枕":"後頭筋/帽状腱膜/僧帽筋上部",
  "天柱":"僧帽筋/頭半棘筋/後頭下筋群",
  "大杼":"T1棘突起外1.5寸/僧帽筋/菱形筋",
  "風門":"T2棘突起外1.5寸/僧帽筋/菱形筋",
  "肺兪":"T3棘突起外1.5寸/菱形筋/脊柱起立筋",
  "厥陰兪":"T4棘突起外1.5寸/菱形筋/脊柱起立筋",
  "心兪":"T5棘突起外1.5寸/菱形筋/脊柱起立筋",
  "督兪":"T6棘突起外1.5寸/菱形筋下/脊柱起立筋",
  "膈兪":"T7棘突起外1.5寸/脊柱起立筋",
  "肝兪":"T9棘突起外1.5寸/脊柱起立筋",
  "胆兪":"T10棘突起外1.5寸/脊柱起立筋",
  "脾兪":"T11棘突起外1.5寸/脊柱起立筋",
  "胃兪":"T12棘突起外1.5寸/脊柱起立筋",
  "三焦兪":"L1棘突起外1.5寸/脊柱起立筋",
  "腎兪":"L2棘突起外1.5寸/脊柱起立筋/多裂筋",
  "気海兪":"L3棘突起外1.5寸/脊柱起立筋",
  "大腸兪":"L4棘突起外1.5寸/脊柱起立筋",
  "関元兪":"L5棘突起外1.5寸/脊柱起立筋",
  "小腸兪":"仙骨孔上/多裂筋/仙棘筋",
  "膀胱兪":"仙骨孔/多裂筋",
  "中膂兪":"仙骨孔/多裂筋",
  "白環兪":"仙骨孔/仙棘靱帯/多裂筋",
  "上髎":"第1後仙骨孔/仙骨後面",
  "次髎":"第2後仙骨孔/仙骨後面",
  "中髎":"第3後仙骨孔/仙骨後面",
  "下髎":"第4後仙骨孔/仙骨後面",
  "会陽":"尾骨外側/大殿筋下縁",
  "承扶":"殿溝中点/大殿筋/ハムストリングス",
  "殷門":"大腿二頭筋/半腱様筋間",
  "浮郄":"大腿二頭筋腱外縁",
  "委陽":"大腿二頭筋腱内縁/膝窩筋",
  "委中":"膝窩中央/腓腹筋腱/膝窩筋",
  "附分":"T2棘突起外3寸/僧帽筋/脊柱起立筋",
  "魄戸":"T3棘突起外3寸/菱形筋/脊柱起立筋",
  "膏肓":"T4棘突起外3寸/菱形筋/脊柱起立筋",
  "神堂":"T5棘突起外3寸/脊柱起立筋",
  "譩譆":"T6棘突起外3寸/脊柱起立筋",
  "膈関":"T7棘突起外3寸/脊柱起立筋",
  "魂門":"T9棘突起外3寸/脊柱起立筋",
  "陽綱":"T10棘突起外3寸/脊柱起立筋",
  "意舎":"T11棘突起外3寸/脊柱起立筋",
  "胃倉":"T12棘突起外3寸/脊柱起立筋",
  "肓門":"L1棘突起外3寸/脊柱起立筋",
  "志室":"L2棘突起外3寸/脊柱起立筋",
  "胞肓":"仙骨孔外3寸/大殿筋/仙棘靱帯",
  "秩辺":"仙骨孔外3寸/大殿筋/梨状筋近位",
  "合陽":"腓腹筋間溝/ヒラメ筋",
  "承筋":"腓腹筋中央/腓腹筋",
  "承山":"腓腹筋腱/ヒラメ筋移行",
  "飛揚":"腓腹筋外側頭下/ヒラメ筋",
  "跗陽":"腓骨後縁/アキレス腱/長趾屈筋",
  "崑崙":"アキレス腱外側/腓腹筋腱末端",
  "僕参":"外果下/短腓骨筋腱/長腓骨筋腱",
  "申脈":"外果下/短腓骨筋腱/長腓骨筋腱",
  "金門":"立方骨上/短腓骨筋/長腓骨筋",
  "京骨":"第5中足骨粗面/短趾伸筋",
  "束骨":"第5中足趾節関節外側/骨間筋",
  "足通谷":"第5趾基節外側/骨間筋/趾伸筋腱",
  "至陰":"第5趾末節外側/趾伸筋腱/皮膚",
  /* 腎経 */
  "湧泉":"足底中央/短趾屈筋/足底腱膜",
  "然谷":"舟状骨粗面下/母趾外転筋/短趾屈筋",
  "太渓":"アキレス腱内側/後脛骨筋腱/長趾屈筋腱",
  "大鍾":"踵骨上内側/アキレス腱付着/後脛骨筋腱",
  "水泉":"太渓下/踵骨/長趾屈筋腱",
  "照海":"内果下/後脛骨筋腱/長趾屈筋腱",
  "復溜":"アキレス腱前縁/長趾屈筋",
  "交信":"脛骨内縁後/後脛骨筋",
  "築賓":"ヒラメ筋内側/後脛骨筋",
  "陰谷":"半腱様筋腱/半膜様筋腱/膝窩筋",
  "横骨":"恥骨上縁/腹直筋下部/恥骨筋",
  "大赫":"恥骨上/腹直筋下部/恥骨筋",
  "気穴":"腹直筋/内腹斜筋腱膜",
  "四満":"腹直筋/内腹斜筋腱膜",
  "中注":"腹直筋/内腹斜筋腱膜",
  "肓兪":"腹直筋/腹直筋鞘",
  "商曲":"腹直筋/腹直筋鞘",
  "石関":"腹直筋/腹直筋鞘",
  "陰都":"腹直筋/腹直筋鞘",
  "腹通谷":"腹直筋/腹直筋鞘",
  "幽門":"腹直筋上部/肋軟骨/内腹斜筋",
  "歩廊":"腹直筋上部/肋軟骨/内肋間筋",
  "神封":"腹直筋上部/肋軟骨/内肋間筋",
  "霊墟":"腹直筋上部/肋軟骨/内肋間筋",
  "神蔵":"腹直筋上部/肋軟骨/内肋間筋",
  "彧中":"腹直筋上部/肋軟骨/内肋間筋",
  "兪府":"鎖骨下/大胸筋上部/肋間筋",
  /* 心包経 */
  "天池":"第4肋間/大胸筋/小胸筋",
  "天泉":"上腕二頭筋長頭間溝/上腕筋膜",
  "曲沢":"肘窩横紋/上腕筋/上腕二頭筋腱内側",
  "郄門":"長掌筋腱/橈側手根屈筋腱間",
  "間使":"長掌筋腱/橈側手根屈筋腱間",
  "内関":"長掌筋腱/橈側手根屈筋腱間",
  "大陵":"長掌筋腱/橈側手根屈筋腱",
  "労宮":"手掌中央/虫様筋腱膜/短母指屈筋",
  "中衝":"中指末端中央/伸筋腱/屈筋腱",
  /* 三焦経 */
  "関衝":"薬指末節尺側/伸筋腱/皮膚",
  "液門":"第4-5指間/骨間筋腱膜/短小指伸筋",
  "中渚":"第4中手指節関節近位/骨間筋",
  "陽池":"手関節背側中央/総指伸筋腱",
  "外関":"橈骨尺骨骨間/総指伸筋/小指伸筋",
  "支溝":"橈骨尺骨骨間/総指伸筋",
  "会宗":"橈骨尺骨骨間/総指伸筋/小指伸筋",
  "三陽絡":"橈骨尺骨骨間/総指伸筋/小指伸筋",
  "四瀆":"橈骨尺骨骨間/総指伸筋/小指伸筋",
  "天井":"肘頭上/上腕三頭筋腱",
  "清冷淵":"上腕三頭筋内側頭/外側頭間",
  "消濼":"上腕三頭筋長頭/外側頭間",
  "臑会":"三角筋後部/上腕三頭筋長頭",
  "肩髎":"肩峰後縁/三角筋",
  "天髎":"肩甲骨上角/僧帽筋/肩甲挙筋",
  "天牖":"胸鎖乳突筋後縁/斜角筋",
  "翳風":"乳様突起下/胸鎖乳突筋/顎二腹筋",
  "瘈脈":"乳様突起後/乳突筋付近筋膜",
  "顱息":"乳様突起後上/側頭筋腱膜",
  "角孫":"耳尖付近/側頭筋",
  "耳門":"耳珠上切痕/外側翼突筋腱/咬筋",
  "和髎":"側頭筋/耳介付着部",
  "糸竹空":"眉外端/眼輪筋/側頭筋",
  /* 胆経 */
  "瞳子髎":"眼輪筋/側頭筋前縁",
  "聴会":"耳珠前/外側翼突筋腱/側頭筋",
  "上関":"頬骨弓/側頭筋腱",
  "頷厭":"側頭筋/帽状腱膜",
  "懸顱":"側頭筋/帽状腱膜",
  "懸釐":"側頭筋/帽状腱膜",
  "曲鬢":"側頭筋/帽状腱膜",
  "率谷":"側頭筋/帽状腱膜",
  "天衝":"側頭筋/帽状腱膜",
  "浮白":"乳様突起後上/側頭筋/後頭筋",
  "頭竅陰":"乳様突起後上/側頭筋/後頭筋",
  "完骨":"乳様突起下/胸鎖乳突筋/後頭筋",
  "本神":"前頭筋/帽状腱膜",
  "陽白":"前頭筋/帽状腱膜",
  "頭臨泣":"前頭筋/帽状腱膜",
  "目窓":"前頭筋/帽状腱膜",
  "正営":"前頭筋/帽状腱膜",
  "承霊":"前頭筋/帽状腱膜",
  "脳空":"後頭筋/帽状腱膜",
  "風池":"胸鎖乳突筋/僧帽筋/頭半棘筋",
  "肩井":"僧帽筋/肩甲挙筋",
  "淵腋":"中腋窩線/前鋸筋/広背筋",
  "輒筋":"前鋸筋/肋間筋/広背筋上縁",
  "日月":"第7肋間/前鋸筋/腹直筋外鞘",
  "京門":"第12肋骨端/腹横筋/広背筋",
  "帯脈":"外腹斜筋/腹横筋/広背筋腱膜",
  "五枢":"腸骨稜前/腹斜筋/大腿筋膜張筋上縁",
  "維道":"腸骨棘付近/腹斜筋/大腿筋膜張筋",
  "居髎":"大殿筋/中殿筋/小殿筋",
  "環跳":"中殿筋/小殿筋/大殿筋外縁",
  "風市":"腸脛靱帯後/大腿筋膜張筋/外側広筋",
  "中瀆":"腸脛靱帯後/外側広筋",
  "膝陽関":"大腿二頭筋腱/外側広筋/膝関節外側裂隙",
  "陽陵泉":"腓骨頭前下/長腓骨筋/総腓骨神経域",
  "陽交":"長腓骨筋/短腓骨筋/腓骨後縁",
  "外丘":"長腓骨筋/短腓骨筋/腓骨前縁",
  "光明":"長腓骨筋/短腓骨筋",
  "陽輔":"長腓骨筋/短腓骨筋",
  "懸鍾":"長腓骨筋/短腓骨筋/骨間膜",
  "丘墟":"短腓骨筋腱/長腓骨筋腱/外果前",
  "足臨泣":"第4-5中足骨間/骨間筋/短趾伸筋",
  "地五会":"第4-5中足骨間/骨間筋",
  "侠渓":"第4-5趾間/骨間筋/短趾屈筋腱",
  "足竅陰":"第4趾末節外側/趾伸筋腱/皮膚",
  /* 肝経 */
  "大敦":"第1趾末節外側/趾伸筋腱",
  "行間":"第1-2趾間/骨間筋",
  "太衝":"第1-2中足骨間/骨間筋/背側骨間動静脈",
  "中封":"足関節前内側/前脛骨筋腱/長趾伸筋腱",
  "蠡溝":"脛骨内側面/長趾屈筋/ヒラメ筋",
  "中都":"脛骨内側面/長趾屈筋/ヒラメ筋",
  "膝関":"脛骨内側顆下/縫工筋/薄筋",
  "曲泉":"半腱様筋腱/半膜様筋腱",
  "陰包":"薄筋/縫工筋/長内転筋",
  "足五里":"長内転筋/薄筋/腸腰筋",
  "陰廉":"長内転筋/薄筋",
  "急脈":"鼡径靱帯下/腸腰筋/長内転筋",
  "章門":"第11肋骨端/腹横筋/腹斜筋",
  "期門":"第6肋間/腹直筋/外腹斜筋/前鋸筋"
};

/* ==== 状態 & DOM ==== */
let ACUPOINTS = [];
let DATA_READY = false;

const inputEl = document.getElementById('acupoint-search-input');
const suggestionListEl = document.getElementById('acupoint-suggestion-list');
const searchBtn = document.getElementById('search-btn');
const statusEl = document.getElementById('data-load-status');
const symptomSelect = document.getElementById('symptom-select');

const inlineAcupointResult = document.getElementById('inline-acupoint-result');
const inlineSymptomResult  = document.getElementById('inline-symptom-result');

const resultNameEl      = document.getElementById('result-name');
const resultMeridianEl  = document.getElementById('result-meridian');
const resultRegionEl    = document.getElementById('result-region');
const resultImportantEl = document.getElementById('result-important');
const resultMuscleEl    = document.getElementById('result-muscle');
const relatedSymptomsEl = document.getElementById('related-symptoms');

const symptomResultTitleEl   = document.getElementById('symptom-result-title');
const symptomAcupointsListEl = document.getElementById('symptom-acupoints-list');

/* 症状デモ */
const SYMPTOMS = {
  symptom_demo1: { label: 'デモ症状: 頭痛',   related: ['百会','風府','霊台'] },
  symptom_demo2: { label: 'デモ症状: 首肩こり', related: ['風府','強間','肩井'] }
};

/* ==== ユーティリティ ==== */
function normalizeNFC(s){ return s ? s.normalize('NFC') : ''; }
function removeAllUnicodeSpaces(str){
  return normalizeNFC(str||'')
    .replace(/[\u0000-\u001F\u007F]/g,'')
    .replace(/[ \u00A0\u1680\u2000-\u200B\u202F\u205F\u3000]/g,'')
    .replace(/\uFEFF/g,'');
}
function trimOuter(s){ return (s||'').trim(); }
function isHiraganaOnly(s){ return !!s && /^[\u3041-\u3096]+$/.test(s); }
function applyRedMarkup(text){
  if(!text) return '';
  return text.replace(/\[\[(.+?)\]\]/g,'<span class="bui-red">$1</span>');
}

/* ==== CSV パース ==== */
function parseCSV(text){
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

/* ==== 検索 ==== */
function filterPoints(qInput){
  const q = removeAllUnicodeSpaces(qInput);
  if(q.length < MIN_QUERY_LENGTH) return [];
  if(isHiraganaOnly(q)){
    let list = ACUPOINTS.filter(p => p.reading && p.reading.startsWith(q));
    if(!list.length) list = ACUPOINTS.filter(p => p.reading && p.reading.includes(q));
    return list.map(p=>({...p,_matchType:'name'}));
  }
  const nameMatches = [];
  const seen = new Set();
  for(const p of ACUPOINTS){
    if(p.name.includes(q)){
      nameMatches.push({...p,_matchType:'name'});
      seen.add(p.id);
    }
  }
  const muscleMatches = [];
  for(const p of ACUPOINTS){
    if(!p.muscle) continue;
    if(seen.has(p.id)) continue;
    if(p.muscle.includes(q)){
      muscleMatches.push({...p,_matchType:'muscle'});
    }
  }
  return nameMatches.concat(muscleMatches);
}

/* ==== サジェスト ==== */
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
    if(p._matchType) li.dataset.matchType = p._matchType;
    const badge = p._matchType === 'muscle'
      ? '<span class="match-badge" title="筋肉名でヒット">M</span>' : '';
    li.innerHTML = `<span>${p.name}</span><span class="kana">${p.reading||''}</span>${badge}`;
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
    e.preventDefault(); current = (current+1)%items.length; setActive(items,current);
  } else if(e.key==='ArrowUp'){
    e.preventDefault(); current = (current-1+items.length)%items.length; setActive(items,current);
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

/* ==== 表示 ==== */
function showPointDetail(p){
  inlineSymptomResult.classList.add('hidden');
  resultNameEl.textContent      = `${p.name}${p.reading?` (${p.reading})`:''}`;
  resultMeridianEl.textContent  = p.meridian || '（経絡未登録）';
  resultRegionEl.innerHTML      = p.region || '（部位未登録）';
  resultImportantEl.textContent = p.important || '（要穴未登録）';
  resultMuscleEl.textContent    = p.muscle || '（筋肉未登録）';
  relatedSymptomsEl.innerHTML   = '<li>（関連症状未登録）</li>';
  inlineAcupointResult.classList.remove('hidden');
  inlineAcupointResult.scrollIntoView({behavior:'smooth',block:'start'});
}
function selectPoint(p){
  clearSuggestions();
  inputEl.value = p.name;
  showPointDetail(p);
}

/* ==== 症状 ==== */
symptomSelect.addEventListener('change',()=>{
  if(!symptomSelect.value) return;
  renderSymptom(symptomSelect.value);
});
function renderSymptom(id){
  const sym = SYMPTOMS[id];
  if(!sym) return;
  inlineAcupointResult.classList.add('hidden');
  symptomResultTitleEl.textContent = sym.label;
  symptomAcupointsListEl.innerHTML = '';
  if(!sym.related.length){
    symptomAcupointsListEl.innerHTML = '<li>関連経穴なし</li>';
  } else {
    sym.related.forEach(name=>{
      const p = ACUPOINTS.find(pt=>pt.name===name);
      if(!p) return;
      const li = document.createElement('li');
      const a  = document.createElement('a');
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
  inlineSymptomResult.classList.remove('hidden');
  inlineSymptomResult.scrollIntoView({behavior:'smooth',block:'start'});
}

/* ==== 検索トリガ ==== */
function runSearch(){
  if(!DATA_READY) return;
  const q = removeAllUnicodeSpaces(inputEl.value);
  if(!q){ clearSuggestions(); return; }
  const exact = ACUPOINTS.find(p=>p.name===q);
  if(exact){ selectPoint(exact); return; }
  const list = filterPoints(q);
  if(list.length===1){
    selectPoint(list[0]);
  } else {
    renderSuggestions(list);
  }
}

/* ==== 入力イベント ==== */
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

/* ==== 外側クリック ==== */
document.addEventListener('click',e=>{
  if(!e.target.closest('.suggestion-wrapper') &&
     !e.target.closest('#acupoint-search-input')){
    clearSuggestions();
  }
});

/* ==== CSV 読込 ==== */
async function loadCSV(){
  try{
    statusEl.textContent = 'CSV 読み込み中...';
    const res = await fetch(`${CSV_PATH}?v=${APP_VERSION}&_=${Date.now()}`);
    if(!res.ok) throw new Error('HTTP ' + res.status);
    const text = await res.text();
    let parsed = parseCSV(text);
    const nameCount = {};
    parsed = parsed.map(p=>{
      nameCount[p.name] = (nameCount[p.name]||0)+1;
      return {...p, id: nameCount[p.name]>1 ? `${p.name}__${nameCount[p.name]}` : p.name};
    });
    ACUPOINTS = parsed;
    DATA_READY = true;

    const byMeridian = {};
    for(const p of ACUPOINTS){
      byMeridian[p.meridian] = (byMeridian[p.meridian]||0)+1;
    }
    const total = ACUPOINTS.length;
    const okMark = total === EXPECTED_TOTAL ? '（正常）' : `（想定:${EXPECTED_TOTAL}）`;
    const missingRead   = ACUPOINTS.filter(p=>!p.reading).length;
    const missingMuscle = ACUPOINTS.filter(p=>!p.muscle).length;
    statusEl.textContent =
      `CSV 読み込み完了: ${total}件 ${okMark}` +
      `${missingRead?` / 読み欠:${missingRead}`:''}` +
      `${missingMuscle?` / 筋肉未:${missingMuscle}`:''}`;
    statusEl.title = Object.entries(byMeridian).map(([m,c])=>`${m}:${c}`).join(' / ');

    window._debugAcu = () => ({
      total,
      byMeridian,
      missingReadings: ACUPOINTS.filter(p=>!p.reading).map(p=>p.name),
      missingMuscles: ACUPOINTS.filter(p=>!p.muscle).map(p=>p.name),
      sample: ACUPOINTS.slice(0,8).map(p=>[p.name,p.reading,p.muscle])
    });
    console.log('[ACUPOINTS]', window._debugAcu());
  }catch(err){
    console.error(err);
    statusEl.textContent = 'CSV 読み込み失敗: ' + err.message;
  }
}

/* ==== 初期化 ==== */
(function init(){
  loadCSV();
  injectBadgeCSS();
})();

/* ==== バッジCSS ==== */
function injectBadgeCSS(){
  const css = `
  #acupoint-suggestion-list li .match-badge{
    display:inline-block;
    margin-left:6px;
    padding:2px 4px 3px;
    font-size:.55rem;
    font-weight:600;
    line-height:1;
    background:#6f42c1;
    color:#fff;
    border-radius:4px;
    letter-spacing:.05em;
  }
  #acupoint-suggestion-list li.active .match-badge{
    background:#fff;
    color:#6f42c1;
  }`;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);
}
