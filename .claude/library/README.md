# Library — 專案知識庫

本資料夾收錄 MCPCocosDemo 專案中，已完成且驗證過的功能實作知識。
每份文件記錄一個功能的**設計決策、關鍵機制、實作細節與驗證方式**，
供日後擴充、除錯或複用時快速對齊，避免重複踩坑或重新推導。

> 定位：`library/` = 已落地功能的「怎麼做、為什麼這樣做」；
> 與 `instructions/`（團隊通用程式碼規範）、`agents/`（子代理設定）互補。

## 索引

| 文件 | 主題 | 狀態 |
|------|------|------|
| [reel-spin.md](reel-spin.md) | 轉輪：`ReelView`（**格內鋸齒 `_stepAccurate` 位移＋整排級聯換圖＋停輪減速對齊**：位置由格內鋸齒 `_stepAccurate`（[0,_height)）驅動——全排在單格內平滑下滑、到格邊界彈回並整排 spriteFrame 級聯下移一列（頂格補隨機新圖），靠「節點彈回一格」抵消「整排圖下移一格」形成連貫捲動；停輪逐格 ×0.65 減速、最後一格線性緩降到 `FINAL_EASE_MIN_SPEED`，`_stepAccurate=0` snap 對齊）+ `GameController`（編排）—— 三輪同時 `spin()` 起轉、`scheduleOnce` 依序 `stop(minSteps)` 減速停輪；含單一 Mask、緩衝格藏換圖接縫、單幀 clamp 防呆；API `spin(speed?)`+`stop(minSteps)`+`isIdle()` | ✅ 已實作，**經 Play 模式實跑驗證正確**（演進：content-slide→recycling→公式化 offset→**2026-07-06 使用者親自改為「格內鋸齒 `_stepAccurate`＋整排級聯換圖」（無位置環繞），並清理參數定案**。停輪減速/末端緩降邏輯沿用；已移除 `_slideOffset`／`_wrapCursor`／`_totalHeight`／`_bottomBaseY`／`Label` import 等殘留；**2026-07-06 完成程式碼清理**：過時註解已同步現行模型、`_initFrames` 恢復開場隨機鋪圖（`start()` 時鋪一次）、`_assignWrapFrame` 補 null 檢查；並再移除動態格距欄位 `_height`（格距恆 120，改用常數 `SYMBOL_SPACING`），詳見 reel-spin.md 反省小節） |
| [state-machine.md](state-machine.md) | `StateMachine<TState>`：通用有限狀態機模組（`assets/utils/`），回呼式、與 cc 無耦合；`ReelView` 已改用 | ✅ 已實作（2026-07-02） |
| [ui-view.md](ui-view.md) | `UIView`：畫面 UI 呈現層（SPIN／Balance／Bet／Win），純 View + 事件 | ✅ 已實作驗證（2026-07-01） |
| [reel-spin.md](reel-spin.md)（集中式設定管理小節） | 轉輪參數集中化：速度＋調校常數→全域 define `ReelDefine`（`assets/scripts/define/`）、符號圖庫→Component 型單例 `ResourceManager`（`assets/scripts/singleton/`，`extends Singleton`）；`ReelView` 移除 `speed`/`symbolFrames` 兩 `@property`、改讀 define＋單例，動畫邏輯不變。單一真實來源、一處修改全輪套用（Spec Kit：`specs/001-reel-config-management/`） | ✅ 已實作，磁碟已驗證，Play 待使用者手動驗（2026-07-07） |

---

# 拉霸機整合說明（MVC）

四個類別依 **MVC** 分層：Model 持資料與規則、View 只呈現與轉發輸入、Controller 居中協調。
腳本目錄亦依層分資料夾：`assets/scripts/{model,view,controller}/`。

## 職責分層（架構）

