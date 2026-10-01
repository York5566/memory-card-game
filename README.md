# 翻牌遊戲：純靜態網站版 v1.0.0

獨立網站專案，依 `HAND-OFF_純靜態網站版.txt` 的產品需求實作。原 Windows 桌面版、活動資料與發行包不需修改。

網站暫用站名為「慢慢玩」，可在 `site.config.mjs` 更換。交付是本機原始碼和靜態成果；沒有建立遠端 GitHub 儲存庫、推送、部署或啟用廣告。

## 快速開始

本機開發／預覽需要 Node.js 22 或以上。網站沒有第三方套件相依，**不需要安裝 npm 套件**。`package.json` 和 `package-lock.json` 保留標準專案資訊；若使用 npm，也可執行 `npm ci`。

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
node --test tests/core.test.mjs
node scripts/build.mjs
node scripts/check.mjs
```

建置只輸出 HTML、CSS、JavaScript、SVG 與 WAV 至 `dist/`。`scripts/serve.mjs` 啟動前自動建置；它只是本機靜態預覽伺服器，沒有遊戲 API。修改原始碼後執行 `node scripts/build.mjs`，再重新整理已開啟的頁面。

正式託管只需提供 `dist/` 內容，無須 Node 或 Python 常駐服務、資料庫、帳號系統或雲端圖片儲存。例如已有 Python 的環境可用普通靜態伺服器驗證：

```powershell
python -m http.server 4174 --bind 127.0.0.1 --directory dist
```

打開 `http://127.0.0.1:4174/games/memory/`。預覽與正式託管須讓目錄中的 `index.html` 可直接提供；錯誤頁可指定 `404.html`。

## 網站內容

- `/`：首頁，只介紹已完成的翻牌遊戲。
- `/games/memory/`：可操作遊戲、設定、本次排行榜、成績紀錄。
- `/help/`、`/about/`、`/privacy/`：使用說明、關於與隱私權。
- `/404.html`：靜態錯誤頁。

手機、平板與桌面共用遊戲規則。卡牌支援鍵盤，設定及紀錄使用原生對話框管理焦點，減少動態效果模式會關閉翻牌動畫。

## 遊戲與保存邊界

預設 6 對／12 張、不限時、限時初值 90 秒、記憶預覽 3 秒、失敗停留 850 毫秒。開局洗牌；每種圖案成一對。計時取 `performance.now()` 差值，預覽與暫停不計時。背景分頁自動暫停，回來必須明確繼續。時限到達優先於最後一張翻牌。

**排行榜僅本次開啟**，只存在頁面 JavaScript 記憶體，不寫入 localStorage 或 sessionStorage。重新開始、設定與全螢幕保留；重新整理、離開遊戲頁、關閉、瀏覽器返回快取還原都不載入舊排名。各分頁獨立。只有過關成績排名，依整數毫秒、翻牌次數、完成時間排序，完全相同則保持加入順序。

分組使用完整、固定排序、帶版本的規則 JSON 作識別碼，不截斷、不假設與桌面版雜湊相容。包含卡牌數量、限時、預覽、失敗停留、卡牌比例／欄數、圖案名稱提示、正面底色及啟用圖庫 ID、版本、各圖案構圖。背景、LOGO、標題、活動名稱及成功提示色不拆分組別。選單顯示可讀規則，若有多種設定另附設定序號。完整組別識別碼會匯出至 CSV。

設定以 `slow-play-settings` 保存至此瀏覽器 localStorage，有 v1 包裝格式及 v0 直接設定物件遷移。只接受已定義欄位與內建素材 ID；未知素材安全回退，較新版本不覆寫。

成績紀錄預設關閉，可與排行榜獨立開關。開啟後以 `slow-play-records` 保存，最多 500 筆。只有使用者選取欄位寫入 `values`，必要識別碼與當時規則另外保存；排行榜不增加持久保存欄位。關閉保存不刪舊紀錄，恢復設定預設也不刪成績。歷史明細不計算總排行。

資料損壞、容量不足或存取被阻擋會顯示提示，遊戲仍可玩。損壞／未知版本的成績資料不自動覆寫；本次新成績保留在頁面內，可先匯出。清除網站資料、無痕模式結束、更換網域或瀏覽器可能影響保存內容。

