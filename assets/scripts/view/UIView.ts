import { _decorator, Component, Node, Button, Label } from 'cc';

const { ccclass, property, menu } = _decorator;

/** Bet 增加方向 */
const BET_DIRECTION_UP = 1;
/** Bet 減少方向 */
const BET_DIRECTION_DOWN = -1;

/** SPIN 點擊回呼型別 */
type SpinHandler = () => void;
/** Bet 調整回呼型別（direction 為 +1／-1） */
type BetChangeHandler = ( direction: number ) => void;

/**
 * UIView
 * 拉霸機畫面 UI 的呈現層（MVC 的 View）：SPIN 按鈕、Balance／Bet／Win 顯示、Bet 加減。
 *
 * 只負責「渲染」與「轉發原始輸入」，不存遊戲狀態、不做規則判斷（下注級距/上下限等由 Model 決定）。
 * 對外開輸入事件（setSpinHandler／setBetChangeHandler）與顯示 setter，由 Controller 串接。
 */
@ccclass( 'UIView' )
@menu( 'Custom/UIView' )
export class UIView extends Component {

    @property( { type: Node, tooltip: 'SPIN 按鈕節點' } )
    public spinButton: Node | null = null;

    @property( { type: Node, tooltip: 'Balance 數值 Label 節點' } )
    public balanceLabel: Node | null = null;

    @property( { type: Node, tooltip: 'Bet 數值 Label 節點' } )
    public betLabel: Node | null = null;

    @property( { type: Node, tooltip: 'Win 數值 Label 節點' } )
    public winLabel: Node | null = null;

    @property( { type: Node, tooltip: 'Bet 減少按鈕節點' } )
    public betMinusButton: Node | null = null;

    @property( { type: Node, tooltip: 'Bet 增加按鈕節點' } )
    public betPlusButton: Node | null = null;

    private _spinHandler: SpinHandler | null = null;
    private _betChangeHandler: BetChangeHandler | null = null;

    protected onLoad(): void {
        this._bindButtons();
    }

    /** 註冊 SPIN 點擊回呼（由 Controller 訂閱） */
    public setSpinHandler( handler: SpinHandler ): void {
        this._spinHandler = handler;
    }

    /** 註冊 Bet 調整回呼（由 Controller 訂閱） */
    public setBetChangeHandler( handler: BetChangeHandler ): void {
        this._betChangeHandler = handler;
    }

    /** 更新餘額顯示 */
    public setBalance( value: number ): void {
        this._applyLabel( this.balanceLabel, value );
    }

    /** 更新下注額顯示 */
    public setBet( value: number ): void {
        this._applyLabel( this.betLabel, value );
    }

    /** 更新中獎金額顯示 */
    public setWin( value: number ): void {
        this._applyLabel( this.winLabel, value );
    }

    /** 設定 SPIN 按鈕是否可互動（轉動中禁用、停輪後恢復） */
    public setSpinInteractable( enabled: boolean ): void {
        if ( this.spinButton === null ) {
            return;
        }
        const button = this.spinButton.getComponent( Button );
        if ( button !== null ) {
            button.interactable = enabled;
        }
    }

    private _bindButtons(): void {
        if ( this.spinButton !== null ) {
            this.spinButton.on( Button.EventType.CLICK, this._onSpinClicked, this );
        }
        if ( this.betMinusButton !== null ) {
            this.betMinusButton.on( Button.EventType.CLICK, this._onBetMinus, this );
        }
        if ( this.betPlusButton !== null ) {
            this.betPlusButton.on( Button.EventType.CLICK, this._onBetPlus, this );
        }
    }

    private _onSpinClicked(): void {
        if ( this._spinHandler !== null ) {
            this._spinHandler();
        }
    }

    private _onBetMinus(): void {
        this._emitBetChange( BET_DIRECTION_DOWN );
    }

    private _onBetPlus(): void {
        this._emitBetChange( BET_DIRECTION_UP );
    }

    private _emitBetChange( direction: number ): void {
        if ( this._betChangeHandler !== null ) {
            this._betChangeHandler( direction );
        }
    }

    /** 將數值寫入指定 Label 節點的 Label 元件 */
    private _applyLabel( labelNode: Node | null, value: number ): void {
        if ( labelNode === null ) {
            return;
        }
        const label = labelNode.getComponent( Label );
        if ( label !== null ) {
            label.string = String( value );
        }
    }

    protected onDestroy(): void {
        if ( this.spinButton !== null ) {
            this.spinButton.off( Button.EventType.CLICK, this._onSpinClicked, this );
        }
        if ( this.betMinusButton !== null ) {
            this.betMinusButton.off( Button.EventType.CLICK, this._onBetMinus, this );
        }
        if ( this.betPlusButton !== null ) {
            this.betPlusButton.off( Button.EventType.CLICK, this._onBetPlus, this );
        }
    }
}
