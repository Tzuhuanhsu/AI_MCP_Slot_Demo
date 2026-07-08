# Phase 0 Research: 集中式設定管理設計決策

本檔記錄規劃階段的關鍵設計取捨，並解消 spec.md 的 *Outstanding Clarifications*。
使用者的規劃輸入（採 singleton pattern、Reel 向 singleton 取資源／設定、新增 `define/` 與 `singleton/` 資料夾）已直接定調主要方向。

## D1. 速度與調校數值 → 全域 define（常數模組）

- **Decision**：於 `assets/scripts/define/ReelDefine.ts` 以具名常數集中定義轉輪的滾動速度與所有調校數值
  （`SYMBOL_SPACING`、`DEFAULT_SPIN_SPEED`、`MAX_SLIDE_CELLS_PER_FRAME`、`STOP_MIN_STEPS_FLOOR`、
  `DECEL_STEP_THRESHOLD`、`DECEL_FACTOR`、`MIN_STOPPING_SPEED`、`FINAL_EASE_MIN_SPEED`、`FREE_SPIN_STEPS`），
  以單一 `const` 物件（如 `ReelDefine`）匯出，供 `ReelView` 直接 import 讀取。
- **Rationale**：這些是「遊戲設定」而非資源，符合使用者「全域 define 方式獲取遊戲設定」；集中後改速度／調校只需改此檔一處（SC-001、SC-003）。消除 `ReelView` 內散落的模組級常數與 `speed` Inspector 欄位（FR-001、FR-008）。
- **Alternatives considered**：
  - 放進資源單例當執行期可調欄位 — 否決：速度屬靜態設定，常數 define 更簡單、無執行期狀態、無 Inspector 依賴。
  - 保留 `ReelView` 內原常數 — 否決：無法達成「一處修改」與去除每輪 Inspector `speed`。

## D2. 符號圖庫（SpriteFrame[]）→ Component 型單例資源管理

- **Decision**：於 `assets/scripts/singleton/ResourceManager.ts` 實作一個 **繼承 `Component`** 的單例，掛在場景中「單一」節點上，於其 Inspector 一次性指派 `symbolFrames: SpriteFrame[]`；`onLoad` 時把自身登記為靜態 `instance`。對外提供 `getSymbolFrames()` 與 `getRandomSymbolFrame()`。`ReelView` 透過 `ResourceManager.instance` 取得圖庫。
- **Rationale**：符號圖庫是需在編輯器指派的 `SpriteFrame` **資產**。純 TS 單例無法直接持有 Inspector 指派的資產。以 Component 單例集中於單一節點，即可「一處編輯圖庫、全部轉輪共用」（SC-002），且沿用本專案既有的 Inspector 資產指派工作流（與 MCP `spriteFrameArray` 指派相容，見 memory）。
- **Alternatives considered**：
  - 純 TS 單例 + `resources.loadDir` 動態載入 — 否決（本次）：需把資產搬入 `assets/resources/` 並改為非同步載入，改動面大、與現有同步啟動流程不合，屬過度設計。可列為未來若要「零 Inspector」時的演進方向。
  - 每個 `ReelView` 仍各自持有圖庫 — 即現況，被本功能否決。

## D3. 通用單例基底 `Singleton`

- **Decision**：於 `assets/scripts/singleton/Singleton.ts` 提供極薄的通用單例骨架，`ResourceManager` 沿用其 `instance` 登記／存取模式。
- **Rationale**：符合「預留適當擴展空間」——未來若新增其他 manager 可複用；成本極低。
- **Alternatives considered**：不抽基底、instance 寫死於 `ResourceManager` — 可行但重複；抽出成本低故採用，並保持最小、不過度抽象（Constitution I）。

## D4. `ReelView` 改動範圍

- **Decision**：移除 `@property symbolFrames` 與 `@property speed`（連同其僅供 Inspector 預設用的本地常數）；
  `spin()` 的預設速度改讀 `ReelDefine.DEFAULT_SPIN_SPEED`；`_initFrames()`／`_randomFrame()` 改向 `ResourceManager.instance` 取圖庫；其餘散落常數改引用 `ReelDefine`。保留 `@property symbolStrip`（節點結構接線，非可調參數）。動畫邏輯（`_advance`／`_onStep`／`_travelNodes`／停輪對齊）一字不改。
- **Rationale**：達成 FR-002~005 且滿足 FR-007（觀感不變）。`symbolStrip` 是每輪必要的節點參照，不屬「重複填的可調參數」，保留合理。
- **Alternatives considered**：連 `symbolStrip` 也集中化 — 否決：各輪捲動的是不同節點，本就需各自接線，非集中對象。

## 解消 spec.md 的 Outstanding Clarifications

- **C1 個別轉輪覆寫**：**不保留**。全體轉輪一律共用 define 速度與單例圖庫（符合 Constitution II 單一真實來源）。未來若需特例覆寫再另立需求。
- **C2 納入集中管理的參數範圍**：**全部納入**。除 `symbolFrames`（單例）與 `speed`（define）外，停輪／減速／格距等調校常數一併移入 `ReelDefine`，徹底去除 `ReelView` 內魔術數字（FR-008）。
- （範圍註記）`GameController` 的計時常數（`baseSpinDuration` 等）本次**不**納入，維持其現有 Inspector 欄位；如要一併集中可列為後續任務，不影響本功能交付。
