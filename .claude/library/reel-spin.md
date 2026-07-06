# 轉輪轉動（Reel_1 ~ Reel_3，同時起轉 · 依序停輪）

**狀態**：✅ 已實作，視覺經使用者實跑確認（單輪 → 三輪 → MVC 重構 2026-07-01 → 「小幅移動＋切圖 content-slide」2026-07-02 → 輸送帶捲動＋停輪減速對齊 2026-07-05 → 改「符號回收 recycling」：節點帶圖 travel、滑出底端才繞頂換圖、停輪 snap 對齊，2026-07-05 → 停輪最後一格改線性緩降到 `FINAL_EASE_MIN_SPEED`，消除末端速度瞬間歸零的頓挫感，2026-07-06 → 位置模型曾改為「公式化 offset」（`_slideOffset` 取模 + `_wrapCursor` 單節點換圖），2026-07-06 → **使用者親自修改並清理參數，定案為「格內鋸齒 `_stepAccurate` 位移 ＋ 整排 spriteFrame 級聯換圖」模型（無位置環繞）：節點在單格內平滑下滑、到格邊界彈回並整排下移一列圖，靠「節點彈回一格」抵消「整排圖下移一格」達成連貫捲動；已移除 `_slideOffset`／`_wrapCursor`／`_totalHeight`／`_bottomBaseY` 等殘留狀態，並經 Play 模式實跑驗證正確，2026-07-06 → **再移除動態格距欄位 `_height`：因專案格距恆為 120、`_height` 每次推算皆等於常數 `SYMBOL_SPACING`，屬多餘，改為一律直接用 `SYMBOL_SPACING`；對現行場景行為等價，2026-07-06**）

> ⚠️ **本文於 2026-07-06 依使用者手改＋清理後的 `ReelView.ts` 重新校對**：以下「現行模型」章節反映使用者修改後的實際程式行為，**已經 Play 模式實跑驗證正確**（上下移動的精靈交換）。使用者已清掉先前的殘留狀態（`_slideOffset`／`_wrapCursor`／`_totalHeight`／`_bottomBaseY`／`_poolIndex`／`Label` import）；隨後 2026-07-06 完成一輪純程式碼清理（過時註解同步、`_initFrames` 恢復開場隨機鋪圖、`_assignWrapFrame` 補 null 檢查），詳見「反省」小節。
**核心檔案**：`assets/scripts/view/ReelView.ts`（轉輪動畫，View）、`assets/scripts/controller/GameController.ts`（編排，Controller）
**掛載節點**：`ReelView` → 各 `Reel_1/2/3`；`GameController` → `Canvas/SlotMachine`

> 本專案已重構為 **MVC**：整體三層架構與資料流見 [README.md](README.md)；UI 呈現層 `UIView` 見 [ui-view.md](ui-view.md)；
> 資料層 `GameModel`（純類、無 `cc`、由 GameController 持有 balance/bet/win 與 Bet 規則）見 README。
> 本文聚焦轉輪的 `ReelView`（動畫）與 `GameController`（轉輪編排）。歷史沿革：單輪 → 三輪依序停輪 → MVC 分層。

## Context

`main.scene` 原本已有完整拉霸機視覺結構（3 個 Reel、SymbolStrip、SpinButton、UI 面板），
但**沒有任何轉動邏輯**：SpinButton 的 `clickEvents` 為空，唯一的腳本 `SpriteFrameAnimation.ts`
只做逐幀圖片動畫。

本功能以 **Reel_1** 為第一版單輪雛型，實作「點擊 SPIN → 轉輪連續轉動（時間可由程式參數指定）→ 減速停輪並對齊原位」，
再擴展到三輪同時起轉、依序停輪。

## 確認過的設計決策

| 決策點 | 選擇 | 理由 |
|--------|------|------|
| 轉動控制 | `spin( speed? )` 起轉（自由滾動）＋ `stop( minSteps )` 減速停輪；Inspector 留 `speed` 預設值 | 起轉與停輪時機分離、由 Controller 編排（早期 `spin(duration)` 轉固定秒數已汰換） |
| 停輪結果 | 減速後對齊回 `+120/0/-120` 格點，不做隨機結果 | 第一版先驗手感，結果判定後補 |
| symbol 溢出 | 在 **ReelContainer 加單一 `cc.Mask`** 裁切三輪 | 視覺乾淨；一次 stencil 開銷，比每輪一個 Mask 省效能 |
| 轉動觸發 | 由 UIView 的 SPIN 事件經 GameController 觸發 | MVC 職責分離，見 [README.md](README.md) |

## 場景現況（實作依據的關鍵數字）

- `Reel_1`（x=-260，Sprite 暗藍底 220×360）
  - `SymbolStrip`（位置 (0,0)）
    - `Symbol_Top` (y=**120**) / `Symbol_Mid` (y=**0**) / `Symbol_Bot` (y=**-120**)
    - symbol 間距 **120px**，皆 150×150 縮放 0.7333
- symbol 數量 = **5**（見「防跳動：窗外緩衝排」），y 分佈 {240,120,0,-120,-240}，
  strip 高度 = 120 × 5 = **600**；可視窗高 360（靜止時只顯示中間 3 格，±240 兩排被 Mask 裁掉）。
  ⚠️ 早期為 3 個（strip 高 360）會有轉動跳動，已修正。

