# Phase 1 Data Model: 集中式設定管理

本功能無持久化資料；此處描述的是「設定與資源的結構實體」與其關係、驗證規則。

## 實體

### ReelDefine（全域遊戲設定）

- **位置**：`assets/scripts/define/ReelDefine.ts`
- **形式**：唯讀具名常數集合（單一 `const` 物件匯出）
- **欄位**（沿用現行語意，型別皆為 `number`）：

  | 欄位 | 現行值 | 說明 |
  |------|--------|------|
  | `SYMBOL_SPACING` | 120 | 相鄰 symbol 垂直間距（像素），格距唯一真實來源 |
  | `DEFAULT_SPIN_SPEED` | 500 | 預設自由滾動速度（像素／秒） |
  | `MAX_SLIDE_CELLS_PER_FRAME` | 0.5 | 單幀最多推進格數上限（防呆） |
  | `STOP_MIN_STEPS_FLOOR` | 2 | stop 的最少倒數步數下限 |
  | `DECEL_STEP_THRESHOLD` | 5 | 剩餘步數低於此值開始每步減速 |
  | `DECEL_FACTOR` | 0.65 | 每減速步的速度衰減係數 |
  | `MIN_STOPPING_SPEED` | 80 | 減速過程速度下限（像素／秒） |
  | `FINAL_EASE_MIN_SPEED` | 20 | 停輪前最後一格緩降速度下限 |
  | `FREE_SPIN_STEPS` | -1 | 自由滾動剩餘步數哨兵值 |

- **驗證規則**：常數固定值；`DEFAULT_SPIN_SPEED > 0`。修改僅需編輯此檔（單一真實來源，FR-001/008）。
- **狀態轉換**：無（無狀態）。

### ResourceManager（符號圖庫資源單例）

- **位置**：`assets/scripts/singleton/ResourceManager.ts`（繼承 `cc.Component`）
- **欄位**：
  - `symbolFrames: SpriteFrame[]` — `@property`，於單一場景節點的 Inspector 指派（唯一來源）。
  - `static instance: ResourceManager | null` — 單例參照，`onLoad` 登記、`onDestroy` 清除。
- **對外方法（契約見 contracts/config-access.md）**：
  - `getSymbolFrames(): SpriteFrame[]`
  - `getRandomSymbolFrame(): SpriteFrame | null`
- **驗證規則**：
  - 圖庫可為空；為空時 `getRandomSymbolFrame()` 回 `null`（FR-006，沿用既有安全行為）。
  - `instance` 未就緒時，呼叫端須容忍（回空／null），不得崩潰。
- **關係**：被 `ReelView` 單向讀取；不認識任何 View/Controller。

### Singleton（通用單例基底）

- **位置**：`assets/scripts/singleton/Singleton.ts`
- **職責**：提供 `instance` 登記／存取的最小共用骨架，供 `ResourceManager` 沿用。
- **關係**：`ResourceManager` 依賴之；無其他耦合。

### ReelView（參數來源變更後的消費者）

- **位置**：`assets/scripts/view/ReelView.ts`（既有，修改）
- **移除**：`@property symbolFrames`、`@property speed`。
- **保留**：`@property symbolStrip`（每輪必要的節點結構參照）。
- **新依賴**：`ReelDefine`（速度與調校常數）、`ResourceManager.instance`（符號圖庫）。
- **不變**：滾動／換圖／停輪的所有動畫狀態量與方法（`_stepAccurate`、`_advance`、`_onStep`、`_travelNodes`、停輪對齊）。

## 關係圖（單向依賴）

```
ReelView ──讀常數──▶ ReelDefine (define/)
   │
   └──讀圖庫──▶ ResourceManager.instance ──繼承──▶ Singleton (singleton/)
                    ▲
                    │ Inspector 一次性指派 symbolFrames
              (單一場景節點)
```

- 依賴方向嚴格單向：`ReelView → {ReelDefine, ResourceManager}`；被依賴者不反向認識 View。
- 符合 Constitution III（MVC 低耦合）與 II（單一真實來源）。
