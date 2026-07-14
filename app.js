/**
 * LoL Draft Assistant - Application Controller
 */

// アプリのグローバル状態
const AppState = {
  // DDragonデータ
  ddragonVersion: "14.3.1",
  champions: {}, // キー: ID, 値: チャンピオン詳細オブジェクト
  championList: [], // チャンピオンオブジェクトの配列
  roleMap: {
    "TOP": "Top",
    "JUNGLE": "Jungle",
    "MIDDLE": "Mid",
    "BOTTOM": "Adc",
    "UTILITY": "Sup"
  },

  // Gemini API
  geminiApiKey: "",
  chatHistory: [], // { role: "user" | "model", text: "..." }

  // 選手マスター名簿
  playerMaster: [],

  // ドラフト設定モード
  draftMode: "custom", // "custom" (対面プールあり) or "ranked" (対面プール不明)

  // プレイヤー & チームデータ
  teamData: {
    blue: [], // 5名
    red: []  // 5名
  },

  // カスタムデータベース（counters, synergies）
  customDatabase: {
    counters: {},
    synergies: {}
  },

  // ドラフトの進行状態
  draft: {
    active: false,
    currentStepIndex: 0,
    blueBans: [], // 選択されたチャンピオンID of リスト（最大5）
    redBans: [],
    bluePicks: [null, null, null, null, null], // 各スロットのチャンピオンID
    redPicks: [null, null, null, null, null],
    selectedChampId: null // 現在クリックで選択中のチャンピオンID
  },

  // 現在プール編集中のプレイヤー情報
  editingPlayer: {
    side: null, // 'blue' or 'red'
    index: null // 0〜4
  }
};

// ドラフトのステップ進行定義（公式競技シーン順序）
// type: 'ban' or 'pick', team: 'blue' or 'red', slotIndex: 格納するBAN/PICKスロットのインデックス
const DRAFT_STEPS = [
  { type: 'ban', team: 'blue', slotIndex: 0, label: '青 BAN 1' },
  { type: 'ban', team: 'red', slotIndex: 0, label: '赤 BAN 1' },
  { type: 'ban', team: 'blue', slotIndex: 1, label: '青 BAN 2' },
  { type: 'ban', team: 'red', slotIndex: 1, label: '赤 BAN 2' },
  { type: 'ban', team: 'blue', slotIndex: 2, label: '青 BAN 3' },
  { type: 'ban', team: 'red', slotIndex: 2, label: '赤 BAN 3' },
  
  { type: 'pick', team: 'blue', slotIndex: 0, label: '青 PICK 1' },
  { type: 'pick', team: 'red', slotIndex: 0, label: '赤 PICK 1' },
  { type: 'pick', team: 'red', slotIndex: 1, label: '赤 PICK 2' },
  { type: 'pick', team: 'blue', slotIndex: 1, label: '青 PICK 2' },
  { type: 'pick', team: 'blue', slotIndex: 2, label: '青 PICK 3' },
  { type: 'pick', team: 'red', slotIndex: 2, label: '赤 PICK 3' },
  
  { type: 'ban', team: 'red', slotIndex: 3, label: '赤 BAN 4' },
  { type: 'ban', team: 'blue', slotIndex: 3, label: '青 BAN 4' },
  { type: 'ban', team: 'red', slotIndex: 4, label: '赤 BAN 5' },
  { type: 'ban', team: 'blue', slotIndex: 4, label: '青 BAN 5' },
  
  { type: 'pick', team: 'red', slotIndex: 3, label: '赤 PICK 4' },
  { type: 'pick', team: 'blue', slotIndex: 3, label: '青 PICK 4' },
  { type: 'pick', team: 'blue', slotIndex: 4, label: '青 PICK 5' },
  { type: 'pick', team: 'red', slotIndex: 4, label: '赤 PICK 5' }
];

// 初期モックデータ（初めて開いたときに見栄えを良くするため）
const DEFAULT_BLUE_TEAM = [
  { name: "味方プレイヤー1", role: "TOP", strength: 80, pool: [{ champId: "Aatrox", winRate: 65, mastery: 5 }, { champId: "Jax", winRate: 55, mastery: 4 }, { champId: "Malphite", winRate: 70, mastery: 3 }] },
  { name: "味方プレイヤー2", role: "JUNGLE", strength: 75, pool: [{ champId: "LeeSin", winRate: 50, mastery: 4 }, { champId: "JarvanIV", winRate: 60, mastery: 5 }, { champId: "Graves", winRate: 45, mastery: 3 }] },
  { name: "味方プレイヤー3", role: "MIDDLE", strength: 90, pool: [{ champId: "Ahri", winRate: 58, mastery: 4 }, { champId: "Yasuo", winRate: 40, mastery: 5 }, { champId: "Syndra", winRate: 62, mastery: 3 }] },
  { name: "味方プレイヤー4", role: "BOTTOM", strength: 85, pool: [{ champId: "Ezreal", winRate: 52, mastery: 4 }, { champId: "Jinx", winRate: 65, mastery: 5 }, { champId: "KaiSa", winRate: 58, mastery: 4 }] },
  { name: "味方プレイヤー5", role: "UTILITY", strength: 60, pool: [{ champId: "Thresh", winRate: 55, mastery: 4 }, { champId: "Nami", winRate: 68, mastery: 5 }, { champId: "Lulu", winRate: 50, mastery: 3 }] }
];

const DEFAULT_RED_TEAM = [
  { name: "相手プレイヤー1", role: "TOP", strength: 80, pool: [{ champId: "Fiora", winRate: 72, mastery: 5 }, { champId: "Renekton", winRate: 54, mastery: 3 }, { champId: "Gnar", winRate: 48, mastery: 4 }] },
  { name: "相手プレイヤー2", role: "JUNGLE", strength: 70, pool: [{ champId: "Nocturne", winRate: 60, mastery: 4 }, { champId: "Viego", winRate: 58, mastery: 5 }, { champId: "Maokai", winRate: 65, mastery: 4 }] },
  { name: "相手プレイヤー3", role: "MIDDLE", strength: 85, pool: [{ champId: "Zed", winRate: 65, mastery: 5 }, { champId: "Orianna", winRate: 55, mastery: 4 }, { champId: "Yone", winRate: 50, mastery: 4 }] },
  { name: "相手プレイヤー4", role: "BOTTOM", strength: 80, pool: [{ champId: "Caitlyn", winRate: 55, mastery: 4 }, { champId: "Aphelios", winRate: 45, mastery: 5 }, { champId: "Samira", winRate: 70, mastery: 4 }] },
  { name: "相手プレイヤー5", role: "UTILITY", strength: 75, pool: [{ champId: "Nautilus", winRate: 58, mastery: 4 }, { champId: "Blitzcrank", winRate: 62, mastery: 5 }, { champId: "Yuumi", winRate: 50, mastery: 3 }] }
];

// 役割アイコン定義 (SVG)
const ROLE_SVGS = {
  TOP: `<svg viewBox="0 0 24 24"><path d="M12 2L2 7v10l10 5 10-5V7L12 2zm8 14.24l-8 4-8-4V8.76l8-4 8 4v7.48zM12 6c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6-2.69-6-6-6zm0 10c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4z"/></svg>`,
  JUNGLE: `<svg viewBox="0 0 24 24"><path d="M12 2L2 22h20L12 2zm0 4l6.3 12.6H5.7L12 6zm-2 7h4v2h-4v-2z"/></svg>`,
  MIDDLE: `<svg viewBox="0 0 24 24"><path d="M12 2L2 12l10 10 10-10L12 2zm0 3.6L18.4 12 12 18.4 5.6 12 12 5.6zM12 9c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg>`,
  BOTTOM: `<svg viewBox="0 0 24 24"><path d="M12 2L3 9v11h18V9l-9-7zm7 16H5v-8.2l7-5.4 7 5.4V18zm-8-7h2v5h-2v-5z"/></svg>`,
  UTILITY: `<svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2V7zm0 8h2v2h-2v-2z"/></svg>`
};

// アプリの初期化
document.addEventListener("DOMContentLoaded", async () => {
  showToast("チャンピオンデータを読み込んでいます...");
  await initDDragon();
  await loadDataFromServer();
  renderDashboard();
  renderPlayerMasterList();
  renderDraftHistoryList();
  initEventListeners();
  populateSettingsChamps();
  showToast("準備完了！");
});

// Riot Data Dragon APIからデータを取得
async function initDDragon() {
  try {
    // 1. 最新バージョンを取得
    const vRes = await fetch("https://ddragon.leagueoflegends.com/api/versions.json");
    const versions = await vRes.json();
    if (versions && versions.length > 0) {
      AppState.ddragonVersion = versions[0];
    }

    // 2. チャンピオンリストを取得
    const cRes = await fetch(`https://ddragon.leagueoflegends.com/cdn/${AppState.ddragonVersion}/data/ja_JP/champion.json`);
    const cData = await cRes.json();
    
    AppState.champions = cData.data;
    AppState.championList = Object.values(cData.data).sort((a, b) => a.name.localeCompare(b.name, 'ja'));
  } catch (error) {
    console.error("DDragonのフェッチに失敗しました。デフォルトバージョンを使用します。", error);
    // フォールバック
    showToast("データ取得に失敗しました。オフラインで動作中...", 5000);
  }
}

// サーバーからデータを読み込む
// サーバーからデータを読み込む
async function loadDataFromServer() {
  try {
    const res = await fetch('/api/data');
    if (res.ok) {
      const data = await res.json();
      applyLoadedData(data);
    } else {
      throw new Error('API server unavailable');
    }
  } catch (e) {
    console.error('Failed to load data from server. Fallback to LocalStorage.', e);
    initLocalStorageFallback();
  }

  loadGeminiKeyFromLocal();
}

function applyLoadedData(data) {
  if (data.playerMaster) AppState.playerMaster = data.playerMaster;
  if (data.teamData && data.teamData.blue) AppState.teamData = data.teamData;
  
  // customDatabase が空かキー不足の場合、DEFAULT_DRAFT_DATABASEからデフォルト値をロード・マージ
  AppState.customDatabase = data.customDatabase || {};
  if (!AppState.customDatabase.counters || Object.keys(AppState.customDatabase.counters).length === 0) {
    AppState.customDatabase.counters = JSON.parse(JSON.stringify(DEFAULT_DRAFT_DATABASE.counters || {}));
  }
  if (!AppState.customDatabase.synergy || Object.keys(AppState.customDatabase.synergy).length === 0) {
    AppState.customDatabase.synergy = JSON.parse(JSON.stringify(DEFAULT_DRAFT_DATABASE.synergy || {}));
  }
  if (!AppState.customDatabase.synergies || Object.keys(AppState.customDatabase.synergies).length === 0) {
    AppState.customDatabase.synergies = AppState.customDatabase.synergy || JSON.parse(JSON.stringify(DEFAULT_DRAFT_DATABASE.synergies || {}));
  }
  if (!AppState.customDatabase.champDetails || Object.keys(AppState.customDatabase.champDetails).length === 0) {
    AppState.customDatabase.champDetails = JSON.parse(JSON.stringify(DEFAULT_DRAFT_DATABASE.champDetails || {}));
  }

  if (data.draftHistory) AppState.draftHistory = data.draftHistory;
  if (data.draftMode) AppState.draftMode = data.draftMode;
  migrateLocalStorageData();
  renderDraftHistoryList();
}

function loadGeminiKeyFromLocal() {
  const savedKey = localStorage.getItem("lol_draft_gemini_key");
  if (savedKey) {
    AppState.geminiApiKey = savedKey;
    const inputEl = document.getElementById("gemini-api-key");
    if (inputEl) inputEl.value = savedKey;
  }
}

