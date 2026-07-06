import { _decorator, Component, Node, Sprite, SpriteFrame } from 'cc';
import { StateMachine } from '../../utils/StateMachine';

const { ccclass, property, menu } = _decorator;

/** 相鄰 symbol 的垂直間距（像素），格距的唯一真實來源（不再由節點動態推算） */
const SYMBOL_SPACING = 120;
/** 預設自由滾動速度：每秒往下滑動的像素距離（像素／秒） */
const DEFAULT_SPIN_SPEED = 500;
/**
 * 單幀最多推進的格數上限（防呆）：限制單幀平滑位移 < 一格（SYMBOL_SPACING），
 * 確保單幀累計位移量 < 一格、`_onStep`（跨格判定／換圖）每幀至多觸發一次，
 * 避免掉幀（dt 尖峰）或速度被誤設過大時，同幀跳過多格造成視覺跳動或漏換圖。
 */
const MAX_SLIDE_CELLS_PER_FRAME = 0.5;
/** stop 的最少倒數步數下限：至少再滑動這麼多格才停，讓停輪動作不會太突兀 */
const STOP_MIN_STEPS_FLOOR = 2;
/** 剩餘步數小於此門檻時，開始每步減速（形成停輪前的減速手感） */
const DECEL_STEP_THRESHOLD = 5;
/** 每個減速步的速度衰減係數：currentSpeed *= 此值 */
const DECEL_FACTOR = 0.65;
/** 減速過程的速度下限（像素／秒）：避免最後幾步過慢而卡住不停 */
const MIN_STOPPING_SPEED = 80;
/**
 * 停輪前最後一格緩降時的速度下限（像素／秒）：最後一格改為從進格速度線性緩降到此值，
 * 而非維持 MIN_STOPPING_SPEED 直到整格結束才瞬間歸零。
 * 取值明顯小於 MIN_STOPPING_SPEED（約 1/4），使真正停止那一刻的速度落差很小、感覺不到頓挫，
 * 同時仍大於 0，確保最後一小段位移能在有限幀數內走完（避免速度趨近 0 時無限逼近格線終點）。
 */
const FINAL_EASE_MIN_SPEED = 20;
/** 自由滾動（無限期）時的剩餘步數哨兵值：負值代表不倒數、不減速、不自行停止 */
const FREE_SPIN_STEPS = -1;

/** 轉輪狀態 */
enum ReelState
{
    IDLE,
    SPINNING,
    STOPPING,
}

/**
 * ReelView
 * 單一轉輪的呈現層（MVC 的 View）。掛載於 Reel 節點，讓 SymbolStrip 底下的 N 個 symbol 子節點
 * 達成「自由滾動 → 收到 stop 後逐步減速並精準對齊停輪」的動畫。起轉與停輪時機由 Controller 決定。
 *
 * 捲動模型（格內鋸齒 `_stepAccurate` 位移＋整排級聯換圖）：唯一驅動位置的狀態量是**格內鋸齒
 * `_stepAccurate`**（範圍 `[0, SYMBOL_SPACING]`），每幀單調累加、到達 `SYMBOL_SPACING` 即歸零；節點位置純公式化推算——
 * `y = ( _topBaseY - x * SYMBOL_SPACING ) - _stepAccurate`，`_topBaseY` 為最頂節點（`_units[0]`）的原始格點 y。
 * 全排節點在單格內平滑下滑、到格邊界一起彈回，**不做位置環繞**。
 *
 * 換圖時機：`_stepAccurate` 每累滿一格即觸發一次 `_onStep → _assignWrapFrame`，把**整排 spriteFrame
 * 級聯下移一列**（每格接手上一格的圖、頂格 `sprite[0]` 補 `_randomFrame()` 隨機新圖）。因「節點彈回一格」
 * 與「整排圖下移一格」在同一瞬間互相抵消，肉眼看到的是連續往下捲，察覺不到彈回與換圖的那一刻。
 *
 * 停輪：`stop( minSteps )` 設定剩餘步數開始倒數；剩餘步數 < DECEL_STEP_THRESHOLD 時每過一格衰減速度，
 * 停輪前最後一格改為把速度從進格速度線性緩降到 `FINAL_EASE_MIN_SPEED`（而非維持定速到格尾才瞬間歸零），
 * 使真正停止前的速度曲線連續、無頓挫感；倒數到 0 時把 `_stepAccurate` 歸零，
 * 節點依公式回落到純格點（`_topBaseY - x * SYMBOL_SPACING`），使盤面精準對齊、無缺格重疊，
 * 停在自然對齊的隨機盤面（不指定目標符號）。
 */
