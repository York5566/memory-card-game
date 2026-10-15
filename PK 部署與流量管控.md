# v1.5.1：PK 部署與流量管控

v1.5.1 是前端介面修正；若已部署 v1.5.0 所附 Worker API 1.3.0，只需推送 GitHub，跳到步驟 2 並在專案根目錄執行檢查（不用先 cd ..）。本次不需重新部署 Worker 或執行 migration。

若尚未部署 Worker API 1.3.0，正式網站需要下列「更新 Worker」及「推送 GitHub」兩個步驟。已使用 v1.4.0 的網站也需要更新 Worker（API 1.3.0），才能同步卡牌最後翻牌者與明確離房狀態；只更新前端會缺少顏色標記和離房通知。既有網域、D1、R2、雲端代碼和單人紀錄繼續沿用。

## 1. 先更新 Cloudflare Worker

在 VS Code 開啟這份 Git 專案，終端執行：

```powershell
cd cloudflare
npm ci
npx wrangler login
npm run check
npm run migrate
npm run deploy
```

- 已登入正確的 Cloudflare 帳號，可跳過 login。
- migrate 只套用尚未執行的既有 D1 migration，不清除資料。本版沒有新增 D1 表格。
- deploy 會依 wrangler.jsonc 自動建立 SQLite Durable Object 類別 PKArena 及 PK_ARENA 綁定；不用手動建立資料庫或 R2 bucket。
- 同時加入 PK_RATE_LIMITER（每個 IP 每分鐘 12 次 PK HTTP 操作）；保留原 API_RATE_LIMITER。
- 保留目前 Worker 的 TURNSTILE_SECRET 與 IP_HASH_SECRET。若原雲端代碼已可正常使用，不需重設金鑰。Turnstile 的允許主機仍是 wwwne1198.party，PK 使用 action=pk。
- 如果帳號尚未完成原雲端功能設定，先照「Cloudflare 部署與流量管控.md」處理 Secret。請勿把 Secret 加入 Git。
- 此交付沒有替你登入、部署、執行遠端 migration 或更動帳戶方案。

部署完成後，Worker 網址仍為：
https://memory-game-api.wwwne1198.workers.dev

PK API 要有正確網站 Origin 及驗證／連線憑證，直接在網址列開 API 出現拒絕，不代表部署失敗。請用下述正式網站流程驗收。

## 2. 再推送網站

回到專案根目錄：

```powershell
cd ..
node --test tests/*.test.mjs cloudflare/tests/*.test.mjs
node scripts/build.mjs
node scripts/check.mjs
```

檢查通過後，在 VS Code 的原始檔控制提交並推送。GitHub Pages 繼續透過既有 Actions 發布 dist；不用把 dist 當成新的 Git 專案。不要漏掉 cloudflare、public/js/pk.js、public/js/pk-rules.js、翻譯、文件及預覽啟動檔。

網站網址與 sitemap 不變。新增 PK 說明、遊戲頁四語 title／description／OG／JSON-LD；邀請房間使用 #pk=…，不新增可索引的房間頁，也不將房間加入 sitemap。語言切換保留邀請。

## v1.5.1 前端修正

- 只在成功配對的牌上顯示 A／B 得分者；後端沿用 cardOwners，不顯示未成功配對的操作歷史。
- 邀請建房、等待朋友、加入房間與隨機搜尋分別提示下一步；等待朋友時隱藏空比分列。
- 單人與 PK 共用穩定的牌面尺寸計算，單人全螢幕填滿牌桌；設定預覽同步，四語引導與首頁／教學入口更新。
- API 套件仍為 1.3.0，免費用量上限不變，沒有新增網路請求或雲端儲存。

## v1.5.0 已有行為

- 牌桌中央顯示回合大字、勝負與再戰／離房通知；雙方固定 A 藍色、B 橘色，角標和打勾區別翻牌歷史與配對得分。Worker 廣播 cardOwners 及 rematchClosed，未翻牌內容仍隱藏，重連保留翻牌歷史，再戰重設。
- PK 自動選擇較大的卡牌排版；單人及 PK 均有 60%–200% 縮放，點百分比重設。只改自己的畫面，不更改保存設定，也不發送額外網路請求。移除原 Ctrl＋滾輪提醒。
- 首次流程改為邀請／配對、雙方準備、輪流翻牌，詳細規則可展開。返回單人遊戲加框，移除 PK 重複標題，保留使用者自訂標題與 LOGO。

