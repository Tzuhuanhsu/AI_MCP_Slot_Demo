# Technology Steering — MCPCocosDemo

> 持久化的技術標準文件，供所有 spec 開發對齊。規範強制程度：**建議遵循**（推薦模式，允許依情境彈性調整，但偏離時應說明理由）。

## 技術棧

| 領域 | 選型 |
|------|------|
| 遊戲引擎 | Cocos Creator **3.8.3+**（設計解析度 960 × 640） |
| 語言 | TypeScript（`strict: false`，繼承自 `temp/tsconfig.cocos.json`） |
| MCP 整合 | `cocos-mcp-server` v1.4.0（端點 `http://127.0.0.1:3000/mcp`，Port 3000，AutoStart=false 需手動啟動） |
| 擴充套件開發 | Node/npm（`extensions/cocos-mcp-server/`：`npm run build` / `npm run watch`） |

## 架構模式（建議遵循）

專案採 **MVC + Singleton + Define** 分層：

- **Model**（`assets/scripts/model/`）：純 TS 類，**不** import `cc`、非 `Component`，由 Controller `new` 持有。存資料與規則（如 Bet 的 clamp/step）。
- **View**（`assets/scripts/view/`）：只呈現與轉發輸入，不存業務狀態、不做規則。對外開事件（如 `setSpinHandler`）與顯示 setter。
- **Controller**（`assets/scripts/controller/`）：唯一同時認識 Model 與 View 的協調層，負責編排與資料流串接。
- **Singleton**（`assets/scripts/singleton/`）：需 Inspector 掛載資產的集中式資源（如 `ResourceManager` 圖庫），採 **Component 型單例**（`extends Singleton`）。
- **Define**（`assets/scripts/define/`）：全域常數與調校參數（如 `ReelDefine` 的速度/格距），單一真實來源。
- **Utils**（`assets/utils/`）：與 cc 無耦合的通用模組（如 `StateMachine<TState>`）。

### 耦合方向（單向）
`GameModel ◀ 持有 ─ GameController ─ 參照 ▶ UIView / ReelView`
Model 與 View 彼此不認識、不反向依賴 Controller。

## 集中式設定管理（重要決策）

- **Inspector 資產**（SpriteFrame 陣列等）→ 走 **Component 型單例**，不可用純 TS 單例（純 TS 單例無法在 Inspector 掛載資產）。
- **速度/常數/調校值** → 走 **全域 define**。
- 單一真實來源：一處修改，全輪套用。避免各 View 各自於 Inspector 重複掛載。
- 詳見 memory `reel-config-centralization` 與 `.claude/library/reel-spin.md`（集中式設定管理小節）。

## 程式碼標準

- **務必**遵循 `.claude/instructions/typescript-code-standards.md`（設計原則、命名規範、空格規範、無 Magic Number、去重複）。規格調整時須回頭同步該文件。

## MCP 操作技術約束（踩坑紀錄）

- 修改場景後須 `scene_save_scene` 才持久化；改磁碟 `.scene`/`.prefab`/`.meta` 後須 `reimport_asset` 讓編輯器記憶體同步。
- 改 `dist/*.js` 後執行中的 MCP server 不熱載入，須重載擴充套件或重啟編輯器。
- `color` 可傳 RGBA 物件或 hex 字串；`SpriteFrame[]` 等資產陣列用 `propertyType: 'spriteFrameArray'`、value 傳 uuid 字串陣列。
- 自訂腳本元件的 `set_component_property` 的 `componentType` 需傳 **cid** 非類名。
- `nodeArray` 屬性、移除內建元件（`cc.Mask`/`cc.Graphics`）等場景，改用 `debug_execute_script`。
- SpriteFrame 引用須用正確的 sprite-frame 子資產 uuid（如 `<png-uuid>@6c48a`），勿誤用 texture 子資產或主 uuid。
- 詳見專案 memory 各條與 `extensions/cocos-mcp-server/cocos_creator_mcp_Bug.md`。

## 第三方服務 / 效能

- 無外部第三方服務整合（純本地 Cocos 專案 + 本地 MCP server）。
- 效能：面向 960×640 單機 Demo 規模，無特殊高負載需求。
