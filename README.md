# 翻牌遊戲：純靜態網站版 v1.2.4

獨立網站專案，依 `HAND-OFF_純靜態網站版.txt` 的產品需求實作。原 Windows 桌面版、活動資料與發行包不需修改。

網站名稱為「翻牌遊戲」，正式網域為 https://wwwne1198.party/，集中設定於 `site.config.mjs`。交付包含原始碼、靜態成果及 GitHub Pages 部署流程；取得後仍需自行提交與推送，廣告預設關閉。

首次按「開始遊戲」會先準備音效：在點擊時啟動無聲暖機，等待翻牌音檔解碼完成才開始記憶預覽或遊戲。準備期間按鈕顯示「準備遊戲…」；關閉音效時直接開始。音檔下載及音訊準備設有 4 秒等待上限，避免網路或瀏覽器音訊阻擋造成無法開始。

## 返回遊戲按鈕（v1.2.4）

隱私權政策頁底部的「返回遊戲」改用網站既有的圓角邊框按鈕，淺綠框線與淡色底，四語共用；目的網址與翻譯保持原設定。

## 隱私權政策與說明（v1.2.3）

使用說明的 Ctrl+Z 改為「撤銷上一步修改」；文字輸入框只復原文字輸入，不把復原描述為重設全部設定。三種外文同步更新。

新增 `/privacy/`、`/en/privacy/`、`/ja/privacy/`、`/ko/privacy/`，所有頁面（含 404）頁尾提供相應語言的普通 HTML 連結。政策依既有功能說明 localStorage／IndexedDB、預設成績保存、圖片壓縮、雲端分享代碼與 30 天失效／分批刪除、管理憑證、GA4／Cookie、Cloudflare 驗證與限流、GitHub Pages、資料管理與聯絡方式。日期為 2026-10-09。

政策頁提供完整四語正文、獨立標題／摘要、canonical、hreflang／x-default、OG／Twitter 及 WebPage 結構化資料；分享圖片沿用相應語言首頁海報。政策正文不放遊戲示意圖，因此不宣告遊戲主要圖片或圖片 sitemap。正式 sitemap 共 16 頁，其中 12 個遊戲相關頁保留原圖片標記。

沿用現有 GA4 與 Cloudflare 行為；本次新增政策頁，未新增 Cookie 同意介面或變更統計啟動條件，也未啟用廣告。供應商政策及 GA4 帳戶設定的資料期限不以網站自己的 30 天雲端期限代替。正式發布前如變更追蹤或廣告服務，應同步更新揭露及適用的同意管理。這次不用重新部署 Worker 或更動 D1／R2。

## 多國語言（v1.2.0）

支援繁體中文、English、日本語、한국어。一般網址從站外進站時，優先使用 `memory-game-language` 保存的手動選擇，否則依 `navigator.languages`／`navigator.language` 的支援語言順序判斷；未支援語言回退英文，缺少語言資料保留繁中。`zh` 各地區變體均使用繁體中文。頁首語言選單會切到同一頁面，確認後才保存偏好；選取目前語言也能保存，且不重新載入遊戲。

英文、日文、韓文專用網址保留指定語言，不受保存偏好覆蓋；內部導覽、404 與已知搜尋／分享爬蟲不自動轉址。查詢參數與錨點會保留。儲存被拒絕時仍可切換，手動繁中使用 `?lang=zh-Hant` 避免又轉回外文。一般網址也接受明確的 `lang=zh-Hant`／`en`／`ja`／`ko` 參數，但 canonical 保持乾淨的語言網址。沒有 IP 判斷或新增雲端 API 呼叫。

| 語言 | 首頁 | 遊戲 | 教學 | 隱私權政策 |
| --- | --- | --- | --- | --- |
| 繁體中文 | `/` | `/games/memory/` | `/help/` | `/privacy/` |
| English | `/en/` | `/en/games/memory/` | `/en/help/` | `/en/privacy/` |
| 日本語 | `/ja/` | `/ja/games/memory/` | `/ja/help/` | `/ja/privacy/` |
| 한국어 | `/ko/` | `/ko/games/memory/` | `/ko/help/` | `/ko/privacy/` |

遊戲、五個設定分頁、圖片調整、成績／CSV、雲端訊息、全螢幕提醒與內建圖案名稱均會依目前網址語言顯示。瀏覽器自身的檔案挑選器等介面仍由瀏覽器語言決定。

