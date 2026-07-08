# Contract: 設定與資源的存取介面

本功能對外契約為內部程式介面（`ReelView` 等消費者如何取得集中設定與資源）。無網路／CLI 介面。

## C1. ReelDefine（全域 define 存取契約）

**匯出**：`assets/scripts/define/ReelDefine.ts` 匯出唯讀常數集合 `ReelDefine`。

**契約**：

| 成員 | 型別 | 保證 |
|------|------|------|
| `ReelDefine.SYMBOL_SPACING` | `number` | > 0，格距單一真實來源 |
| `ReelDefine.DEFAULT_SPIN_SPEED` | `number` | > 0，預設滾動速度 |
| `ReelDefine.MAX_SLIDE_CELLS_PER_FRAME` | `number` | (0, 1)，單幀防呆上限 |
| `ReelDefine.STOP_MIN_STEPS_FLOOR` | `number` | ≥ 0 整數 |
| `ReelDefine.DECEL_STEP_THRESHOLD` | `number` | ≥ 0 整數 |
| `ReelDefine.DECEL_FACTOR` | `number` | (0, 1) |
| `ReelDefine.MIN_STOPPING_SPEED` | `number` | > 0 |
| `ReelDefine.FINAL_EASE_MIN_SPEED` | `number` | > 0 且 < `MIN_STOPPING_SPEED` |
| `ReelDefine.FREE_SPIN_STEPS` | `number` | 哨兵值（< 0） |

**使用約定**：消費者僅讀取，不得寫入（唯讀語意）。修改設定＝編輯此檔一處。

## C2. ResourceManager（資源單例存取契約）

**匯出**：`assets/scripts/singleton/ResourceManager.ts` 匯出 `class ResourceManager extends Component`。

**靜態存取**：

- `ResourceManager.instance: ResourceManager | null`
  - `onLoad` 後、`onDestroy` 前為有效實例；否則為 `null`。
  - 呼叫端 **MUST** 在使用前檢查 `null`（FR-006：未就緒不得崩潰）。

**方法**：

- `getSymbolFrames(): SpriteFrame[]`
  - 回傳目前圖庫（可能為長度 0 的陣列）。永不回 `null`。
- `getRandomSymbolFrame(): SpriteFrame | null`
  - 圖庫非空時回其中隨機一張；圖庫為空時回 `null`。

**不變式**：

- 全場景僅一個 `ResourceManager` 實例（掛於單一節點）。若偵測到重複實例，後者 **SHOULD** 不覆蓋既有 `instance`（保留先登記者）並可記錄告警。

## C3. ReelView 消費契約（改版後行為保證）

- `spin( speed? )`：`speed` 為正時採用之；否則採 `ReelDefine.DEFAULT_SPIN_SPEED`（不再讀移除的 `this.speed`）。
- 初始鋪圖與滾動換圖：透過 `ResourceManager.instance?.getRandomSymbolFrame()` 取圖；`instance` 為 `null` 或圖庫空時，該格略過指派（不崩潰、不改變既有安全行為）。
- 對外 API（`spin`／`stop`／`isIdle`）簽章不變，`GameController` 無需改動。

## 驗收對應

| 契約項 | 對應 FR / SC |
|--------|--------------|
| C1 一處改速度／調校 | FR-001, FR-003, FR-008, SC-001, SC-003 |
| C2 一處維護圖庫、空庫安全 | FR-002, FR-004, FR-006, SC-002 |
| C3 API 不變、觀感不變、新輪零填參數 | FR-005, FR-007, SC-004, SC-005 |