## 核心機制：格內鋸齒 `_stepAccurate` 位移＋整排級聯換圖（現行，使用者手改 2026-07-06）

> **演進**：`_offset+wrapY`（浮點對齊、baseY 須為 120 倍數，會機率性歪斜）→ `content-shift`（節點固定、搬 frame）→
> `content-slide`（節點只在單格內小幅滑、靠整排切圖製造流動、共用 `_offset`）→ 符號回收 recycling（節點帶圖 travel、單節點繞頂換圖）→
> 公式化 offset（`_slideOffset` 取模 + `_wrapCursor` 單節點換圖）→ **格內鋸齒 `_stepAccurate` ＋ 整排級聯換圖（現行，使用者手改 2026-07-06）**。
>
> **本次由使用者親自修改，非 agent 產出**，並經 **Play 模式實跑驗證正確**（「上下移動的精靈交換」）。使用者隨後**再次清理掉不必要的參數**，模型收斂為純淨的「格內鋸齒位移＋整排級聯換圖」。與前一版（公式化 offset）相比，實質差異：
> 1. **位置驅動**：唯一狀態量為**格內鋸齒 `_stepAccurate`（範圍 [0, _height]）**；`_slideOffset` 已移除。
> 2. **換圖方式**：`_onStep → _assignWrapFrame` 把**整排 spriteFrame 級聯下移一列**（每格接手上一格的圖、頂格補隨機新圖）；`_wrapCursor` 單節點換圖已移除。
> 3. **無位置環繞**：`_travelNodes` 不再做 `+= _totalHeight` 環繞；`_totalHeight`／`_bottomBaseY` 已移除。全排單純在單格內鋸齒下滑、到格邊界隨 `_stepAccurate` 歸零一起彈回，連貫性純由「鋸齒彈回 ⇄ 整排級聯換圖」互相抵消達成。
> 4. **格距固定、移除動態 `_height`（2026-07-06 再簡化）**：先前用 `_height = _units[0].y - _units[1].y` 動態推算格距，但專案恆定「三輪 symbol 格距 = 120」（場景強制、見踩坑），故 `_height` 每次都等於常數 `SYMBOL_SPACING`，屬多餘欄位，已移除。現行所有格距一律直接用 `SYMBOL_SPACING`（120）。**本文以下出現的 `_height` 皆等同此固定格距 `SYMBOL_SPACING`**。取捨：程式現在假設「場景實際格距 == `SYMBOL_SPACING`」（不再自適應任意格距），因專案已把 120 格距列為硬性規範，此耦合可接受，且使 `SYMBOL_SPACING` 成為格距的唯一真實來源。`_topBaseY`（最頂節點 y）仍動態讀取。

### 白話：什麼是「格內鋸齒」

「格內鋸齒」是在描述 `_stepAccurate` 這個變數**隨時間變化的波形**，拆成兩個詞理解：

- **格內**＝數值範圍被限制在一格之內：`_stepAccurate` 永遠落在 `[0, _height]`（一格高，如 0~120），代表「目前這一格滑到哪了」，**不是**累計總滑距。
- **鋸齒**＝變化波形長得像鋸齒（sawtooth）：每幀慢慢增加（節點往下滑），一累滿一格（到 `_height`）就**瞬間歸零**，再慢慢增加、再歸零，週而復始。畫成時間圖：

```
_stepAccurate
120 ┤    /|    /|    /|
    │   / |   / |   / |
 60 ┤  /  |  /  |  /  |
    │ /   | /   | /   |
  0 ┤/    |/    |/    |/
    └───────────────────→ 時間
     ↑歸零  ↑歸零  ↑歸零
```

斜線緩升（節點平滑往下滑一格）＋垂直驟降回 0（到邊界瞬間彈回），這個「緩升、驟降」反覆的形狀就叫鋸齒波。對應到畫面：

- **斜線段**：`_travelNodes` 以 `y = _topBaseY - x·_height - _stepAccurate` 定位，`_stepAccurate` 由 0 漲到 `_height`，整排 symbol 平滑往下滑一整格。
- **歸零瞬間**：`_onStep` 觸發 → 節點彈回上一格點，同時 `_assignWrapFrame` 把整排圖往下級聯一列、頂格補新圖。因「節點彈回一格」與「圖下移一格」互相抵消，肉眼看到的是**連續往下捲**，察覺不到歸零那一刻。

所以「格內鋸齒位移」＝**用一個被限制在單格內、呈鋸齒狀反覆升降的位移量來驅動節點滑動**，配合到邊界時的整排換圖，湊出無限往下滾的視覺。

### 公式與偽碼

節點順序固定，`_units` 依 y 由上而下排序（index 0 最上），最頂格點基準於 `start()` 快取為 `_topBaseY`（唯一保留的格點基準純量）：