// データを保存する
async function saveDataToServer() {
  const payload = {
    playerMaster: AppState.playerMaster,
    teamData: AppState.teamData,
    customDatabase: AppState.customDatabase,
    draftHistory: AppState.draftHistory || [],
    draftMode: AppState.draftMode
  };

  // キャッシュとしてローカルストレージにも保存
  localStorage.setItem("lol_draft_player_master", JSON.stringify(AppState.playerMaster));
  localStorage.setItem("lol_draft_team_data", JSON.stringify(AppState.teamData));
  localStorage.setItem("lol_draft_custom_db", JSON.stringify(AppState.customDatabase));
  localStorage.setItem("lol_draft_mode", AppState.draftMode);
  localStorage.setItem("lol_draft_history", JSON.stringify(AppState.draftHistory || []));

  try {
    const res = await fetch('/api/data', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    
    if (!res.ok) throw new Error('Save API failure');
  } catch (e) {
    console.error('Failed to save data to server.', e);
  }
}

// LocalStorageに古いデータがある場合にサーバー側へマージ（初回移行用）
function migrateLocalStorageData() {
  let migrated = false;
  const oldMaster = localStorage.getItem("lol_draft_player_master");
  if (oldMaster) {
    try {
      const parsed = JSON.parse(oldMaster);
      parsed.forEach(p => {
        const exists = AppState.playerMaster.some(m => m.name === p.name);
        if (!exists) {
          AppState.playerMaster.push(p);
          migrated = true;
        }
      });
      localStorage.removeItem("lol_draft_player_master"); // 移行後は削除
    } catch (e) {
      console.error(e);
    }
  }
  
  if (migrated) {
    saveDataToServer();
  }
}

// サーバーに繋がらない場合のフォールバックロード
function initLocalStorageFallback() {
  const savedMaster = localStorage.getItem("lol_draft_player_master");
  if (savedMaster) {
    AppState.playerMaster = JSON.parse(savedMaster);
  }
  const savedTeams = localStorage.getItem("lol_draft_team_data");
  if (savedTeams) {
    AppState.teamData = JSON.parse(savedTeams);
  }
  const savedDb = localStorage.getItem("lol_draft_custom_db");
  if (savedDb) {
    AppState.customDatabase = JSON.parse(savedDb);
  }
  const savedHistory = localStorage.getItem("lol_draft_history");
  if (savedHistory) {
    AppState.draftHistory = JSON.parse(savedHistory);
  }
}

// 各セーブ関数のラッパー
function saveTeamData() {
  saveDataToServer();
}

function saveCustomDatabase() {
  saveDataToServer();
}

// 不要になった共有URLパラメータ解析は空関数化
function parseUrlData() {}

// ダッシュボードUIの描画
function renderDashboard() {
  const redCard = document.querySelector(".team-setup-card.red-side");
  const blueHeader = document.querySelector(".team-setup-card.blue-side .side-badge");

  if (AppState.draftMode === "ranked") {
    // フルパランクモードの時は相手チーム設定を非表示にする
    if (redCard) redCard.style.display = "none";
    if (blueHeader) {
      blueHeader.textContent = "MY TEAM (味方チーム)";
      blueHeader.style.background = "linear-gradient(135deg, #1f3b5c, #0a1424)";
    }
  } else {
    // カスタム戦では両方表示
    if (redCard) redCard.style.display = "block";
    if (blueHeader) {
      blueHeader.textContent = "BLUE TEAM (味方)";
      blueHeader.style.background = "linear-gradient(135deg, #102a45, #1f8bbf)";
    }
  }

  renderSetupTeam('blue', document.getElementById("blue-players-list"));
  if (AppState.draftMode !== "ranked") {
    renderSetupTeam('red', document.getElementById("red-players-list"));
  }
}

function renderSetupTeam(side, container) {
  container.innerHTML = "";
  const players = AppState.teamData[side];

  players.forEach((player, index) => {
    const row = document.createElement("div");
    row.className = "player-input-row";
    
    // HTML5 ドラッグ＆ドロップによる並び替え設定
    row.draggable = true;
    row.style.cursor = "grab";
    
    row.addEventListener("dragstart", (e) => {
      e.dataTransfer.setData("text/plain", JSON.stringify({ side: side, index: index }));
      e.dataTransfer.effectAllowed = "move";
      row.style.opacity = "0.5";
      row.style.border = "1px dashed var(--gold-metallic)";
    });

    row.addEventListener("dragend", () => {
      row.style.opacity = "1";
      row.style.border = "";
    });

    row.addEventListener("dragover", (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
    });

    row.addEventListener("drop", (e) => {
      e.preventDefault();
      try {
        const dragData = JSON.parse(e.dataTransfer.getData("text/plain"));
        // 同じチーム内でのみ並び替えを許可
        if (dragData && dragData.side === side && dragData.index !== index) {
          swapTeamPlayerOrder(side, dragData.index, index);
        }
      } catch (err) {
        console.error("Drop failed:", err);
      }
    });

    // つかむ用ハンドルUIを左端に作成
    const dragHandle = document.createElement("div");
    dragHandle.className = "drag-handle";
    dragHandle.style.cssText = "color: #606570; margin-right: 8px; font-weight: bold; cursor: grab; user-select: none; font-size: 14px;";
    dragHandle.textContent = "☰";
    
    // ロールアイコン
    const roleIcon = document.createElement("div");
    roleIcon.className = "player-role-icon";
    roleIcon.innerHTML = ROLE_SVGS[player.role] || "";

    // 選手名簿アサイド・ドロップダウン
    const selectPlayer = document.createElement("select");
    selectPlayer.className = "form-input select-player-dropdown";
    
    const defaultOpt = document.createElement("option");
    defaultOpt.value = "";
    defaultOpt.textContent = "-- 選手選択 --";
    selectPlayer.appendChild(defaultOpt);

    // 名簿一覧を追加
    AppState.playerMaster.forEach(p => {
      const opt = document.createElement("option");
      opt.value = p.id;
      const rolesStr = p.roles && Array.isArray(p.roles) ? p.roles.map(r => AppState.roleMap[r] || r).join(" / ") : (AppState.roleMap[p.role] || p.role || "未設定");
      opt.textContent = `${p.name} (${rolesStr})`;
      if (p.name === player.name) {
        opt.selected = true;
      }
      selectPlayer.appendChild(opt);
    });

    selectPlayer.addEventListener("change", (e) => {
      const pId = e.target.value;
      if (pId) {
        const found = AppState.playerMaster.find(p => p.id === pId);
        if (found) {
          // ディープコピーしてスロットにアサイン
          AppState.teamData[side][index] = JSON.parse(JSON.stringify(found));
          AppState.teamData[side][index].role = player.role; // ロールはスロットに合わせる
          AppState.teamData[side][index].strength = found.laneStrengths ? (found.laneStrengths[player.role] || 80) : (found.strength || 80);
          saveTeamData();
          renderDashboard(); // 再描画
          showToast(`${found.name} 選手をアサインしました！`);
        }
      }
    });

    // プレイヤー名インプット
    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.className = "form-input input-name";
    nameInput.placeholder = `プレイヤー ${index + 1}`;
    nameInput.value = player.name;
    nameInput.addEventListener("change", (e) => {
      const oldName = AppState.teamData[side][index].name;
      AppState.teamData[side][index].name = e.target.value;
      saveTeamData();
      
      // 名簿側にも同期
      const matched = AppState.playerMaster.find(p => p.name === oldName || p.name === e.target.value);
      if (matched) {
        matched.name = e.target.value;
        savePlayerMaster();
        renderPlayerMasterList(); // 名簿リストの更新
      }
    });

    // レーン強さ (習熟度 1-100) インプット
    const strengthInput = document.createElement("input");
    strengthInput.type = "number";
    strengthInput.className = "form-input input-strength";
    strengthInput.min = "1";
    strengthInput.max = "100";
    strengthInput.value = player.strength || 80;
    strengthInput.title = "レーン習熟度・強さ (1-100)";
    strengthInput.addEventListener("change", (e) => {
      let val = parseInt(e.target.value, 10);
      if (isNaN(val)) val = 80;
      val = Math.max(1, Math.min(100, val));
      e.target.value = val;
      AppState.teamData[side][index].strength = val;
      saveTeamData();
      
      // 名簿側にも同期 (そのロールの強さとしてピンポイント同期)
      const matched = AppState.playerMaster.find(p => p.name === player.name);
      if (matched) {
        if (!matched.laneStrengths) matched.laneStrengths = {};
        matched.laneStrengths[player.role] = val;
        matched.strength = val;
        savePlayerMaster();
        renderPlayerMasterList();
      }
    });

    // ロール選択セレクト
    const roleSelect = document.createElement("select");
    roleSelect.className = "form-input select-role";
    ["TOP", "JUNGLE", "MIDDLE", "BOTTOM", "UTILITY"].forEach(role => {
      const opt = document.createElement("option");
      opt.value = role;
      opt.textContent = AppState.roleMap[role];
      if (role === player.role) opt.selected = true;
      roleSelect.appendChild(opt);
    });
    roleSelect.addEventListener("change", (e) => {
      const newRole = e.target.value;
      AppState.teamData[side][index].role = newRole;
      roleIcon.innerHTML = ROLE_SVGS[newRole];
      saveTeamData();
    });

    // キャラプールプレビュー
    const poolPreview = document.createElement("div");
    poolPreview.className = "player-pool-preview";
    renderPoolPreview(player.pool, poolPreview);

    // プール編集ボタン
    const editBtn = document.createElement("button");
    editBtn.className = "btn btn-secondary";
    editBtn.textContent = "プール編集";
    editBtn.addEventListener("click", () => {
      openPoolEditModal(side, index);
    });

    // 並び替え（ドラフト順）ボタングループ
    const orderBtnGroup = document.createElement("div");
    orderBtnGroup.style.cssText = "display: flex; flex-direction: column; gap: 2px; justify-content: center; margin-left: 5px;";

    const upBtn = document.createElement("button");
    upBtn.className = "btn btn-secondary";
    upBtn.style.cssText = "padding: 1px 4px; font-size: 7px; height: 14px; line-height: 1; border-radius: 2px; min-width: auto;";
    upBtn.textContent = "▲";
    upBtn.disabled = index === 0;
    upBtn.addEventListener("click", () => {
      swapTeamPlayerOrder(side, index, index - 1);
    });

    const downBtn = document.createElement("button");
    downBtn.className = "btn btn-secondary";
    downBtn.style.cssText = "padding: 1px 4px; font-size: 7px; height: 14px; line-height: 1; border-radius: 2px; min-width: auto;";
    downBtn.textContent = "▼";
    downBtn.disabled = index === players.length - 1;
    downBtn.addEventListener("click", () => {
      swapTeamPlayerOrder(side, index, index + 1);
    });

    orderBtnGroup.appendChild(upBtn);
    orderBtnGroup.appendChild(downBtn);

    row.appendChild(dragHandle);
    row.appendChild(roleIcon);
    row.appendChild(selectPlayer);
    row.appendChild(nameInput);
    row.appendChild(strengthInput);
    row.appendChild(roleSelect);
    row.appendChild(poolPreview);
    row.appendChild(editBtn);
    row.appendChild(orderBtnGroup);

    container.appendChild(row);
  });
}

// 選手のアサイン順（ドラフト順）をスワップする処理
function swapTeamPlayerOrder(side, i, j) {
  const temp = AppState.teamData[side][i];
  AppState.teamData[side][i] = AppState.teamData[side][j];
  AppState.teamData[side][j] = temp;
  saveTeamData();
  renderDashboard();
  showToast("ドラフト順（並び順）を変更しました。");
}

function renderPoolPreview(pool, container) {
  container.innerHTML = "";
  if (!pool || pool.length === 0) {
    container.innerHTML = `<span class="pool-empty">プール未設定</span>`;
    return;
  }

  // 最大4つまでプレビューを表示
  const displayLimit = 4;
  const itemsToShow = pool.slice(0, displayLimit);

  itemsToShow.forEach(item => {
    const champ = AppState.champions[item.champId];
    if (!champ) return;

    const tag = document.createElement("span");
    tag.className = "pool-tag";
    
    const imgUrl = `https://ddragon.leagueoflegends.com/cdn/${AppState.ddragonVersion}/img/champion/${champ.image.full}`;
    tag.innerHTML = `
      <img src="${imgUrl}" alt="${champ.name}">
      <span>${champ.name} (${item.winRate}%)</span>
    `;
    container.appendChild(tag);
  });

  if (pool.length > displayLimit) {
    const more = document.createElement("span");
    more.className = "pool-tag-more";
    more.textContent = `他 ${pool.length - displayLimit} 体`;
    container.appendChild(more);
  }
}

// 相性設定タブ用のチャンピオン選択肢構築
function populateSettingsChamps() {
  const selects = document.querySelectorAll(".select-champ-list");
  selects.forEach(select => {
    // 既存のオプションをクリア（最初のプレースホルダーは残す）
    const firstOpt = select.querySelector("option");
    select.innerHTML = "";
    if (firstOpt) select.appendChild(firstOpt);

    AppState.championList.forEach(champ => {
      const opt = document.createElement("option");
      opt.value = champ.id;
      opt.textContent = champ.name;
      select.appendChild(opt);
    });
  });
}

// イベントリスナーの初期化
function initEventListeners() {
  // ナビゲーション切り替え
  const navButtons = {
    "btn-show-dashboard": "section-dashboard",
    "btn-show-draft": "section-draft",
    "btn-show-settings": "section-settings"
  };

  Object.entries(navButtons).forEach(([btnId, sectionId]) => {
    document.getElementById(btnId).addEventListener("click", () => {
      document.querySelectorAll(".nav-btn").forEach(btn => btn.classList.remove("active"));
      document.getElementById(btnId).classList.add("active");

      document.querySelectorAll(".view-section").forEach(sec => sec.classList.remove("active"));
      document.getElementById(sectionId).classList.add("active");

      // ドラフト画面への遷移時
      if (sectionId === "section-draft" && !AppState.draft.active) {
        startDraftSimulation();
      }
    });
  });



  // ドラフト開始ボタン
  document.getElementById("btn-start-draft").addEventListener("click", () => {
    document.getElementById("btn-show-draft").click();
  });

  // モーダルイベント
  document.getElementById("btn-close-modal").addEventListener("click", closeModal);
  document.getElementById("btn-save-pool").addEventListener("click", closeModal);

  // チャンピオン検索サジェスト (モーダル用)
  const poolSearchInput = document.getElementById("pool-champ-search");
  poolSearchInput.addEventListener("input", handlePoolSearchInput);
  poolSearchInput.addEventListener("focus", handlePoolSearchInput);
  
  // フォーカスが外れたら少し遅れてサジェストを閉じる（クリックイベントを消化するため）
  poolSearchInput.addEventListener("blur", () => {
    setTimeout(() => {
      document.getElementById("pool-search-suggestions").classList.add("hidden");
    }, 200);
  });

  // プールへの追加ボタン
  document.getElementById("btn-add-to-pool").addEventListener("click", addChampToPool);

  // ドラフト画面: チャンピオン検索
  document.getElementById("champ-search-input").addEventListener("input", filterChampionsGrid);

  // ドラフト画面: ロールフィルター
  document.querySelectorAll(".role-filter-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      document.querySelectorAll(".role-filter-btn").forEach(b => b.classList.remove("active"));
      e.target.classList.add("active");
      filterChampionsGrid();
    });
  });

  // LOCK IN ボタン
  document.getElementById("btn-lock-in").addEventListener("click", handleLockIn);

  // ドラフトリセット・戻るボタン
  document.getElementById("btn-reset-draft").addEventListener("click", resetDraftSimulation);
  document.getElementById("btn-back-to-dashboard").addEventListener("click", () => {
    document.getElementById("btn-show-dashboard").click();
  });

  // ドラフト画面内のタブ切り替え（チャンピオン一覧 vs AI推奨 vs AI構成診断 vs AIチャット）
  document.getElementById("tab-btn-champions").addEventListener("click", () => {
    document.getElementById("tab-btn-champions").classList.add("active");
    document.getElementById("tab-btn-ai").classList.remove("active");
    document.getElementById("tab-btn-diagnose").classList.remove("active");
    document.getElementById("tab-btn-chat").classList.remove("active");
    document.getElementById("panel-champions").classList.add("active");
    document.getElementById("panel-ai").classList.remove("active");
    document.getElementById("panel-diagnose").classList.remove("active");
    document.getElementById("panel-chat").classList.remove("active");
  });
  document.getElementById("tab-btn-ai").addEventListener("click", () => {
    document.getElementById("tab-btn-champions").classList.remove("active");
    document.getElementById("tab-btn-ai").classList.add("active");
    document.getElementById("tab-btn-diagnose").classList.remove("active");
    document.getElementById("tab-btn-chat").classList.remove("active");
    document.getElementById("panel-champions").classList.remove("active");
    document.getElementById("panel-ai").classList.add("active");
    document.getElementById("panel-diagnose").classList.remove("active");
    document.getElementById("panel-chat").classList.remove("active");
    updateAIRecommendations(); // 推奨の更新
  });
  document.getElementById("tab-btn-diagnose").addEventListener("click", () => {
    document.getElementById("tab-btn-champions").classList.remove("active");
    document.getElementById("tab-btn-ai").classList.remove("active");
    document.getElementById("tab-btn-diagnose").classList.add("active");
    document.getElementById("tab-btn-chat").classList.remove("active");
    document.getElementById("panel-champions").classList.remove("active");
    document.getElementById("panel-ai").classList.remove("active");
    document.getElementById("panel-diagnose").classList.add("active");
    document.getElementById("panel-chat").classList.remove("active");
  });
  document.getElementById("tab-btn-chat").addEventListener("click", () => {
    document.getElementById("tab-btn-champions").classList.remove("active");
    document.getElementById("tab-btn-ai").classList.remove("active");
    document.getElementById("tab-btn-diagnose").classList.remove("active");
    document.getElementById("tab-btn-chat").classList.add("active");
    document.getElementById("panel-champions").classList.remove("active");
    document.getElementById("panel-ai").classList.remove("active");
    document.getElementById("panel-diagnose").classList.remove("active");
    document.getElementById("panel-chat").classList.add("active");
    scrollToChatBottom();
  });

  // カウンター相性設定の保存
  document.getElementById("btn-save-counter").addEventListener("click", saveCounterConfig);
  document.getElementById("counter-target").addEventListener("change", loadCounterConfig);

  // シナジー相性設定の保存
  document.getElementById("btn-save-synergy").addEventListener("click", saveSynergyConfig);
  document.getElementById("synergy-target").addEventListener("change", loadSynergyConfig);

  // OP.GGインポートボタン
  document.getElementById("btn-import-opgg").addEventListener("click", handleOpggImport);

  // Gemini APIキー保存ボタン
  document.getElementById("btn-save-gemini-key").addEventListener("click", handleGeminiKeySave);

  // AIチャット送信
  document.getElementById("btn-send-chat").addEventListener("click", handleChatSend);
  document.getElementById("ai-chat-input").addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      handleChatSend();
    }
  });

  // AI構成診断の実行
  document.getElementById("btn-run-diagnose").addEventListener("click", handleRunDiagnose);
  document.getElementById("btn-re-diagnose").addEventListener("click", handleRunDiagnose);

  // ドラフトモード切り替え
  document.getElementById("btn-mode-custom").addEventListener("click", () => {
    document.getElementById("btn-mode-custom").classList.add("active");
    document.getElementById("btn-mode-ranked").classList.remove("active");
    AppState.draftMode = "custom";
    showToast("対戦モード：カスタム戦 (相手の得意プールを考慮します)");
    renderDashboard();
  });

  document.getElementById("btn-mode-ranked").addEventListener("click", () => {
    document.getElementById("btn-mode-custom").classList.remove("active");
    document.getElementById("btn-mode-ranked").classList.add("active");
    AppState.draftMode = "ranked";
    showToast("対戦モード：フルパランク (相手プールを非開示にし、一般メタからBAN推奨を出します)");
    renderDashboard();
  });

  // 選手マスター新規登録
  const addMasterBtn = document.getElementById("btn-add-master-player");
  if (addMasterBtn) {
    addMasterBtn.addEventListener("click", handleAddMasterPlayer);
  }

  // 得意ロールチェックボックスと強さ入力の有効/無効連動
  document.querySelectorAll('input[name="master-player-roles"]').forEach(checkbox => {
    checkbox.addEventListener("change", (e) => {
      const role = e.target.value;
      const inputEl = document.querySelector(`input[name="master-player-strength-${role}"]`);
      if (inputEl) {
        inputEl.disabled = !e.target.checked;
        if (e.target.checked) {
          inputEl.focus();
        }
      }
    });
  });

  // ドラフト保存ボタン
  const saveDraftBtn = document.getElementById("btn-save-current-draft");
  if (saveDraftBtn) {
    saveDraftBtn.addEventListener("click", handleSaveCurrentDraft);
  }
}


