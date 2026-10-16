const rows = [
  [
    "若重試後仍無法加入，請朋友重新建立邀請並傳送新連結。",
    "If you still cannot join after retrying, ask your friend to create a new invitation and send you the new link.",
    "再試行しても参加できない場合は、友達に新しい招待を作成し、新しいリンクを送ってもらってください。",
    "다시 시도해도 입장할 수 없다면 친구에게 초대를 새로 만들고 새 링크를 보내 달라고 요청하세요."
  ],
  [
    "← 返回選擇玩法",
    "← Back to mode selection",
    "← 遊び方の選択に戻る",
    "← 플레이 방식 선택으로"
  ],
  [
    "返回選擇玩法",
    "Back to mode selection",
    "遊び方の選択に戻る",
    "플레이 방식 선택으로"
  ],
  [
    "返回會離開此房間；你可以重新調整設定、邀請或配對。",
    "Returning leaves this room. You can then change settings, invite a friend or find an opponent.",
    "戻るとこの部屋から退出します。設定の変更、招待、マッチングをやり直せます。",
    "돌아가면 이 방에서 나갑니다. 설정을 바꾸거나 새로 초대 또는 매칭할 수 있어요."
  ],
  [
    "返回選擇玩法？",
    "Return to mode selection?",
    "遊び方の選択に戻りますか？",
    "플레이 방식 선택으로 돌아갈까요?"
  ],
  [
    "返回會離開目前房間，並通知對方。再次對戰需要新的邀請或配對。",
    "You will leave this room and your opponent will be notified. Playing again requires a new invitation or matchmaking.",
    "現在の部屋から退出し、相手に通知します。再度対戦するには新しい招待かマッチングが必要です。",
    "현재 방에서 나가며 상대에게 알립니다. 다시 대전하려면 새 초대나 매칭이 필요해요."
  ],
  [
    "先決定難度，其他設定保留預設就能玩。",
    "Choose a difficulty. You can leave everything else at its default.",
    "難しさを選べば、ほかは初期設定のままで遊べます。",
    "난이도를 고르면 나머지는 기본 설정으로 바로 즐길 수 있어요."
  ],
  [
    "先選圖案或上傳照片，再視需要調整卡背與外觀。",
    "Choose patterns or upload photos, then customize card backs and appearance if you like.",
    "絵柄を選ぶか写真をアップロードしてから、必要に応じて裏面や見た目を変更します。",
    "그림을 고르거나 사진을 올린 뒤 필요하면 카드 뒷면과 모양을 바꾸세요."
  ],
  [
    "先換背景；標題、LOGO 與細部排版可按需展開。",
    "Start with the background. Expand titles, logos and layout details when needed.",
    "まず背景を選びましょう。タイトル・ロゴ・細かい配置は必要なときに開けます。",
    "배경부터 바꿔 보세요. 제목, 로고, 세부 배치는 필요할 때 펼치세요."
  ],
  [
    "決定是否保存成績；不需要填寫活動名稱也能玩。",
    "Choose whether to save scores. An event name is optional.",
    "成績を保存するか選びます。イベント名は入力しなくても遊べます。",
    "성적 저장 여부를 선택하세요. 이벤트 이름은 입력하지 않아도 돼요."
  ],
  [
    "復原與重設",
    "Undo & reset",
    "元に戻す・リセット",
    "실행 취소 및 초기화"
  ],
  [
    "顯示預覽",
    "Show preview",
    "プレビューを表示",
    "미리보기 표시"
  ],
  [
    "收合預覽",
    "Hide preview",
    "プレビューを閉じる",
    "미리보기 접기"
  ],
  [
    "更多圖片調整",
    "More image adjustments",
    "画像の詳細設定",
    "추가 이미지 조정"
  ],
  [
    "圖片名稱與構圖",
    "Image name & framing",
    "画像名・構図",
    "이미지 이름 및 구도"
  ],
  [
    "勾選要玩的圖案；點「編輯圖片」即可上傳照片。至少保留 2 種。",
    "Select patterns to play with. Choose Edit image to upload a photo. Keep at least 2 selected.",
    "遊ぶ絵柄にチェックを入れます。「画像を編集」で写真をアップロードできます。2種類以上選んでください。",
    "사용할 그림을 체크하세요. 이미지 편집을 누르면 사진을 올릴 수 있어요. 최소 2개를 선택하세요."
  ],
  [
    "編輯圖片",
    "Edit image",
    "画像を編集",
    "이미지 편집"
  ],
  [
    "卡牌設定分類",
    "Card settings categories",
    "カード設定の分類",
    "카드 설정 분류"
  ],
  [
    "正面圖案",
    "Card faces",
    "表の絵柄",
    "카드 앞면"
  ],
  [
    "大小與顏色",
    "Size & colors",
    "サイズ・色",
    "크기 및 색상"
  ],
  [
    "卡牌排版",
    "Card layout",
    "カードの配置",
    "카드 배치"
  ],
  [
    "卡牌顏色",
    "Card colors",
    "カードの色",
    "카드 색상"
  ],
  [
    "背景圖片",
    "Background image",
    "背景画像",
    "배경 이미지"
  ],
  [
    "標題與文字",
    "Titles & text",
    "タイトル・文字",
    "제목 및 글자"
  ],
  [
    "文字外觀與位置",
    "Text style & position",
    "文字の見た目・位置",
    "글자 모양 및 위치"
  ],
  [
    "LOGO 圖片",
    "Logo image",
    "ロゴ画像",
    "로고 이미지"
  ],
  [
    "LOGO 大小與位置",
    "Logo size & position",
    "ロゴのサイズ・位置",
    "로고 크기 및 위치"
  ],
  [
    "活動與保存欄位",
    "Event & saved fields",
    "イベント・保存項目",
    "이벤트 및 저장 항목"
  ],
  [
    "快速選擇卡牌數",
    "Quick card count",
    "カード数を選ぶ",
    "카드 수 빠른 선택"
  ],
  [
    "輕鬆",
    "Easy",
    "かんたん",
    "쉬움"
  ],
  [
    "標準",
    "Standard",
    "ふつう",
    "보통"
  ],
  [
    "挑戰",
    "Challenge",
    "チャレンジ",
    "도전"
  ],
  [
    "{0} · {1} 對",
    "{0} · {1} pairs",
    "{0} · {1}ペア",
    "{0} · {1}쌍"
  ],
  [
    "進階玩法",
    "Advanced rules",
    "詳細ルール",
    "세부 규칙"
  ],
  [
    "直接開始，找出相同的兩張",
    "Start playing and find matching pairs",
    "さっそく同じ絵のペアを探そう",
    "바로 시작해서 같은 카드 두 장 찾기"
  ],
  [
    "按「開始遊戲」，記住牌面後一次翻兩張。聲音開關同時控制音樂與音效；＋／− 可以調整卡牌大小。",
    "Choose Start game, remember the cards, then flip two at a time. The sound switch controls music and effects together. Use + / − to resize the cards.",
    "「ゲーム開始」を押してカードを覚えたら、2枚ずつめくりましょう。サウンドボタンでBGMと効果音をまとめて切り替え、＋／−でカードの大きさを変えられます。",
    "게임 시작을 누르고 카드를 기억한 뒤 두 장씩 뒤집으세요. 소리 버튼으로 음악과 효과음을 함께 켜고 끌 수 있어요. ＋／−로 카드 크기를 바꾸세요."
  ],
  [
    "把照片變成自己的卡牌",
    "Turn photos into your own cards",
    "自分の写真をカードにしよう",
    "내 사진으로 카드 만들기"
  ],
  [
    "開啟「設定 → 卡牌與圖庫」，點圖案下方的「編輯圖片」上傳照片。需要時展開構圖調整，預覽後按「儲存並套用」。",
    "Open Settings → Cards & images and choose Edit image below a pattern to upload a photo. Expand framing controls if needed, check the preview, then choose Save & apply.",
    "「設定 → カード・画像」を開き、絵柄の下の「画像を編集」で写真をアップロードします。必要なら構図を調整し、プレビューを確認して「保存して適用」を押します。",
    "설정 → 카드·이미지에서 그림 아래 이미지 편집을 눌러 사진을 올리세요. 필요하면 구도 설정을 펼치고 미리보기를 확인한 뒤 저장하고 적용을 누르세요."
  ],
  [
    "設定 → 卡牌與圖庫",
    "Settings → Cards & images",
    "設定 → カード・画像",
    "설정 → 카드·이미지"
  ],
  [
    "邀請朋友，或找一位對手",
    "Invite a friend or find an opponent",
    "友達を招待する・相手を探す",
    "친구 초대 또는 상대 찾기"
  ],
  [
    "按「雙人 PK」選擇邀請朋友或線上配對。兩人都按「我準備好了」才開局；準備期間可返回選擇玩法。",
    "Choose Two-player match, then invite a friend or find an opponent. The game starts when both players choose Ready. You can return to mode selection while preparing.",
    "「2人対戦」で友達の招待かオンライン対戦を選びます。2人とも準備完了を押すと開始します。準備中は遊び方の選択に戻れます。",
    "2인 대전에서 친구 초대 또는 온라인 매칭을 선택하세요. 두 사람 모두 준비 버튼을 누르면 시작해요. 준비 중에는 플레이 방식 선택으로 돌아갈 수 있어요."
  ],
  [
    "快速上手",
    "Quick start",
    "かんたんガイド",
    "빠른 시작"
  ],
  [
    "跳過教學",
    "Skip guide",
    "スキップ",
    "안내 건너뛰기"
  ],
  [
    "第 {0} 步，共 {1} 步",
    "Step {0} of {1}",
    "{0} / {1} ステップ",
    "{1}단계 중 {0}단계"
  ],
  [
    "之後可在「使用說明」重新查看教學。",
    "You can reopen this guide from How to play.",
    "このガイドは「遊び方」からいつでも見直せます。",
    "게임 방법에서 이 안내를 다시 볼 수 있어요."
  ],
  [
    "上一步",
    "Back",
    "戻る",
    "이전"
  ],
  [
    "下一步",
    "Next",
    "次へ",
    "다음"
  ],
  [
    "開始體驗",
    "Let's play",
    "遊んでみる",
    "시작하기"
  ],
  [
    "重新查看操作教學",
    "Replay the quick guide",
    "操作ガイドをもう一度見る",
    "조작 안내 다시 보기"
  ]
];
rows.push(["設定依玩法、卡牌與圖庫、畫面、成績、雲端代碼分頁整理。先調整常用選項，需要時再展開進階設定。卡牌與圖庫分成正面圖案、卡背、大小與顏色；點圖案下方的「編輯圖片」即可上傳照片。圖片名稱、構圖、裁切與旋轉可展開調整，預覽會顯示對應牌面。手機可用「顯示預覽／收合預覽」切換。確認後按「儲存並套用」。","Settings is organized into Rules, Cards & images, Appearance, Scores and Cloud codes. Start with common options and expand advanced controls only when needed. Cards & images has Card faces, Card backs, and Size & colors sections. Choose Edit image below a pattern to upload a photo. Expand controls to adjust its name, framing, crop or rotation, and check the matching preview. On mobile, use Show preview / Hide preview. Finish with Save & apply.","設定はルール、カード・画像、画面、成績、クラウドコードに分かれています。よく使う項目から設定し、詳細は必要なときだけ開いてください。カード・画像は表の絵柄、裏面、サイズ・色に分かれています。絵柄の下の「画像を編集」で写真をアップロードできます。画像名、構図、切り抜き、回転を調整し、プレビューを確認しましょう。スマートフォンではプレビューを表示・非表示にできます。最後に「保存して適用」を押してください。","설정은 규칙, 카드·이미지, 화면, 성적, 클라우드 코드로 나뉩니다. 자주 쓰는 항목부터 설정하고 세부 옵션은 필요할 때 펼치세요. 카드·이미지는 카드 앞면, 뒷면, 크기 및 색상으로 구분됩니다. 그림 아래 이미지 편집을 누르면 사진을 올릴 수 있어요. 이름, 구도, 자르기, 회전을 펼쳐 조정하고 해당 카드의 미리보기를 확인하세요. 모바일에서는 미리보기를 펼치거나 접을 수 있어요. 마지막에 저장하고 적용을 누르세요."]);
rows.push(...[["準備已結束","Preparation ended","準備が終了しました","준비가 종료되었어요"],["這場尚未開始。返回選擇玩法，即可重新邀請或配對。","This game had not started. Return to mode selection to invite someone or find an opponent again.","この対戦はまだ始まっていません。遊び方の選択に戻り、招待やマッチングをやり直してください。","아직 시작하지 않은 대전이에요. 플레이 방식 선택으로 돌아가 새로 초대하거나 매칭하세요."]]);
export const uiV152Messages = Object.fromEntries(rows.map(([zh,en,ja,ko]) => [zh,{en,ja,ko}]));
