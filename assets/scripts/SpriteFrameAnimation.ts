import { _decorator, Component, Sprite, SpriteFrame } from 'cc';

const { ccclass, property, requireComponent, menu } = _decorator;

/** 預設每幀間隔秒數 */
const DEFAULT_FRAME_INTERVAL = 0.1;
/** 起始幀索引 */
const FIRST_FRAME_INDEX = 0;

/**
 * SpriteFrameAnimation
 * 依序播放多張 SpriteFrame 的逐幀動畫組件。
 * 掛載此組件的節點必須具備 Sprite 組件（已透過 @requireComponent 強制）。
 */
@ccclass( 'SpriteFrameAnimation' )
@requireComponent( Sprite )
@menu( 'Custom/SpriteFrameAnimation' )
export class SpriteFrameAnimation extends Component {

    @property( { type: [ SpriteFrame ], tooltip: '依序播放的 SpriteFrame 清單' } )
    public spriteFrames: SpriteFrame[] = [];

    @property( { tooltip: '每幀切換的間隔秒數', min: 0 } )
    public interval: number = DEFAULT_FRAME_INTERVAL;

    @property( { tooltip: '是否循環播放' } )
    public loop: boolean = true;

    @property( { tooltip: '是否在 onLoad 時自動播放' } )
    public playOnLoad: boolean = true;

    private _sprite: Sprite | null = null;
    private _currentIndex: number = FIRST_FRAME_INDEX;
    private _elapsed: number = 0;
    private _isPlaying: boolean = false;

    protected onLoad(): void {
        this._sprite = this.getComponent( Sprite );

        if ( this.playOnLoad ) {
            this.play();
        }
    }

    /** 從頭開始播放 */
    public play(): void {
        if ( !this._hasFrames() ) {
            return;
        }

        this._currentIndex = FIRST_FRAME_INDEX;
        this._elapsed = 0;
        this._isPlaying = true;
        this._applyFrame( this._currentIndex );
    }

    /** 停止播放（保留目前畫面） */
    public stop(): void {
        this._isPlaying = false;
    }

    /** 恢復播放（接續目前進度） */
    public resume(): void {
        if ( this._hasFrames() ) {
            this._isPlaying = true;
        }
    }

    protected update( deltaTime: number ): void {
        if ( !this._isPlaying || this.interval <= 0 ) {
            return;
        }

        this._elapsed += deltaTime;

        if ( this._elapsed < this.interval ) {
            return;
        }

        this._elapsed -= this.interval;
        this._advanceFrame();
    }

    /** 推進至下一幀，處理循環與結束邏輯 */
    private _advanceFrame(): void {
        const nextIndex = this._currentIndex + 1;
        const frameCount = this.spriteFrames.length;

        if ( nextIndex >= frameCount ) {
            if ( !this.loop ) {
                this._isPlaying = false;
                return;
            }
            this._currentIndex = FIRST_FRAME_INDEX;
        } else {
            this._currentIndex = nextIndex;
        }

        this._applyFrame( this._currentIndex );
    }

    /** 將指定索引的 SpriteFrame 套用到 Sprite */
    private _applyFrame( index: number ): void {
        if ( this._sprite === null ) {
            return;
        }
        this._sprite.spriteFrame = this.spriteFrames[ index ];
    }

    private _hasFrames(): boolean {
        return this.spriteFrames.length > FIRST_FRAME_INDEX;
    }
}
