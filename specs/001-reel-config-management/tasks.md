---
description: "Task list for 轉輪符號圖庫與速度的集中式設定管理"
---

# Tasks: 轉輪符號圖庫與速度的集中式設定管理

**Input**: Design documents from `specs/001-reel-config-management/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/config-access.md, quickstart.md

**Tests**: 本專案不採 TDD，未要求自動化測試；以 Play 模式端到端驗證（見 quickstart.md）。故不產生測試任務，改以各階段 **Checkpoint** 手動驗證。

**Organization**: 依 user story 分組，各故事可獨立實作與驗證。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 可平行（不同檔案、無未完成依賴）
- **[Story]**: US1 / US2 / US3（對應 spec.md）
- 每個任務含明確檔案路徑

## Constitution 提醒

- 所有 Cocos IDE 操作（場景節點、Inspector 指派、存檔/reimport）**MUST** 交由 `cocos-creator-developer` agent（再委由 MCP）執行，不自行人工拖拽（Principle V）。
- 純腳本檔（`.ts`）編輯屬程式碼實作，可直接改；但新增 `.ts` 後須由編輯器導入生成 `.meta`。
- 全部數值 **MUST** 具名、無魔術數字；遵循團隊空格規範（Principle I）。

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: 建立資料夾與知識對齊

- [X] T001 查閱 `.claude/library/reel-spin.md` 與 `README.md`，確認 `ReelView` 現行捲動/停輪模型與參數語意，作為改版基準
- [X] T002 建立 `assets/scripts/define/` 與 `assets/scripts/singleton/` 兩個資料夾（新增首個 `.ts` 後由 Cocos 編輯器導入以生成 `.meta`）

**Checkpoint**: 目錄結構就緒，可開始建立基礎腳本

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 建立所有 user story 共同依賴的 define 與 singleton 基礎；此階段完成前，US1/US2 無法整合

**⚠️ CRITICAL**: 本階段完成後才可進行各 user story

- [X] T003 [P] 建立 `assets/scripts/define/ReelDefine.ts`：以唯讀具名常數集合匯出 `ReelDefine`，含 `SYMBOL_SPACING`、`DEFAULT_SPIN_SPEED`、`MAX_SLIDE_CELLS_PER_FRAME`、`STOP_MIN_STEPS_FLOOR`、`DECEL_STEP_THRESHOLD`、`DECEL_FACTOR`、`MIN_STOPPING_SPEED`、`FINAL_EASE_MIN_SPEED`、`FREE_SPIN_STEPS`（值沿用 data-model.md 表格，逐項附說明註解）
- [X] T004 [P] 建立 `assets/scripts/singleton/Singleton.ts`：極薄通用單例基底，提供 `instance` 登記/存取骨架（供 Component 型 manager 沿用）
- [X] T005 建立 `assets/scripts/singleton/ResourceManager.ts`：`extends Component`、沿用 T004 基底；`@property symbolFrames: SpriteFrame[]`；`onLoad` 登記 `static instance`、`onDestroy` 清除；提供 `getSymbolFrames()` 與 `getRandomSymbolFrame()`（空庫回 `null`），契約見 contracts/config-access.md（依賴 T004）
- [X] T006 由 Cocos 編輯器導入 `define/`、`singleton/` 下新腳本，確認編譯無誤、`.meta` 生成（交由 `cocos-creator-developer` agent）

**Checkpoint**: define 與資源單例可被引用；user story 實作可開始

---

## Phase 3: User Story 1 - 一處改速度套用全部轉輪 (Priority: P1) 🎯 MVP

**Goal**: 在單一 define 修改速度即讓所有轉輪套用，`ReelView` 不再持有 `speed` Inspector 欄位

**Independent Test**: 於 `ReelDefine.ts` 改 `DEFAULT_SPIN_SPEED`，播放後所有轉輪以新速度滾動，全程未編輯任何 Reel 元件

### Implementation for User Story 1

- [X] T007 [US1] 修改 `assets/scripts/view/ReelView.ts`：移除 `@property speed` 與 `DEFAULT_SPIN_SPEED` 等模組級常數；`import { ReelDefine }`；`spin( speed? )` 於 `speed` 非正時回退 `ReelDefine.DEFAULT_SPIN_SPEED`；將 `SYMBOL_SPACING`／`MAX_SLIDE_CELLS_PER_FRAME`／`STOP_MIN_STEPS_FLOOR`／`DECEL_STEP_THRESHOLD`／`DECEL_FACTOR`／`MIN_STOPPING_SPEED`／`FINAL_EASE_MIN_SPEED`／`FREE_SPIN_STEPS` 全數改引用 `ReelDefine.*`（動畫邏輯不變）
- [X] T008 [US1] 由 Cocos 編輯器重新導入 `ReelView.ts`，確認各 Reel 節點 Inspector 上 `speed` 欄位已消失、無編譯錯誤（交由 `cocos-creator-developer` agent）

**Checkpoint**: 依 quickstart.md 情境 1 驗證——改 `DEFAULT_SPIN_SPEED`→全部轉輪新速度（此時圖庫仍為各輪自有，US1 可獨立通過）

---

## Phase 4: User Story 2 - 一處增修圖庫套用全部轉輪 (Priority: P1)

**Goal**: 符號圖庫集中於單一 `ResourceManager` 節點，`ReelView` 向單例取圖，不再各自於 Inspector 掛載圖片陣列

**Independent Test**: 於 `ResourceManager` 節點的 `symbolFrames` 加一張新圖，播放後各轉輪抽圖含該圖，未編輯任何 Reel 元件

### Implementation for User Story 2

- [X] T009 [US2] 修改 `assets/scripts/view/ReelView.ts`：移除 `@property symbolFrames`；`_randomFrame()` 改為 `ResourceManager.instance?.getRandomSymbolFrame() ?? null`；`_initFrames()` 改依單例圖庫鋪圖；`instance` 為 `null` 或空庫時該格略過指派（保留既有安全行為，FR-006）（依賴 T005、T007）
- [X] T010 [US2] 於場景新增一個節點掛載 `ResourceManager`，在其 Inspector 一次性指派 `symbolFrames` 圖庫（用 `spriteFrameArray` 指派 uuid 陣列）；`scene_save_scene` 後 `reimport`（交由 `cocos-creator-developer` agent，參考 memory：MCP asset 陣列與 spriteFrameArray 指派）
- [X] T011 [US2] 由 Cocos 編輯器重新導入 `ReelView.ts`，確認各 Reel 節點 Inspector 上 `symbolFrames` 欄位已消失、無編譯錯誤（交由 `cocos-creator-developer` agent）

**Checkpoint**: 依 quickstart.md 情境 2 驗證——`ResourceManager` 增圖→全部轉輪抽得到；情境 4 邊界：清空圖庫不崩潰

---

## Phase 5: User Story 3 - 新增轉輪不需重複填參數 (Priority: P2)

**Goal**: 新增乾淨轉輪節點（僅接 `symbolStrip` 結構）即自動沿用集中速度與圖庫，零填可調參數

**Independent Test**: 複製/新增一個未填圖庫與速度的轉輪，播放後與既有轉輪表現一致

### Implementation for User Story 3

- [X] T012 [US3] 於場景複製既有轉輪節點（或新建並接好 `symbolStrip` 子結構）為一個「未填任何圖庫/速度參數」的新轉輪，暫置於可見範圍（交由 `cocos-creator-developer` agent）
- [X] T013 [US3] 播放驗證新轉輪與既有輪同速度、同圖庫來源後，移除此測試節點並存檔（確保零填參數即一致；本故事以驗證為主，不需再改腳本）

**Checkpoint**: 依 quickstart.md 情境 3 驗證——新增未填參數的轉輪表現與既有一致（SC-004 = 0 個必填參數）

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: 收尾、知識庫與端到端驗證

- [X] T014 端到端 Play 模式驗證 quickstart.md 情境 1~4 全數通過（滾動/依序停輪/對齊無退化、邊界不崩潰），請使用者手動點播放確認（勿用 MCP 開 preview）
- [X] T015 [P] 更新 `.claude/library/reel-spin.md` 與 `.claude/library/README.md` 索引：記錄「speed/調校常數→`define/ReelDefine`、symbolFrames→`singleton/ResourceManager` 單例」的集中式設定決策與依賴方向
- [X] T016 [P] 更新專案 memory：新增一則「轉輪參數集中式管理（define + ResourceManager 單例）」指向本 spec，方便後續擴充對齊
- [X] T017 對照 `.claude/instructions/typescript-code-standards.md` 檢查清單自審 `ReelDefine.ts`／`Singleton.ts`／`ResourceManager.ts`／`ReelView.ts`（單一責任、無魔術數字、空格規範、無重複）

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: 無依賴，最先執行
- **Foundational (Phase 2)**: 依賴 Setup；**阻擋**所有 user story
- **User Stories (Phase 3~5)**: 皆依賴 Foundational
  - US1 與 US2 均改 `ReelView.ts`（同檔），須**依序**：先 US1（T007）後 US2（T009）
  - US3 依賴 US1+US2 完成（新輪要能沿用集中速度與圖庫）
- **Polish (Phase 6)**: 依賴所有 user story 完成

### User Story Dependencies

- **US1 (P1)**: Foundational 後可開始；可獨立驗證（此時圖庫仍為各輪自有不影響速度測試）
- **US2 (P1)**: 需 T005（ResourceManager）與 T007（US1 已改的 ReelView）就緒後進行
- **US3 (P2)**: 需 US1+US2 完成

### Within Each User Story

- 腳本編輯（`ReelView.ts`）先於編輯器重新導入驗證
- 場景/Inspector 操作交由 `cocos-creator-developer` agent

### Parallel Opportunities

- Phase 2：T003（ReelDefine）與 T004（Singleton）可平行（不同檔）；T005 依賴 T004
- Phase 6：T015、T016 可平行（不同檔）
- 註：US1 與 US2 因共改 `ReelView.ts`，**不可**平行

---

## Parallel Example: Phase 2 Foundational

```text
# 可同時進行（不同檔、無互相依賴）：
Task: "建立 assets/scripts/define/ReelDefine.ts"        (T003)
Task: "建立 assets/scripts/singleton/Singleton.ts"       (T004)
# 完成 T004 後再進行：
Task: "建立 assets/scripts/singleton/ResourceManager.ts" (T005，依賴 T004)
```

---

## Implementation Strategy

### MVP First (User Story 1)

1. Phase 1 Setup → Phase 2 Foundational
2. Phase 3 US1（速度集中）
3. **STOP & VALIDATE**：quickstart 情境 1 通過即交付 MVP（一處改速度、全輪生效）

### Incremental Delivery

1. Setup + Foundational → 基礎就緒
2. US1（速度）→ 驗證 → 交付 MVP
3. US2（圖庫）→ 驗證 → 交付
4. US3（新輪零填）→ 驗證 → 交付
5. Polish（知識庫/自審/端到端）

---

## Notes

- [P] = 不同檔、無依賴；US1/US2 同改 `ReelView.ts` 故不可平行
- 每個 Cocos IDE 操作任務皆註明交由 `cocos-creator-developer` agent（Constitution Principle V）
- 每完成一個 checkpoint 可停下獨立驗證該故事
- 避免：動畫邏輯改動（FR-007 要求觀感不變）、擴大改動 `Math.random()`（見 plan.md Complexity Tracking）
