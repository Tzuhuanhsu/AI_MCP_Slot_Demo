import { _decorator, Component, Node, Sprite, SpriteFrame } from 'cc';
import { StateMachine } from '../../utils/StateMachine';
import { ReelDefine } from '../define/ReelDefine';
import { ResourceManager } from '../singleton/ResourceManager';

const { ccclass, property, menu } = _decorator;

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
 * `_stepAccurate`**（範圍 `[0, ReelDefine.SYMBOL_SPACING]`），每幀單調累加、到達 `ReelDefine.SYMBOL_SPACING` 即歸零；節點位置純公式化推算——
 * `y = ( _topBaseY - x * ReelDefine.SYMBOL_SPACING ) - _stepAccurate`，`_topBaseY` 為最頂節點（`_units[0]`）的原始格點 y。
 * 全排節點在單格內平滑下滑、到格邊界一起彈回，**不做位置環繞**。
 *
 * 換圖時機：`_stepAccurate` 每累滿一格即觸發一次 `_onStep → _assignWrapFrame`，把**整排 spriteFrame
 * 級聯下移一列**（每格接手上一格的圖、頂格 `sprite[0]` 補 `_randomFrame()` 隨機新圖，取自 `ResourceManager` 集中圖庫）。
 * 因「節點彈回一格」與「整排圖下移一格」在同一瞬間互相抵消，肉眼看到的是連續往下捲，察覺不到彈回與換圖的那一刻。
 *
 * 停輪：`stop( minSteps )` 設定剩餘步數開始倒數；剩餘步數 < `ReelDefine.DECEL_STEP_THRESHOLD` 時每過一格衰減速度，
 * 停輪前最後一格改為把速度從進格速度線性緩降到 `ReelDefine.FINAL_EASE_MIN_SPEED`（而非維持定速到格尾才瞬間歸零），
 * 使真正停止前的速度曲線連續、無頓挫感；倒數到 0 時把 `_stepAccurate` 歸零，
 * 節點依公式回落到純格點（`_topBaseY - x * ReelDefine.SYMBOL_SPACING`），使盤面精準對齊、無缺格重疊，
 * 停在自然對齊的隨機盤面（不指定目標符號）。
 *
 * 速度／調校常數集中於 `ReelDefine`（define/），符號圖庫集中於 `ResourceManager` 單例（singleton/）；
 * 本類別不再持有 `speed`／`symbolFrames` 的 Inspector 欄位（單一真實來源，見 spec 001-reel-config-management）。
 */
@ccclass( 'ReelView' )
@menu( 'Custom/ReelView' )
export class ReelView extends Component
{

    @property( { type: Node, tooltip: '要捲動的 SymbolStrip 節點（其子節點為各 symbol）；留空則使用本節點' } )
    public symbolStrip: Node | null = null;

    private _units: Node[] = [];
    private _sprites: ( Sprite | null )[] = [];

    /**
     * 最頂節點（`_units[0]`）的原始格點 y：唯一保留的格點基準純量。
     * 因節點恆以 `ReelDefine.SYMBOL_SPACING` 等距排列，任一節點 x 的原始格點皆可公式化推出：
     * `_topBaseY - x * ReelDefine.SYMBOL_SPACING`，故不需要另存整個 `_baseY[]` 陣列。
     */
    private _topBaseY: number = 0;

    private _machine: StateMachine<ReelState> = new StateMachine<ReelState>();
    /** 目前滾動速度（像素／秒）：自由滾動時等於 spin() 採用的速度，減速時逐步衰減 */
    private _currentSpeed: number = 0;