// トースト通知を表示
function showToast(message, duration = 3000) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.classList.remove("hidden");
  
  // アニメーション用
  toast.style.opacity = 1;

  clearTimeout(toast.timeoutId);
  toast.timeoutId = setTimeout(() => {
    toast.classList.add("hidden");
  }, duration);
}

// ==========================================
// キャラリープール編集モーダル処理
// ==========================================
// 編集対象のオブジェクトを特定するヘルパー
function getEditingPlayerObject() {
  const { side, index, masterPlayerId } = AppState.editingPlayer;
  if (masterPlayerId) {
    return AppState.playerMaster.find(p => p.id === masterPlayerId);
  }
  return AppState.teamData[side][index];
}

// アクティブチームから名簿選手へのプール同期
function syncActivePlayerPoolToMaster(side, index) {
  const activePlayer = AppState.teamData[side][index];
  if (!activePlayer) return;

  const matched = AppState.playerMaster.find(p => p.name === activePlayer.name);
  if (matched) {
    matched.pool = JSON.parse(JSON.stringify(activePlayer.pool));
    savePlayerMaster();
  }
}

// 名簿選手からアクティブチームへのプール同期
function syncMasterPlayerPoolToActive(masterId) {
  const master = AppState.playerMaster.find(p => p.id === masterId);
  if (!master) return;

  let changed = false;
  ['blue', 'red'].forEach(side => {
    AppState.teamData[side].forEach((player, idx) => {
      if (player.name === master.name) {
        AppState.teamData[side][idx].pool = JSON.parse(JSON.stringify(master.pool));
        changed = true;
      }
    });
  });

  if (changed) {
    saveTeamData();
  }
}

function openPoolEditModal(side, index, masterPlayerId = null) {
  AppState.editingPlayer.side = side;
  AppState.editingPlayer.index = index;
  AppState.editingPlayer.masterPlayerId = masterPlayerId;

  const player = getEditingPlayerObject();
  if (!player) return;

  const titlePrefix = masterPlayerId ? `選手名簿 [${AppState.roleMap[player.role]}]` : `${side === 'blue' ? 'BLUE TEAM' : 'RED TEAM'} [${AppState.roleMap[player.role]}]`;
  document.getElementById("modal-title").textContent = `${titlePrefix} ${player.name} のプール編集`;

  // フォームクリア
  document.getElementById("pool-champ-search").value = "";
  document.getElementById("pool-winrate").value = "50";
  document.getElementById("pool-mastery").value = "3";
  document.getElementById("pool-champ-search").dataset.champId = "";

  renderModalCurrentPool();

  document.getElementById("modal-pool-edit").classList.add("active");
}

function closeModal() {
  document.getElementById("modal-pool-edit").classList.remove("active");
  renderDashboard(); // ダッシュボードを更新
  renderPlayerMasterList(); // 名簿を更新
}

// モーダル内の現在のプール一覧を描画
function renderModalCurrentPool() {
  const container = document.getElementById("modal-current-pool-list");
  container.innerHTML = "";

  const player = getEditingPlayerObject();
  if (!player) return;

  if (!player.pool || player.pool.length === 0) {
    container.innerHTML = `<div style="text-align:center; padding: 20px; font-style: italic; color:#606570;">プールに登録されているチャンピオンはありません</div>`;
    return;
  }

  // 勝率の高い順にソートして表示
  const sortedPool = [...player.pool].sort((a, b) => b.winRate - a.winRate);

  sortedPool.forEach(item => {
    const champ = AppState.champions[item.champId];
    if (!champ) return;

    const row = document.createElement("div");
    row.className = "pool-list-item";

    const imgUrl = `https://ddragon.leagueoflegends.com/cdn/${AppState.ddragonVersion}/img/champion/${champ.image.full}`;
    
    row.innerHTML = `
      <div class="pool-item-champ">
        <img src="${imgUrl}" alt="${champ.name}">
        <span>${champ.name}</span>
      </div>
      <div class="pool-item-winrate">${item.winRate}%</div>
      <div class="pool-item-mastery">★${item.mastery}</div>
      <div>
        <button class="btn-delete-item" data-champ-id="${item.champId}">削除</button>
      </div>
    `;

    row.querySelector(".btn-delete-item").addEventListener("click", (e) => {
      const cid = e.target.dataset.champId;
      removeChampFromPool(cid);
    });

    container.appendChild(row);
  });
}

// プールから削除
function removeChampFromPool(champId) {
  const player = getEditingPlayerObject();
  if (!player) return;

  player.pool = player.pool.filter(item => item.champId !== champId);
  
  if (AppState.editingPlayer.masterPlayerId) {
    savePlayerMaster();
    syncMasterPlayerPoolToActive(AppState.editingPlayer.masterPlayerId);
  } else {
    saveTeamData();
    syncActivePlayerPoolToMaster(AppState.editingPlayer.side, AppState.editingPlayer.index);
  }

  renderModalCurrentPool();
}