@ccclass( 'ReelView' )
@menu( 'Custom/ReelView' )
export class ReelView extends Component
{

    @property( { type: Node, tooltip: '要捲動的 SymbolStrip 節點（其子節點為各 symbol）；留空則使用本節點' } )
    public symbolStrip: Node | null = null;

    @property( { type: [ SpriteFrame ], tooltip: '符號圖庫：節點繞回頂端時隨機抽出換圖（需多張不同圖才看得到滾動）' } )
    public symbolFrames: SpriteFrame[] = [];

    @property( { tooltip: '自由滾動速度（像素／秒）：每秒往下滑動的像素距離', min: 0 } )
    public speed: number = DEFAULT_SPIN_SPEED;

    private _units: Node[] = [];
    private _sprites: ( Sprite | null )[] = [];

    /**
     * 最頂節點（`_units[0]`）的原始格點 y：唯一保留的格點基準純量。
     * 因節點恆以 `SYMBOL_SPACING` 等距排列，任一節點 x 的原始格點皆可公式化推出：
     * `_topBaseY - x * SYMBOL_SPACING`，故不需要另存整個 `_baseY[]` 陣列。
     */
    private _topBaseY: number = 0;

    private _machine: StateMachine<ReelState> = new StateMachine<ReelState>();
    /** 目前滾動速度（像素／秒）：自由滾動時等於 speed，減速時逐步衰減 */
    private _currentSpeed: number = 0;

    /** 累計已滑動距離（用於計步）：每累滿一格 SYMBOL_SPACING 觸發一次 _onStep（跨格換圖／停輪倒數／減速） */
    private _stepAccurate: number = 0;
    /**
     * 停輪前的剩餘步數（步＝滑過一整格）：FREE_SPIN_STEPS(-1) 代表自由滾動、不倒數；
     * >0 代表已收到 stop，正在倒數，倒數到 0 時對齊停住。
     */
    private _remainingSteps: number = FREE_SPIN_STEPS;
    /**
     * 停輪前最後一格「進格時」的速度快照：`_remainingSteps` 剛減到 1（即將行走的是停輪前最後一格）時記錄，
     * 供 `_advance` 在該格內把速度從此值線性緩降到 `FINAL_EASE_MIN_SPEED`，讓真正停止前的速度曲線連續。
     */
    private _finalStepEntrySpeed: number = 0;

    protected start(): void
    {
        this._collectUnits();
        this._initFrames();
        this._setupStateMachine();
    }

    /**
     * 啟動自由滾動（由 Controller 呼叫）；僅 IDLE 才受理。
     * @param speed 可選的滾動速度（像素／秒），未指定或非正值時採用 Inspector 的 speed
     */
    public spin( speed?: number ): void
    {
        if ( !this._machine.is( ReelState.IDLE ) )
        {
            return;
        }
        if ( this._units.length === 0 )
        {
            return;
        }

        this._currentSpeed = ( speed !== undefined && speed > 0 ) ? speed : this.speed;
        this._remainingSteps = FREE_SPIN_STEPS;
        this._stepAccurate = 0;
        this._finalStepEntrySpeed = 0;
        this._machine.changeTo( ReelState.SPINNING );
    }

    /**
     * 通知轉輪停輪（由 Controller 呼叫）：再滑動至少 minSteps 格後減速對齊停住。
     * 僅在滾動中（非 IDLE）才受理；停在自然對齊的隨機盤面。
     * @param minSteps 停輪前至少再滑過的格數（會與 STOP_MIN_STEPS_FLOOR 取最大值）
     */
    public stop( minSteps: number ): void
    {
        if ( this._machine.is( ReelState.IDLE ) )
        {
            return;
        }

        this._remainingSteps = Math.max( STOP_MIN_STEPS_FLOOR, Math.floor( minSteps ) );
        this._machine.changeTo( ReelState.STOPPING );
    }

