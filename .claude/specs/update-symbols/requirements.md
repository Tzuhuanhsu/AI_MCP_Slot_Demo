# Requirements Document

## Introduction

本功能將 `ResourceManager`（集中式符號圖庫單例）在場景中掛載的 `symbolFrames` 陣列，由目前的 debug 佔位圖（`assets/textures/debug/` 下的 7 張 `color_*` 純色圖）替換成正式的魚類符號圖 `assets/textures/Fish_1.png` ~ `Fish_7.png`。此為資產資料替換，不涉及程式邏輯或介面變更，目的是讓轉輪顯示正式美術資產而非除錯用純色塊。

## Alignment with Product Vision

專案尚無正式 steering 文件（`product.md`/`tech.md`/`structure.md` 未建立）。本功能延續既有的「符號圖庫集中式管理」架構決策（見 memory `reel-config-centralization`）：圖庫為單一真實來源，各 `ReelView` 向 `ResourceManager` 抽圖。本次僅更換圖庫內容資料，強化「以正式資產取代除錯佔位」的產品方向，不改變架構。

## Requirements

### Requirement 1 — 替換圖庫資產內容

**User Story:** 作為遊戲開發者，我想要讓 `ResourceManager.symbolFrames` 指向 Fish_1~Fish_7 的 SpriteFrame，如此轉輪符號即顯示正式魚類美術，而非 debug 純色圖。

#### Acceptance Criteria

1. WHEN 場景 `main.scene` 儲存後 THEN `ResourceManager` 節點的 `symbolFrames` 陣列 SHALL 恰好包含 7 筆項目，依序對應 Fish_1、Fish_2、Fish_3、Fish_4、Fish_5、Fish_6、Fish_7 的 SpriteFrame 子資產。
2. WHEN 檢視 `symbolFrames` 中任一項目的 `__uuid__` THEN 該值 SHALL 為對應 Fish PNG 的 sprite-frame 子資產 uuid（形如 `<png-uuid>@6c48a`），且 `__expectedType__` SHALL 為 `cc.SpriteFrame`。
3. IF 替換完成 THEN `symbolFrames` 陣列中 SHALL 不再包含任何 `assets/textures/debug/` 下 `color_*` 圖的引用。

### Requirement 2 — 維持既有存取行為

**User Story:** 作為遊戲開發者，我想要替換後 `ResourceManager` 的對外 API 行為維持不變，如此既有 `ReelView` 抽圖流程無需修改即可正常運作。

#### Acceptance Criteria

1. WHEN 遊戲執行且呼叫 `getRandomSymbolFrame()` THEN 系統 SHALL 從 7 張 Fish SpriteFrame 中隨機回傳一張，永不回傳 null。
2. WHEN 呼叫 `getSymbolFrames()` THEN 系統 SHALL 回傳長度為 7 的 Fish SpriteFrame 陣列。
3. IF 本功能完成 THEN `ResourceManager.ts` 的程式碼 SHALL 維持不變（純資產資料替換，不改邏輯與介面）。

### Requirement 3 — 引用有效性

**User Story:** 作為遊戲開發者，我想要替換後所有 SpriteFrame 引用皆有效，如此不會在編輯器或執行期出現 uuid invalid / 資產被 revert 成預設的問題。

#### Acceptance Criteria

1. WHEN 場景重新載入或 reimport 後 THEN 所有 7 筆 `symbolFrames` 引用 SHALL 皆能解析為有效 SpriteFrame，無 missing / invalid 警告。
2. IF 任一 Fish PNG 的 `.meta` 缺少 sprite-frame 子資產 THEN 系統 SHALL 於實作前先修復該 `.meta`（參考 memory `png-import-type-sprite-frame`），再進行替換。

## Non-Functional Requirements

### Performance
- 替換為靜態資產引用，無執行期效能影響；7 張圖載入成本與現況（7 張 debug 圖）相當。

### Security
- 無安全考量（本地資產資料變更）。

### Reliability
- 必須使用 Fish PNG 正確的 sprite-frame 子資產 uuid（`@6c48a`），不可誤用 texture 子資產或 png 主 uuid，以免引用失效。
- 場景變更後須 `scene_save_scene` 持久化，並於必要時 `reimport_asset` 讓編輯器記憶體同步。

### Usability
- 替換後轉輪符號應清楚顯示為魚類圖案，取代原本難以辨識的純色佔位塊。
