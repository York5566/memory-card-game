# 自訂圖片與雲端代碼：Cloudflare 部署

版本：v1.1.0，2026-10-06。前端仍部署 GitHub Pages，只有數字代碼保存、讀取與刪除使用 Worker。

## 已填入你的公開設定

| 資源 | 值 |
| --- | --- |
| 正式網站 | `https://wwwne1198.party` |
| Worker 名稱 | `memory-game-api` |
| API 網址 | `https://memory-game-api.wwwne1198.workers.dev` |
| D1 名稱 | `memory-card-game` |
| D1 Database ID | `bce04f96-bdca-4994-9684-ff766182bef5` |
| R2 bucket | `memory-card-game` |
| Turnstile Site Key | `0x4AAAAAAFO-lRDUAUd9M0PH` |

上述是公開識別資訊，可放 Git；Secret 不可放在原始碼、GitHub 或聊天內容中。

目前交付已完成本機測試與部署打包檢查，**未替你登入 Cloudflare、執行遠端 migration、設定 Secret、部署 Worker 或推送 GitHub**。正式端到端驗收需完成下列步驟。

## 一次性設定與發布順序

1. 在 Cloudflare → Turnstile 確認現有 widget 的 Hostnames 包含 `wwwne1198.party`，模式為 Managed。Site Key 已加入網站；複製相對應的 Secret Key，稍後在終端提示時貼入。預覽不會呼叫正式 Turnstile，不必為此加入 localhost。
2. 在 VS Code 開啟目前 Git 專案根目錄，終端執行：

   ```powershell
   cd cloudflare
   npm ci
   npx wrangler login
   ```

   使用 Node.js 22.13 或以上。在瀏覽器登入你的 Cloudflare 帳號並完成官方授權。若多帳號可選，請使用上述 D1、R2 所在帳號。

3. 初始化 D1 表格（只建立 `mg_` 前綴的新表與索引，不清空既有表）：

   ```powershell
   npx wrangler d1 migrations apply memory-card-game --remote
   ```

4. 設定 Turnstile Secret：

   ```powershell
   npx wrangler secret put TURNSTILE_SECRET
   ```

   出現輸入提示才貼入 Turnstile 的 Secret Key。不要填 Site Key。命令會將 Secret 安全傳送到你的 Worker，不會寫入程式碼。

5. 產生一個獨立的 IP 雜湊密鑰（在自己的終端執行）：

   ```powershell
   node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
   npx wrangler secret put IP_HASH_SECRET
   ```

   將上一行產生的 64 個字元貼入提示。這個密鑰用來把來源 IP 轉成每日更換的雜湊，請勿和 Turnstile Secret 共用。

6. 本機確認後，發布至你既有的 Worker（會取代目前預設範例程式）：

   ```powershell
   npm test
   npm run test:runtime
   npm run check
   npm run deploy
   ```

   `check` 僅打包檢查，不會發布；`deploy` 才會更新正式 Worker。Wrangler 設定會綁定下列資源並加入每小時清理排程：

   | Binding 名稱 | 資源 |
   | --- | --- |
   | `DB` | D1 `memory-card-game` |
   | `IMAGES` | R2 `memory-card-game` |
   | `API_RATE_LIMITER` | 每來源 20 次／60 秒，namespace `1001` |

   namespace 是限流識別號，請勿讓其他不相關 Worker 使用同一號碼。R2 保持私人 bucket，停用 public development URL，不需要另開公開網域或 R2 CORS。所有圖片僅經過 Worker 檢查後讀取。請選 R2 Standard 儲存類別。

7. 回到 Git 專案根目錄，提交並推送這次網站原始碼，等待 Pages Actions 成功：

   ```powershell
   cd ..
   node --test tests/*.test.mjs cloudflare/tests/*.test.mjs
   node scripts/build.mjs
   node scripts/check.mjs
   ```

   `.github/workflows/pages.yml` 只發布前端，不會替你部署 Worker 或設定 Secret。更新後端時，要在 `cloudflare` 再執行 `npm run deploy`。不要把 `cloudflare/` 或 Secret 複製進 `dist/`。

## 正式驗收

1. 在正式遊戲頁選一張無私密資訊的測試圖片、調整縮放與名稱，進入「雲端代碼」，產生代碼。
2. 用另一台裝置，或另一個獨立瀏覽器，開啟同一正式網站，輸入 12 位數字；確認圖片、名稱、構圖與玩法出現在草稿，再儲存並套用。
3. 重新整理，確認圖片仍存在；開始遊戲確認自訂圖案成對。網路面板不應每翻一張牌就向 Worker/R2 發送請求。
4. 在原建立瀏覽器刪除這份測試雲端檔，再用代碼讀取應顯示找不到。已下載的本機副本會保留。
5. 查看 Cloudflare Workers 指標是否有 CPU 超限或錯誤、D1 查詢量、R2 用量，以及 Scheduled Events。實際平台 CPU 與真實 Turnstile 需部署後確認；本機 workerd 驗收不能替代真實網路環境。

## 目前套用的用量限制

