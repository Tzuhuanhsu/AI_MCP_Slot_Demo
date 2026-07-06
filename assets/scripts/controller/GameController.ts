import { _decorator, Component, Node } from 'cc';
import { ReelView } from '../view/ReelView';
import { UIView } from '../view/UIView';
import { GameModel } from '../model/GameModel';

const { ccclass, property, menu } = _decorator;

/** 第一輪從起轉到呼叫停輪的等待秒數 */
const DEFAULT_BASE_SPIN_DURATION = 2;
/** 每多一輪，額外增加的停輪等待秒數（形成逐輪依序停輪的時間差） */
const DEFAULT_REEL_STOP_INTERVAL = 0.4;
/**
 * 呼叫停輪時要求各輪至少再滑過的格數（傳給 ReelView.stop）。
 * 取 5 使倒數涵蓋 ReelView 的減速門檻（DECEL_STEP_THRESHOLD），讓最後數格漸進減速、手感明顯。
 */
const DEFAULT_STOP_MIN_STEPS = 5;

/**
 * GameController
 * 拉霸機的協調層（MVC 的 Controller）：唯一持有 Model 與各 View 的參照，串接輸入 → Model → View。
 *
 * 轉輪編排：點 SPIN → 三輪同時 `spin()` 起轉（自由滾動）→ 依序（第 i 輪於
 * baseSpinDuration + i × reelStopInterval 秒後）對第 i 輪呼叫 `stop( stopMinSteps )`，
 * 達成「同時起轉、依序減速停輪」。`update` 偵測全部停妥後恢復 SPIN。
 * 監聽 UIView 的 SPIN／Bet 輸入事件，向 GameModel 讀寫狀態，再把結果推回 View 顯示。
 */
@ccclass( 'GameController' )
@menu( 'Custom/GameController' )
export class GameController extends Component {

    @property( { type: [ Node ], tooltip: '各轉輪節點（掛有 ReelView），陣列順序即為停輪順序' } )
    public reelNodes: Node[] = [];

    @property( { type: Node, tooltip: '掛有 UIView 的節點' } )
    public uiView: Node | null = null;

    @property( { tooltip: '第一輪從起轉到呼叫停輪的等待秒數', min: 0 } )
    public baseSpinDuration: number = DEFAULT_BASE_SPIN_DURATION;

    @property( { tooltip: '相鄰兩輪停輪的時間差（秒）', min: 0 } )
    public reelStopInterval: number = DEFAULT_REEL_STOP_INTERVAL;

    @property( { tooltip: '停輪時要求各輪至少再滑過的格數', min: 0 } )
    public stopMinSteps: number = DEFAULT_STOP_MIN_STEPS;

    private _model: GameModel = new GameModel();
    private _ui: UIView | null = null;
    private _reels: ReelView[] = [];
    private _isSpinning: boolean = false;

    protected onLoad(): void {
        this._collectReels();
        this._resolveUI();
        this._syncAllDisplays();
    }

    /** 啟動整台拉霸機轉動；所有輪皆閒置時才受理。三輪同時起轉，依序排程停輪 */
    public spinAll(): void {
        if ( !this._allIdle() ) {
            return;
        }

        for ( let i = 0; i < this._reels.length; i++ ) {
            this._reels[ i ].spin();
        }

        for ( let i = 0; i < this._reels.length; i++ ) {
            const reel = this._reels[ i ];
            const delay = this.baseSpinDuration + i * this.reelStopInterval;
            this.scheduleOnce( () => reel.stop( this.stopMinSteps ), delay );
        }

        this._isSpinning = true;
        this._setSpinInteractable( false );
    }

    protected update(): void {
        if ( this._isSpinning && this._allIdle() ) {
            this._isSpinning = false;
            this._setSpinInteractable( true );
        }
    }

    /** SPIN 輸入處理 */
    private _onSpin(): void {
        this.spinAll();
    }

    /** Bet 調整輸入處理：更新 Model 後把新值推回 View */
    private _onBetChange( direction: number ): void {
        if ( this._isSpinning ) {
            return;
        }
        this._model.changeBet( direction );
        if ( this._ui !== null ) {
            this._ui.setBet( this._model.bet );
        }
    }

    /** 從 reelNodes 取出各節點的 ReelView，略過缺件者 */
    private _collectReels(): void {
        this._reels = [];
        for ( let i = 0; i < this.reelNodes.length; i++ ) {
            const node = this.reelNodes[ i ];
            if ( node === null ) {
                continue;
            }
            const reel = node.getComponent( ReelView );
            if ( reel !== null ) {
                this._reels.push( reel );
            }
        }
    }

    /** 取得 UIView 並訂閱其輸入事件 */
    private _resolveUI(): void {
        if ( this.uiView === null ) {
            return;
        }
        this._ui = this.uiView.getComponent( UIView );
        if ( this._ui !== null ) {
            this._ui.setSpinHandler( () => this._onSpin() );
            this._ui.setBetChangeHandler( ( direction ) => this._onBetChange( direction ) );
        }
    }

    /** 把 Model 目前狀態同步到 View 顯示 */
    private _syncAllDisplays(): void {
        if ( this._ui === null ) {
            return;
        }
        this._ui.setBalance( this._model.balance );
        this._ui.setBet( this._model.bet );
        this._ui.setWin( this._model.win );
    }

    private _setSpinInteractable( enabled: boolean ): void {
        if ( this._ui !== null ) {
            this._ui.setSpinInteractable( enabled );
        }
    }

    private _allIdle(): boolean {
        if ( this._reels.length === 0 ) {
            return false;
        }
        return this._reels.every( ( reel ) => reel.isIdle() );
    }
}