```
                       ┌──────────────── [GameController] ────────────────┐
                       │                  (controller/ · SlotMachine)      │
                       │  持有 Model；串接 輸入 → Model → View；轉輪編排     │
                       └───────┬───────────────┬──────────────────┬───────┘
              new/讀寫          │               │ 訂閱事件/推顯示    │ spin()/stop()
                       ▼        │               ▼                  ▼
                [GameModel]     │          [UIView]          [ReelView] × 3
                (model/)        │          (view/ · UIPanel)  (view/ · Reel_1/2/3)
                balance/bet/win │          SPIN/Balance/Bet/  單一轉輪捲動／停輪動畫
                + Bet 規則       │          Win 顯示 + 輸入事件
                純類，無 cc 依賴  └───────────────────────────
```

- **GameModel**（[model 說明見 reel-spin.md / ui-view.md]）：純 TS 類（不 import `cc`、非 Component），由 Controller `new` 出來持有。存 balance/bet/win 與 Bet 的 `clamp/step` 規則。不含扣款/結算 gameplay。
- **UIView**（[ui-view.md](ui-view.md)）：UI 呈現層。純 View，對外開輸入事件（`setSpinHandler`／`setBetChangeHandler`）與顯示 setter，不存狀態、不做規則。
- **ReelView**（[reel-spin.md](reel-spin.md)）：單一轉輪的捲動／停輪動畫（**格內鋸齒 `_stepAccurate` 位移＋整排級聯換圖**：全排在單格內下滑、到格邊界彈回並整排 spriteFrame 級聯下移一列、頂格補隨機新圖；停輪逐格減速後 `_stepAccurate=0` snap 對齊），被 Controller 以 `spin( speed? )` 起轉、`stop( minSteps )` 停輪驅動。
- **GameController**（[reel-spin.md](reel-spin.md)）：唯一持有 Model 與所有 View 的協調層。轉輪編排、串接輸入與顯示更新。

## 耦合方向（單向）

`GameModel` ◀─ 持有 ─ **GameController** ─ 參照 ─▶ `UIView` / `ReelView`

- Controller 是唯一同時認識 Model 與 View 的層；Model 與 View 彼此不認識、也不反向依賴 Controller。
- 換 UI 皮、改編排規則、改資料規則，三者互不影響。

## 資料流（點一次 SPIN / 調 Bet）

1. 玩家點 SPIN → UIView 觸發 `spinHandler` → GameController.`spinAll()`（僅全部輪 idle 才受理）→ 三輪同時 `spin()` 起轉、並 `scheduleOnce` 於 `base + i×interval` 秒後對第 i 輪 `stop( stopMinSteps )`，同時請 UIView 禁用 SPIN。
2. 各 ReelView 自由滾動→減速→對齊停輪；GameController.`update()` 偵測全部 idle → 恢復 SPIN（未來於此結算 Win → `UIView.setWin(...)`）。
3. 玩家點 Bet +/- → UIView 觸發 `betChangeHandler(±1)` → GameController 呼 `GameModel.changeBet(±1)` → 把 `model.bet` 推回 `UIView.setBet(...)`。

## 端到端驗證（Play 模式）

- 點 SPIN → 三輪同時起轉、約 2.0/2.4/2.8s 依序停輪、對齊不歪斜、**無跳動**；轉動期間 SPIN 禁用、停輪後恢復。
- 點 Bet 的 +/- → Bet 值於 10~100 間以 10 增減（規則現由 GameModel 決定）。
- 架構檢查：`GameModel.ts` 無 `import ... 'cc'`；View 不含遊戲狀態；GameController 為唯一持有 Model 者。

## 撰寫慣例

- 檔名用 kebab-case，一份文件對應一個功能／模組。
- 結構建議：Context（為何做）→ 設計決策 → 關鍵機制 → 檔案與場景異動 → 驗證方式 → 後續擴充 → 踩坑紀錄。
- 引用具體檔案路徑與節點路徑；記錄 magic number 的由來。
- 功能擴充後，回頭更新對應文件與本 README 的索引／整合說明，保持知識與實作一致。
