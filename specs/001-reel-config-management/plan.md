# Implementation Plan: 轉輪符號圖庫與速度的集中式設定管理

**Branch**: `001-reel-config-management` | **Date**: 2026-07-07 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/001-reel-config-management/spec.md`

## Summary

將目前散落於每個 `ReelView` 元件（Inspector）的 `symbolFrames` 與 `speed` 參數，改為集中式管理：

- **全域 define**（`assets/scripts/define/`）：以具名常數集中定義轉輪的滾動速度與所有調校數值（間距、減速、停輪等），供全專案「一處修改、全域生效」。
- **Singleton 資源管理**（`assets/scripts/singleton/`）：以單例統一提供符號圖庫（`SpriteFrame[]`）資源，`ReelView` 於執行時向單例取得圖庫，不再各自於 Inspector 掛載。

`ReelView` 移除 `symbolFrames`／`speed` 兩個 `@property`，改為：速度取自全域 define、符號圖庫取自資源單例；保留 `symbolStrip`（節點結構參照，屬每輪必要的接線，非可調參數）。滾動／換圖／停輪動畫行為完全不變。

## Technical Context

**Language/Version**: TypeScript（Cocos Creator 3.8.3+，`tsconfig` 繼承 `./temp/tsconfig.cocos.json`，`strict: false`）

**Primary Dependencies**: Cocos Creator 引擎模組 `cc`（`Component`、`Node`、`Sprite`、`SpriteFrame`）；專案內 `utils/StateMachine`

**Storage**: N/A（無持久化；符號圖庫為專案內 `SpriteFrame` 資產，經 Inspector 於單一節點指派）

**Testing**: 手動 Play 模式端到端驗證（本專案不強制 TDD，符合 Constitution 開發工作流第 5 點）

**Target Platform**: Cocos Creator 編輯器內執行（設計解析度 960 × 640）

**Project Type**: 單一 Cocos 遊戲專案（MVC 分層於 `assets/scripts/{model,view,controller}/`）

**Performance Goals**: 維持既有轉輪動畫每幀行為，無新增每幀配置或 GC 壓力（單例查詢為 O(1) 靜態存取）

**Constraints**:
- 資源單例存取須安全：圖庫缺失／為空時 `ReelView` 不得崩潰，沿用既有「無圖略過指派」行為（FR-006）。
- 速度非正值時回退全域 define 的預設速度（FR-006）。
- 改版不得改變滾動／換圖／停輪對齊觀感（FR-007）。
- Framework 層禁止 `Math.random()`（團隊規範）；本專案 `ReelView._randomFrame()` 現用 `Math.random()`，屬既有 View 層抽圖行為，本次不擴大改動，維持現狀（見 Complexity Tracking）。

**Scale/Scope**: 影響 1 個既有腳本（`ReelView.ts`）、新增 3 個腳本（1 define、2 singleton）、1 處場景節點新增（掛載資源單例並指派圖庫）。

## Constitution Check

*GATE: 依 `.specify/memory/constitution.md` v1.0.0 評估。*

| 原則 | 評估 | 結論 |
|------|------|------|
| I. 團隊 TypeScript 程式碼標準 | 全部參數改為具名 define，消除魔術數字；遵循空格規範 | ✅ Pass |
| II. 集中式設定管理（單一真實來源） | 本功能即為此原則的落地：speed→define 一處、symbolFrames→singleton 一處 | ✅ Pass（核心） |
| III. MVC 分層架構 | 新增 define（常數）與 singleton（共享資源服務）屬跨層基礎設施；`ReelView` 仍為純 View，僅改參數來源 | ✅ Pass（見說明） |
| IV. 知識庫與記憶優先 | 已查 `.claude/library/README.md` 與 `reel-spin.md`；完成後須更新知識庫 | ✅ Pass |
| V. Cocos 操作透過 Agent 與 MCP | 場景節點新增與 symbolFrames 指派將交由 `cocos-creator-developer` agent／MCP 執行 | ✅ Pass |

**III 補充**：資源單例是「被 View 讀取的共享資源提供者」，依賴方向為 `ReelView → ResourceManager／GameDefine`（單向），不反向依賴 View，也不介入 Model/Controller 的資料規則，符合低耦合。define 為無狀態常數集合。無違反單一責任。

**Gate 結果**：通過，無需額外 Complexity Tracking 例外（唯一記錄項為既有 `Math.random()` 現狀，見下表）。

## Project Structure

### Documentation (this feature)

```text
specs/001-reel-config-management/
├── plan.md              # 本檔（/speckit-plan 輸出）
├── research.md          # Phase 0：設計決策與取捨
├── data-model.md        # Phase 1：實體（define/資源單例/ReelView 參數來源）
├── quickstart.md        # Phase 1：端到端驗證指引
├── contracts/
│   └── config-access.md # Phase 1：define 與資源單例對 ReelView 的存取契約
└── tasks.md             # Phase 2：由 /speckit-tasks 產生（本命令不建立）
```

### Source Code (repository root)

```text
assets/scripts/
├── define/                    # 新增：全域遊戲設定 define（具名常數）
│   └── ReelDefine.ts          #   轉輪速度與所有調校數值的單一真實來源
├── singleton/                 # 新增：單例資源／設定管理
│   ├── Singleton.ts           #   通用單例基底（輕量，供未來其他 manager 複用）
│   └── ResourceManager.ts     #   符號圖庫（SpriteFrame[]）資源單例
├── model/GameModel.ts         # 不變
├── view/
│   ├── ReelView.ts            # 修改：移除 symbolFrames/speed @property，改讀 define + 單例
│   └── UIView.ts              # 不變
└── controller/GameController.ts  # 不變（本次不動 controller 計時常數，列為可選後續）
```

**場景異動**（交由 cocos-creator-developer agent 執行）：於場景新增一個掛載 `ResourceManager` 的節點，於其 Inspector 一次性指派 `symbolFrames` 圖庫；各 `ReelView` 節點原本的 `symbolFrames`／`speed` 設定因屬性移除、重新導入腳本後自動失效。

**Structure Decision**：沿用既有 `assets/scripts/{model,view,controller}/` 分層，新增與層無關的 `define/`（常數）與 `singleton/`（共享資源服務）兩個基礎設施資料夾，符合使用者指定的存放位置。

## Complexity Tracking

> 僅記錄 Constitution Check 需說明的項目。

| 項目 | 為何保留現狀 | 更簡單替代方案不採用的原因 |
|------|--------------|----------------------------|
| `ReelView._randomFrame()` 沿用 `Math.random()` | 屬既有 View 層抽圖行為，非本次集中式設定範圍；貿然改動亂數來源會擴大 diff 並影響動畫觀感驗證 | 本次聚焦參數來源重構；亂數規範對齊留待專門任務，避免一次改動過大 |
| `singleton/Singleton.ts` 通用基底 | 提供最小可複用單例骨架，符合「預留適當擴展空間」 | 直接把 instance 邏輯寫死於 `ResourceManager` 亦可，但抽出極薄基底成本低、利於後續 manager 複用，保持精簡不過度抽象 |