CSV 具有 UTF-8 BOM、CRLF、引號跳脫與公式注入防護，固定包含成績識別碼、完整組別識別碼、是否限時、限時時長。挑戰用時為「12 秒 345 毫秒」，另附原始毫秒；未知欄位顯示未記錄。不含取消保存的欄位。成功只顯示文字提示，無額外音效。

## 設定與內建素材維護

設定有玩法、卡牌與圖庫、畫面、成績四個分頁。每個可調選項、每個分頁及全部設定可恢復預設。草稿與套用設定分離，支援復原、重做、Ctrl+Z／Cmd+Z；文字框保留原生文字復原。一段滑桿操作合併為一步。儲存並套用後面板保持開啟，遊戲回到準備畫面。關閉未套用草稿會詢問是否捨棄。

`public/js/stage.js` 同時繪製主畫面及畫面預覽；預覽保留主畫面寬度後整體縮小。圖片可完整顯示／填滿裁切／拉伸，並調整縮放、水平／垂直位置、透明度、旋轉和四側裁切。LOGO 畫布寬、高與畫布內圖案縮放獨立。

圖庫清單：`public/js/core.js` 中的 `PRODUCTS`、`ASSETS`；預設設定與欄位定義也集中在此。素材放在 `public/assets/`。所有素材隨建置提供，不存在上傳、拖放、貼上圖片、相機或外部圖片網址入口。

站方更換素材時：

1. 修改自有素材檔案，更新清單中的穩定 ID／版本；有影響辨識難度的圖案更新需提高產品版本。
2. 若移除 ID，舊設定會回退至預設內建素材；不保存絕對路徑或臨時網址。
3. 更新 `素材來源.md`，執行測試及建置，再依選定的 GitHub／託管流程發布。

## 網域與 GitHub

`site.config.mjs` 的 `domain` 預設空字串，因此不產生測試網址的 canonical、sitemap 或 robots。正式網域確定後設為 `https://你的網域`，再建置即會產生正式網址的中繼資料、`sitemap.xml` 和 `robots.txt`。`basePath` 預設 `/`；若選擇 GitHub Pages 的儲存庫子路徑，可改成 `/儲存庫名稱/`。GitHub 版本控制不等於已指定 GitHub Pages。

`.gitignore` 排除 QA、建置成果、node_modules、暫存、環境變數及個人資料。原始碼、內建素材、鎖定檔及文件可以進版本控制。尚未初始化遠端儲存庫或提供帳號憑證。

`.github/workflows/check.yml` 是建置／檢查範本，使用官方 [checkout](https://github.com/actions/checkout)、[setup-node](https://github.com/actions/setup-node) 和 [upload-artifact](https://github.com/actions/upload-artifact)，只上傳建置成果供檢查，不部署。它尚未在遠端 GitHub 執行。

## Google 廣告預留

`site.config.mjs` 集中控制 `ads.enabled`、`demo`、`publisher`、`slot`、`consentReady`。預設全關，不填虛構 ID、不送出廣告請求。`demo: true` 只在使用說明下方顯示本機版位示意，不載入 Google。廣告不在卡牌操作區，也不在全螢幕遊戲內。

`public/js/site.js` 包含有條件載入閘門與錯誤隱藏處理；遊戲不依賴廣告。此版本沒有完成真實 AdSense 帳號／廣告單元／CMP 整合。`consentReady` 是由站方控制的整合閘門，不是 CMP 或同意管理系統，也不表示獲得使用者同意。正式啟用前需依真實帳號提供的程式碼、適用地區的同意管理、最新政策與 ads.txt 指示處理並更新隱私權頁；廣告版位預留不保證審核或收益。

## 模組與驗證

- `public/js/core.js`：規則、狀態機、設定資料、復原、本機保存、排序、CSV。
- `stage.js`：主畫面與預覽共用圖片構圖、卡牌及排版。
- `app.js`：遊戲操作與本次會話排行。
- `settings.js`、`records.js`：設定草稿及歷史明細。
- `src/layout.html`、`src/pages/`：共用網站外殼與靜態內容。
- `scripts/`：零第三方依賴的建置、預覽與成果檢查。
- `tests/core.test.mjs`：有針對性的計時邊界、資料保存、排序與 CSV 測試。

本次驗證證據及未實測範圍見 `驗收報告.md`。QA 快照、測試下載與截圖存放在忽略的 `qa/`，不混入網站成果或原始碼交付包。