// チャンピオンの検索サジェスト処理
function handlePoolSearchInput(e) {
  const query = e.target.value.toLowerCase().trim();
  const suggestionsBox = document.getElementById("pool-search-suggestions");
  suggestionsBox.innerHTML = "";

  if (query === "") {
    suggestionsBox.classList.add("hidden");
    return;
  }

  // 日本語の表示名、または英語IDで部分一致
  const filtered = AppState.championList.filter(champ => 
    champ.name.toLowerCase().includes(query) || 
    champ.id.toLowerCase().includes(query)
  ).slice(0, 8); // 最大8件表示

  if (filtered.length === 0) {
    suggestionsBox.classList.add("hidden");
    return;
  }

  filtered.forEach(champ => {
    const item = document.createElement("div");
    item.className = "suggestion-item";
    
    const imgUrl = `https://ddragon.leagueoflegends.com/cdn/${AppState.ddragonVersion}/img/champion/${champ.image.full}`;
    item.innerHTML = `
      <img src="${imgUrl}" alt="${champ.name}">
      <span>${champ.name} (${champ.id})</span>
    `;

    item.addEventListener("mousedown", () => {
      const input = document.getElementById("pool-champ-search");
      input.value = champ.name;
      input.dataset.champId = champ.id; // データ属性に保存
      suggestionsBox.classList.add("hidden");
    });

    suggestionsBox.appendChild(item);
  });

  suggestionsBox.classList.remove("hidden");
}

// プールにチャンピオンを追加
function addChampToPool() {
  const input = document.getElementById("pool-champ-search");
  const champId = input.dataset.champId;
  const winRate = parseFloat(document.getElementById("pool-winrate").value) || 50;
  const mastery = parseInt(document.getElementById("pool-mastery").value) || 3;

  if (!champId) {
    showToast("チャンピオンを候補リストから正しく選択してください。");
    return;
  }

  const player = getEditingPlayerObject();
  if (!player) return;

  // 既にプールに存在するかチェック
  const exists = player.pool.some(item => item.champId === champId);
  if (exists) {
    showToast("このチャンピオンは既にプールに登録されています。");
    return;
  }

  // 追加
  player.pool.push({
    champId: champId,
    winRate: winRate,
    mastery: mastery
  });

  if (AppState.editingPlayer.masterPlayerId) {
    savePlayerMaster();
    syncMasterPlayerPoolToActive(AppState.editingPlayer.masterPlayerId);
  } else {
    saveTeamData();
    syncActivePlayerPoolToMaster(AppState.editingPlayer.side, AppState.editingPlayer.index);
  }

  renderModalCurrentPool();

  // インプットクリア
  input.value = "";
  input.dataset.champId = "";
  showToast("プールに追加しました！");
}

// ==========================================
// ドラフトシミュレーション処理
// ==========================================
function startDraftSimulation() {
  AppState.draft.active = true;
  AppState.draft.currentStepIndex = 0;
  AppState.draft.blueBans = [];
  AppState.draft.redBans = [];
  AppState.draft.bluePicks = [null, null, null, null, null];
  AppState.draft.redPicks = [null, null, null, null, null];
  AppState.draft.selectedChampId = null;

  renderDraftPicks();
  renderDraftBans();
  renderChampionsGrid();
  updateDraftStateUI();
  updateWinConditionText();
}

function resetDraftSimulation() {
  if (confirm("ドラフトをリセットして最初からやり直しますか？")) {
    startDraftSimulation();
    showToast("ドラフトをリセットしました。");
  }
}

// ドラフトのPick枠を描画
function renderDraftPicks() {
  renderTeamPicks('blue', document.getElementById("blue-pick-slots"));
  renderTeamPicks('red', document.getElementById("red-pick-slots"));
}

function renderTeamPicks(side, container) {
  container.innerHTML = "";
  const players = AppState.teamData[side];
  const picks = side === 'blue' ? AppState.draft.bluePicks : AppState.draft.redPicks;
  const isRankedRed = side === 'red' && AppState.draftMode === 'ranked';

  players.forEach((player, index) => {
    const slot = document.createElement("div");
    slot.className = "pick-slot";
    slot.dataset.index = index;
    slot.id = `pick-slot-${side}-${index}`;

    // ドラフト進行中のドラッグ＆ドロップ設定 (フルパランクの敵チームはドラッグ不可)
    const isDraggable = !isRankedRed;
    if (isDraggable) {
      slot.draggable = true;
      slot.style.cursor = "grab";
      
      slot.addEventListener("dragstart", (e) => {
        e.dataTransfer.setData("text/plain", JSON.stringify({ side: side, index: index }));
        e.dataTransfer.effectAllowed = "move";
        slot.style.opacity = "0.5";
        slot.style.border = "1px dashed var(--hextech-gold)";
      });

      slot.addEventListener("dragend", () => {
        slot.style.opacity = "1";
        slot.style.border = "";
      });

      slot.addEventListener("dragover", (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
      });

      slot.addEventListener("drop", (e) => {
        e.preventDefault();
        try {
          const dragData = JSON.parse(e.dataTransfer.getData("text/plain"));
          if (dragData && dragData.side === side && dragData.index !== index) {
            swapDraftSlotOrder(side, dragData.index, index);
          }
        } catch (err) {
          console.error("Draft drop failed:", err);
        }
      });
    }

    const champId = picks[index];
    const champ = champId ? AppState.champions[champId] : null;

    // 背景スプラッシュアート
    const bg = document.createElement("div");
    bg.className = "pick-slot-bg";
    if (champ) {
      bg.style.backgroundImage = `url(https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${champ.id}_0.jpg)`;
      slot.classList.add("filled");
    }
    
    // アバター
    const avatar = document.createElement("div");
    avatar.className = "pick-slot-avatar";
    if (champ) {
      avatar.style.backgroundImage = `url(https://ddragon.leagueoflegends.com/cdn/${AppState.ddragonVersion}/img/champion/${champ.image.full})`;
    } else if (isRankedRed) {
      // ランク戦の敵未ピック枠は赤いクエスチョンアバター
      avatar.style.backgroundImage = "none";
      avatar.innerHTML = `<span style="font-size: 18px; color: #ff4e50; font-weight: 700; line-height: 1.8;">?</span>`;
      avatar.style.cssText = "display: flex; align-items: center; justify-content: center; border: 1.5px dashed rgba(255, 78, 80, 0.4); background: rgba(255, 78, 80, 0.05); border-radius: 50%;";
    }

    // プレイヤー＆チャンプ情報
    const info = document.createElement("div");
    info.className = "pick-slot-info";
    
    const pName = document.createElement("span");
    pName.className = "pick-player-name";
    if (isRankedRed) {
      pName.textContent = `対面敵 ${index + 1}`;
      pName.style.color = "#ff4e50";
    } else {
      pName.textContent = player.name || `プレイヤー ${index+1}`;
    }

    const pRole = document.createElement("span");
    pRole.className = "pick-player-role";
    pRole.textContent = AppState.roleMap[player.role];

    const cName = document.createElement("span");
    cName.className = "pick-champ-name";
    cName.textContent = champ ? champ.name : "SELECTING...";

    info.appendChild(pName);
    info.appendChild(pRole);
    info.appendChild(cName);

    slot.appendChild(bg);
    slot.appendChild(avatar);
    slot.appendChild(info);

    container.appendChild(slot);
  });
}

// ドラフト進行中のスロット入れ替え（プレイヤー＆ピック済みチャンプも同期スワップ）
function swapDraftSlotOrder(side, i, j) {
  // 1. チームプレイヤーデータの入れ替え
  const tempPlayer = AppState.teamData[side][i];
  AppState.teamData[side][i] = AppState.teamData[side][j];
  AppState.teamData[side][j] = tempPlayer;

  // 2. ピック済みチャンピオンの同期入れ替え
  const picksKey = `${side}Picks`;
  const tempChamp = AppState.draft[picksKey][i];
  AppState.draft[picksKey][i] = AppState.draft[picksKey][j];
  AppState.draft[picksKey][j] = tempChamp;

  saveTeamData();
  renderDraftPicks();
  showToast("ドラフト内の配置を入れ替えました！");
}

// BAN枠の描画
function renderDraftBans() {
  const sides = ['blue', 'red'];
  sides.forEach(side => {
    const bans = side === 'blue' ? AppState.draft.blueBans : AppState.draft.redBans;
    const slots = document.getElementById(`${side}-ban-slots`).children;
    
    for (let i = 0; i < 5; i++) {
      const slot = slots[i];
      slot.className = "ban-slot";
      slot.style.backgroundImage = "none";
      
      const champId = bans[i];
      if (champId) {
        const champ = AppState.champions[champId];
        if (champ) {
          slot.style.backgroundImage = `url(https://ddragon.leagueoflegends.com/cdn/${AppState.ddragonVersion}/img/champion/${champ.image.full})`;
          slot.classList.add("filled");
        }
      }
    }
  });
}

// チャンピオン選択グリッドの描画
function renderChampionsGrid() {
  const grid = document.getElementById("champions-grid");
  grid.innerHTML = "";

  AppState.championList.forEach(champ => {
    const item = document.createElement("div");
    item.className = "champ-grid-item";
    item.dataset.champId = champ.id;
    item.dataset.roles = JSON.stringify(champ.tags); // ['Mage', 'Assassin'] などのタグが入っている

    const imgUrl = `https://ddragon.leagueoflegends.com/cdn/${AppState.ddragonVersion}/img/champion/${champ.image.full}`;
    item.innerHTML = `
      <img src="${imgUrl}" alt="${champ.name}" loading="lazy">
      <div class="champ-grid-name">${champ.name}</div>
    `;

    item.addEventListener("click", () => {
      if (item.classList.contains("disabled")) return;
      selectChampionForDraft(champ.id);
    });

    grid.appendChild(item);
  });
}

// チャンピオンリストの検索・フィルター処理
function filterChampionsGrid() {
  const searchQuery = document.getElementById("champ-search-input").value.toLowerCase().trim();
  const activeRoleBtn = document.querySelector(".role-filter-btn.active");
  const selectedRole = activeRoleBtn ? activeRoleBtn.dataset.role : "all";

  // ロールのマッピング (DDragonのtagsとUIロール)
  // TOP -> Fighter, Tank
  // JUNGLE -> Fighter, Assassin, Tank
  // MIDDLE -> Mage, Assassin
  // BOTTOM -> Marksman
  // UTILITY -> Support, Mage
  const tagFilters = {
    "TOP": ["Fighter", "Tank"],
    "JUNGLE": ["Fighter", "Assassin", "Tank"],
    "MIDDLE": ["Mage", "Assassin"],
    "BOTTOM": ["Marksman"],
    "UTILITY": ["Support", "Mage"]
  };

  const gridItems = document.querySelectorAll(".champ-grid-item");
  
  gridItems.forEach(item => {
    const champId = item.dataset.champId;
    const champ = AppState.champions[champId];
    if (!champ) return;

    // 1. 検索クエリマッチ
    const matchesSearch = champ.name.toLowerCase().includes(searchQuery) || champ.id.toLowerCase().includes(searchQuery);

    // 2. ロールフィルターマッチ
    let matchesRole = true;
    if (selectedRole !== "all") {
      const allowedTags = tagFilters[selectedRole] || [];
      matchesRole = champ.tags.some(tag => allowedTags.includes(tag));
    }

    if (matchesSearch && matchesRole) {
      item.classList.remove("hidden");
    } else {
      item.classList.add("hidden");
    }
  });
}

// チャンピオンの選択（LOCK IN 前の一時選択）
function selectChampionForDraft(champId) {
  // すでにBAN/PICKされているか確認
  const allUsed = new Set([
    ...AppState.draft.blueBans,
    ...AppState.draft.redBans,
    ...AppState.draft.bluePicks.filter(Boolean),
    ...AppState.draft.redPicks.filter(Boolean)
  ]);

  if (allUsed.has(champId)) {
    return; // 使用不可
  }

  // 選択枠のアクティブ表示切替
  document.querySelectorAll(".champ-grid-item").forEach(item => {
    if (item.dataset.champId === champId) {
      item.classList.add("selected");
    } else {
      item.classList.remove("selected");
    }
  });

  AppState.draft.selectedChampId = champId;

  // LOCK IN ボタン有効化
  const lockBtn = document.getElementById("btn-lock-in");
  lockBtn.classList.remove("btn-disabled");
  lockBtn.disabled = false;

  // プレビュー表示の更新（Pickスロット）
  const step = DRAFT_STEPS[AppState.draft.currentStepIndex];
  if (step && step.type === 'pick') {
    const slotEl = document.getElementById(`pick-slot-${step.team}-${step.slotIndex}`);
    if (slotEl) {
      const champ = AppState.champions[champId];
      const avatar = slotEl.querySelector(".pick-slot-avatar");
      const cName = slotEl.querySelector(".pick-champ-name");
      const bg = slotEl.querySelector(".pick-slot-bg");

      avatar.style.backgroundImage = `url(https://ddragon.leagueoflegends.com/cdn/${AppState.ddragonVersion}/img/champion/${champ.image.full})`;
      cName.textContent = champ.name;
      bg.style.backgroundImage = `url(https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${champ.id}_0.jpg)`;
    }
  }
}

