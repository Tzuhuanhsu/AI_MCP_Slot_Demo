# Structure Steering — MCPCocosDemo

> 持久化的專案結構與慣例文件，供所有 spec 開發對齊。

## 目錄結構

```
MCPCocosDemo/
├── assets/
│   ├── scene/main.scene          # 主場景（唯一場景）
│   ├── scripts/
│   │   ├── model/                # 純 TS 資料與規則層（不 import cc）
│   │   ├── view/                 # 呈現與輸入轉發層（ReelView / UIView）
│   │   ├── controller/           # 協調層（GameController）
│   │   ├── singleton/            # Component 型單例（ResourceManager / Singleton 基底）
│   │   ├── define/               # 全域常數與調校參數（ReelDefine）
│   │   └── *.ts                  # 通用元件（如 SpriteFrameAnimation）
│   ├── utils/                    # 與 cc 無耦合的通用模組（StateMachine 等）
│   └── textures/                 # 圖片資產（正式 Fish_*；debug/ 為除錯純色圖）
├── extensions/cocos-mcp-server/  # MCP server 擴充套件原始碼
├── specs/                        # Spec Kit 規格（feature 分資料夾）
├── settings/                     # mcp-server.json / tool-manager.json
└── .claude/
    ├── steering/                 # 本組 steering 文件（product/tech/structure）
    ├── specs/                    # /spec-create 產出的 spec（feature 分資料夾）
    ├── library/                  # 已驗證功能的實作知識庫（含 README 索引）
    ├── instructions/             # 團隊 TS 程式碼規範
    ├── agents/                   # 子代理設定
    └── templates/                # spec / bug 文件模板
```

## 命名慣例

- **檔名**：TS 腳本用 PascalCase 與類別同名（`ReelView.ts`）；文件/spec 資料夾用 kebab-case。
- **類別**：PascalCase；**方法/變數**：camelCase；**常數**：全域 define 內集中管理，禁止散落的 Magic Number。
- **私有欄位**：底線前綴（如 `_stepAccurate`、`_registerInstance`），沿用既有腳本風格。
- **空格與格式**：遵循 `.claude/instructions/typescript-code-standards.md`（含括號內側空格等團隊風格）。

## 新功能組織原則

- 新腳本依 MVC 歸位到對應資料夾（`model`/`view`/`controller`/`singleton`/`define`/`utils`）。
- **優先擴充/沿用既有程式與模式**，而非另起爐灶；實作前先查 `.claude/library/README.md` 索引是否有可複用知識。
- Inspector 掛載資產走 Component 型單例；速度/常數走 define（見 `tech.md` 集中式設定管理）。
- Cocos 開發任務一律經 `cocos-creator-developer` agent 執行，IDE 實際操作委由 `cocos-mcp-dev-assistant`。

## 測試 / 驗證要求

**現階段以 Play 模式手動驗證為主，無自動化測試流程。**

- 功能完成後的標準驗證流程：
  1. **磁碟序列化驗證** — 經 MCP 變更場景/資產後，讀回磁碟序列化確認欄位正確（uuid、屬性值、陣列長度等）。
  2. **Play 模式手動實跑** — 由使用者在 Cocos 編輯器點播放，親自確認執行期行為（轉輪手感、停輪對齊、UI 顯示、無 missing/invalid 警告）。
     - 注意：**不可經 MCP 啟動外部 preview**（見 memory `mcp-cannot-start-external-preview`），須請使用者手動點播放。
- 驗證通過後，回頭更新 `.claude/library/` 對應文件與（若有非顯而易見的學習）專案 memory。

## 知識沉澱慣例

- **實作前**：查 `.claude/library/README.md` 索引 + 相關 memory，避免重複踩坑。
- **完成後**：新功能新增 library 文件並登錄索引；既有功能擴充/修正則更新對應文件，保持知識與實作一致。
