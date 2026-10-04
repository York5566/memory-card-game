# 翻牌遊戲：純靜態網站版 v1.0.5

獨立網站專案，依 `HAND-OFF_純靜態網站版.txt` 的產品需求實作。原 Windows 桌面版、活動資料與發行包不需修改。

網站暫用站名為「翻牌遊戲」，可在 `site.config.mjs` 更換。交付包含原始碼、靜態成果及 GitHub Pages 部署流程；取得後仍需自行提交與推送，廣告預設關閉。

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
node --test tests/*.test.mjs
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
- `/help/`：使用說明。
- 頁尾提供「問題或建議，歡迎來信」與聯絡信箱連結。
- `/404.html`：靜態錯誤頁。

手機、平板與桌面共用遊戲規則。全螢幕的背景依標題與牌面內容決定高度，不拉伸出額外背景；卡牌較多時可捲動查看全部內容。卡牌支援鍵盤，設定及紀錄使用原生對話框管理焦點，減少動態效果模式會關閉翻牌動畫。

## 遊戲與保存邊界

預設 6 對／12 張、不限時、限時初值 90 秒、記憶預覽 3 秒、失敗停留 850 毫秒。開局洗牌；每種圖案成一對。計時取 `performance.now()` 差值，預覽與暫停不計時。背景分頁自動暫停，回來必須明確繼續。時限到達優先於最後一張翻牌。

**排行榜僅本次開啟**，只存在頁面 JavaScript 記憶體，不寫入 localStorage 或 sessionStorage。重新開始、設定與全螢幕保留；重新整理、離開遊戲頁、關閉、瀏覽器返回快取還原都不載入舊排名。各分頁獨立。只有過關成績排名，依整數毫秒、翻牌次數、完成時間排序，完全相同則保持加入順序。

分組使用完整、固定排序、帶版本的規則 JSON 作識別碼，不截斷、不假設與桌面版雜湊相容。包含卡牌數量、限時、預覽、失敗停留、卡牌比例／欄數、圖案名稱提示、正面底色及啟用圖庫 ID、版本、各圖案構圖。背景、LOGO、標題、活動名稱及成功提示色不拆分組別。選單顯示可讀規則，若有多種設定另附設定序號。完整組別識別碼會匯出至 CSV。

設定以 `slow-play-settings` 保存至此瀏覽器 localStorage，有 v1 包裝格式及 v0 直接設定物件遷移。只接受已定義欄位與內建素材 ID；未知素材安全回退，較新版本不覆寫。

成績紀錄預設關閉，可與排行榜獨立開關。開啟後以 `slow-play-records` 保存，最多 500 筆。只有使用者選取欄位寫入 `values`，必要識別碼與當時規則另外保存；排行榜不增加持久保存欄位。關閉保存不刪舊紀錄，恢復設定預設也不刪成績。歷史明細不計算總排行。

資料損壞、容量不足或存取被阻擋會顯示提示，遊戲仍可玩。損壞／未知版本的成績資料不自動覆寫；本次新成績保留在頁面內，可先匯出。清除網站資料、無痕模式結束、更換網域或瀏覽器可能影響保存內容。

CSV 具有 UTF-8 BOM、CRLF、引號跳脫與公式注入防護，固定包含成績識別碼、完整組別識別碼、是否限時、限時時長。挑戰用時為「12 秒 345 毫秒」，另附原始毫秒；未知欄位顯示未記錄。不含取消保存的欄位。成功只顯示文字提示，無額外音效。

## 設定與內建素材維護

設定有玩法、卡牌與圖庫、畫面、成績四個分頁。圖庫使用勾選選取圖案，沒有每張圖案的啟用狀態恢復按鈕；其他設定欄位、每個分頁及全部設定可恢復預設。草稿與套用設定分離，支援復原、重做、Ctrl+Z／Cmd+Z；恢復預設、復原及重做會直接更新欄位，保留目前區塊的展開狀態、選中的圖案與焦點，避免表單重建造成跳動；文字框保留原生文字復原。一段滑桿操作合併為一步。儲存並套用後面板保持開啟，遊戲回到準備畫面。關閉未套用草稿會詢問是否捨棄。

`public/js/stage.js` 同時繪製主畫面及畫面預覽；整體預覽保留主畫面寬度、欄數及樣式後等比例縮放，另有卡牌細節、正面／卡背／配對成功檢視；調整卡背或圖案時自動顯示相應效果。選中的圖案即使未勾選，也能檢視構圖並顯示狀態。手機將預覽固定在設定上方，並可按「放大預覽」。內建「柔色波浪」使用薄荷綠與淡杏色的大片漸層曲線，切換「不顯示背景圖片」即可比較效果。圖片可完整顯示／填滿裁切／拉伸，並調整縮放、水平／垂直位置、透明度、旋轉和四側裁切。LOGO 畫布寬、高與畫布內圖案縮放獨立。

圖庫清單：`public/js/core.js` 中的 `PRODUCTS`、`ASSETS`；預設設定與欄位定義也集中在此。素材放在 `public/assets/`。所有素材隨建置提供，不存在上傳、拖放、貼上圖片、相機或外部圖片網址入口。

站方更換素材時：

1. 修改自有素材檔案，更新清單中的穩定 ID／版本；有影響辨識難度的圖案更新需提高產品版本。
2. 若移除 ID，舊設定會回退至預設內建素材；不保存絕對路徑或臨時網址。
3. 更新 `素材來源.md`，執行測試及建置，再依選定的 GitHub／託管流程發布。

## 網域與 GitHub

`site.config.mjs` 由 `SITE_ORIGIN` 取得正式 HTTPS origin、`SITE_BASE_PATH` 取得網站子目錄。Pages 工作流程會自動提供兩者；一般本機預覽省略正式 origin，避免把 localhost 當成正式網址。

各頁直接輸出獨立 title、description、H1、Open Graph 與 Twitter 摘要；首頁提供實際玩法介紹與內部連結。正式建置另外產生 canonical、WebSite／WebPage／WebApplication JSON-LD、`sitemap.xml` 與 `robots.txt`；404 使用 noindex 且不列入 sitemap。未添加不存在的評分、評論或關鍵字堆砌。

GitHub 專案網站發布後，sitemap 位於 https://york5566.github.io/memory-card-game/sitemap.xml，可在 Google Search Console 提交。注意搜尋引擎只把 origin 根目錄的 `/robots.txt` 視為 robots 規則；專案子目錄中的 robots 檔案不能控制整個 github.io 網域，sitemap 仍可直接提交。是否及何時收錄、排名由搜尋引擎決定。

本機模擬正式建置（測完移除環境變數即可回到根路徑預覽）：

```powershell
$env:SITE_ORIGIN = 'https://york5566.github.io'
$env:SITE_BASE_PATH = '/memory-card-game/'
node scripts/build.mjs
node scripts/check.mjs
```

實作參考：[Google JavaScript SEO](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics)、[canonical](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls)、[sitemap](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap)、[MDN Web Audio](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Best_practices)。

`.gitignore` 排除 QA、建置成果、node_modules、暫存、環境變數及個人資料。原始碼、內建素材、鎖定檔及文件可以進版本控制。`dist/` 不需提交，GitHub Actions 會從原始碼重新產生。

`.github/workflows/check.yml` 提供原始碼測試與建置檢查。`.github/workflows/pages.yml` 會在推送到 `main` 後測試、建置並部署 `dist/`；部署時自動取得 Pages 正式 origin 與子目錄，讓 CSS、JavaScript、圖庫及導覽連結都使用正確路徑。

首次部署：

1. 在 GitHub 儲存庫的 **Settings → Pages → Build and deployment → Source** 選擇 **GitHub Actions**。不要將原始碼根目錄交給預設 Jekyll，否則首頁可能顯示 README。
2. 提交並推送本次的 `site.config.mjs`、`README.md` 及 `.github/workflows/pages.yml`。
3. 到 **Actions** 等待 **Deploy website to GitHub Pages** 顯示成功；若已推送才切換 Source，可選此工作流程並按 **Run workflow**。
4. 首頁為 `https://york5566.github.io/memory-card-game/`，遊戲頁為 `https://york5566.github.io/memory-card-game/games/memory/`。

之後更新玩法或畫面並推送到 `main`，同一流程會自動重新部署。更新到其他版本時，請保留 `pages.yml` 與 `SITE_BASE_PATH` 的設定，避免丟失部署功能。

### 更新既有 GitHub 儲存庫

已經初始化並連上 GitHub 的專案，請沿用原資料夾與原有的 .git：

1. 將本版資料夾裡的檔案與子資料夾複製到原專案根目錄，覆蓋同名檔案（含 .github、site.config.mjs、src、public、scripts、tests 與文件）。本交付不含 .git，不需重新初始化，也不要刪除原專案的 .git。
2. 若自行改過內容，先查看差異再合併；不必复制 dist/，部署流程會重建。
3. 在原專案終端執行 git status，確認只有本次更新檔案；再執行下列指令。

```powershell
git add .
git commit -m "Update website to v1.0.5"
git push
```

4. 到 Actions 等待 Deploy website to GitHub Pages 成功，再檢查遊戲頁。若 Pages 尚未設定，先將 Settings → Pages → Source 改為 GitHub Actions。


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
