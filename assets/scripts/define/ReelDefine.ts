/**
 * ReelDefine
 * 轉輪相關的全域集中式設定（唯讀具名常數集合）。原本分散在各 ReelView 節點 Inspector 的
 * speed 與各項調校常數，改集中於此檔，達成「一處修改、全部轉輪套用」（單一真實來源）。
 * 消費者（如 ReelView）僅可讀取，不可寫入。
 */
export const ReelDefine = {
    /** 相鄰 symbol 的垂直間距（像素），格距的唯一真實來源 */
    SYMBOL_SPACING: 120,
    /** 預設自由滾動速度（像素／秒）：每秒往下滑動的像素距離 */
    DEFAULT_SPIN_SPEED: 500,
    /**
     * 單幀最多推進的格數上限（防呆）：限制單幀平滑位移 < 一格（SYMBOL_SPACING），
     * 確保單幀累計位移量 < 一格、`_onStep`（跨格判定／換圖）每幀至多觸發一次，
     * 避免掉幀（dt 尖峰）或速度被誤設過大時，同幀跳過多格造成視覺跳動或漏換圖。
     */
    MAX_SLIDE_CELLS_PER_FRAME: 0.5,
    /** stop 的最少倒數步數下限：至少再滑動這麼多格才停，讓停輪動作不會太突兀 */
    STOP_MIN_STEPS_FLOOR: 2,
    /** 剩餘步數小於此門檻時，開始每步減速（形成停輪前的減速手感） */
    DECEL_STEP_THRESHOLD: 5,
    /** 每個減速步的速度衰減係數：currentSpeed *= 此值 */
    DECEL_FACTOR: 0.65,
    /** 減速過程的速度下限（像素／秒）：避免最後幾步過慢而卡住不停 */
    MIN_STOPPING_SPEED: 80,
    /**
     * 停輪前最後一格緩降時的速度下限（像素／秒）：最後一格改為從進格速度線性緩降到此值，
     * 而非維持 MIN_STOPPING_SPEED 直到整格結束才瞬間歸零。
     * 取值明顯小於 MIN_STOPPING_SPEED（約 1/4），使真正停止那一刻的速度落差很小、感覺不到頓挫，
     * 同時仍大於 0，確保最後一小段位移能在有限幀數內走完（避免速度趨近 0 時無限逼近格線終點）。
     */
    FINAL_EASE_MIN_SPEED: 20,
    /** 自由滾動（無限期）時的剩餘步數哨兵值：負值代表不倒數、不減速、不自行停止 */
    FREE_SPIN_STEPS: -1,
} as const;