各語言共用原有 localStorage／IndexedDB。自行輸入的暱稱、圖案名稱、標題及活動名稱不會被翻譯或覆寫；預設文案只在顯示時翻譯，規則 ID 與雲端設定格式不變。切換語言會重新載入頁面；進行中的遊戲或已有本次排名會先提醒。已保存設定、圖片及歷史成績會保留，當局進度與本次排行榜會清空。

建置會產生 16 個可索引的完整靜態 HTML 頁面，包含本地化 title、description、OG／Twitter、JSON-LD、各語言自己的 canonical、雙向 hreflang 與 x-default，並納入同一個 sitemap。CSS／JS／favicon 仍使用部署根路徑，避免語言子目錄導致資源 404。每種語言均有 404 頁；GitHub Pages 的未知網址使用根目錄 404，並提供四種語言的首頁入口。

翻譯集中於 `public/js/locales/messages.js`，繁體中文原文為鍵值。`t()` 翻譯固定文字，`msg`／`html` 標記模板先翻譯固定片段再代入值，避免翻譯使用者資料。更新文案時同步補齊三種翻譯並執行測試。分享圖 PNG 與 SVG 原稿已隨附，正常建置不需圖片工具或額外 npm 套件。

這次不需新增 Cloudflare 資源、改 D1／R2 或重新設定金鑰。既有 Worker 的中文錯誤由前端對照翻譯，Turnstile 使用當前網站語言。GA4 延用原測量 ID；正式四語頁面都有追蹤，預覽不送出流量。

## 快速開始

本機開發／預覽需要 Node.js 22.13 或以上。前端預覽沒有第三方套件相依，**不需要安裝 npm 套件**；Cloudflare 部署工具另在 `cloudflare/` 安裝。`package.json` 和 `package-lock.json` 保留標準專案資訊；若使用 npm，也可執行 `npm ci`。

Windows 可雙擊 `開始預覽.cmd`，保持該視窗開啟，再開啟：

`http://127.0.0.1:4173/games/memory/`

亦可在此資料夾執行：

```powershell
node scripts/serve.mjs
```

停止預覽：在命令視窗按 Ctrl+C。若 4173 已被占用，可改用：

```powershell
$env:PORT = '4175'
node scripts/serve.mjs
```

請以終端顯示的網址開啟。不以雙擊 HTML 的 `file://` 方式使用。

## 建置、檢查與普通靜態伺服器

```powershell
node --test tests/*.test.mjs cloudflare/tests/*.test.mjs
node scripts/build.mjs
node scripts/check.mjs
```

建置只輸出 HTML、CSS、JavaScript、SVG、PNG 與 WAV 至 `dist/`。`scripts/serve.mjs` 啟動前自動建置；它只是本機靜態預覽伺服器，沒有遊戲 API。修改原始碼後執行 `node scripts/build.mjs --preview`，再重新整理已開啟的頁面。

前端仍以 `dist/` 部署到 GitHub Pages。本機遊戲與圖片設定可獨立使用；跨裝置代碼功能另外需要 Cloudflare Workers、D1、R2 與 Turnstile。請先完成 [Cloudflare 部署與流量管控.md](Cloudflare%20部署與流量管控.md)。例如已有 Python 的環境可用普通靜態伺服器驗證：

```powershell
python -m http.server 4174 --bind 127.0.0.1 --directory dist
```

打開 `http://127.0.0.1:4174/games/memory/`。預覽與正式託管須讓目錄中的 `index.html` 可直接提供；錯誤頁可指定 `404.html`。

## 網站內容

- `/`：首頁，只介紹已完成的翻牌遊戲。
- `/games/memory/`：可操作遊戲、設定、本次排行榜、成績紀錄。
- `/help/`：使用說明。
- 頁尾提供「問題或建議，歡迎來信」與聯絡信箱連結。
- `/404.html`：靜態錯誤頁。

手機、平板與桌面共用遊戲規則。全螢幕的背景依標題與牌面內容決定高度，不拉伸出額外背景；卡牌較多時可捲動查看全部內容。卡牌支援鍵盤，設定及紀錄使用原生對話框管理焦點，減少動態效果模式會關閉翻牌動畫。

## 遊戲與保存邊界

預設 6 對／12 張、不限時、限時初值 90 秒、記憶預覽 3 秒、失敗停留 850 毫秒。開局洗牌；每種圖案成一對。計時取 `performance.now()` 差值，預覽與暫停不計時。背景分頁自動暫停，回來必須明確繼續。時限到達優先於最後一張翻牌。

