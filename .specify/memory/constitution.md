<!--
SYNC IMPACT REPORT
==================
Version change: (template, unversioned) → 1.0.0
Rationale: First concrete ratification of the project constitution from the
  unfilled template. MINOR/PATCH inapplicable to an initial adoption; a full
  principle set is being established, so this is the baseline 1.0.0.

Modified principles (placeholder → concrete):
  - [PRINCIPLE_1_NAME] → I. 團隊 TypeScript 程式碼標準（不可退讓）
  - [PRINCIPLE_2_NAME] → II. 集中式設定管理（單一真實來源）
  - [PRINCIPLE_3_NAME] → III. MVC 分層架構
  - [PRINCIPLE_4_NAME] → IV. 知識庫與記憶優先
  - [PRINCIPLE_5_NAME] → V. Cocos 操作透過 Agent 與 MCP

Added sections:
  - 技術約束與環境 (was [SECTION_2_NAME])
  - 開發工作流 (was [SECTION_3_NAME])
  - Governance (filled)

Removed sections: none

Templates requiring updates:
  - .specify/templates/plan-template.md ✅ reviewed — generic "Constitution Check"
    gate stays valid; principle-specific gates are derived at plan time.
  - .specify/templates/spec-template.md ✅ reviewed — no mandatory section change.
  - .specify/templates/tasks-template.md ✅ reviewed — test tasks remain OPTIONAL,
    consistent with Principle I/III (no TDD mandate for this game project).
  - .specify/templates/checklist-template.md ✅ reviewed — no change needed.

Follow-up TODOs:
  - RATIFICATION_DATE set to 2026-07-07 (adoption date unknown; used the date the
    constitution was first concretely filled). Amend if an earlier date is confirmed.
-->

# MCPCocosDemo Constitution

## Core Principles

### I. 團隊 TypeScript 程式碼標準（不可退讓）

所有 TypeScript 程式碼 **MUST** 遵循 `.claude/instructions/typescript-code-standards.md`：
單一責任、低耦合、高內聚、避免過度設計；命名清晰、消除重複、**禁止 Magic Number**；
遵循團隊空格規範（`( condition )`、`array[ index ]`、`function( arg1, arg2 )`、`index as Type`）。
規範調整時 **MUST** 同步回頭修正該標準文件，使規範與實作永遠一致。

**理由**：一致的程式碼標準是可維護性與可審查性的基礎；標準與實作分歧會使規範失效。

### II. 集中式設定管理（單一真實來源）

可調參數（符號圖庫、速度、間距等數值與資源）**MUST** 集中於 Config／Define 單一真實來源，
**MUST NOT** 逐一散落於各節點實例（如每個 Reel 掛載的 element）。新增或調整參數時，
**MUST** 只改設定來源一處即生效，**MUST NOT** 需要逐一手動調整每個實例。
共用常數 **MUST** 具名並附說明，禁止 Magic Number。

**理由**：參數散落於實例會使「改一個值需編輯 N 個節點」，易漏改、易不一致；單一真實來源
消除重複、降低維護成本，並讓擴充（新增符號、調速）成為一次性設定變更。

### III. MVC 分層架構

遊戲程式碼 **MUST** 維持 Model／View／Controller 分層：View（如 `ReelView`）只負責呈現與動畫，
Model 持有資料與規則，Controller 決定時機與流程。跨層依賴 **MUST** 單向、明確；
呈現層 **MUST NOT** 內嵌業務決策，資料層 **MUST NOT** 直接操作節點。

**理由**：分層維持低耦合與高內聚，使邏輯可獨立於場景演進，符合單一責任原則。

### IV. 知識庫與記憶優先

任何實作前 **MUST** 先查閱 `.claude/library/README.md` 索引，確認可複用模式與已知陷阱；
計畫完成後 **MUST** 回頭更新 `.claude/library/`（新功能新增文件並登錄索引，既有功能同步修正）。
跨 session 的非顯而易見決策 **SHOULD** 記錄於專案 memory。

**理由**：避免重複踩坑與重新推導；知識與實作同步是本專案 MCP 踩坑經驗的核心資產。

### V. Cocos 操作透過 Agent 與 MCP

凡 Cocos Creator 開發任務（場景、UI、節點／元件、prefab、資產、遊戲邏輯、MVC 腳本）
**MUST** 透過 `cocos-creator-developer` agent 執行，其固定流程為「查知識庫 → 擬計畫待使用者確認 → 才執行」。
所有 Cocos IDE 實際操作（inspector／node／prefab／scene／asset）**MUST** 委由 MCP（`cocos-mcp-dev-assistant`）進行，
**MUST NOT** 預設人工拖拽。修改場景後 **MUST** 呼叫 `scene_save_scene` 持久化。

**理由**：統一入口確保計畫先於執行、知識被查閱、操作可追蹤，並沿用已驗證的 MCP 修正路徑。

## 技術約束與環境

- **引擎／版本**：Cocos Creator 3.8.3+，設計解析度 960 × 640。
- **MCP Server**：`http://127.0.0.1:3000/mcp`（Port 3000，AutoStart 預設 false，需於編輯器手動啟動）。
- **TypeScript 設定**：繼承 `./temp/tsconfig.cocos.json`，`strict: false`；`BigNumber` 為全域型別無需 import。
- **亂數規則**：Framework 層 **MUST NOT** 使用 `Math.random()`（見程式碼標準檢查清單）。
- **擴充套件建置**：改 `extensions/cocos-mcp-server/dist/*.js` 後，執行中的 MCP server 不熱載入，
  **MUST** 重載擴充套件或重啟編輯器才生效。
- **資產操作**：直寫 `.scene`／`.prefab` 磁碟後 **MUST** `reimport_asset` 才會同步編輯器記憶體。

## 開發工作流

1. 開始任務前，依序確認：專案級 `CLAUDE.md` → 全域 `@instructions` 團隊標準 → 通用最佳實踐。
2. Cocos 任務走 Principle V 的 agent 流程；計畫 **MUST** 經使用者確認後才執行。
3. 實作遵循 Principle I（程式碼標準）與 Principle II（集中式設定）；審查對照標準檢查清單。
4. 完成後 **MUST** 更新 `.claude/library/` 知識庫與必要的專案 memory。
5. 測試為 OPTIONAL——僅在規格明確要求時撰寫（本專案不強制 TDD）。

## Governance

本 Constitution 為本專案最高治理依據，**優先於**其他慣例；衝突時以本文件為準，
其次為全域團隊標準，最後為通用最佳實踐。

- **修訂程序**：任何原則的新增、移除或重定義 **MUST** 記錄於本文件的 Sync Impact Report，
  並依語意化版本調整版本號。
- **版本政策**：MAJOR＝不相容的治理／原則移除或重定義；MINOR＝新增原則或實質擴充指引；
  PATCH＝措辭澄清、錯字、非語意修正。
- **合規審查**：所有變更 **MUST** 對照相關原則自評；違反單一責任、集中式設定或分層架構者
  **MUST** 在 `.specify/templates/plan-template.md` 的 Complexity Tracking 記錄理由，否則不得通過。
- **執行期指引**：日常開發指引以 `CLAUDE.md`、`.claude/instructions/`、`.claude/library/` 為準。

**Version**: 1.0.0 | **Ratified**: 2026-07-07 | **Last Amended**: 2026-07-07