```
SYMBOL_SPACING = 120（常數）                                // 相鄰格距（固定；不再由節點推算 _height）
_topBaseY      = _units[0].y                                // 最頂節點原始格點（唯一保留的動態基準）

_advance(dt):   speed = (_remainingSteps === 1) ? _finalStepSpeed() : _currentSpeed
                dist  = min(speed×dt, SYMBOL_SPACING×0.5)          // 單幀 clamp 半格（防呆，每幀至多跨一格）
                _stepAccurate = min(_stepAccurate + dist, SYMBOL_SPACING) // 格內鋸齒累加、封頂於一格
                if( _stepAccurate >= SYMBOL_SPACING ){ _onStep(); _stepAccurate = 0 }   // 到格邊界換一列、歸零
                _travelNodes()

_travelNodes(): for each node x:
                  y = (_topBaseY - x × SYMBOL_SPACING) - _stepAccurate   // 全排一起在單格內下滑，無位置環繞
                  node.setPosition(x, y, z)

_onStep() → _assignWrapFrame():                                    // 整排 spriteFrame 級聯下移一列
                  for x = N-1 .. 1:  sprite[x] = 舊 sprite[x-1]     // 每格接手上一格的圖
                  sprite[0] = _randomFrame()                        // 頂格補圖庫隨機新圖
                （之後其餘停輪倒數／減速邏輯不變）
```

- **視覺連貫的關鍵——「節點彈回一格」恰好抵消「整排圖下移一格」**：`_stepAccurate` 在一格內 0→`_height` 讓全排平滑下滑一格；到格邊界 `_onStep` 觸發時 `_stepAccurate` 歸零（所有節點瞬間彈回上一格點），**同一刻** `_assignWrapFrame` 把整排圖往下移一列。因此某格原本顯示的圖 A：格內隨節點滑到下緣，邊界瞬間「節點彈回上一格」與「圖被下一格接手」兩件事互相抵消，A 在畫面上的實際位置**連續不跳**；頂格換上一張新的隨機圖，隨後一格一格往下帶。這正是「整排一次換圖」在搭配正確的節點鋸齒＋彈回後看起來連貫、而非「原地亂換」的原因——差別就在位置模型（`_stepAccurate` 鋸齒）。
- **無位置環繞、換圖藏在窗外**：本模型不搬移節點回收，最底節點只是隨 `_stepAccurate` 滑出遮罩窗外下緣（如 5 格、`_height=120`、`_stepAccurate→120` 時最底節點由 -240 滑到 -360），到格邊界隨全排彈回；`_assignWrapFrame` 給頂格補新圖時，頂格位在 `_topBaseY`（如 240）＝遮罩窗（±180）外上緣，故換圖不被玩家看到，新圖隨後才一格一格滑進可視窗（見「緩衝格」章節）。
- **停輪／減速邏輯完全沿用（本次未動）**：`_onStep` 內先 `_assignWrapFrame` 換圖，再視 `_remainingSteps` 倒數；`< DECEL_STEP_THRESHOLD` 時每步 `× DECEL_FACTOR` 衰減（下限 `MIN_STOPPING_SPEED`）；`_remainingSteps===1`（最後一格）記 `_finalStepEntrySpeed`、由 `_advance` 呼 `_finalStepSpeed()` 線性緩降到 `FINAL_EASE_MIN_SPEED`；`_remainingSteps===0` 時 `_finishStop()`。速度序列與末端連續化的推導/實測見下方「狀態機」章節（邏輯與前版一致）。
- **停輪對齊靠 `_stepAccurate=0`**：`_finishStop` 先把 `_stepAccurate` 設 0 再 `_snapToGrid()`（現已精簡為只呼叫 `_travelNodes()`），此時 `y = _topBaseY - x×_height`（純格點），N 顆節點精準落在 N 個相異格點、完整覆蓋盤面、無缺格重疊。
- **進場鋪出初始盤面（2026-07-06 起）**：`_initFrames` 在 `start()` 執行一次，為每格隨機抽一張圖庫符號（`_randomFrame()` 抽 `symbolFrames`）並指派給該格的 `Sprite`；僅在元件啟動當下鋪一次，**非**每次 `spin()` 都重鋪。之後轉動中的換圖一律交由 `_onStep → _assignWrapFrame` 處理。停在自然對齊的隨機盤面、不指定目標符號。

### 反省：清理後的現況（三項小瑕疵已於 2026-07-06 全數處理）

使用者已**清除**先前記錄的殘留狀態——`_slideOffset`、`_wrapCursor`、`_bottomBaseY`、`_totalHeight`、`_poolIndex`、未使用的 `Label` import 皆已移除，`_snapToGrid` 精簡為只呼叫 `_travelNodes()`，`_advance` 不再累加無用的位移。隨後於 2026-07-06 完成純程式碼清理，三項小瑕疵處理如下：

- ✅ **原始碼註解已同步現行模型**：ReelView 類別頂部 JSDoc、以及 `_advance`／`_travelNodes`／`_onStep`／`_snapToGrid`／`_assignWrapFrame`／`_finishStop`／`_collectUnits` 的方法註解已全數改寫，正確描述現行「`_stepAccurate` 格內鋸齒 [0,_height] ＋ 整排級聯換圖 ＋ 無位置環繞」行為，不再殘留 `_slideOffset`/`_wrapCursor`/`_totalHeight` 等舊用詞。
- ✅ **`_initFrames` 恢復為開場隨機鋪圖（行為微調，經使用者拍板選定）**：取消原本被註解掉的 `sprite.spriteFrame = this._randomFrame();`，`_initFrames` 重新產生實際效果——**元件 `start()` 時鋪一次隨機初始盤面**（非移除、非每次 spin 重鋪）。⚠️ 此為唯一伴隨的行為變化：初始盤面從「沿用場景/編輯器既有 spriteFrame」改為「啟動時隨機決定」，轉動中的捲動／停輪演算法完全未變動。
- ✅ **`_assignWrapFrame` 已補 null 檢查**：迴圈內對每個 `sprite`（`x ≥ 1`）與收尾的頂格 `sprite[0]` 皆先判斷非 `null` 才賦值，`_sprites` 元素在 symbol 無 `Sprite` 元件時會安全跳過，符合團隊安全檢查規範；`_initFrames` 迴圈原本就已有 null 檢查，一併沿用同一防護精神。