**排行榜僅本次開啟**，只存在頁面 JavaScript 記憶體，不寫入 localStorage 或 sessionStorage。重新開始、設定與全螢幕保留；重新整理、離開遊戲頁、關閉、瀏覽器返回快取還原都不載入舊排名。各分頁獨立。只有過關成績排名，依整數毫秒、翻牌次數、完成時間排序，完全相同則保持加入順序。

分組使用完整、固定排序、帶版本的規則 JSON 作識別碼，不截斷、不假設與桌面版雜湊相容。包含卡牌數量、限時、預覽、失敗停留、卡牌比例／欄數、圖案名稱提示、正面底色及啟用圖庫 ID、版本、各圖案構圖。背景、LOGO、標題、活動名稱及成功提示色不拆分組別。選單顯示可讀規則，若有多種設定另附設定序號。完整組別識別碼會匯出至 CSV。

設定以 `slow-play-settings` 保存至此瀏覽器 localStorage，有 v1 包裝格式及 v0 直接設定物件遷移。只接受已定義欄位、內建素材 ID、自訂圖片 SHA-256 與圖案名稱；圖片二進位存於 IndexedDB，未知素材安全回退，較新版本不覆寫。

成績紀錄預設開啟，可與排行榜獨立開關。首次使用及恢復預設均開啟；已有明確關閉的設定保持關閉。完成遊戲後以 `slow-play-records` 保存，最多 500 筆。只有使用者選取欄位寫入 `values`，必要識別碼與當時規則另外保存；排行榜不增加持久保存欄位。關閉保存不刪舊紀錄，恢復設定預設也不刪成績。歷史明細不計算總排行。

資料損壞、容量不足或存取被阻擋會顯示提示，遊戲仍可玩。損壞／未知版本的成績資料不自動覆寫；本次新成績保留在頁面內，可先匯出。清除網站資料、無痕模式結束、更換網域或瀏覽器可能影響保存內容。

CSV 具有 UTF-8 BOM、CRLF、引號跳脫與公式注入防護，固定包含成績識別碼、完整組別識別碼、是否限時、限時時長。挑戰用時為「12 秒 345 毫秒」，另附原始毫秒；未知欄位顯示未記錄。不含取消保存的欄位。成功只顯示文字提示，無額外音效。

## 設定與內建素材維護

設定有玩法、卡牌與圖庫、畫面、成績、雲端代碼五個分頁。圖庫使用勾選選取圖案，沒有每張圖案的啟用狀態恢復按鈕；其他設定欄位、每個分頁及全部設定可恢復預設。草稿與套用設定分離，支援復原、重做、Ctrl+Z／Cmd+Z；恢復預設、復原及重做會直接更新欄位，保留目前區塊的展開狀態、選中的圖案與焦點，避免表單重建造成跳動；文字框保留原生文字復原。一段滑桿操作合併為一步。儲存並套用後面板保持開啟，遊戲回到準備畫面。關閉未套用草稿會詢問是否捨棄。

`public/js/stage.js` 同時繪製主畫面及畫面預覽；整體預覽保留主畫面寬度、欄數及樣式後等比例縮放，另有卡牌細節、正面／卡背／配對成功檢視；調整卡背或圖案時自動顯示相應效果。選中的圖案即使未勾選，也能檢視構圖並顯示狀態。手機將預覽固定在設定上方，並可按「放大預覽」。內建「柔色波浪」使用薄荷綠與淡杏色的大片漸層曲線，切換「不顯示背景圖片」即可比較效果。圖片可完整顯示／填滿裁切／拉伸，並調整縮放、水平／垂直位置、透明度、旋轉和四側裁切。LOGO 畫布寬、高與畫布內圖案縮放獨立。

圖庫清單：`public/js/core.js` 中的 `PRODUCTS`、`ASSETS`；預設設定與欄位定義也集中在此。素材放在 `public/assets/`。內建素材隨建置提供。使用者可選擇本機 PNG、JPG、WebP 替換卡背、12 個圖案、背景或 LOGO，再調整構圖。自訂圖片壓縮後保存在 IndexedDB；只有產生代碼才傳到雲端。不接受外部圖片 URL、SVG、動畫或相機輸入。

站方更換素材時：