// LOCK IN（選択確定）処理
function handleLockIn() {
  const cid = AppState.draft.selectedChampId;
  if (!cid) return;

  const step = DRAFT_STEPS[AppState.draft.currentStepIndex];
  if (!step) return;

  if (step.type === 'ban') {
    if (step.team === 'blue') {
      AppState.draft.blueBans.push(cid);
    } else {
      AppState.draft.redBans.push(cid);
    }
  } else if (step.type === 'pick') {
    if (step.team === 'blue') {
      AppState.draft.bluePicks[step.slotIndex] = cid;
    } else {
      AppState.draft.redPicks[step.slotIndex] = cid;
    }
  }

  // 選択されていたマスの disabled 属性を設定し、全マスの選択を解除
  AppState.draft.selectedChampId = null;
  const lockBtn = document.getElementById("btn-lock-in");
  lockBtn.classList.add("btn-disabled");
  lockBtn.disabled = true;

  // UI再描画
  renderDraftPicks();
  renderDraftBans();
  disableUsedChampionsInGrid();

  // 次のステップへ
  AppState.draft.currentStepIndex++;

  if (AppState.draft.currentStepIndex >= DRAFT_STEPS.length) {
    // ドラフト会議終了
    updateDraftStateUI(true);
  } else {
    // 進行中
    updateDraftStateUI();
  }
}

// 既にBAN/PICKされたチャンピオンをグリッド上でグレーアウト
function disableUsedChampionsInGrid() {
  const allUsed = new Set([
    ...AppState.draft.blueBans,
    ...AppState.draft.redBans,
    ...AppState.draft.bluePicks.filter(Boolean),
    ...AppState.draft.redPicks.filter(Boolean)
  ]);

  document.querySelectorAll(".champ-grid-item").forEach(item => {
    const cid = item.dataset.champId;
    item.classList.remove("selected");
    if (allUsed.has(cid)) {
      item.classList.add("disabled");
    } else {
      item.classList.remove("disabled");
    }
  });
}

// 現在の進行ステップに応じたドラフトUI（枠の強調、ステータステキストなど）の更新
function updateDraftStateUI(isFinished = false) {
  // 全てのスロットの強調をクリア
  document.querySelectorAll(".pick-slot").forEach(s => s.classList.remove("active-pick"));
  document.querySelectorAll(".ban-slot").forEach(s => s.classList.remove("active-target"));

  const poolBox = document.getElementById("turn-player-pool-box");

  if (isFinished) {
    document.getElementById("draft-phase-name").textContent = "ドラフト完了！";
    document.getElementById("draft-timer").textContent = "--";
    document.getElementById("draft-sub-status").textContent = "お疲れ様でした";
    if (poolBox) poolBox.classList.add("hidden");
    showToast("ドラフト会議が完了しました！");
    
    // AI推奨の最終更新
    updateAIRecommendations(true);
    return;
  }

  const step = DRAFT_STEPS[AppState.draft.currentStepIndex];
  if (!step) return;

  // タイトルとサブテキストの変更
  const actionText = step.type === 'ban' ? 'BANNING...' : 'PICKING...';
  const teamText = step.team === 'blue' ? 'BLUE TEAM' : 'RED TEAM';
  
  document.getElementById("draft-phase-name").textContent = `${teamText} ${actionText}`;
  document.getElementById("draft-sub-status").textContent = `${step.label} フェーズ`;

  // カウントダウンタイマー（擬似タイマー: 30秒固定）
  document.getElementById("draft-timer").textContent = "30";

  // スロットの強調
  if (step.type === 'pick') {
    const activeSlot = document.getElementById(`pick-slot-${step.team}-${step.slotIndex}`);
    if (activeSlot) activeSlot.classList.add("active-pick");
  } else if (step.type === 'ban') {
    const bans = step.team === 'blue' ? AppState.draft.blueBans : AppState.draft.redBans;
    const banIndex = bans.length; // 次に格納されるインデックス
    const banSlots = document.getElementById(`${step.team}-ban-slots`).children;
    if (banSlots[banIndex]) {
      banSlots[banIndex].classList.add("active-target");
    }
  }

  // 既に使われているものを非活性化
  disableUsedChampionsInGrid();

  // 勝利条件 (Win Condition) プランの更新
  updateWinConditionText();

  // 手番プレイヤーの得意プール一覧を描画
  renderTurnPlayerPoolUI();

  // AI推奨の自動更新（タブがAI推奨になっていれば）
  if (document.getElementById("tab-btn-ai").classList.contains("active")) {
    updateAIRecommendations();
  }
}

// 現在の手番プレイヤーの得意チャンピオンプールを描画するUI処理
function renderTurnPlayerPoolUI() {
  const box = document.getElementById("turn-player-pool-box");
  const nameDisplay = document.getElementById("turn-player-name-display");
  const list = document.getElementById("turn-player-pool-list");

  if (!box || !nameDisplay || !list) return;

  const step = DRAFT_STEPS[AppState.draft.currentStepIndex];
  
  // PICKフェーズでなければプールは非表示
  if (!step || step.type !== 'pick') {
    box.classList.add("hidden");
    return;
  }

  // フルパランク戦での敵手番時はプールを非表示にする
  if (step.team === 'red' && AppState.draftMode === 'ranked') {
    box.classList.add("hidden");
    return;
  }

  // アサインされている選手を取得
  const player = AppState.teamData[step.team][step.slotIndex];
  if (!player || !player.name) {
    box.classList.add("hidden");
    return;
  }

  nameDisplay.textContent = `${player.name} (${AppState.roleMap[player.role]})`;
  list.innerHTML = "";

  // 既にBAN/PICKされているチャンピオン
  const allUsed = new Set([
    ...AppState.draft.blueBans,
    ...AppState.draft.redBans,
    ...AppState.draft.bluePicks.filter(Boolean),
    ...AppState.draft.redPicks.filter(Boolean)
  ]);

  if (!player.pool || player.pool.length === 0) {
    list.innerHTML = `<div style="font-size:10px; color:#606570; font-style:italic; padding: 4px 0;">登録されている得意チャンピオンがありません</div>`;
  } else {
    // 勝率の高い順にソート
    const sortedPool = [...player.pool].sort((a, b) => b.winRate - a.winRate);

    sortedPool.forEach(item => {
      const champ = AppState.champions[item.champId];
      if (!champ) return;

      const isUsed = allUsed.has(item.champId);

      const btn = document.createElement("button");
      btn.className = `btn-pool-quick-select ${isUsed ? 'used' : ''}`;
      btn.style.cssText = `
        display: flex;
        align-items: center;
        gap: 6px;
        background: rgba(200, 170, 110, 0.08);
        border: 1px solid ${isUsed ? 'rgba(255,255,255,0.03)' : 'rgba(200, 170, 110, 0.35)'};
        color: ${isUsed ? '#505560' : '#fff'};
        padding: 4px 8px;
        border-radius: 4px;
        cursor: ${isUsed ? 'not-allowed' : 'pointer'};
        font-size: 11px;
        white-space: nowrap;
        transition: all 0.2s;
        opacity: ${isUsed ? '0.4' : '1'};
      `;

      const imgUrl = `https://ddragon.leagueoflegends.com/cdn/${AppState.ddragonVersion}/img/champion/${champ.image.full}`;
      btn.innerHTML = `
        <img src="${imgUrl}" alt="${champ.name}" style="width: 16px; height: 16px; border-radius: 50%;">
        <span>${champ.name} (${item.winRate}%)</span>
      `;

      if (!isUsed) {
        btn.addEventListener("click", () => {
          selectChampionForDraft(item.champId);
        });
        
        btn.addEventListener("mouseenter", () => {
          btn.style.background = "rgba(200, 170, 110, 0.25)";
          btn.style.borderColor = "var(--gold-magic)";
        });
        btn.addEventListener("mouseleave", () => {
          btn.style.background = "rgba(200, 170, 110, 0.08)";
          btn.style.borderColor = "rgba(200, 170, 110, 0.35)";
        });
      }

      list.appendChild(btn);
    });
  }

  box.classList.remove("hidden");
}

// AI推奨スコアの計算と描画
function updateAIRecommendations(isFinished = false) {
  const banContainer = document.getElementById("ai-ban-recs");
  const pickContainer = document.getElementById("ai-pick-recs");

  banContainer.innerHTML = "";
  pickContainer.innerHTML = "";

  if (isFinished) {
    banContainer.innerHTML = `<div class="no-rec-message">ドラフトは終了しました</div>`;
    pickContainer.innerHTML = `<div class="no-rec-message">ドラフトは終了しました</div>`;
    return;
  }

  const step = DRAFT_STEPS[AppState.draft.currentStepIndex];
  if (!step) return;

  // 現在の状況をエンジンへ渡す形に構築
  const draftState = {
    blueBans: AppState.draft.blueBans,
    redBans: AppState.draft.redBans,
    bluePicks: AppState.draft.bluePicks.filter(Boolean),
    redPicks: AppState.draft.redPicks.filter(Boolean),
    activeTeam: step.team,
    draftMode: AppState.draftMode
  };

  const allySide = step.team;
  const enemySide = step.team === 'blue' ? 'red' : 'blue';

  const allyPlayers = AppState.teamData[allySide];
  const enemyPlayers = AppState.teamData[enemySide];

  // 1. BAN推奨の計算 (相手のプールから計算するため、enemyPlayersを渡す)
  const banRecs = DraftEngine.getBanRecommendations(draftState, enemyPlayers, AppState.customDatabase);
  
  if (banRecs.length === 0) {
    banContainer.innerHTML = `<div class="no-rec-message">相手プレイヤーの得意プールがありません</div>`;
  } else {
    banRecs.slice(0, 5).forEach(rec => {
      const champ = AppState.champions[rec.champId];
      if (!champ) return;

      const card = createAiRecommendationCard(champ, rec, true);
      banContainer.appendChild(card);
    });
  }

  // 2. PICK推奨の計算 (現在のスロットを担当するプレイヤーの得意プールから)
  let currentPlayer = null;
  if (step.type === 'pick') {
    // 現在のPickを担当する味方チームのプレイヤー
    currentPlayer = allyPlayers[step.slotIndex];
  } else {
    // BANフェーズの場合は、味方全体でまだPickされていない各ロールの推奨値をだすため、
    // 現在BAN中なら、まだ空いている味方のスロットの適当なプレイヤーを想定
    const emptySlotIdx = AppState.draft[`${allySide}Picks`].findIndex(p => !p);
    if (emptySlotIdx !== -1) {
      currentPlayer = allyPlayers[emptySlotIdx];
    }
  }

  if (!currentPlayer) {
    pickContainer.innerHTML = `<div class="no-rec-message">現在推奨を計算できません</div>`;
  } else {
    const allyPicks = draftState[`${allySide}Picks`];
    const enemyPicks = draftState[`${enemySide}Picks`];

    const pickRecs = DraftEngine.getPickRecommendations(
      draftState,
      currentPlayer,
      allyPlayers,
      enemyPlayers,
      AppState.customDatabase
    );

    if (pickRecs.length === 0) {
      pickContainer.innerHTML = `<div class="no-rec-message">${currentPlayer.name}のキャラプールに対応するチャンピオンがありません</div>`;
    } else {
      pickRecs.slice(0, 5).forEach(rec => {
        const champ = AppState.champions[rec.champId];
        if (!champ) return;

        const card = createAiRecommendationCard(champ, rec, false, currentPlayer.name);
        pickContainer.appendChild(card);
      });
    }
  }
}

// AI推奨アイテムカードのDOM生成
function createAiRecommendationCard(champ, recData, isBan = false, playerName = '') {
  const item = document.createElement("div");
  item.className = "ai-rec-item";

  const imgUrl = `https://ddragon.leagueoflegends.com/cdn/${AppState.ddragonVersion}/img/champion/${champ.image.full}`;
  
  // 理由・バッジのHTML構築
  const badgesHtml = recData.badges.map(b => `
    <span class="ai-badge ${b.type}">${b.text}</span>
  `).join('');

  item.innerHTML = `
    <img src="${imgUrl}" alt="${champ.name}" class="ai-rec-img">
    <div class="ai-rec-info">
      <div class="ai-rec-name-row">
        <span class="ai-rec-name">${champ.name}</span>
        <span class="ai-rec-score">${isBan ? '脅威' : '推奨'}: ${recData.score}</span>
      </div>
      <div class="ai-rec-badges">
        ${badgesHtml}
      </div>
    </div>
  `;

  // クリックでドラフト選択ショートカット
  item.addEventListener("click", () => {
    // チャンピオン一覧タブに自動的に戻し、そのキャラを選択
    document.getElementById("tab-btn-champions").click();
    selectChampionForDraft(champ.id);
    showToast(`${champ.name} を仮選択しました。LOCK INを押して確定してください。`);
  });

  return item;
}