> 通則：清掉殘留「狀態」後，別忘了同步清掉描述舊狀態的「註解」——過時註解與殘留變數一樣會誤導後續閱讀者。若清理過程中決定「恢復」某段先前被註解掉的行為（如本次 `_initFrames`），務必判斷這是否為單純清理還是伴隨行為變化，並如實記錄變化範圍（本次僅影響開場盤面外觀，捲動/停輪邏輯不受影響）。

**追加簡化（使用者手改 2026-07-06）：移除動態格距欄位 `_height`。** 理由：專案格距恆為 120，`_height = _units[0].y - _units[1].y` 每次推算皆等於常數 `SYMBOL_SPACING`，屬多餘欄位。移除後 `_advance`／`_travelNodes`／`_finalStepSpeed` 一律直接用 `SYMBOL_SPACING`；`_collectUnits` 不再計算 `_height`（只保留動態的 `_topBaseY`）。對現行場景行為等價（120==120）。取捨已於「核心機制」演進點 4 記錄——程式現改為假設「場景實際格距 == `SYMBOL_SPACING`」、不再自適應任意格距。

> ✅ **已於 2026-07-06 完成同步**：`.ts` 內先前殘留、引用已移除欄位 `_height` 的過時註解（`SYMBOL_SPACING` 常數註解、`MAX_SLIDE_CELLS_PER_FRAME` 註解、類別頂部 JSDoc、`_topBaseY`／`_stepAccurate` 欄位註解、`_advance`／`_finalStepSpeed`／`_travelNodes`／`_snapToGrid`／`_collectUnits` 方法 JSDoc）已全數改為 `SYMBOL_SPACING`；`_collectUnits` 註解另移除「推算格距 `_height`」字樣（現行不再計算格距），並順手清掉該方法內一行多餘空行。純註解與空白變動，未動任何程式邏輯，已用 `project_refresh_assets` + `sceneAdvanced_query_scene_classes` 確認 `ReelView` 仍正常編譯註冊。此為「通則」所述情況的實際落地收尾。

## 狀態機（`update(dt)` 驅動）

> 用通用 FSM 模組 [`StateMachine<ReelState>`](state-machine.md)（`assets/utils/`）管理狀態切換。

- `IDLE`：不動。只有 IDLE 才受理 `spin()`（轉動中重複點擊無效）。
- `SPINNING`：自由滾動。`_currentSpeed = speed`、`_remainingSteps = -1`（哨兵，不倒數）、`_stepAccum = 0`。`onUpdate` → `_advance(dt)`（節點 travel＋計步）。等 Controller 呼 `stop()` 才轉 STOPPING。
- `STOPPING`：**逐格減速對齊**。`stop(minSteps)` 設 `_remainingSteps = max(2, minSteps)` 後進入；`onUpdate` 仍是 `_advance(dt)`，每累滿一格（`_stepAccum`）觸發 `_onStep()`：`_remainingSteps--`，當 `_remainingSteps < 5`（`DECEL_STEP_THRESHOLD`）時 `_currentSpeed = max(80, _currentSpeed × 0.65)`；`_remainingSteps === 0` 時 `_finishStop()`（`_currentSpeed=0`、`_snapToGrid()` 各節點對齊回最近格線、回 IDLE、`_onStopped()`）。

> **停輪為減速對齊而非瞬間對齊**（依使用者需求，取代舊版 `_enterStopping` 瞬間歸零）：`stop(5)` 實測速度序列 500→325→211.3→137.3→89.3→0（每步 ×0.65、下限 80），最後精準落回格點。減速掛在「格」步進（`_onStep`）而非逐幀，故與速度無關、恆對齊。

