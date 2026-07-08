# Quickstart: 驗證集中式設定管理

本檔為端到端驗證指引，證明「一處修改即全域生效、且轉輪行為不退化」。實作細節見 tasks.md 與各契約檔。

## 前置

- Cocos Creator 3.8.3+ 開啟 `MCPCocosDemo` 專案。
- 已完成本功能實作（define/singleton 腳本、`ReelView` 改版、場景新增 `ResourceManager` 節點並指派 `symbolFrames`）。
- MCP Server 已於編輯器手動啟動（若以 MCP 驗證）；預覽播放請於編輯器手動點播放（見 memory：MCP 無法啟動外部 preview）。

## 情境 1：一處改速度套用全部轉輪（US1 / SC-001, SC-003）

1. 編輯 `assets/scripts/define/ReelDefine.ts`，將 `DEFAULT_SPIN_SPEED` 由 500 改為明顯不同的值（如 900）。
2. 回編輯器等待腳本重新編譯，點播放。
3. **預期**：所有轉輪皆以新速度滾動；全程未編輯任何 Reel 節點的元件參數。

## 情境 2：一處增修圖庫套用全部轉輪（US2 / SC-002）

1. 於場景中掛載 `ResourceManager` 的單一節點，Inspector 的 `symbolFrames` 陣列新增一張可辨識的符號圖。
2. 存檔（`scene_save_scene`）後點播放，讓轉輪滾動數秒。
3. **預期**：新符號會出現在各轉輪的抽圖結果中；未在任何 `ReelView` 節點上編輯圖片陣列。

## 情境 3：新增轉輪零填參數（US3 / SC-004）

1. 複製一個既有轉輪節點（或新建並接好 `symbolStrip` 節點結構），**不**填任何圖庫／速度參數。
2. 點播放。
3. **預期**：新轉輪與既有轉輪表現一致（同速度、同圖庫來源）。

## 情境 4：行為不退化與邊界安全（SC-005 / FR-006, FR-007）

1. 點播放，觀察滾動 → 依序停輪 → 對齊：與改版前一致（無跳動、無缺格重疊、停齊）。
2. 邊界：將 `ResourceManager` 的 `symbolFrames` 清空後播放 → 轉輪不崩潰（各格略過指派）。
3. 邊界：`spin()` 傳入 0 或負速度 → 回退 `ReelDefine.DEFAULT_SPIN_SPEED`，正常滾動。

## 通過準則

- 情境 1~3 皆「僅改一處」即生效，且過程零次編輯 Reel 元件。
- 情境 4 行為與改版前無可觀察差異，邊界皆不崩潰。
- 對照 spec.md 的 SC-001~005 全數達成。