    /** 是否處於閒置（可再次啟動）狀態 */
    public isIdle(): boolean
    {
        return this._machine.is( ReelState.IDLE );
    }

    protected update( deltaTime: number ): void
    {
        this._machine.update( deltaTime );
    }

    /** 建置轉輪狀態機：SPINNING（自由滾動）→ STOPPING（倒數減速對齊）→ IDLE（閒置） */
    private _setupStateMachine(): void
    {
        this._machine
            .define( ReelState.IDLE, {} )
            .define( ReelState.SPINNING, {
                onUpdate: ( deltaTime ) => this._advance( deltaTime ),
            } )
            .define( ReelState.STOPPING, {
                onUpdate: ( deltaTime ) => this._advance( deltaTime ),
            } );
        this._machine.start( ReelState.IDLE );
    }

    /**
     * 往下推進一幀：格內鋸齒 `_stepAccurate` 增加 distance（封頂於 `SYMBOL_SPACING`），
     * 再依公式重新定位所有節點；一旦 `_stepAccurate` 累滿一格即觸發一次 `_onStep`
     * （整排級聯換圖／停輪倒數／減速）並歸零。單幀位移 clamp 在半格內，確保一幀不會跳過多格。
     */
    private _advance( deltaTime: number ): void
    {
        const maxDistance = SYMBOL_SPACING * MAX_SLIDE_CELLS_PER_FRAME;
        const speed = this._remainingSteps === 1 ? this._finalStepSpeed() : this._currentSpeed;
        const distance = Math.min( speed * deltaTime, maxDistance );

        this._stepAccurate = Math.min( this._stepAccurate + distance, SYMBOL_SPACING );

        if ( this._stepAccurate >= SYMBOL_SPACING )
        {
            this._onStep();
            this._stepAccurate = 0;
        }
        this._travelNodes();

    }

    /**
     * 停輪前最後一格（`_remainingSteps === 1`）的緩降速度：以 `_stepAccurate / SYMBOL_SPACING` 為此格內的
     * 進度（0～1），把速度從 `_finalStepEntrySpeed` 線性降到 `FINAL_EASE_MIN_SPEED`，
     * 使真正停止（`_finishStop` 把速度歸零）前的最後一段位移速度已經很小、曲線連續，不再是
     * 「維持定速直到整格結束才瞬間歸零」的頓挫。
     */
    private _finalStepSpeed(): number
    {
        const progress = this._stepAccurate / SYMBOL_SPACING;
        const eased = this._finalStepEntrySpeed * ( 1 - progress );
        return Math.max( FINAL_EASE_MIN_SPEED, eased );
    }

    /**
     * 依目前的 `_stepAccurate` 重新定位所有節點：`y = ( _topBaseY - x * SYMBOL_SPACING ) - _stepAccurate`。
     * 全排節點單純在單格內下滑，不做位置環繞；純粹是 `_stepAccurate` 的公式化投影，
     * 不改變任何節點的 spriteFrame（換圖交由 `_onStep → _assignWrapFrame` 處理）。
     */
    private _travelNodes(): void
    {
        for ( let x = 0; x < this._units.length; x++ )
        {
            const node = this._units[ x ];
            const position = node.position;
            let y = ( this._topBaseY - x * SYMBOL_SPACING ) - this._stepAccurate;
            node.setPosition( position.x, y, position.z );
        }
    }

    /**
     * 完成一步（`_stepAccurate` 滑過一整格）時的處理：先呼叫 `_assignWrapFrame` 把整排
     * spriteFrame 級聯下移一列（頂格補隨機新圖），此步驟與是否倒數無關、自由滾動時也持續進行。
     * 之後僅在停輪倒數中（_remainingSteps > 0）才處理減速：剩餘步數遞減；
     * 進入減速門檻後每步衰減速度；倒數到 0 即對齊停住。
     */
    private _onStep(): void
    {
        this._assignWrapFrame();

        if ( this._remainingSteps <= 0 )
        {
            return;
        }

        this._remainingSteps -= 1;
        if ( this._remainingSteps < DECEL_STEP_THRESHOLD )
        {
            this._currentSpeed = Math.max( MIN_STOPPING_SPEED, this._currentSpeed * DECEL_FACTOR );
        }
        if ( this._remainingSteps === 1 )
        {
            // 即將行走的是停輪前最後一格：記錄本格進格速度，供 _advance 於格內線性緩降到 FINAL_EASE_MIN_SPEED
            this._finalStepEntrySpeed = this._currentSpeed;
        }
        if ( this._remainingSteps === 0 )
        {
            this._finishStop();
        }
    }