// ==========================================
// カウンター・シナジーのカスタマイズ設定処理
// ==========================================
function loadCounterConfig() {
  const targetId = document.getElementById("counter-target").value;
  const helpersSelect = document.getElementById("counter-helpers");
  
  // 選択解除
  Array.from(helpersSelect.options).forEach(opt => opt.selected = false);

  if (!targetId) return;

  // 既存のカウンターを読み込み
  const counters = AppState.customDatabase.counters[targetId] || [];
  Array.from(helpersSelect.options).forEach(opt => {
    if (counters.includes(opt.value)) {
      opt.selected = true;
    }
  });
}

function saveCounterConfig() {
  const targetId = document.getElementById("counter-target").value;
  const helpersSelect = document.getElementById("counter-helpers");

  if (!targetId) {
    showToast("基準となるチャンピオンを選択してください。");
    return;
  }

  const selectedValues = Array.from(helpersSelect.selectedOptions).map(opt => opt.value);

  if (selectedValues.length === 0) {
    delete AppState.customDatabase.counters[targetId];
  } else {
    AppState.customDatabase.counters[targetId] = selectedValues;
  }

  saveCustomDatabase();
  showToast(`${AppState.champions[targetId].name} のカウンター関係を設定しました。`);
}

function loadSynergyConfig() {
  const targetId = document.getElementById("synergy-target").value;
  const helpersSelect = document.getElementById("synergy-helpers");

  // 選択解除
  Array.from(helpersSelect.options).forEach(opt => opt.selected = false);

  if (!targetId) return;

  // 既存のシナジーを読み込み
  const synergies = AppState.customDatabase.synergies[targetId] || [];
  Array.from(helpersSelect.options).forEach(opt => {
    if (synergies.includes(opt.value)) {
      opt.selected = true;
    }
  });
}

function saveSynergyConfig() {
  const targetId = document.getElementById("synergy-target").value;
  const helpersSelect = document.getElementById("synergy-helpers");

  if (!targetId) {
    showToast("基準となるチャンピオンを選択してください。");
    return;
  }

  const selectedValues = Array.from(helpersSelect.selectedOptions).map(opt => opt.value);

  if (selectedValues.length === 0) {
    delete AppState.customDatabase.synergies[targetId];
  } else {
    AppState.customDatabase.synergies[targetId] = selectedValues;
  }

  saveCustomDatabase();
  showToast(`${AppState.champions[targetId].name} のシナジー関係を設定しました。`);
}

// ==========================================
// OP.GGインポート処理 & テキストパース
// ==========================================
function handleOpggImport() {
  const pasteArea = document.getElementById("opgg-paste-area");
  const text = pasteArea.value.trim();

  if (!text) {
    showToast("貼り付けエリアが空です。OP.GGの戦績テキストを貼り付けてください。");
    return;
  }

  const side = AppState.editingPlayer.side;
  const index = AppState.editingPlayer.index;
  const player = AppState.teamData[side][index];

  const importedList = parseOpggText(text);

  if (importedList.length === 0) {
    showToast("テキストからチャンピオンデータを検出できませんでした。フォーマットを確認してください。");
    return;
  }

  // 既存のプールとマージ
  const existingPoolMap = {};
  player.pool.forEach(item => {
    existingPoolMap[item.champId] = item;
  });

  importedList.forEach(importedItem => {
    existingPoolMap[importedItem.champId] = {
      champId: importedItem.champId,
      winRate: importedItem.winRate,
      mastery: importedItem.mastery
    };
  });

  player.pool = Object.values(existingPoolMap);
  saveTeamData();

  // モーダルとダッシュボード表示を更新
  renderModalCurrentPool();

  // テキストエリアをクリア
  pasteArea.value = "";
  
  showToast(`${importedList.length} 件のチャンピオンデータをインポートしました！`);
}

function parseOpggText(text) {
  const lines = text.split('\n').map(line => line.trim()).filter(Boolean);
  const results = [];

  // 全チャンピオンのマッピングマップを作成（日本語名・英語ID ➔ 正式ID）
  const champMap = {};
  AppState.championList.forEach(c => {
    champMap[c.name.toLowerCase()] = c.id;
    champMap[c.id.toLowerCase()] = c.id;
  });

  // 改行やタブでテキストをスキャン
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    let matchedChampId = null;

    // トークン分割してチェック
    const tokens = line.split(/[\s\t,]+/).map(t => t.toLowerCase().trim()).filter(Boolean);
    for (const token of tokens) {
      if (champMap[token]) {
        matchedChampId = champMap[token];
        break;
      }
    }

    // 行全体の部分一致チェック（日本語名など）
    if (!matchedChampId) {
      for (const [name, id] of Object.entries(champMap)) {
        if (line.toLowerCase() === name || line.toLowerCase().includes(name)) {
          matchedChampId = id;
          break;
        }
      }
    }

    if (matchedChampId) {
      // チャンピオンを検出。勝率とゲーム数（試合数）のコンテキストスキャン
      let winRate = 50;
      let games = 10;

      // 該当行、その前後行を含むコンテキストテキストの結合
      const contextLines = [];
      if (i > 0) contextLines.push(lines[i-1]);
      contextLines.push(line);
      if (i < lines.length - 1) contextLines.push(lines[i+1]);
      if (i < lines.length - 2) contextLines.push(lines[i+2]);
      if (i < lines.length - 3) contextLines.push(lines[i+3]); // OP.GGのコピーは改行が多いため広めにスキャン

      const contextText = contextLines.join(' ');

      // 1. 勝率の抽出 (%付き数値)
      const wrRegex = /(\d+(?:\.\d+)?)\s*%/;
      const wrMatch = contextText.match(wrRegex);
      if (wrMatch) {
        winRate = parseFloat(wrMatch[1]);
      }

      // 2. 試合数の抽出 (「ゲーム」「戦」「Played」「G」などの手前の数値)
      const gamesRegex = /(\d+)\s*(?:ゲーム|戦|試合|Played|played|G|g)/i;
      const gamesMatch = contextText.match(gamesRegex);
      if (gamesMatch) {
        games = parseInt(gamesMatch[1], 10);
      } else {
        // 単位が見つからない場合、コンテキスト内の「順位や勝率以外の妥当な数値」を推測
        const numbers = contextText.match(/\b\d+\b/g);
        if (numbers) {
          for (const numStr of numbers) {
            const num = parseInt(numStr, 10);
            // 順位（1桁）や勝率（winRateの整数部分）以外の、1以上の数値を試合数として仮定
            if (num > 0 && num < 1000 && num !== Math.floor(winRate)) {
              games = num;
              break;
            }
          }
        }
      }

      // 試合数と勝率から熟練度（★1〜5）をインテリジェントに判定
      let mastery = 3;
      if (games >= 30) mastery = 5;
      else if (games >= 15) mastery = 4;
      else if (games >= 6) mastery = 3;
      else if (games >= 3) mastery = 2;
      else mastery = 1;

      // 勝率に応じた補正
      if (winRate >= 60 && mastery < 5) mastery += 1;
      if (winRate <= 40 && mastery > 1) mastery -= 1;

      // 同一プレイヤー内で同じチャンピオンの重複インポートを防ぐ
      if (!results.some(r => r.champId === matchedChampId)) {
        results.push({
          champId: matchedChampId,
          winRate: winRate,
          mastery: mastery
        });
      }
    }
  }

  return results;
}

// ==========================================
// Gemini API 設定 & 保存
// ==========================================
function handleGeminiKeySave() {
  const keyInput = document.getElementById("gemini-api-key");
  const apiKey = keyInput.value.trim();

  AppState.geminiApiKey = apiKey;
  localStorage.setItem("lol_draft_gemini_key", apiKey);

  if (apiKey) {
    showToast("Gemini API キーを保存しました。AIコーチが有効化されました！");
  } else {
    showToast("APIキーをクリアしました。簡易AIコーチモードで動作します。");
  }
}

// ==========================================
// AIチャット送受信処理
// ==========================================
async function handleChatSend() {
  const inputEl = document.getElementById("ai-chat-input");
  const query = inputEl.value.trim();

  if (!query) return;

  // 入力欄クリア
  inputEl.value = "";

  // 1. ユーザーのメッセージを画面に表示
  addChatMessageToUi("user", query);
  AppState.chatHistory.push({ role: "user", text: query });

  // 2. ローディングメッセージを表示
  const loadingId = addChatMessageToUi("coach", "思考中...");

  try {
    let coachResponse = "";

    try {
      // サーバー側の共有キー、またはユーザー個人のキーでGemini APIを叩きに行く
      coachResponse = await sendChatMessageToGemini(query);
    } catch (apiErr) {
      console.warn("Failed to get response from Gemini API, falling back to local coach.", apiErr);
      // APIキー未設定やネットワークエラーの時は、ローカルの簡易コーチが応答を返す
      coachResponse = getLocalCoachResponse(query);
    }

    // 3. ローディングメッセージを消し、AIの回答を表示
    const loadingEl = document.getElementById(loadingId);
    if (loadingEl) {
      loadingEl.querySelector(".chat-bubble").textContent = coachResponse;
    }
    AppState.chatHistory.push({ role: "model", text: coachResponse });

  } catch (error) {
    console.error("AIコーチの応答取得に失敗しました。", error);
    const loadingEl = document.getElementById(loadingId);
    if (loadingEl) {
      loadingEl.querySelector(".chat-bubble").textContent = "通信エラーが発生しました。APIキーまたは接続状況を確認してください。";
    }
  }

  scrollToChatBottom();
}