1. 修改自有素材檔案，更新清單中的穩定 ID／版本；有影響辨識難度的圖案更新需提高產品版本。
2. 若移除 ID，舊設定會回退至預設內建素材；不保存絕對路徑或臨時網址。
3. 更新 `素材來源.md`，執行測試及建置，再依選定的 GitHub／託管流程發布。

## 網域、SEO 與 GitHub

正式首頁：https://wwwne1198.party/

遊戲：https://wwwne1198.party/games/memory/

說明：https://wwwne1198.party/help/

`site.config.mjs` 預設正式 origin 為 `https://wwwne1198.party`、basePath 為 `/`。CSS、JavaScript、圖片、導覽、canonical、OG 與 sitemap 都由此產生。Pages 工作流程不再把歷史專案子目錄帶入自訂網域的成品。仍可明確以 `SITE_ORIGIN`、`SITE_BASE_PATH` 覆寫，但目前網域不需要這些環境變數。

各頁以「可上傳圖片／照片、自訂記憶配對卡牌」作主題，直接輸出獨立 title、description、H1、OG 與 Twitter 大圖摘要，並有 WebSite／WebPage／ImageObject 結構化資料；遊戲頁另有 WebApplication。分享圖為 1200×630 PNG，設計原稿在 `design/social/`。沒有虛構評分或評論。首頁與說明提供靜態玩法內容、常見問題與內部連結。

正式建置包含 sitemap、robots、CNAME 與 .nojekyll；404 不索引，舊 `/memory-card-game/` 的三個對應頁面立即轉址到新版，不列入 sitemap。所有不存在的網址仍應由託管服務回傳 404。

`node scripts/serve.mjs` 會產生本機預覽：無 canonical、無 sitemap、noindex。單獨建置預覽使用 `node scripts/build.mjs --preview`，檢查用 `node scripts/check.mjs --preview`。正式發布使用不帶 --preview 的建置命令。GitHub Actions 每次會重新正式建置，不會使用本機預覽成果。

`.github/workflows/check.yml` 負責 CI；`pages.yml` 在推送 main 後測試、建置、檢查並部署 dist。dist、QA、node_modules、環境變數及個人資料都由 .gitignore 排除。請沿用原專案與 .git，更新時將原始碼覆蓋到原 Git 根目錄，不需重新初始化。

發布步驟、Google Search Console 驗證與 sitemap 提交、各平台分享快取說明，見 [搜尋索引與發布檢查.md](搜尋索引與發布檢查.md)。

## GA4 流量分析

已加入使用者提供的 GA4 評估 ID `G-VXMTJFXBHE`。正式首頁、遊戲頁與使用說明會載入 Google tag，使用 GA4 預設頁面瀏覽及其資料串流設定。沒有另外新增開始遊戲、過關、暱稱或歷史成績的自訂追蹤事件。

`site.config.mjs` 的 `ga4MeasurementId` 集中管理 ID，可用 `GA4_MEASUREMENT_ID` 環境變數覆寫，設為空字串可關閉。本機預覽不輸出 GA4；正式成品即使被拿到 localhost、file:// 或其他網域開啟，也會因 origin 檢查而不載入追蹤。404 與舊網址轉址頁不追蹤，每頁只初始化一次。Google tag 以非同步方式載入，遊戲功能不等待追蹤程式完成。

提交並推送至 main，等待 Pages 部署成功後，使用瀏覽器開啟正式網站並到 GA4「即時」報表確認收集。一般報表處理可能需要 24～48 小時。評估 ID 已設定不代表帳號端已實際收到資料；本次驗證不向正式 GA4 帳號送測試事件。GA4 會將網站瀏覽資訊傳送至 Google，遊戲原有本機保存功能仍由自己的程式處理。