- PK 準備畫面的「調整設定」共用原設定面板，套用後更新摘要並保存個人設定；不會清空已輸入暱稱。配對、邀請等待與對戰期間鎖定本局設定，要修改需取消／離開。加入他人邀請時使用房主設定。
- 每次入列只抽一次 15,000–30,000 毫秒期限，保存於 Durable Object；重連沿用原期限。舊版本尚未結束的佇列保留原 25 秒期限。
- 結算後 60 秒內可邀請原對手再戰，雙方同意才重新洗牌與抽先手。沿用同一房間、圖片及設定，清零分數／記憶／翻牌狀態；舊局訊息不會套用至新局。
- 對手離開、短暫離線或結果期限結束時停用再戰；短暫離線者在房間清理前重新連線可恢復。再戰計入每日 200 局上限，沿用每日 12,000 次／每連線 900 次操作額度，不重新下載同房圖片。
- 連線最長仍為 20 分鐘；若剩餘期限不足以容納新局的預覽、最大遊戲時間及結果時間，會提示離開後重新建立或配對，不無限延長房間。
- 電腦對手依頁面語言選擇一般暱稱，沒有自動數字尾碼；再戰會清空其記憶並重新學習可見牌面。
- 原創本機合成 BGM（126 BPM、輕快彈撥旋律／低音／鼓點）無外部音檔下載，不增加 Workers／R2 請求。等待及對戰播放，音效時降音量；獨立音樂開關記在本機，初次依音效偏好啟用。頁面隱藏、離開、結算時停止。
- 找到對手、開局、自己的回合、再戰邀請與離房有不同提示音，遵守音效開關；BGM 音量會短暫降低。勝／平／負以牌桌中央的結果卡與短動畫呈現，按鈕可直接操作，遵守減少動態效果偏好。
- 首頁加入線上配對與好友對戰區、FAQ 與 PK 直達入口。四語 title、description、OG／Twitter、結構化功能同步更新；既有 canonical／hreflang／sitemap 路徑保留。首頁入口的 ?mode=pk 使用遊戲頁既有 canonical，房間碼依舊不納入 sitemap。

本版不新增 D1 migration、R2 bucket 或 Secret；若已完成 v1.3.0 設定，登入後執行 cloudflare 的 npm ci、npm run check、npm run deploy 即可，再推送前端。

## 3. 正式驗收

1. 從 https://wwwne1198.party/games/memory/ 開啟「雙人 PK」。
2. 建立邀請，將連結用另一台裝置或獨立分頁開啟，輸入另一個暱稱加入。
3. 雙方按準備：確認牌面、回合、翻牌及得分同步；翻錯後換人，配對成功可繼續。
4. 用自訂圖片建立一次房間，確認另一裝置顯示相同卡背、圖案、背景及構圖。圖片会先沿用雲端設定檔保存。
5. 雙方同時按「開始配對」確認進入同一房間。配對採先進入者的設定，雙方看到規則後才準備。
6. 只有一人搜尋時，等待隨機 15–30 秒會補上電腦對手。依本次需求，使用一般暱稱及相同介面，畫面不標示 AI；運算在本機，不呼叫生成式 AI。
7. 短暫重新整理：原分頁 30 秒內可恢復真人房間。取消配對後，不會再被分配給下一位玩家。
8. 關閉／離開房間後對方應看到結果。PK 不寫入單人排行榜或歷史成績。

電腦對局重新整理後不保留進度。真人房間與連線失效後需重新建立。所有 PK 額度用完或服務離線時，顯示可理解的訊息，單人遊戲仍可繼續。

## 4. 免費容量的保護設計

下表為程式自己的保守上限，不是 Cloudflare 方案額度：

