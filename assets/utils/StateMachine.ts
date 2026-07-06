/**
 * StateMachine — 通用有限狀態機（Finite State Machine）
 *
 * 與 Cocos 無耦合的純 TypeScript 模組，透過 import 即可套用於任何需要
 * 「狀態切換 + 逐幀更新」的物件（如轉輪動畫、角色行為、UI 流程）。
 *
 * 使用方式：
 *   1. 以 `define( state, handlers )` 註冊每個狀態的 onEnter / onUpdate / onExit 回呼。
 *   2. 以 `start( state )` 設定初始狀態（觸發其 onEnter）。
 *   3. 於每幀呼叫 `update( deltaTime )`，派發給當前狀態的 onUpdate。
 *   4. 狀態內以 `changeTo( state )` 切換（自動呼叫舊狀態 onExit、新狀態 onEnter）。
 *
 * 泛型 `TState` 可為 enum / string / number，呼叫端自行定義狀態集合。
 */

/** 單一狀態的生命週期回呼；三者皆為選用 */
export interface StateHandlers {
    /** 進入此狀態時呼叫一次 */
    onEnter?(): void;
    /** 停留於此狀態時每幀呼叫，deltaTime 為與上一幀的時間差（秒） */
    onUpdate?( deltaTime: number ): void;
    /** 離開此狀態時呼叫一次 */
    onExit?(): void;
}

export class StateMachine<TState> {

    private _states: Map<TState, StateHandlers> = new Map();
    private _current: TState | null = null;

    /**
     * 註冊一個狀態與其回呼。回傳自身以支援鏈式呼叫。
     * 重複註冊同一狀態會覆寫先前的回呼。
     */
    public define( state: TState, handlers: StateHandlers ): this {
        this._states.set( state, handlers );
        return this;
    }

    /**
     * 設定初始狀態並觸發其 onEnter。應於所有狀態註冊完成後呼叫一次。
     * 若狀態未註冊則不作任何事（避免進入未定義狀態）。
     */
    public start( state: TState ): void {
        if ( !this._states.has( state ) ) {
            return;
        }
        this._current = state;
        this._invokeEnter( state );
    }

    /**
     * 切換至指定狀態：先呼叫舊狀態 onExit，再呼叫新狀態 onEnter。
     * 切換到未註冊狀態、或切換到目前所在狀態時，皆不作任何事。
     */
    public changeTo( state: TState ): void {
        if ( !this._states.has( state ) ) {
            return;
        }
        if ( this._current === state ) {
            return;
        }
        this._invokeExit( this._current );
        this._current = state;
        this._invokeEnter( state );
    }

    /** 派發至當前狀態的 onUpdate；尚未 start 時不作任何事 */
    public update( deltaTime: number ): void {
        if ( this._current === null ) {
            return;
        }
        const handlers = this._states.get( this._current );
        if ( handlers !== undefined && handlers.onUpdate !== undefined ) {
            handlers.onUpdate( deltaTime );
        }
    }

    /** 目前是否處於指定狀態 */
    public is( state: TState ): boolean {
        return this._current === state;
    }

    /** 目前狀態；尚未 start 時為 null */
    public get current(): TState | null {
        return this._current;
    }

    private _invokeEnter( state: TState ): void {
        const handlers = this._states.get( state );
        if ( handlers !== undefined && handlers.onEnter !== undefined ) {
            handlers.onEnter();
        }
    }

    private _invokeExit( state: TState | null ): void {
        if ( state === null ) {
            return;
        }
        const handlers = this._states.get( state );
        if ( handlers !== undefined && handlers.onExit !== undefined ) {
            handlers.onExit();
        }
    }
}
