# Implementation Plan

## Task Overview
純資產引用替換：將 `main.scene` 中 `ResourceManager` 節點的 `symbolFrames` 7 筆 `__uuid__` 由 debug 純色圖改為 Fish_1~7 的 sprite-frame 子資產（`@f9941`），再存檔並以磁碟序列化驗證。無 TypeScript 程式變更。所有 Cocos 場景操作經 `cocos-creator-developer` agent 執行（IDE 操作委由 `cocos-mcp-dev-assistant`）。

## Steering Document Compliance
- **structure.md**：僅修改既有 `assets/scene/main.scene`，不新增檔案；驗證採「磁碟序列化 + Play 模式手動實跑」。
- **tech.md**：使用正確 sprite-frame 子資產 `@f9941`；變更後 `scene_save_scene` 持久化，磁碟直寫則 `reimport_asset` 同步。

## Atomic Task Requirements
每個任務皆符合：檔案範圍 1 個、15–30 分鐘內可完成、單一可驗證產出、明確檔案路徑。

## Task Format Guidelines
- Checkbox 格式、標註 `_Requirements:_` 與 `_Leverage:_`。
- 僅涵蓋實作任務；Play 模式手動實跑為使用者驗收，列於下方「Post-Implementation」非編碼任務。

## Tasks

- [x] 1. 替換 `symbolFrames` 陣列為 Fish_1~7 的 SpriteFrame（`assets/scene/main.scene`）
  - File: `assets/scene/main.scene`（`ResourceManager` 節點元件，`symbolFrames` 現於約第 5288–5317 行）
  - 經 `cocos-creator-developer` agent 執行；將 7 筆 `__uuid__` 依序改為（`__expectedType__` 皆 `cc.SpriteFrame`）：
    - Fish_1 `01dff65a-e3e2-401d-ade2-0a5eb5607893@f9941`
    - Fish_2 `07a05d57-0181-4f42-9723-2424464f500a@f9941`
    - Fish_3 `25ca2f9c-c7fe-4f54-9256-cdb0ae91c951@f9941`
    - Fish_4 `7446020f-1713-4ff2-9544-8126e6ed4bb4@f9941`
    - Fish_5 `44847cbd-eff4-4f88-9972-f3db2974411d@f9941`
    - Fish_6 `8b81402c-7104-4a2d-b3a8-f3654b00d87e@f9941`
    - Fish_7 `fc59e954-514a-47ed-85e8-865db7bbbcbf@f9941`
  - 使用 `@f9941`（sprite-frame）子資產，**不得**用 `@6c48a`（texture）
  - 設定資產陣列採 `propertyType: 'spriteFrameArray'`、value 傳上列 uuid 字串陣列
  - Purpose: 讓集中式圖庫指向正式魚類美術，取代 debug 純色圖
  - _Leverage: assets/scripts/singleton/ResourceManager.ts（symbolFrames property，不改碼）, assets/textures/Fish_1~7.png_
  - _Requirements: 1.1, 1.2, 1.3_

- [x] 2. 存檔並以磁碟序列化驗證替換結果（`assets/scene/main.scene`）
  - File: `assets/scene/main.scene`（讀回驗證）
  - 呼叫 `scene_save_scene` 持久化；若採磁碟直寫則 `reimport_asset` 同步編輯器記憶體
  - 讀回 `main.scene` 的 `symbolFrames`，確認：恰 7 筆、順序為 Fish_1→7、後綴皆 `@f9941`、uuid 與任務 1 表一致、且不含任何 `debug/color_*` 引用
  - Purpose: 確保引用有效且完整，攔截誤用 texture 子資產或漏筆/錯序
  - _Leverage: assets/scene/main.scene_
  - _Requirements: 1.1, 1.2, 1.3, 3.1_

## Post-Implementation（使用者驗收，非編碼任務）
- **Play 模式手動實跑**（需求 2.1、2.2、3.1）：由使用者於 Cocos 編輯器點播放，確認三輪轉輪顯示 Fish 圖案、`getRandomSymbolFrame()` 正常抽圖、轉輪/停輪行為如常、無 missing/invalid 警告。不經 MCP 啟動外部 preview。
