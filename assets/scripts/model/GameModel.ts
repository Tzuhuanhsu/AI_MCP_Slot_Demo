/** 初始餘額 */
const INITIAL_BALANCE = 1000;
/** 初始下注額 */
const INITIAL_BET = 10;
/** 初始中獎金額 */
const INITIAL_WIN = 0;
/** 下注額每次調整的級距 */
const BET_STEP = 10;
/** 下注額下限 */
const MIN_BET = 10;
/** 下注額上限 */
const MAX_BET = 100;

/**
 * GameModel
 * 拉霸機的資料層（MVC 的 Model）：持有 balance／bet／win 狀態與下注規則。
 *
 * 純資料類，不依賴 `cc`、不掛在節點上，由 Controller 建立並持有。
 * 只負責「狀態與規則」，不涉及畫面呈現，也不涉及扣款/結算等 gameplay（保留由 Controller 日後擴充）。
 */
export class GameModel {

    private _balance: number = INITIAL_BALANCE;
    private _bet: number = INITIAL_BET;
    private _win: number = INITIAL_WIN;

    public get balance(): number {
        return this._balance;
    }

    public get bet(): number {
        return this._bet;
    }

    public get win(): number {
        return this._win;
    }

    /** 依方向調整下注額（direction 為 +1／-1），以 BET_STEP 為級距並夾在 [MIN_BET, MAX_BET] */
    public changeBet( direction: number ): void {
        this.setBet( this._bet + direction * BET_STEP );
    }

    /** 設定下注額（自動夾範圍） */
    public setBet( value: number ): void {
        this._bet = this._clampBet( value );
    }

    /** 設定餘額 */
    public setBalance( value: number ): void {
        this._balance = value;
    }

    /** 設定中獎金額 */
    public setWin( value: number ): void {
        this._win = value;
    }

    /** 將下注額限制在 [MIN_BET, MAX_BET] 範圍內 */
    private _clampBet( value: number ): number {
        if ( value < MIN_BET ) {
            return MIN_BET;
        }
        if ( value > MAX_BET ) {
            return MAX_BET;
        }
        return value;
    }
}