    /** 熄火對齊：速度歸零，把 `_stepAccurate` 歸零後節點依公式重新定位回格線，回 IDLE 並觸發停輪回呼 */
    private _finishStop(): void
    {
        this._currentSpeed = 0;
        this._stepAccurate = 0;
        this._finalStepEntrySpeed = 0;
        this._snapToGrid();
        this._machine.changeTo( ReelState.IDLE );
        this._onStopped();
    }

    /**
     * 依目前已歸零的 `_stepAccurate`（見 `_finishStop`）呼叫 `_travelNodes()` 重新定位所有節點。
     * 因節點恆保持 `SYMBOL_SPACING` 等距排列，`_stepAccurate = 0` 時 N 個節點必落在
     * `_topBaseY - x * SYMBOL_SPACING` 這 N 個相異格點上、完整覆蓋整個盤面（無缺格重疊）。
     */
    private _snapToGrid(): void
    {
        this._travelNodes();
    }

    /**
     * 把整排 spriteFrame 級聯下移一列：`_units` 依原始 y 由上而下排序（index 0 最上），
     * 每格（x ≥ 1）接手上一格（x - 1）舊有的圖，頂格（x = 0）補一張 `_randomFrame()` 隨機新圖。
     * `_sprites` 元素在對應 symbol 節點無 `Sprite` 元件時會是 `null`，故逐一做空值檢查後才賦值。
     */
    private _assignWrapFrame(): void
    {
        if ( this._units.length === 0 )
        {
            return;
        }

        const sprites = this._sprites.map( ( sprite ) => sprite?.spriteFrame ?? null );
        for ( let x = this._sprites.length - 1; x >= 1; x-- )
        {
            const sprite = this._sprites[ x ];
            if ( sprite === null )
            {
                continue;
            }
            sprite.spriteFrame = sprites[ x - 1 ];
        }

        const topSprite = this._sprites[ 0 ];
        if ( topSprite !== null )
        {
            topSprite.spriteFrame = this._randomFrame();
        }
    }

    /** 從圖庫隨機抽一張 SpriteFrame（節點繞回頂端時換圖用）；圖庫為空時回 null */
    private _randomFrame(): SpriteFrame | null
    {
        const length = this.symbolFrames.length;
        if ( length === 0 )
        {
            return null;
        }
        return this.symbolFrames[ Math.floor( Math.random() * length ) ];
    }

    /** 讀取 symbol 子節點，依原始 y 由上而下排序，快取節點/Sprite 與最頂格點基準 `_topBaseY` */
    private _collectUnits(): void
    {
        const strip = this.symbolStrip !== null ? this.symbolStrip : this.node;
        this._units = strip.children.slice();
        this._units.sort( ( a, b ) => b.position.y - a.position.y );
        this._sprites = this._units.map( ( unit ) => unit.getComponent( Sprite ) );

        const count = this._units.length;
        this._topBaseY = count > 0 ? this._units[ 0 ].position.y : 0;

        this._stepAccurate = 0;
    }

    /**
     * 元件啟動時鋪出初始盤面：由 `start()` 呼叫一次，為每格隨機抽一張圖庫符號並指派。
     * 僅在啟動當下執行一次，之後轉動中的換圖一律交由 `_onStep → _assignWrapFrame` 處理，
     * 並非每次 `spin()` 都會重鋪。`symbolFrames` 為空或某格無 `Sprite` 元件時該格略過不指派。
     */
    private _initFrames(): void
    {
        if ( this.symbolFrames.length === 0 )
        {
            return;
        }
        for ( let x = 0; x < this._sprites.length; x++ )
        {
            const sprite = this._sprites[ x ];
            if ( sprite !== null )
            {
                sprite.spriteFrame = this._randomFrame();
            }
        }
    }

    /** 停輪完成的回呼點（保留供後續中獎判定擴充） */
    private _onStopped(): void
    {
        // 後續擴充：通知 Controller 進行結果判定等
    }
}