官方說明：[安裝 Google tag](https://developers.google.com/tag-platform/gtagjs)、[驗證 GA4](https://developers.google.com/analytics/devguides/collection/ga4/troubleshoot)。

## Google 廣告預留

`site.config.mjs` 集中控制 `ads.enabled`、`demo`、`publisher`、`slot`、`consentReady`。預設全關，不填虛構 ID、不送出廣告請求。`demo: true` 只在使用說明下方顯示本機版位示意，不載入 Google。廣告不在卡牌操作區，也不在全螢幕遊戲內。

`public/js/site.js` 包含有條件載入閘門與錯誤隱藏處理；遊戲不依賴廣告。此版本沒有完成真實 AdSense 帳號／廣告單元／CMP 整合。`consentReady` 是由站方控制的整合閘門，不是 CMP 或同意管理系統，也不表示獲得使用者同意。正式啟用前需依真實帳號提供的程式碼、適用地區的同意管理、最新政策與 ads.txt 指示處理並補齊相應說明；廣告版位預留不保證審核或收益。

## 模組與驗證

- `public/js/core.js`：規則、狀態機、設定資料、復原、本機保存、排序、CSV。
- `stage.js`：主畫面與預覽共用圖片構圖、卡牌及排版。
- `app.js`：遊戲操作與本次會話排行；重新開始只在記憶預覽、遊戲中與暫停時顯示。
- `audio.js`：提前下載音效、在使用者開局手勢建立並恢復 AudioContext，第一次翻牌等解碼完成再播放；靜音會取消待播放聲音。
- `preview.js`：設定預覽選圖與自動切換牌面的規則。
- `settings.js`、`records.js`：設定草稿及歷史明細。
- `src/layout.html`、`src/pages/`：共用網站外殼與靜態內容。
- `scripts/`：零第三方依賴的建置、預覽與成果檢查。
- `tests/*.test.mjs`：計時邊界、資料保存、排序、CSV、冷啟動音效、預覽與 SEO 網址安全測試。

本次驗證證據及未實測範圍見 `驗收報告.md`。QA 快照、測試下載與截圖存放在忽略的 `qa/`，不混入網站成果或原始碼交付包。

## 自訂圖片與雲端代碼（v1.1.6）

- `public/js/images.js`、`image-input.js`：讀取尺寸、瀏覽器壓縮、移除中繼資料、IndexedDB 與圖片 URL。
- `profile-format.js`：前後端共用的二進位封包、白名單設定、圖片 SHA-256 與容量驗證。
- `cloud.js`：Turnstile、產生／讀取／刪除代碼；數字代碼不加入網址或 GA4 事件。
- `cloudflare/`：Worker、D1 migration、Wrangler 設定與後端測試。此目錄不複製到 dist。

雲端保存不含成績與暱稱。代碼可讀取，不能覆寫原設定；重新保存產生新代碼。管理憑證只存在建立裝置；清除瀏覽器資料後無法手動刪除，仍會依 30 天未使用期限清理。

本機預覽刻意停用正式雲端上傳與 GA4，避免測試消耗正式配額。完整雲端驗收須先部署 Worker、填入 Secret，再以正式網站及第二個獨立瀏覽器操作。

搜尋 favicon 同時宣告固定路徑的 96px PNG 與多尺寸 ICO。搜尋主要圖片為可見於三個內容頁的無文字卡牌示意圖（1200×900 PNG），加入 primaryImageOfPage 及圖片 sitemap；社群分享保留原本各頁的 1200×630 海報。發布後需等待 Google 重新抓取，無法由程式保證搜尋結果必定顯示縮圖。詳見《搜尋索引與發布檢查.md》。

設定按鈕沿用開始遊戲的綠底白字樣式。全螢幕／放大遊戲檢視進入時，在上方中央、Chrome 預設原生 Esc 提醒下方浮動顯示「CTRL+滾輪可以調整畫面大小」。提示使用接近原生提醒的 #282c32 深灰底、白字、圓角與 CTRL 鍵框，350ms 淡入、進入後約 3.8 秒開始 700ms 淡出、4.5 秒後清除；退出或離開頁面會取消。提示不增加預留空間、不改變原間距或牌面位置，也不攔截點擊及 Ctrl+滾輪；中央提醒會短暫覆蓋下方內容。時序依 [Chromium 預設停留](https://chromium.googlesource.com/chromium/src/+/refs/heads/main/chrome/browser/ui/exclusive_access/exclusive_access_bubble.h)與[動畫](https://chromium.googlesource.com/chromium/src/+/refs/heads/main/chrome/browser/ui/views/exclusive_access/exclusive_access_bubble_views.cc)，外觀參考[原生提醒](https://chromium.googlesource.com/chromium/src/+/refs/heads/main/components/fullscreen_control/subtle_notification_view.cc)及[色彩](https://chromium.googlesource.com/chromium/src/+/refs/heads/main/components/fullscreen_control/color_mixer.cc)。瀏覽器沒有開放原生視窗的顯示、位置或結束事件，因此以下方 108px 與預設時間配合，不能保證不同版本、縮放、平台或互動時完全同步。減少動態效果時不播放淡入淡出動畫。