// Gemini API 通信ロジック
async function sendChatMessageToGemini(userQuery) {
  const step = DRAFT_STEPS[AppState.draft.currentStepIndex];
  const activeSide = step ? step.team : 'blue';
  
  const context = {
    currentDraftStep: step ? step.label : "完了",
    activeTeam: activeSide === 'blue' ? "味方 (BLUE)" : "相手 (RED)",
    draftMode: AppState.draftMode === 'ranked' ? "フルパランク戦 (相手プレイヤーのプールは不明。メタ重視)" : "カスタム戦 (相手プレイヤーのプール開示済み)",
    blueBans: AppState.draft.blueBans,
    redBans: AppState.draft.redBans,
    bluePicks: AppState.draft.bluePicks.filter(Boolean),
    redPicks: AppState.draft.redPicks.filter(Boolean),
    teamConfig: {
      blueTeam: AppState.teamData.blue.map(p => ({
        name: p.name,
        role: p.role,
        strength: p.strength || 80,
        pool: p.pool.map(c => `${c.champId}(勝率${c.winRate}%, 熟練度★${c.mastery})`)
      })),
      redTeam: AppState.draftMode === 'ranked' ? "非公開 (フルパランク)" : AppState.teamData.red.map(p => ({
        name: p.name,
        role: p.role,
        pool: p.pool.map(c => `${c.champId}(勝率${c.winRate}%, 熟練度★${c.mastery})`)
      }))
    }
  };

  // プロンプトの組み立て
  const systemInstruction = `
あなたはLeague of Legends (LoL) のプロコーチであり、オンラインコミュニティ「しろ鯖」専用のドラフト戦術アドバイザー兼コーチです。
以下の現在のドラフト状況と、両チームのプレイヤーキャラプール、レーン習熟度（強さ数値 1-100）を完全に把握しています。

---
【現在のドラフトコンテキスト】
${JSON.stringify(context, null, 2)}
---

【指示】
1. ユーザーからのBANやPICKに関する相談、メタ構成、および「今回のチーム勝利条件 (Win Condition / ゲームプラン)」について、戦術的かつ具体的に答えてください。
2. 味方プレイヤーごとの「レーン強さ (strength)」の値を考慮し、最も実力の高いエースレーンをキャリーさせるプランや、実力の低いレーンをカバーする構成提案を行ってください。
3. フルパランク戦モードの場合は、相手チームの得意プールは不明であるため、一般的な最新の強キャラメタや敵の実際のピックからBAN/PICKを判断してください。
4. アドバイスする際は、味方プレイヤーの得意プールにないチャンピオンを無理に推奨しないでください。
5. 簡潔かつフレンドリー（熱心なプロコーチ風）に日本語で答えてください。
`;

  // 履歴も加味して送信メッセージを組み立てる
  const historyContents = AppState.chatHistory.slice(-6).map(h => ({
    role: h.role === 'user' ? 'user' : 'model',
    parts: [{ text: h.text }]
  }));

  const userMessageText = `${systemInstruction}\n\nユーザーの質問: ${userQuery}`;

  const contents = [
    ...historyContents,
    {
      role: "user",
      parts: [{ text: userMessageText }]
    }
  ];

  // サーバーのハイブリッドAPIプロキシを呼び出します（個人キーがあれば一緒に送信）
  const response = await fetch(`/api/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ 
      contents: contents,
      apiKey: AppState.geminiApiKey || ""
    })
  });

  if (!response.ok) {
    throw new Error(`Gemini API error: ${response.status}`);
  }

  const resJson = await response.json();
  if (resJson.candidates && resJson.candidates[0].content.parts[0].text) {
    return resJson.candidates[0].content.parts[0].text.trim();
  } else {
    throw new Error("無効なAPIレスポンスです。");
  }
}

// 簡易ローカルAIコーチ（APIキー未設定時のフォールバック）
function getLocalCoachResponse(query) {
  const step = DRAFT_STEPS[AppState.draft.currentStepIndex];
  if (!step) {
    return "ドラフトは既に終了しています。";
  }

  const side = step.team;
  const allyPlayers = AppState.teamData[side];
  const enemySide = side === 'blue' ? 'red' : 'blue';
  const enemyPlayers = AppState.teamData[enemySide];

  const draftState = {
    blueBans: AppState.draft.blueBans,
    redBans: AppState.draft.redBans,
    bluePicks: AppState.draft.bluePicks.filter(Boolean),
    redPicks: AppState.draft.redPicks.filter(Boolean),
    activeTeam: side
  };

  if (query.includes("BAN") || query.includes("ban") || query.includes("バン")) {
    const recs = DraftEngine.getBanRecommendations(draftState, enemyPlayers, AppState.customDatabase);
    if (recs.length > 0) {
      const top = recs[0];
      const champ = AppState.champions[top.champId];
      return `【簡易AIコーチ】相手チームのプールから判定すると、次は「${champ ? champ.name : top.champId}」をBANするのがおすすめです。${top.badges.map(b => b.text).join('、')}という理由から脅威度が高くなっています。`;
    }
    return "【簡易AIコーチ】相手のキャラプール情報が不足しているため、具体的な推奨BANが算出できませんでした。";
  }

  // デフォルトはPICK推奨
  let currentPlayer = null;
  if (step.type === 'pick') {
    currentPlayer = allyPlayers[step.slotIndex];
  } else {
    const emptySlotIdx = AppState.draft[`${side}Picks`].findIndex(p => !p);
    if (emptySlotIdx !== -1) currentPlayer = allyPlayers[emptySlotIdx];
  }

  if (currentPlayer) {
    const recs = DraftEngine.getPickRecommendations(draftState, currentPlayer, allyPlayers, enemyPlayers, AppState.customDatabase);

    if (recs.length > 0) {
      const top = recs[0];
      const champ = AppState.champions[top.champId];
      const reasons = top.badges.map(b => b.text).join('、');
      return `【簡易AIコーチ】${currentPlayer.name}選手には「${champ ? champ.name : top.champId}」のピックが最もおすすめです（AIスコア: ${top.score}）。このピックは、${reasons} という強みがあります。`;
    }
  }

  return "【簡易AIコーチ】現在のドラフト状況では、明確な推奨が計算できませんでした。設定画面からGemini APIキーを設定すると、状況に応じた柔軟な相談対話ができるようになります！";
}

// チャットUIへのメッセージ追加
function addChatMessageToUi(role, text) {
  const historyEl = document.getElementById("ai-chat-history");
  const msgEl = document.createElement("div");
  const msgId = `chat-msg-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
  
  msgEl.className = `chat-message ${role}`;
  msgEl.id = msgId;

  const avatar = role === 'coach' ? '🤖' : '👤';

  msgEl.innerHTML = `
    <div class="chat-avatar">${avatar}</div>
    <div class="chat-bubble">${text}</div>
  `;

  historyEl.appendChild(msgEl);
  scrollToChatBottom();

  return msgId;
}

// 最下部へスクロール
function scrollToChatBottom() {
  const historyEl = document.getElementById("ai-chat-history");
  if (historyEl) {
    historyEl.scrollTop = historyEl.scrollHeight;
  }
}

// チームの勝利条件 (Win Condition) 計算・描画
function updateWinConditionText() {
  const step = DRAFT_STEPS[AppState.draft.currentStepIndex];
  const side = step ? step.team : 'blue'; 
  const players = AppState.teamData[side];

  if (!players || players.length === 0) return;

  // 1. 最も習熟度(strength)の高いプレイヤー(エース)を特定
  let sortedPlayers = [...players].sort((a, b) => {
    const sB = b.strength !== undefined ? b.strength : 80;
    const sA = a.strength !== undefined ? a.strength : 80;
    return sB - sA;
  });
  const ace = sortedPlayers[0];

  if (!ace) return;

  let winCondText = "";

  // 2. エースのロールに応じた基本プラン
  const rolePlans = {
    "TOP": `TOPキャリープラン：${ace.name}選手(強さ:${ace.strength || 80})がレーン戦で対面を圧倒し、スプリットプッシュで試合を破壊するのが勝ち筋です。TOPへの過剰なガンクを防ぎ、孤立させましょう。`,
    "JUNGLE": `JGキャリープラン：${ace.name}選手(強さ:${ace.strength || 80})主導でマップ全体をコントロールします。JGが序盤のオブジェクトを確保し、MIDと連携した積極的なインベイドで川の主導権を握るのが勝ち筋です。`,
    "MIDDLE": `MIDキャリープラン：エースの${ace.name}選手(強さ:${ace.strength || 80})がレーンで勝利し、サイドレーンへロームして試合を動かすのが勝ち筋です。MIDが動きやすいようにMID-JGで強気にゲームを展開しましょう。`,
    "BOTTOM": `ボットキャリープラン(Protect ADC)：高実力のADC${ace.name}選手(強さ:${ace.strength || 80})にリソースを集約し、終盤の集団戦でキャリーさせるのが勝ち筋です。他レーンはADCを保護する構成(シールドやピール)を優先してください。`,
    "UTILITY": `サポートキャリープラン：実力者${ace.name}選手(強さ:${ace.strength || 80})が視界制圧やレーン戦の仕掛けで主導権を握るのが勝ち筋です。JGとSUPが連携して敵を「キャッチ（隔離撃破）」し、集団戦で人数有利を作りましょう。`
  };

  winCondText = rolePlans[ace.role] || "チーム全体の戦力バランスを保ち、隙のない構成を目指しましょう。";

  // 3. ピックされたチャンピオンの構成タイプ加算
  const picks = side === 'blue' ? AppState.draft.bluePicks.filter(Boolean) : AppState.draft.redPicks.filter(Boolean);
  
  if (picks.length > 0) {
    let wombComboCount = 0;
    let shieldCount = 0;
    let pokeCount = 0;

    picks.forEach(cid => {
      const details = AppState.customDatabase.champDetails[cid];
      if (details && details.tags) {
        if (details.tags.includes("WombCombo")) wombComboCount++;
        if (details.tags.includes("Shield")) shieldCount++;
        if (details.tags.includes("Poke")) pokeCount++;
      }
    });

    if (wombComboCount >= 2) {
      winCondText += " 【集団戦CCコンボ成立】強力なCCチェインが揃っています。集団戦の口火を切り、一気に壊滅させるゲームプランが極めて強力です。";
    } else if (shieldCount >= 2) {
      winCondText += " 【キャリー保護構成成立】シールドやヒールが豊富です。フロントラインで耐えつつ、キャリーが被弾せずにダメージを出し続ける粘り強い集団戦が勝ち筋です。";
    } else if (pokeCount >= 2) {
      winCondText += " 【ポーク構成成立】遠距離削りスキルが揃っています。集団戦を起こさず、タワー周りやオブジェクト前で一方的に削ってから安全に確保するプランが効果的です。";
    }
  }

  const textEl = document.getElementById("win-cond-text");
  if (textEl) {
    textEl.textContent = winCondText;
  }
}

// ==========================================
// 選手マスター（名簿）管理 CRUD
// ==========================================

// 選手マスター名簿の保存
function savePlayerMaster() {
  localStorage.setItem("lol_draft_player_master", JSON.stringify(AppState.playerMaster));
}

// 選手マスター名簿（設定画面）の一覧描画
function renderPlayerMasterList() {
  const container = document.getElementById("player-master-list");
  if (!container) return;

  container.innerHTML = "";

  if (AppState.playerMaster.length === 0) {
    container.innerHTML = `<div class="no-rec-message">登録された選手がいません</div>`;
    return;
  }

  // 名簿を最初の得意ロール順、次に名前順でソート
  const sorted = [...AppState.playerMaster].sort((a, b) => {
    const roleOrder = { "TOP": 0, "JUNGLE": 1, "MIDDLE": 2, "BOTTOM": 3, "UTILITY": 4 };
    const rA = a.roles && a.roles.length > 0 ? a.roles[0] : "TOP";
    const rB = b.roles && b.roles.length > 0 ? b.roles[0] : "TOP";
    const orderA = roleOrder[rA] !== undefined ? roleOrder[rA] : 9;
    const orderB = roleOrder[rB] !== undefined ? roleOrder[rB] : 9;
    if (orderA !== orderB) return orderA - orderB;
    return a.name.localeCompare(b.name, 'ja');
  });

  sorted.forEach(p => {
    const card = document.createElement("div");
    card.className = "master-player-card";

    const poolText = p.pool && p.pool.length > 0
      ? p.pool.map(c => AppState.champions[c.champId] ? AppState.champions[c.champId].name : c.champId).join(", ")
      : "プール未設定";

    // 各ロールと、そのレーンの強さを表示
    const rolesStr = p.roles && Array.isArray(p.roles)
      ? p.roles.map(r => `${AppState.roleMap[r] || r} (${p.laneStrengths ? (p.laneStrengths[r] || 80) : 80})`).join(" / ")
      : "未設定";

    card.innerHTML = `
      <div class="master-player-info">
        <div class="master-player-name">${p.name}</div>
        <div class="master-player-meta">
          <span>ロール & 習熟度: ${rolesStr}</span>
        </div>
        <div class="master-player-pool" title="${poolText}">プール: ${poolText}</div>
      </div>
      <div class="master-player-actions">
        <button class="btn btn-secondary btn-edit-pool" data-id="${p.id}">プール編集</button>
        <button class="btn btn-secondary btn-delete-player" data-id="${p.id}" style="border-color: var(--red-magic); color: var(--red-magic);">削除</button>
      </div>
    `;

    // イベントバインド
    card.querySelector(".btn-edit-pool").addEventListener("click", () => {
      AppState.editingPlayer.side = null;
      AppState.editingPlayer.index = null;
      AppState.editingPlayer.masterPlayerId = p.id;
      
      openPoolEditModal(null, null, p.id);
    });

    card.querySelector(".btn-delete-player").addEventListener("click", () => {
      if (confirm(`本当に ${p.name} 選手を名簿から削除しますか？`)) {
        handleDeleteMasterPlayer(p.id);
      }
    });

    container.appendChild(card);
  });
}

// 選手マスター名簿への追加
function handleAddMasterPlayer() {
  const nameEl = document.getElementById("master-player-name");
  const checkboxes = document.querySelectorAll('input[name="master-player-roles"]:checked');

  const name = nameEl.value.trim();
  const roles = Array.from(checkboxes).map(cb => cb.value);

  if (!name) {
    showToast("選手名を入力してください。");
    return;
  }
  if (roles.length === 0) {
    showToast("得意ロールを少なくとも1つ選択してください。");
    return;
  }

  // 個別レーンの強さを収集
  const laneStrengths = { TOP: 50, JUNGLE: 50, MIDDLE: 50, BOTTOM: 50, UTILITY: 50 };
  roles.forEach(r => {
    const inputEl = document.querySelector(`input[name="master-player-strength-${r}"]`);
    const val = inputEl ? parseInt(inputEl.value, 10) : 80;
    laneStrengths[r] = isNaN(val) ? 80 : Math.max(1, Math.min(100, val));
  });

  // 重複チェック
  const exists = AppState.playerMaster.some(p => p.name === name);
  if (exists) {
    showToast("同名の選手が既に名簿に登録されています。");
    return;
  }

  const newPlayer = {
    id: `custom_player_${Date.now()}`,
    name: name,
    roles: roles,
    laneStrengths: laneStrengths,
    strength: laneStrengths[roles[0]] || 80, // 後方互換用の代表値
    pool: []
  };

  AppState.playerMaster.push(newPlayer);
  savePlayerMaster();
  renderPlayerMasterList();
  renderDashboard(); // ドロップダウンの選択肢を更新するためにダッシュボードも更新

  // フォームクリア
  nameEl.value = "";
  document.querySelectorAll('input[name="master-player-roles"]').forEach(cb => {
    cb.checked = false;
    const role = cb.value;
    const inputEl = document.querySelector(`input[name="master-player-strength-${role}"]`);
    if (inputEl) {
      inputEl.value = "80";
      inputEl.disabled = true;
    }
  });
  showToast(`${name} 選手を名簿に登録しました！`);
}

// 選手マスター名簿からの削除
function handleDeleteMasterPlayer(id) {
  const player = AppState.playerMaster.find(p => p.id === id);
  AppState.playerMaster = AppState.playerMaster.filter(p => p.id !== id);
  savePlayerMaster();
  renderPlayerMasterList();
  renderDashboard(); // ドロップダウンの選択肢更新
  if (player) {
    showToast(`${player.name} 選手を削除しました。`);
  }
}

// 共有URLインポート時などに、アサインされたチームの選手名簿を自動マージする処理
function syncTeamToPlayerMaster() {
  let updated = false;
  ['blue', 'red'].forEach(side => {
    AppState.teamData[side].forEach(p => {
      if (!p.name) return;
      const matched = AppState.playerMaster.find(m => m.name === p.name);
      if (!matched) {
        const baseVal = p.strength || 80;
        AppState.playerMaster.push({
          id: `imported_player_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
          name: p.name,
          roles: [p.role],
          laneStrengths: {
            TOP: baseVal,
            JUNGLE: baseVal,
            MIDDLE: baseVal,
            BOTTOM: baseVal,
            UTILITY: baseVal
          },
          strength: baseVal,
          pool: JSON.parse(JSON.stringify(p.pool || []))
        });
        updated = true;
      } else {
        // 選手がすでにいるが、アサインされたロールが名簿登録ロールに無い場合はマージ追加
        if (p.role && !matched.roles.includes(p.role)) {
          matched.roles.push(p.role);
          if (!matched.laneStrengths) {
            matched.laneStrengths = { TOP: 80, JUNGLE: 80, MIDDLE: 80, BOTTOM: 80, UTILITY: 80 };
          }
          matched.laneStrengths[p.role] = p.strength || 80;
          updated = true;
        }
      }
    });
  });

  if (updated) {
    savePlayerMaster();
    renderPlayerMasterList();
  }
}

// ==========================================
// ドラフト構成イメージ複数保存・ロード処理
// ==========================================

// 現在の構成を保存する処理
function handleSaveCurrentDraft() {
  const nameInput = document.getElementById("input-save-draft-name");
  const name = nameInput.value.trim();

  if (!name) {
    showToast("構成名を入力してください（例：練習試合Aなど）");
    return;
  }

  // 保存用オブジェクトの構築
  const newRecord = {
    id: `draft_${Date.now()}`,
    name: name,
    timestamp: new Date().toLocaleString('ja-JP'),
    teamData: JSON.parse(JSON.stringify(AppState.teamData)),
    draftMode: AppState.draftMode
  };

  if (!AppState.draftHistory) {
    AppState.draftHistory = [];
  }

  // 同名の上書きチェック
  const existingIndex = AppState.draftHistory.findIndex(d => d.name === name);
  if (existingIndex !== -1) {
    if (!confirm(`構成名「${name}」は既に存在します。上書きしますか？`)) {
      return;
    }
    AppState.draftHistory[existingIndex] = newRecord;
  } else {
    AppState.draftHistory.push(newRecord);
  }

  saveDataToServer();
  renderDraftHistoryList();

  nameInput.value = "";
  showToast(`ドラフト構成「${name}」を保存しました！`);
}

// 保存済み構成一覧の描画
function renderDraftHistoryList() {
  const container = document.getElementById("saved-drafts-list");
  if (!container) return;

  container.innerHTML = "";

  if (!AppState.draftHistory || AppState.draftHistory.length === 0) {
    container.innerHTML = `<div style="text-align: center; color: #606570; font-style: italic; font-size: 11px; padding: 10px;">保存された構成はありません</div>`;
    return;
  }

  // 日時新しい順にソート
  const sorted = [...AppState.draftHistory].sort((a, b) => b.id.localeCompare(a.id));

  sorted.forEach(d => {
    const row = document.createElement("div");
    row.style.cssText = `
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: rgba(255,255,255,0.02);
      border: 1px solid rgba(255,255,255,0.05);
      padding: 6px 10px;
      border-radius: 4px;
      gap: 10px;
    `;

    row.innerHTML = `
      <div style="flex: 1; min-width: 0;">
        <div style="font-size: 12px; color: #fff; font-weight: bold; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${d.name}</div>
        <div style="font-size: 9px; color: #606570; margin-top: 2px;">保存日時: ${d.timestamp} (${d.draftMode === 'custom' ? 'カスタム' : 'フルパランク'})</div>
      </div>
      <div style="display: flex; gap: 6px;">
        <button class="btn btn-secondary btn-load-draft" data-id="${d.id}" style="padding: 2px 8px; font-size: 10px;">ロード</button>
        <button class="btn btn-secondary btn-delete-draft" data-id="${d.id}" style="padding: 2px 8px; font-size: 10px; border-color: var(--red-magic); color: var(--red-magic);">削除</button>
      </div>
    `;

    row.querySelector(".btn-load-draft").addEventListener("click", () => {
      loadDraftHistory(d.id);
    });

    row.querySelector(".btn-delete-draft").addEventListener("click", () => {
      if (confirm(`本当に構成「${d.name}」を削除しますか？`)) {
        deleteDraftHistory(d.id);
      }
    });

    container.appendChild(row);
  });
}

// 構成のロード
function loadDraftHistory(id) {
  const record = AppState.draftHistory.find(d => d.id === id);
  if (!record) return;

  AppState.teamData = JSON.parse(JSON.stringify(record.teamData));
  AppState.draftMode = record.draftMode || "custom";

  // モード切り替えボタンのアクティブクラス更新
  if (AppState.draftMode === "custom") {
    document.getElementById("btn-mode-custom").classList.add("active");
    document.getElementById("btn-mode-ranked").classList.remove("active");
  } else {
    document.getElementById("btn-mode-custom").classList.remove("active");
    document.getElementById("btn-mode-ranked").classList.add("active");
  }

  saveDataToServer();
  renderDashboard();
  showToast(`構成「${record.name}」をロードしました！`);
}

// 構成の削除
function deleteDraftHistory(id) {
  AppState.draftHistory = AppState.draftHistory.filter(d => d.id !== id);
  saveDataToServer();
  renderDraftHistoryList();
  showToast("構成を削除しました。");
}

// AI構成診断の実行
async function handleRunDiagnose() {
  const startView = document.getElementById("ai-diagnose-start-view");
  const loadingView = document.getElementById("ai-diagnose-loading-view");
  const resultView = document.getElementById("ai-diagnose-result-view");

  startView.classList.add("hidden");
  loadingView.classList.remove("hidden");
  resultView.classList.add("hidden");

  // ドラフトのピック情報を収集
  const bluePicks = AppState.draft.bluePicks.filter(Boolean);
  const redPicks = AppState.draft.redPicks.filter(Boolean);
  const blueBans = AppState.draft.blueBans.filter(Boolean);
  const redBans = AppState.draft.redBans.filter(Boolean);

  if (bluePicks.length === 0 && redPicks.length === 0) {
    loadingView.classList.add("hidden");
    startView.classList.remove("hidden");
    alert("ドラフトのピックが1体も選択されていません。診断を開始するにはチャンピオンをピックしてください。");
    return;
  }

  // AIへの診断用特別プロンプトの構築
  const prompt = `
あなたはLeague of Legends (LoL) のプロフェッショナルコーチです。現在のドラフト完了状況（または途中経過）を徹底的に分析し、両チームの構成相性、勝率予測、時間帯別の具体的な勝利ゲームプラン、集団戦のイメージ、およびキープレイヤーを出力してください。

【現在のドラフト状況】
・味方チーム (BLUE): [${bluePicks.join(', ')}]
・敵チーム (RED): [${redPicks.join(', ')}]
・味方のBAN: [${blueBans.join(', ')}]
・相手のBAN: [${redBans.join(', ')}]
・モード: ${AppState.draftMode === 'ranked' ? 'フルパランク戦 (相手情報不明)' : 'カスタム戦 (相手情報開示済み)'}

【出力の絶対ルール】
必ず以下の6つのセクションを厳密に含めて出力してください。特に「有利度」の行はパーセンテージを解析するため、必ず指定のフォーマット「【有利度】味方XX% / 敵YY%」で記述してください（足して100%になるようにすること）。

---
【有利度】味方〇% / 敵〇%

【強みと弱み】
（ここに味方チームのピック構成のシナジーや、集団戦、キャリー力、強みと弱みを詳細に書く。箇条書きまたは段落）

【警戒ポイント】
（ここに敵チームの構成で警戒すべき点、カウンターされているレーン、相手の強い時間帯などを詳細に書く）

【ゲームプラン】
（ここに味方チームが勝つための具体的なゲームプランと時間帯別の立ち回りを詳細に書く）

【集団戦のイメージ】
（ここに集団戦での具体的なスキル連携、フォーカスすべき対象、立ち回りのイメージ、エンゲージの主導権などを詳細に書く）

【キープレイヤー】
（ここにこの試合の勝敗の鍵を握る味方のチャンピオンとそのレーン、担うべき役割を詳細に書く）
---
`;

  try {
    const contents = [
      {
        role: "user",
        parts: [{ text: prompt }]
      }
    ];

    // AIプロキシAPIを呼び出す
    const response = await fetch(`/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ 
        contents: contents,
        apiKey: AppState.geminiApiKey || ""
      })
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const resJson = await response.json();
    let reply = "";
    if (resJson.candidates && resJson.candidates[0].content.parts[0].text) {
      reply = resJson.candidates[0].content.parts[0].text.trim();
    } else {
      throw new Error("無効なAPIレスポンスです。");
    }

    // 診断結果のパース処理
    let winRateBlue = 50;
    let winRateRed = 50;

    // 【有利度】味方XX% / 敵YY% というテキストからパーセンテージを正規表現で抽出
    const winRateMatch = reply.match(/【有利度】.*?味方\s*(\d+)\s*%\s*[\/\s]*敵\s*(\d+)\s*%/);
    if (winRateMatch) {
      winRateBlue = parseInt(winRateMatch[1]) || 50;
      winRateRed = parseInt(winRateMatch[2]) || 50;
    }

    // 各セクションのテキストの切り分け
    const sections = {
      strengths: "--",
      threats: "--",
      plan: "--",
      teamfight: "--",
      keyplayer: "--"
    };

    const strengthsMatch = reply.match(/【強みと弱み】([\s\S]*?)(?=【|$)/);
    const threatsMatch = reply.match(/【警戒ポイント】([\s\S]*?)(?=【|$)/);
    const planMatch = reply.match(/【ゲームプラン】([\s\S]*?)(?=【|$)/);
    const teamfightMatch = reply.match(/【集団戦のイメージ】([\s\S]*?)(?=【|$)/);
    const keyplayerMatch = reply.match(/【キープレイヤー】([\s\S]*?)(?=【|$)/);

    if (strengthsMatch) sections.strengths = strengthsMatch[1].trim();
    if (threatsMatch) sections.threats = threatsMatch[1].trim();
    if (planMatch) sections.plan = planMatch[1].trim();
    if (teamfightMatch) sections.teamfight = teamfightMatch[1].trim();
    if (keyplayerMatch) sections.keyplayer = keyplayerMatch[1].trim();

    // UIへ反映
    const barBlue = document.getElementById("diagnose-bar-blue");
    const barRed = document.getElementById("diagnose-bar-red");

    barBlue.style.width = `${winRateBlue}%`;
    barBlue.textContent = `味方 ${winRateBlue}%`;
    barRed.style.width = `${winRateRed}%`;
    barRed.textContent = `敵 ${winRateRed}%`;

    document.getElementById("diagnose-txt-strengths").textContent = sections.strengths;
    document.getElementById("diagnose-txt-threats").textContent = sections.threats;
    document.getElementById("diagnose-txt-plan").textContent = sections.plan;
    document.getElementById("diagnose-txt-teamfight").textContent = sections.teamfight;
    document.getElementById("diagnose-txt-keyplayer").textContent = sections.keyplayer;

    loadingView.classList.add("hidden");
    resultView.classList.remove("hidden");
    showToast("AI構成診断が完了しました！");

  } catch (error) {
    console.error("AI診断の実行に失敗しました。", error);
    loadingView.classList.add("hidden");
    startView.classList.remove("hidden");
    alert("通信エラーが発生しました。APIキーまたは接続状況を確認してください。");
  }
}