| 項目 | 程式限制 |
| --- | --- |
| 原始選圖 | PNG／JPG／WebP，最多 10 MiB、4,000 萬像素、單邊 20,000 像素 |
| 壓縮後單圖 | 256 KiB，背景最長邊 1536px，其餘 1024px |
| 每份設定 | 最多 15 張不同圖片、4 MiB；同份重複使用相同圖只存一次 |
| 全站已預留容量 | 512 MiB、1000 份設定；含上傳中與待刪除資料 |
| 全站每日 | 100 次保存、2000 次讀取、1000 次刪除；另有 6000 次 API 嘗試上限 |
| 每來源網路每日 | 5 次保存、60 次讀取、30 次刪除 |
| 突發操作 | 每來源每 60 秒 20 次（Cloudflare 節點內限流；每日 D1 限额另行精確計數） |
| 保存期限 | 最後一次有效代碼讀取起 30 天；到期立即無法讀取 |
| 清理 | 每小時第 17 分，最多處理 10 份；積壓分批處理，未刪除前仍佔配額 |

每日以 UTC 午夜重置，即台灣時間上午 8 點。失敗與重試可能消耗操作次數，避免惡意重複驗證或猜碼。多人共用公司／學校網路可能共用來源配額。上傳前在裝置壓縮；遊戲中不查 D1、不讀 R2，不自動同步，也不輪詢服務。

圖片與設定合併為一個二進位封包，每次保存至多一次 R2 Put；每次讀取至多一次 Get。D1 先原子預留容量，再寫 R2；失敗時只在確認 R2 已刪除後釋放配額。若刪除失敗，排程會重試，避免孤立圖片造成未計入的空間。重試同一保存請求不重複寫入圖片。

以上配額是**這個服務自行使用的上限**，不代表 Cloudflare 整個帳號的零帳單保證。請勿在同一 bucket 額外手動放檔，否則那些檔案不在此程式計數內；其他 Worker／D1／R2 使用量也須合併觀察。被拒絕的請求仍可能算 Worker 請求，極端流量下 Free 方案可能暫停 API，靜態遊戲仍可用。

查核基準（2026-10-06）：[Workers 限制](https://developers.cloudflare.com/workers/platform/limits/)列 Free 每日 100,000 請求、每請求 10ms CPU；[D1 免費用量](https://developers.cloudflare.com/d1/platform/pricing/)列每日 500 萬列讀取、10 萬列寫入、5GB 儲存；[R2 Standard 免費用量](https://developers.cloudflare.com/r2/pricing/)列 10GB-month、每月 100 萬 Class A／1000 萬 Class B、網路輸出免計費。平台規則可能改動，發布時以帳號方案與官方頁面為準。

## 資料與安全邊界

- 代碼是隨機 12 位數字，可能以 0 開頭；每次保存建立不可覆寫的新設定。知道代碼的人能讀取，因此不是私人保險箱。
- 刪除另需 256-bit 管理憑證，只保存在原瀏覽器；D1 保存其 SHA-256。其他装置讀取代碼不會取得刪除權限。
- Turnstile 由伺服器核對 success、hostname、action。缺少 Secret、限流 binding 或服務停用時拒絕雲端操作，沒有正式環境驗證繞過開關。
- 圖片轉為靜態 WebP、移除 ICCP／EXIF／XMP；伺服器驗證尺寸、區塊、SHA-256、檔案數量及大小，下載端再實際解碼，避免破圖直接套用。拒絕 SVG、任意 URL 與動畫封包。原始選取動態 WebP 只取第一幀。
- D1 不存圖片；R2 不對外公開。API 不提供列出代碼或任意檔案路徑的功能。讀取代碼放在 POST 內容，不加入分享網址、搜尋索引或 GA4 自訂事件。
- 僅設定和圖片上雲；暱稱、成績資料列、排行榜留在裝置。構圖、圖案名稱、標題與活動文字是設定的一部分，會包含在設定檔內。
- 每日 IP HMAC 識別只用於限流，短期計數器分批清理。Cloudflare 基礎設施本身仍會處理請求資訊。程式未啟用 Worker 日誌、未記錄圖片、代碼或憑證。

## 排錯與暫停服務

- 產生代碼失敗：確認先部署 Worker、migration 成功、兩個 Secret 均存在、Turnstile domain 與 Site Key 配對正確。Worker 根網址不是測試介面，`GET /` 會被拒絕。
- 驗證失敗：在正式 `wwwne1198.party` 使用，確認內容阻擋程式未阻擋 `challenges.cloudflare.com`。不要把測試 Secret 用在正式 Worker。
- 429：每分钟或每日配額已滿；等候一分鐘或下一個 UTC 日。507：容量已滿；刪除自己先前的雲端檔或等待清理。
- 保存中斷：保持目前草稿，重新按產生代碼；程式保留重試識別和憑證，已成功的寫入會回傳同一代碼。
- 臨時暫停：在 `cloudflare/wrangler.jsonc` 把 `API_ENABLED` 改為 `"false"` 並部署。現有本機設定和靜態遊戲仍運行。恢復後改回 `"true"`。排程仍會執行到期清理。
- 需要調整限額：修改 `cloudflare/worker.js` 的 `QUOTA`；同時更新 UI 與本文件數字。提高前先確認帳號整體用量，不需修改 Cloudflare 方案。
