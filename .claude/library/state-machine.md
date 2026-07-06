# StateMachine — 通用有限狀態機模組

## Context（為何做）

`ReelView` 原以 `enum ReelState` + `update()` 內的 `if/else` 手動管理狀態，
狀態切換散落各處（直接寫 `this._state = ...`），不易複用也難擴充。
抽出一個與 Cocos 無耦合的通用 FSM 模組，透過 import 套用於任何需要
「狀態切換 + 逐幀更新」的物件。

## 位置

`assets/utils/StateMachine.ts`（純 TypeScript，不 import `cc`、非 Component）。

## 設計決策

- **回呼式而非類別式**：每個狀態以 `define( state, { onEnter, onUpdate, onExit } )` 註冊回呼，
  而非每個狀態一個 class。對本專案的簡單狀態邏輯而言最輕量、貼合原有寫法，改動最小
  （避免過度設計）。
- **泛型 `StateMachine<TState>`**：`TState` 可為 enum / string / number，呼叫端自訂狀態集合。
- **切換語意**：`changeTo` 先呼叫舊狀態 `onExit`、再呼叫新狀態 `onEnter`；`update` 只派發給當前狀態的 `onUpdate`。
- **安全檢查**：切換／啟動到未註冊狀態時不作任何事；`changeTo` 到目前所在狀態亦不觸發（避免無意義的 exit/enter）。

## API

| 方法 | 說明 |
|------|------|
| `define( state, handlers )` | 註冊狀態回呼，回傳自身以鏈式呼叫；重複註冊會覆寫 |
| `start( state )` | 設初始狀態並觸發其 `onEnter`（未註冊則忽略） |
| `changeTo( state )` | 切換狀態（舊 `onExit` → 新 `onEnter`）；未註冊或同狀態則忽略 |
| `update( deltaTime )` | 派發給當前狀態的 `onUpdate`；未 `start` 則忽略 |
| `is( state )` | 是否處於指定狀態 |
| `current` (getter) | 目前狀態，未 `start` 時為 `null` |

## 套用範例（ReelView）

```typescript
this._machine
    .define( ReelState.IDLE, {} )
    .define( ReelState.SPINNING, {
        onUpdate: ( deltaTime ) => this._updateSpinning( deltaTime ),
    } )
    .define( ReelState.STOPPING, {
        onEnter: () => this._enterStopping(),      // 進入時計算停輪目標位移
        onUpdate: ( deltaTime ) => this._updateStopping( deltaTime ),
    } );
this._machine.start( ReelState.IDLE );
```

狀態切換由狀態內部驅動：等速時間到 → `changeTo( STOPPING )`；減速完成 → `changeTo( IDLE )`。
`spin()` / `isIdle()` 對外介面不變。

## 後續擴充

- 需要轉場守衛（guard）或轉場表（僅允許特定 A→B）時，可於 `changeTo` 前加白名單，不影響現有呼叫端。
- 需要事件驅動（`send( event )` 觸發轉場）時，可另加一層事件→狀態對應，維持核心不變。

## 踩坑紀錄

- `IDLE` 的 `onEnter` 保持為空：因初始 `start( IDLE )` 也會觸發 `onEnter`，
  停輪完成的 `_onStopped()` 因此仍由 `_updateStopping` 顯式呼叫，避免遊戲一開始就誤觸發停輪回呼。
