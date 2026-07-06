import { _decorator, Component, Node, Sprite, SpriteFrame } from 'cc';
import { StateMachine } from '../../utils/StateMachine';

const { ccclass, property, menu } = _decorator;

/** 相鄰 symbol 的預設垂直間距（像素）；實際 _height 於 start 由節點位置推算 */
const SYMBOL_SPACING = 120;
/** 預設自由滾動速度：每秒往下滑動的像素距離（像素／秒） */
const DEFAULT_SPIN_SPEED = 500;
/**
 * 單幀最多推進的格數上限（防呆）：限制單幀平滑位移 < 一格（_height），
 * 確保節點每幀最多下移半格、回收判定每幀至多觸發一次，
 * 避免掉幀（dt 尖峰）或速度被誤設過大時，同幀跳過多格造成視覺跳動。
 */
const MAX_SLIDE_CELLS_PER_FRAME = 0.5;
/**
 * 回收下界的緩衝格數：節點 y 低於「最底格點 − 此格數 × _height」時視為滑出可視範圍，
 * 搬回最頂端並換新圖。取 0.5（半格）使回收判定與換圖都發生在遮罩窗外，玩家看不到瞬移接縫。
 */
const RECYCLE_MARGIN_CELLS = 0.5;
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
 * 捲動模型（符號回收 recycling）：每個 symbol 節點**帶著自己的 spriteFrame 一路往下移動**——
 * 每幀 y 依 `_currentSpeed`（像素／秒）× dt 遞減，節點 worldPosition 真的逐幀下滑，且**移動過程中該節點的圖完全不變**。
 * 當某節點下滑出最底端（低於 `_wrapThreshold`，落在遮罩窗外）時，把它搬回最頂端（y += `_totalHeight`，
 * 接到目前最頂節點上方一格），並**在此時（且僅在此時）指派一張隨機新圖**——所以只有「繞回頂端」的那一個節點會換圖，
 * 其餘節點在移動中圖都不動，視覺上就是「上面的 symbol 一路往下帶」。
 *
 * 停輪：`stop( minSteps )` 設定剩餘步數開始倒數；剩餘步數 < DECEL_STEP_THRESHOLD 時每過一格衰減速度，
 * 停輪前最後一格改為把速度從進格速度線性緩降到 `FINAL_EASE_MIN_SPEED`（而非維持定速到格尾才瞬間歸零），
 * 使真正停止前的速度曲線連續、無頓挫感；倒數到 0 時把每個節點 snap 回最近的格點（對齊回 `_baseY` 定義的格線），
 * 使盤面精準對齊、無缺格重疊，停在自然對齊的隨機盤面（不指定目標符號）。
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
    private _baseY: number[] = [];
    private _height: number = SYMBOL_SPACING;
    /** 最頂／最底格點 y（由 _baseY 推算，供 snap 與回收邊界使用） */
    private _topBaseY: number = 0;
    private _bottomBaseY: number = 0;
    /** 回收環的總高度 = 節點數 × _height；節點回收時 y += 此值，恰好接到目前最頂節點上方一格 */
    private _totalHeight: number = 0;
    /** 回收下界門檻：節點 y 低於此值即搬回頂端並換新圖 */
    private _wrapThreshold: number = 0;

    private _machine: StateMachine<ReelState> = new StateMachine<ReelState>();
    /** 目前滾動速度（像素／秒）：自由滾動時等於 speed，減速時逐步衰減 */
    private _currentSpeed: number = 0;
    /** 累計已滑動距離（用於計步）：每累滿一格 _height 觸發一次 _onStep（停輪倒數／減速），與節點回收各自獨立 */
    private _stepAccum: number = 0;
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
        this._stepAccum = 0;
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
     * 往下推進一幀：所有節點以目前速度往下 travel（碰到底端回收＋換圖），
     * 同時累計滑動距離計步（供停輪倒數／減速）。單幀位移 clamp 在半格內，確保節點不會一次跳過多格。
     */
    private _advance( deltaTime: number ): void
    {
        const maxDistance = this._height * MAX_SLIDE_CELLS_PER_FRAME;
        const speed = this._remainingSteps === 1 ? this._finalStepSpeed() : this._currentSpeed;
        const distance = Math.min( speed * deltaTime, maxDistance );

        this._travelNodes( distance );

        this._stepAccum += distance;
        while ( this._stepAccum >= this._height )
        {
            this._stepAccum -= this._height;
            this._onStep();
        }
    }

    /**
     * 停輪前最後一格（`_remainingSteps === 1`）的緩降速度：以 `_stepAccum / _height` 為此格內的
     * 進度（0～1），把速度從 `_finalStepEntrySpeed` 線性降到 `FINAL_EASE_MIN_SPEED`，
     * 使真正停止（`_finishStop` 把速度歸零）前的最後一段位移速度已經很小、曲線連續，不再是
     * 「維持定速直到整格結束才瞬間歸零」的頓挫。
     */
    private _finalStepSpeed(): number
    {
        const progress = this._height > 0 ? this._stepAccum / this._height : 1;
        const eased = this._finalStepEntrySpeed * ( 1 - progress );
        return Math.max( FINAL_EASE_MIN_SPEED, eased );
    }

    /**
     * 讓所有節點往下移動 distance：更新各節點 y（保持各自 spriteFrame 不變）。
     * 任一節點滑出最底端（y < _wrapThreshold）時，搬回最頂端（y += _totalHeight）並指派一張隨機新圖——
     * 這是唯一會改變 spriteFrame 的時機，故只有剛繞回頂端的節點會換圖。
     */
    private _travelNodes( distance: number ): void
    {
        for ( let x = 0; x < this._units.length; x++ )
        {
            const node = this._units[ x ];
            const position = node.position;
            let y = position.y - distance;
            if ( y < this._wrapThreshold )
            {
                y += this._totalHeight;
                const sprite = this._sprites[ x ];
                if ( sprite !== null )
                {
                    sprite.spriteFrame = this._randomFrame();
                }
            }
            node.setPosition( position.x, y, position.z );
        }
    }

    /**
     * 完成一步（滑過一整格）時的處理：僅在停輪倒數中（_remainingSteps > 0）生效。
     * 剩餘步數遞減；進入減速門檻後每步衰減速度；倒數到 0 即對齊停住。
     */
    private _onStep(): void
    {
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

    /** 熄火對齊：速度歸零，把每個節點 snap 回最近格線後回 IDLE 並觸發停輪回呼 */
    private _finishStop(): void
    {
        this._currentSpeed = 0;
        this._stepAccum = 0;
        this._finalStepEntrySpeed = 0;
        this._snapToGrid();
        this._machine.changeTo( ReelState.IDLE );
        this._onStopped();
    }

    /**
     * 把所有節點對齊回格線：每個節點以「最底格點 + k × _height」為候選，snap 到最近者，
     * 再環繞收攏進 [_bottomBaseY, _topBaseY] 區間。因節點恆保持 _height 等距且共 N 個、環總高 = N × _height，
     * snap 後 N 個節點必落在 N 個相異格點上、完整覆蓋整個盤面（無缺格重疊）。
     */
    private _snapToGrid(): void
    {
        for ( let x = 0; x < this._units.length; x++ )
        {
            const node = this._units[ x ];
            const position = node.position;
            const steps = Math.round( ( position.y - this._bottomBaseY ) / this._height );
            let snappedY = this._bottomBaseY + steps * this._height;
            while ( snappedY > this._topBaseY )
            {
                snappedY -= this._totalHeight;
            }
            while ( snappedY < this._bottomBaseY )
            {
                snappedY += this._totalHeight;
            }
            node.setPosition( position.x, snappedY, position.z );
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

    /** 讀取 symbol 子節點，依原始 y 由上而下排序，快取節點/Sprite/原始格點，推算格距與回收邊界 */
    private _collectUnits(): void
    {
        const strip = this.symbolStrip !== null ? this.symbolStrip : this.node;
        this._units = strip.children.slice();
        this._units.sort( ( a, b ) => b.position.y - a.position.y );
        this._sprites = this._units.map( ( unit ) => unit.getComponent( Sprite ) );
        this._baseY = this._units.map( ( unit ) => unit.position.y );

        this._height = this._units.length >= 2
            ? this._units[ 0 ].position.y - this._units[ 1 ].position.y
            : SYMBOL_SPACING;

        const count = this._units.length;
        this._topBaseY = count > 0 ? this._baseY[ 0 ] : 0;
        this._bottomBaseY = count > 0 ? this._baseY[ count - 1 ] : 0;
        this._totalHeight = count * this._height;
        this._wrapThreshold = this._bottomBaseY - this._height * RECYCLE_MARGIN_CELLS;
        this._stepAccum = 0;
    }

    /** 初始盤面：每格隨機抽一張圖庫符號 */
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
