# UIView（畫面 UI 呈現層）

**狀態**：✅ 已實作並驗證（2026-07-01，MVC 重構後）
**核心檔案**：`assets/scripts/view/UIView.ts`
**掛載節點**：`Canvas/SlotMachine/UIPanel`（uuid `c9I721zbdCqZ6TlG73L6MY`）

> 本專案為 **MVC**：整體三層與資料流見 [README.md](README.md)；轉輪 View 見 [reel-spin.md](reel-spin.md)。
> `UIView` 是 MVC 的 **View（UI 部分）**；資料層 `GameModel`、協調層 `GameController` 說明見 README／reel-spin.md。

## Context

拉霸機除轉輪外的畫面 UI（SPIN 按鈕、Balance／Bet／Win 顯示、Bet 加減）需要一個呈現層。
沿革：曾為 `UIController`（自帶顯示狀態與下注 clamp 規則）；MVC 重構後改名 `UIView`，
**把狀態與規則移入 `GameModel`**，UIView 只剩「渲染 + 轉發輸入」。

## 定位：純 View + 事件

- **對外開輸入事件回呼與顯示 setter**，本身**不存遊戲狀態、不做規則判斷**（下注級距/上下限由 GameModel 決定）。
- **耦合**：`GameController → UIView`（單向）；UIView 不認識 Model、不反向依賴 Controller，好測試、好替換。
- 觸發流程：SPIN／Bet± 點擊 → UIView 呼叫已註冊的 handler → GameController 處理（讀寫 GameModel）→ 回頭呼 UIView 的 setter 更新顯示。

## 公開 API

- `setSpinHandler( cb: () => void )` — 註冊 SPIN 點擊回呼。
- `setBetChangeHandler( cb: (direction: number) => void )` — 註冊 Bet 調整回呼；+ 鈕傳 `+1`、- 鈕傳 `-1`（**不含級距大小**，級距由 Model 決定）。
- `setBalance( value )` / `setBet( value )` / `setWin( value )` — 更新對應 Label 顯示。
- `setSpinInteractable( enabled )` — 取 SPIN 節點的 `cc.Button` 設 `interactable`（轉動中禁用、停輪後恢復）。

## 內部行為

- onLoad：綁定 SPIN／Bet± 按鈕（顯示初值由 GameController 於其 onLoad 從 Model 推入）。
- SPIN 按鈕點擊 → 觸發 `spinHandler`（無則忽略）。
- Bet +/- 按鈕 → 觸發 `betChangeHandler( +1 / -1 )`（純方向意圖，無數值運算）。
- 顯示更新：`_applyLabel( node, value )` 取節點的 `cc.Label` 設 `string`。
- 所有節點參照皆為 `@property( Node )`，使用時 `getComponent( Button/Label )`（Node 參照較穩定，避開元件參照 marshalling 問題）。

## 具名常數

| 常數 | 值 | 意義 |
|------|----|------|
| `BET_DIRECTION_UP` | +1 | Bet 增加方向 |
| `BET_DIRECTION_DOWN` | -1 | Bet 減少方向 |

> 下注級距／上下限（`BET_STEP`／`MIN_BET`／`MAX_BET`）已移至 `GameModel`，不再放 View。

## @property（節點參照，皆 Node 型別）

`spinButton`、`balanceLabel`、`betLabel`、`winLabel`、`betMinusButton`、`betPlusButton`。

## GameController／GameModel 的配合

- **GameController**（controller/）：`new GameModel()`；onLoad 解析 UIView 並
  `setSpinHandler(()=>spinAll())`、`setBetChangeHandler(dir=>...)`，再把 Model 初值推入三個顯示 setter。
- Bet 流程：UIView 傳方向 → `GameModel.changeBet(±1)`（內含 step/clamp）→ `UIView.setBet(model.bet)`。
- SPIN 流程：轉動時 `setSpinInteractable(false)`；`update()` 偵測全部輪 idle → `setSpinInteractable(true)`。

## 節點／元件 UUID・cid

| 節點 | UUID |
|------|------|
| UIPanel（掛 UIView） | `c9I721zbdCqZ6TlG73L6MY` |
| SpinButton | `baNCTb0qND0KZdEkwUJz6k` |
| BalanceValueLabel | `c6I/fJrUxGyJTdOWz1xQBp` |
| BetValueLabel | `86hIRe45BIYbATbZaRcVTd` |
| WinValueLabel | `cemk46fklELadeIC8oKAjP` |
| BetMinusButton | `bbXiwzbd5GW6NVLcPNNuZx` |
| BetPlusButton | `88lbYy6elEXrZlw6Ye7cyd` |

元件 cid（MVC 重構後重新掛載）：UIView `0243evp0blNM6lk6wchf80a`。

## 驗證方式（需 Play 模式）

1. 點 SPIN → 觸發轉動，且 SPIN 按鈕於轉動期間禁用、全部停輪後恢復。
2. 點 Bet 的 +/- → Bet 數值在 10~100 間以 10 遞增／遞減（規則由 GameModel 決定）。
3. 程式：`debug_execute_script` 取得 UIView 呼叫 `setWin(500)` / `setBalance(...)`，對應 Label 應即時更新。

## 踩坑紀錄

- 自訂腳本設屬性需用 cid（見 [reel-spin.md](reel-spin.md) 踩坑與 memory `custom-script-component-set-property-cid`）。
- UI Label 底色為白 Panel，文字須用深色才可讀（見場景配色調整）。

## 後續擴充（尚未做）

- 下注扣款／餘額結算等 gameplay 放 **GameModel／GameController**，透過 UIView 的 setter 更新顯示，**不放進 View**。