> **停輪最後一格改線性緩降到 `FINAL_EASE_MIN_SPEED`（現行，2026-07-06）**：上述逐格減速在**最後一格**原本是維持定速（如 89.25px/s）直到整格滑完，才由 `_finishStop()` 把 `_currentSpeed` 瞬間砍到 0——速度曲線在真正停止前有一次不連續的大落差（~89→0），使用者實跑回報「停輪瞬間有頓挫感」。修法：`_remainingSteps` 剛減到 1（即將行走停輪前最後一格）時，把當下速度存進 `_finalStepEntrySpeed`；`_advance` 在該格內改呼叫 `_finalStepSpeed()`，以 `_stepAccum/_height`（0～1）為格內進度，將速度從 `_finalStepEntrySpeed` **線性緩降**到 `FINAL_EASE_MIN_SPEED`（新常數，20px/s，約 `MIN_STOPPING_SPEED` 的 1/4）。真正停止（`_finishStop` 歸零）前的最後非零速度因此從 ~89 降到 20，落差大幅縮小、曲線連續，同時：
> - **不新增格數／不拉長停輪距離**：緩降只發生在既有的最後一格內（`_remainingSteps===1` 期間），總步數仍是 `stop(minSteps)` 指定的格數，符合「保持俐落、不要變太軟」的手感要求。
> - **下限存在的必要性**：若不設 `FINAL_EASE_MIN_SPEED` 下限、任速度線性降到 0，會導致該格最後一小段的每幀位移趨近 0（`distance = speed×dt`），理論上需要無限多幀才能真正走完 `_height`（Zeno 收斂問題）。設下限使最後一段以等速（20px/s）走完剩餘距離，保證有限幀數內觸發 `_onStep`→`_finishStop`。
> - **不影響 `_snapToGrid` 精準度**：`_finalStepSpeed()` 算出的 `distance` 仍同時餵給 `_travelNodes`（節點位移）與 `_stepAccum`（計步），兩者共用同一個值的不變量沒有改變，故停輪對齊誤差仍為 0（實測見下方驗證）。
> - **實測**（Reel_1，`stop(5)`，2026-07-06）：離散步進速度 500→325→211.25→137.3125→89.253125（於 frame 120 進入最後一格）；最後一格（frame 120~319，共 200 幀）速度連續遞減 88.03→…→30.11→20.46，於 frame 239 觸達下限 20 並維持等速走完剩餘距離，frame 320 觸發 `_finishStop` 由 20 直接歸零；停輪後 5 個節點 y 值 `[240,120,0,-120,-240]` 與原始格點（`_topBaseY - x×_height`）完全一致，**maxAlignmentError = 0**。

## 具名常數

**ReelView**
| 常數 | 值 | 意義／由來 |
|------|----|-----------|
| `SYMBOL_SPACING` | 120 | 相鄰 symbol 的 y 格距，**格距的唯一真實來源**（2026-07-06 移除動態 `_height` 後，`_advance`／`_travelNodes`／`_finalStepSpeed` 一律直接用此常數；假設場景實際格距 == 120） |
| `DEFAULT_SPIN_SPEED` | 500 | 預設自由滾動速度（**像素／秒**）；格距 120px 下 500px/s ≈ 4.17 格/秒 |
| `MAX_SLIDE_CELLS_PER_FRAME` | 0.5 | 單幀最多推進的格數上限（防呆）：`_advance` 把單幀 distance clamp 到 `SYMBOL_SPACING × 0.5`，保證 `_stepAccurate` 單幀至多跨一格、`_onStep`（跨格換圖）每幀至多觸發一次，杜絕掉幀／誤設過大速度時漏拍或跳過多格 |
| `STOP_MIN_STEPS_FLOOR` | 2 | `stop(minSteps)` 的步數下限：`_remainingSteps = max(2, minSteps)`，至少再滑 2 格才停 |
| `DECEL_STEP_THRESHOLD` | 5 | 剩餘步數 < 此值時開始每步減速（停輪前的減速手感涵蓋範圍） |
| `DECEL_FACTOR` | 0.65 | 每個減速步的速度衰減係數：`_currentSpeed *= 0.65` |
| `MIN_STOPPING_SPEED` | 80 | 減速下限（像素／秒），避免最後幾步過慢卡住不停 |
| `FINAL_EASE_MIN_SPEED` | 20 | 停輪前最後一格緩降的速度下限（像素／秒）：最後一格從進格速度線性降到此值才等速走完剩餘距離，取 `MIN_STOPPING_SPEED` 的 1/4，讓真正停止那一刻的速度落差變小（~20→0）以消除頓挫，同時保證有限幀數內走完最後一格（避免線性降到 0 時的 Zeno 收斂問題） |
| `FREE_SPIN_STEPS` | -1 | 自由滾動的 `_remainingSteps` 哨兵值：負值代表不倒數、不減速、不自停 |

> `_topBaseY` 於 `start()`→`_collectUnits()` 由 `_units[0].position.y` 推算（唯一保留的動態基準）；格距不再動態推算，一律用常數 `SYMBOL_SPACING`（清理後不再有 `_height`／`_totalHeight`／`_bottomBaseY`）。
> 初始化在 **`start()`**（非 `onLoad()`）：onLoad 時子節點可能尚未就位，會導致 `_collectUnits` 抓不到 symbol（見踩坑）。
> `@property`：`symbolStrip`（Node）、`symbolFrames`（SpriteFrame[]，符號圖庫，跨格時頂格隨機抽入、整排往下級聯）、`speed`（**像素／秒**，預設 500，min 0，自由滾動速度）。
> **現行（使用者手改＋清理 2026-07-06，Play 驗證正確）完整狀態**：`_units`、`_sprites`、`_topBaseY`、`_machine`、`_currentSpeed`、`_stepAccurate`（格內鋸齒位移，範圍 [0, SYMBOL_SPACING]，**唯一驅動位置的量**）、`_remainingSteps`、`_finalStepEntrySpeed`。節點位置由 `(_topBaseY - x×SYMBOL_SPACING) - _stepAccurate` 公式推算（**無位置環繞**）。換圖由 `_onStep → _assignWrapFrame`（整排 spriteFrame 級聯下移一列、頂格補 `_randomFrame()`）；停輪對齊由 `_finishStop` 先設 `_stepAccurate=0` 再 `_snapToGrid`（＝`_travelNodes`）落回純格點。
> **已移除**：`_height`（格距改用常數 `SYMBOL_SPACING`）、`_slideOffset`、`_wrapCursor`、`_totalHeight`、`_bottomBaseY`、`_poolIndex`、未使用的 `Label` import，以及更早的 `_wrapThreshold`／`RECYCLE_MARGIN_CELLS`／`_baseY[]` 陣列。
> 末端連續化狀態：`_finalStepEntrySpeed`（停輪前最後一格進格時的速度快照），搭配 `_finalStepSpeed()` 於 `_advance` 內線性緩降到 `FINAL_EASE_MIN_SPEED`。