    /** 累計已滑動距離（用於計步）：每累滿一格 `ReelDefine.SYMBOL_SPACING` 觸發一次 _onStep（跨格換圖／停輪倒數／減速） */
    private _stepAccurate: number = 0;
    /**
     * 停輪前的剩餘步數（步＝滑過一整格）：`ReelDefine.FREE_SPIN_STEPS`(-1) 代表自由滾動、不倒數；
     * >0 代表已收到 stop，正在倒數，倒數到 0 時對齊停住。
     */
    private _remainingSteps: number = ReelDefine.FREE_SPIN_STEPS;
    /**
     * 停輪前最後一格「進格時」的速度快照：`_remainingSteps` 剛減到 1（即將行走的是停輪前最後一格）時記錄，
     * 供 `_advance` 在該格內把速度從此值線性緩降到 `ReelDefine.FINAL_EASE_MIN_SPEED`，讓真正停止前的速度曲線連續。
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
     * @param speed 可選的滾動速度（像素／秒），未指定或非正值時採用 `ReelDefine.DEFAULT_SPIN_SPEED`
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

        this._currentSpeed = ( speed !== undefined && speed > 0 ) ? speed : ReelDefine.DEFAULT_SPIN_SPEED;
        this._remainingSteps = ReelDefine.FREE_SPIN_STEPS;
        this._stepAccurate = 0;
        this._finalStepEntrySpeed = 0;
        this._machine.changeTo( ReelState.SPINNING );
    }

    /**
     * 通知轉輪停輪（由 Controller 呼叫）：再滑動至少 minSteps 格後減速對齊停住。
     * 僅在滾動中（非 IDLE）才受理；停在自然對齊的隨機盤面。
     * @param minSteps 停輪前至少再滑過的格數（會與 `ReelDefine.STOP_MIN_STEPS_FLOOR` 取最大值）
     */
    public stop( minSteps: number ): void
    {
        if ( this._machine.is( ReelState.IDLE ) )
        {
            return;
        }

        this._remainingSteps = Math.max( ReelDefine.STOP_MIN_STEPS_FLOOR, Math.floor( minSteps ) );
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
     * 往下推進一幀：格內鋸齒 `_stepAccurate` 增加 distance（封頂於 `ReelDefine.SYMBOL_SPACING`），
     * 再依公式重新定位所有節點；一旦 `_stepAccurate` 累滿一格即觸發一次 `_onStep`
     * （整排級聯換圖／停輪倒數／減速）並歸零。單幀位移 clamp 在半格內，確保一幀不會跳過多格。
     */
    private _advance( deltaTime: number ): void
    {
        const maxDistance = ReelDefine.SYMBOL_SPACING * ReelDefine.MAX_SLIDE_CELLS_PER_FRAME;
        const speed = this._remainingSteps === 1 ? this._finalStepSpeed() : this._currentSpeed;
        const distance = Math.min( speed * deltaTime, maxDistance );

        this._stepAccurate = Math.min( this._stepAccurate + distance, ReelDefine.SYMBOL_SPACING );

        if ( this._stepAccurate >= ReelDefine.SYMBOL_SPACING )
        {
            this._onStep();
            this._stepAccurate = 0;
        }
        this._travelNodes();

    }

    /**
     * 停輪前最後一格（`_remainingSteps === 1`）的緩降速度：以 `_stepAccurate / ReelDefine.SYMBOL_SPACING` 為此格內的
     * 進度（0～1），把速度從 `_finalStepEntrySpeed` 線性降到 `ReelDefine.FINAL_EASE_MIN_SPEED`，
     * 使真正停止（`_finishStop` 把速度歸零）前的最後一段位移速度已經很小、曲線連續，不再是
     * 「維持定速直到整格結束才瞬間歸零」的頓挫。
     */
    private _finalStepSpeed(): number
    {
        const progress = this._stepAccurate / ReelDefine.SYMBOL_SPACING;
        const eased = this._finalStepEntrySpeed * ( 1 - progress );
        return Math.max( ReelDefine.FINAL_EASE_MIN_SPEED, eased );
    }

    /**
     * 依目前的 `_stepAccurate` 重新定位所有節點：`y = ( _topBaseY - x * ReelDefine.SYMBOL_SPACING ) - _stepAccurate`。
     * 全排節點單純在單格內下滑，不做位置環繞；純粹是 `_stepAccurate` 的公式化投影，
     * 不改變任何節點的 spriteFrame（換圖交由 `_onStep → _assignWrapFrame` 處理）。
     */
    private _travelNodes(): void
    {
        for ( let x = 0; x < this._units.length; x++ )
        {
            const node = this._units[ x ];
            const position = node.position;
            let y = ( this._topBaseY - x * ReelDefine.SYMBOL_SPACING ) - this._stepAccurate;
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
        if ( this._remainingSteps < ReelDefine.DECEL_STEP_THRESHOLD )
        {
            this._currentSpeed = Math.max( ReelDefine.MIN_STOPPING_SPEED, this._currentSpeed * ReelDefine.DECEL_FACTOR );
        }
        if ( this._remainingSteps === 1 )
        {
            // 即將行走的是停輪前最後一格：記錄本格進格速度，供 _advance 於格內線性緩降到 ReelDefine.FINAL_EASE_MIN_SPEED
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
     * 因節點恆保持 `ReelDefine.SYMBOL_SPACING` 等距排列，`_stepAccurate = 0` 時 N 個節點必落在
     * `_topBaseY - x * ReelDefine.SYMBOL_SPACING` 這 N 個相異格點上、完整覆蓋整個盤面（無缺格重疊）。
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

    /**
     * 從集中圖庫（`ResourceManager` 單例）隨機抽一張 SpriteFrame（節點繞回頂端時換圖用）；
     * 單例尚未就緒（`instance` 為 `null`）或圖庫為空時回 `null`（FR-006，呼叫端須容忍不得崩潰）。
     */
    private _randomFrame(): SpriteFrame | null
    {
        return ResourceManager.instance?.getRandomSymbolFrame() ?? null;
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
     * 元件啟動時鋪出初始盤面：由 `start()` 呼叫一次，為每格向集中圖庫（`ResourceManager` 單例）
     * 隨機抽一張符號並指派。僅在啟動當下執行一次，之後轉動中的換圖一律交由
     * `_onStep → _assignWrapFrame` 處理，並非每次 `spin()` 都會重鋪。
     * 單例未就緒、圖庫為空，或某格無 `Sprite` 元件時，該格略過不指派（保留既有安全行為，FR-006）。
     */
    private _initFrames(): void
    {
        for ( let x = 0; x < this._sprites.length; x++ )
        {
            const sprite = this._sprites[ x ];
            if ( sprite === null )
            {
                continue;
            }
            const frame = this._randomFrame();
            if ( frame !== null )
            {
                sprite.spriteFrame = frame;
            }
        }
    }

    /** 停輪完成的回呼點（保留供後續中獎判定擴充） */
    private _onStopped(): void
    {
        // 後續擴充：通知 Controller 進行結果判定等
    }
}