| 項目 | 上限 |
| --- | --- |
| 全站每日建立連線 | 400 |
| 每個網路每日建立連線 | 30 |
| 同時保留的連線資料 | 64 |
| 同時保留的真人房間（含短暫結果） | 20 |
| 每日真人開局（含再戰） | 200 |
| 全站每日 WebSocket 遊戲操作 | 12,000；達 9,000 後停止新房間與再戰 |
| 每個連線遊戲操作 | 900 |
| 每個 WebSocket 每秒操作 | 6 |
| 每個連線可重連 | 8 次 |
| 每位玩家每房圖片包下載 | 3 次 |
| 邀請等待／配對搜尋 | 3 分鐘／隨機 15–30 秒 |
| 每局／每回合 | 最多 10 分鐘／20 秒 |
| 離線保留 | 30 秒；期間暫停回合判逾時，整局上限仍計時 |
| 清理 | 結束約 1 分鐘清房間；連線最長 20 分鐘 |
| 自訂圖片 | 每份最多 15 張、4 MiB；原雲端保存與流量上限同時適用 |

每日額度以 UTC 午夜重置，即台灣時間上午 8 點。失敗／無效操作也可能計入。實作集中在 cloudflare/pk.js 的 PK_QUOTA 與 public/js/pk-rules.js 的 PK。

- 一個有容量限制的 SQLite Durable Object 統一處理配對與房間；取消、超時補位與真人加入是序列操作，避免同一人同時得到兩個對手。
- 使用可休眠 WebSocket；伺服器不每秒輪詢 D1、不使用持續計時迴圈。只在翻牌、狀態改變與必要期限喚醒。
- 心跳用 WebSocket auto-response；電腦補位確定移出真人佇列後釋放連線。
- 真人洗牌、回合、分數由伺服器判定；未翻開的位置不送牌面內容，預覽及結束才全部揭露。每次操作驗證版本，連點或舊訊息不會多計分。
- 邀請使用 192-bit 隨機房間碼。私人連線 token 不放網址，以 sessionStorage 暫存；服務端只保存雜湊。房間碼只讓持有者加入尚未滿員的等待房間。
- 自訂圖片沿用現有 Cloudflare 設定檔，SHA-256 相同且尚有效時重用代碼。圖片只在載入房間時下載，翻牌不重新讀 R2。設定檔沿用 30 天未使用刪除機制，退出房間不立即刪檔。
- 超過用量時停止接受相關 PK 操作，不自動升級帳戶或切換付費服務。可將 Worker vars.PK_ENABLED 設 false 再部署，單獨暫停 PK。

這些限制能控制正常使用與部分濫用；不能保證整個帳戶永遠零費用。被拒絕的外部請求仍可能計入 Workers，其他網站也共用帳戶額度；R2 本身有超額計費規則。預算通知是提醒，不是硬性停用開關。上線後先看 Workers／Durable Objects／D1／R2 的實際用量，再決定是否調高程式限制。

Cloudflare 官方參考：
- https://developers.cloudflare.com/durable-objects/platform/pricing/
- https://developers.cloudflare.com/durable-objects/best-practices/websockets/
- https://developers.cloudflare.com/d1/platform/pricing/
- https://developers.cloudflare.com/r2/pricing/

## 5. 本機測試

雙擊「開始 PK 預覽.cmd」，或：

```powershell
npm ci --prefix cloudflare
npm run preview:pk
```

網站：http://127.0.0.1:4185/games/memory/
本機 API：http://127.0.0.1:8795

預覽使用隔離的 Miniflare D1／R2／Durable Objects，停止後清空，不上傳到正式 Cloudflare。只有本機測試程式模擬 Turnstile 回覆；正式 Worker 沒有略過驗證的開關。正式 GA4 也不在預覽啟動。

普通「開始預覽.cmd」只看靜態與單人功能；PK 必須使用新的預覽啟動檔。連接埠已占用時，先關閉舊預覽，或在 PowerShell 設定 PORT 及 PK_PORT 再執行。停止按 Ctrl+C。

自動化測試：

```powershell
node --test tests/*.test.mjs cloudflare/tests/*.test.mjs
node cloudflare/tests/pk-runtime.mjs
```

runtime 測試使用真正 workerd 的 WebSocket、SQLite Durable Object、D1 與 R2 模擬器，含 15–30 秒隨機期限的實際等待；不等於已在正式網域或實體手機完成驗收。