**GameController**
| 常數 | 值 | 意義 |
|------|----|------|
| `DEFAULT_BASE_SPIN_DURATION` | 2 | 第一輪從起轉到呼叫 `stop()` 的等待秒數 |
| `DEFAULT_REEL_STOP_INTERVAL` | 0.4 | 相鄰兩輪停輪的時間差（秒） |
| `DEFAULT_STOP_MIN_STEPS` | 5 | 停輪時傳給各 `ReelView.stop()` 的最少滑格數；取 5 使倒數涵蓋 `DECEL_STEP_THRESHOLD`，最後約 4 格漸進減速（500→325→211→137→89） |

## 公開 API

**ReelView**（view/）
- `public spin( speed?: number ): void` — 由 Controller 呼叫；IDLE 才受理。啟動自由滾動（無限期，全排在單格內鋸齒下滑＋跨格整排級聯換圖），未帶參或非正值時採用 `@property speed`。
- `public stop( minSteps: number ): void` — 由 Controller 呼叫；滾動中才受理。再滑至少 `max(2, minSteps)` 格後逐格減速，倒數到 0 時 `_stepAccurate=0` snap 回格點對齊停住，停在自然對齊的隨機盤面（不指定目標符號）。
- `public isIdle(): boolean` — 是否可再次啟動。
- `@property`：`symbolStrip`（Node，捲動目標，留空 fallback 用本節點）、`symbolFrames`（SpriteFrame[]，符號圖庫，跨格時頂格由 `_randomFrame()` 抽入、整排往下級聯；目前 7 張佔位圖）、`speed`（像素／秒，預設 500，自由滾動速度）。

**GameController**（controller/）
- `public spinAll(): void` — 啟動整台轉動（由 UIView 的 SPIN 事件觸發）；所有輪皆 idle 才受理，並請 UIView 禁用 SPIN。
- onLoad 建立 `GameModel`、解析 UIView／ReelView[]、訂閱輸入事件、把 Model 初值推到 View；`update()` 於全部停輪後恢復 SPIN。
- `@property`：`reelNodes`（Node[]，順序即停輪順序）、`uiView`（Node，指向掛 UIView 的節點）、`baseSpinDuration`（第 0 輪起轉→呼叫 stop 的延遲秒數）、`reelStopInterval`、`stopMinSteps`（傳給各輪 `stop()`，預設 5）。

## 多輪編排：同時起轉、依序停輪（GameController）

**設計決策**：不讓每輪各自綁按鈕（否則已停的輪會在其他輪仍轉動時被重複觸發），
改由單一 `GameController` 編排（單一責任 / 低耦合）。

- 三輪**同時 `spin()` 起轉**（自由滾動）；`spinAll()` 再用 `this.scheduleOnce()` 為第 i 輪排程一次 `stop( stopMinSteps )`，
  延遲 = `baseSpinDuration + i × reelStopInterval`，故依 `reelNodes` 陣列順序**先後停輪**（陣列順序即停輪順序）。
- `spinAll()` 進入點：**所有輪皆 `isIdle()` 才受理**，避免轉動中重複觸發造成部分輪重轉。
- `update()` 偵測 `_isSpinning && _allIdle()` → 三輪皆減速停妥後恢復 SPIN 可互動。
- `ReelView` 不綁按鈕，SPIN 統一由 UIView → GameController 驅動（MVC 前的版本各輪曾自綁按鈕，已移除）。

> 用 `Node[]` 而非 `ReelView[]`：Node 參照較穩定、避開元件陣列 marshalling 問題，停輪順序由陣列排列決定。

## 裁切遮罩：單一 Mask（效能優化）

三輪的垂直裁切需求相同（symbol 只上下捲動、範圍 ±180、高度 360），故用**一個** Mask 取代每輪一個：

- 移除三個 SymbolStrip 上的 `cc.Mask`（含自動附帶的 `cc.Graphics`）。
- 在 **ReelContainer**（position y=50、anchor 0.5,0.5）加單一 `cc.Mask`（GRAPHICS_RECT），UITransform contentSize 設 **740×360**。
- 幾何：三輪 x=-260/0/+260、各寬 220 → 水平範圍 -370~+370（寬 740）；`cc.Mask` 裁切整個子樹（含 symbol 孫節點）。
- 效益：一次 stencil 寫入/還原，省去多餘 draw call；視覺與三 Mask 完全等價。

## 緩衝格：為何 icon 要多於可視格數（現行 `_stepAccurate` 版）

每輪 **5** 列 = 中間 3 格可視 + 上下各一排緩衝（`Symbol_Above` y=+240、`Symbol_Below` y=-240）。

**緩衝格的作用**（現行整排級聯換圖法）：換圖（`_assignWrapFrame` 給頂格補 `_randomFrame()`）發生在頂格所在的 `_topBaseY`（如 y=240）＝遮罩窗（±180）**外的上緣**。故**換新圖在遮罩窗外完成，玩家看不到新圖憑空出現**——新圖隨全排 `_stepAccurate` 鋸齒一格一格往下「滑進」可視窗，視覺上就是「上面帶下來一張新符號」。同理最底節點滑到 y=-240~-360（窗外下緣）後隨全排彈回，離場也在窗外。
若沒有緩衝格、換圖/彈回發生在可視窗內，會看到符號憑空變臉或瞬跳。

**通則**：此類轉輪的列數必須 > 可視格數，多出的當窗外緩衝，讓「頂格補新圖＋格邊界彈回」藏在遮罩外整整（至少）一格處。

> 現行法全排共用同一個 `_stepAccurate`（間距恆為 `_height`），到格邊界一起彈回、整排圖同步級聯下移，停輪靠 `_stepAccurate=0` 落回格點，**不會有間距歪斜或窗內憑空換臉**。

## 節點與元件 UUID／cid（程式化操作用）

| 節點 | UUID | 節點 | UUID |
|------|------|------|------|
| ReelContainer | `610UkjyUdPLYzzHGtegn3Z` | SlotMachine | `d8ENho4whGMrxfZvED3D2w` |
| Reel_1 | `a8UC3v65lBxbeyg9wNQxGh` | Reel_1/SymbolStrip | `7apVuEXwNII4Cj05dKvS36` |
| Reel_2 | `b0pmf4hENIF6k1Lv/TuyOG` | Reel_2/SymbolStrip | `6bxtCxfGBBDbpEdiwNdjnq` |
| Reel_3 | `22mM0wgz1PtK8PFhVAC/iS` | Reel_3/SymbolStrip | `f2zqXDmX5Gabk1L8v4iCpA` |

緩衝排節點（Above/Below）：Reel_1 `aaCJSq6r1LNoFsGpQ9FmXq` / `26ogG62jNMkr3TJsO41pEL`；
Reel_2 `74tqx3eGJJ46bnzQYF4mZh` / `09HadKdDFDEKbhjJZJ+3mC`；
Reel_3 `54ge/nvxtN26ZEyN5aaQ30` / `ca+gF1Do1DY7HKhEtDhU9Q`。

元件 cid（MVC 重構後重新掛載）：ReelView `1067fQJFCpHwIo9bZ+rEw3j`（三輪相同）、GameController `503652WnkVHepUREaHhl+u7`。

## 驗證方式（需 Play 模式）

`update()` 只在執行時跑。MCP 的 `project_run_project` 只能開 Build 面板、無法自動啟動 preview，且 debug_execute_script 跑在編輯器場景 runtime（非外部 preview runtime），故採「編輯器場景手動驅動 update 迴圈、逐幀讀節點 y 與 spriteFrame」作為執行期驗證（與 preview 共用同一 transform 系統）；**外部 preview 目視由使用者手動點播放**。

> ⚠️ 編輯器場景**非 Play Mode**，元件生命週期 `start()` 不會自動被呼叫，`_machine` 未 `start()` 則 `spin()` 的 `is(IDLE)` guard 恆 false 直接 return（看起來完全不動、非 bug）。用 debug_execute_script 驗證前須先手動呼叫 `reelView['_collectUnits']()`、`_initFrames()`、`_setupStateMachine()` 模擬 `start()`。

1. 點 SPIN → 三輪同時起轉，全排 symbol 在單格內平滑下滑、到格邊界整排下移一列圖、頂格換新隨機圖，靠「節點彈回一格」抵消「整排圖下移一格」形成連貫捲動；被轉輪窗裁切、間距始終一致。
2. 依序（約 2.0/2.4/2.8s 排程 `stop()`）**逐格減速**停輪、精準落回格點不歪斜（停輪對齊由 `_stepAccurate=0` 達成）。
3. 停輪後可重複；轉動中（任一輪未停）不受理新的 SPIN。

**現行模型（使用者手改＋清理 2026-07-06）已由使用者於 Play 模式實跑驗證正確**（上下移動的精靈交換、連貫捲動、依序停輪對齊）。若日後要以逐幀白箱做等效量測，檢查點為：

1. **鋸齒位移**：轉動中 `_stepAccurate` 呈 0→`_height` 反覆、到邊界歸零；節點 y ＝ `_topBaseY - x×_height - _stepAccurate`。
2. **整排級聯換圖**：每次 `_onStep` 後 `sprite[x] === 前一步的 sprite[x-1]`（x≥1）、`sprite[0]` 為新隨機圖。
3. **停輪對齊**：`stop(n)` 倒數到 0 後 `_stepAccurate=0`、各節點精準落回 `_topBaseY - x×_height` 格點（maxAlignmentError=0）；減速速度序列 `stop(5)` 為 500→325→211→137→89→（最後一格線性緩降至 20）→0。

> 停輪減速/末端線性緩降的詳細實測數據見上方「狀態機」章節（該邏輯自 recycling 版沿用、未被本次修改動到，故仍有效）。更早期各模型（recycling 單節點繞頂、公式化 offset）的白箱驗收數據已隨模型汰換移除，僅保留設計演進脈絡於本文各處。

## 踩坑紀錄（另見 memory）

- **`component_add_component` 對自訂腳本回傳 `success:false`**（v1.4.0 用類名查不到），但元件實際已加入，用 `component_get_components` 確認。
- **自訂腳本 `set_component_property` 的 componentType 需傳 cid**，不能傳類名。見 memory `custom-script-component-set-property-cid`。
- **`propertyType=nodeArray` 有 bug**（`Cannot read property 'hasOwnProperty' of undefined`），改用 `debug_execute_script` 賦值（`smc.reelNodes = [n1,n2,n3]`）。見 memory `nodearray-set-via-execute-script`。
- **`component_remove_component` 對內建元件傳類名無效**（cc.Mask/cc.Graphics），改用 `debug_execute_script` 的 `node.removeComponent( cc.Mask )`。
- 加 GRAPHICS_RECT Mask 時 Cocos 會自動附加 `cc.Graphics`；Mask 裁切整個子樹，不可與要顯示的 Sprite 放同一節點。
- 新增 `.ts` 後須 `project_refresh_assets`，並用 `sceneAdvanced_query_scene_classes` 確認類別已註冊再掛元件。
- **ReelView 初始化要放 `start()` 不要放 `onLoad()`**：放 `onLoad` 時 SymbolStrip 子節點可能尚未就位，`_collectUnits`（讀 `strip.children`）抓到空陣列 → 後續全都拿不到 symbol。移到 `start()`（保證所有節點 onLoad 跑完後才執行）即修正（2026-07-02，現行仍適用）。

### 轉輪捲動模型相關踩坑（仍適用於現行模型）

- **單幀位移必須 clamp < 一格（`MAX_SLIDE_CELLS_PER_FRAME`）**：離散換格事件（`_onStep`）掛在連續位移上時，若某幀 `distance ≥ _height`（掉幀 dt 尖峰，或速度被誤設過大），同一幀會跨多格、跳過換圖或視覺爆衝。現行 `_advance` 開頭把 `distance` clamp 到 `_height × 0.5`，保證 `_stepAccurate` 單幀至多跨一格、`_onStep` 每幀至多觸發一次。**通則：離散換格事件掛在連續位移上時，務必限制單幀位移 < 一格。**
- **停輪頓挫＝末端速度不連續**：逐格減速若在最後一格維持定速、到格尾才由 `_finishStop` 把速度瞬間砍到 0，即使沒掉幀、沒位置瞬移，這種「勻速中突然靜止」的速度不連續也會被感知為頓挫。現行以最後一格線性緩降到 `FINAL_EASE_MIN_SPEED` 解決（詳見「狀態機」章節）。**通則：診斷動作頓挫要逐幀記錄「速度序列」而非只看位置是否瞬移。**
- **symbol y 座標須為 `_height` 整數倍且三輪一致**：Reel_1 曾因 symbol 子節點 y 偏移、且節點名稱垂直排序與 Reel_2/3 相反，導致初始盤面沒對齊。修法＝依節點名稱把各 symbol y 設回 `{240,120,0,-120,-240}`（`node_set_node_transform`，x/z=0），三輪同名節點對齊即可（2026-07-06，純場景資料修正、不動腳本）。ReelView 純以 y 運作，功能上只需 y 值集合一致。
- **診斷「位移沒 render」的探針**：若懷疑節點滑動被覆蓋，先「改本地 y、讀 `worldPosition` 是否同步變」來分辨「座標系被外部每幀覆蓋（如 `cc.Layout`/`cc.Widget`）」vs「位移幅度太小的視覺問題」。實查三輪 SymbolStrip 皆只掛 `cc.UITransform`、無自動排版元件，故位移能正常 render；早期 content-slide「看似原地換圖」的真因是位移刻意限制在單格內、肉眼難察。

> **已隨模型汰換移除的歷史踩坑（僅記通則，細節不再保留）**：content-shift／content-slide／recycling／公式化 offset 各版曾遇到——(a)「換圖時機要落在深窗外整整一格、別卡遮罩邊緣」（`_wrapThreshold`/`_currentCenter+2h` 版，現行由頂格在 `_topBaseY` 換圖天然滿足）；(b)「ease-out 減速接等速運動時，曲線初速要對齊等速段速度，否則接縫暴衝」（舊 `_stopTime`/`STOP_DURATION` 版，現行改逐格減速已無此問題）；(c)「離散換格別綁連續量的 `>=` 浮點門檻、要整數化比對次數」（現行由 `_stepAccurate` 鋸齒＋單幀 clamp 保證）；(d) content-slide 的 init 鋪圖與進場流「相位不一致致窗內重複貼圖」（`_stripHead` 修法，窗內零重複的充分條件：圖庫張數 > 可視格數）；(e) `DEFAULT_SPIN_SPEED` 曾誤寫為 10（已為 500）。

## 後續擴充（尚未做）

- 隨機停輪結果與中獎判定（`stop()` 時選定目標符號、於節點繞回頂端換圖處塞入目標而非純隨機，使其滑進 Center；`_onStopped` 判定連線；GameController 彙整跨輪連線、寫入 `GameModel` 後透過 `UIView.setWin()` / `setBalance()` 更新顯示）。
