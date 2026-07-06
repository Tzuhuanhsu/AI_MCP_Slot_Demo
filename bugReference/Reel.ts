import { _decorator, Component, instantiate, Node, Prefab, Vec3 } from 'cc';
import { randomIntRangeInclusive } from '../CustomLibrary/CustomMath';
import { FixedBallData } from '../GameData/SlotResultData/FixedBallData';
import { SlotUnitType } from '../GameData/SlotUnitType';
import { GameUtility } from '../GameUtility/GameUtility';
import { ReelProperty } from './ReelController';
import { SlotUnit } from './SlotUnit';
import { SlotUnitPositionHelper } from './SlotUnitPositionHelper';
import { EventManager } from '../EventManager/EventManager';
const { ccclass, property } = _decorator;

enum SlotState
{
    Idle,
    Run,
    ReadyToStop,
    Stop,
    Shock
}

@ccclass( 'Reel' )
export class Reel extends Component 
{
    private readonly _deltaTime: number = 1 / 60;
    private readonly _extraUnitCount: number = 2;

    @property( { type: Prefab, visible: true } )
    private _prefabSlotUnit: Node;
    private _unitList: SlotUnit[] = [];
    private _reelProperty: ReelProperty;
    private _reelData: number[];
    private _isFGIconArray: boolean[];
    private _changeSymbolPositions: number[] = [];
    private _slotState: SlotState = SlotState.Idle;
    private _height: number = 0;
    private _isWaitStop: boolean = false;
    private _canStop: boolean = false;
    private _endCount: number = 0;
    private _currentCenter: number = 0;
    private _timer: number = 0;

    public initialize( reelID: number, reelProperty: ReelProperty ): void
    {
        this._height = SlotUnitPositionHelper.Instance.SlotUnitHeight;
        this._reelProperty = reelProperty;
        let slotUnitArray: SlotUnit[] = this.getComponentsInChildren( SlotUnit );

        if ( slotUnitArray.length === GameUtility.getSlotColumn() + this._extraUnitCount )
        {
            this._unitList = slotUnitArray;
        }
        else
        {
            slotUnitArray.forEach( ( element ) => element.node.destroy() );
            this.node.position = new Vec3( SlotUnitPositionHelper.Instance.columnPosition( reelID ), 0, 0 );
            let slotUnit: SlotUnit;
            for ( let x = 0; x < GameUtility.getSlotRow() + this._extraUnitCount; x++ )
            {
                slotUnit = instantiate( this._prefabSlotUnit ).getComponent( SlotUnit );
                slotUnit.Init();
                slotUnit.node.name = this.node.name + "SlotUnit" + x;
                slotUnit.node.parent = this.node;
                slotUnit.node.position = new Vec3( 0, SlotUnitPositionHelper.Instance.rowPosition( x - this._extraUnitCount ), 0 );
                slotUnit.setIcon( randomIntRangeInclusive( 0, SlotUnitType.FreeGame ) );
                this._unitList.push( slotUnit );
            }
        }

        //### For Debug
        EventManager.Instance.on( "onClickAllZeus", this.TestZeus.bind( this ) );
        EventManager.Instance.on( "onClickAllShock", this.TestAction.bind( this ) );
    }
    private TestZeus( data: string )
    {
        this._unitList.forEach( element =>
        {
            element.setIcon( Number( data ) );
        } );
    }

    private TestAction()
    {
        this._unitList.forEach( element =>
        {
            element.Idle();
        } );

    }

    //Set Icon
    public SetIcon( position: number, symbol: SlotUnitType )
    {
        this._unitList[ position ].setIcon( symbol );
    }

    //播放指定位置 Symbol reward action
    public PlayRewardAction( symbolPosition: number, callFun: () => void )
    {
        const worldPosition = this._unitList[ symbolPosition + 1 ].node.getWorldPosition();
        this._unitList[ symbolPosition + 1 ].node.parent = this._reelProperty.topActionNode;
        this._unitList[ symbolPosition + 1 ].node.active = true;
        this._unitList[ symbolPosition + 1 ].Reward( callFun );
        this._unitList[ symbolPosition + 1 ].node.setWorldPosition( worldPosition );
        if ( this._unitList[ symbolPosition + 1 ].IconType == SlotUnitType.FreeGame )
        {
            this._unitList[ symbolPosition + 1 ].node.setSiblingIndex( -1 );
        }
        else
        {
            this._unitList[ symbolPosition + 1 ].node.setSiblingIndex( symbolPosition );
        }

    }

    public ChangeToFGStartPlant()
    {
        for ( let x = 0; x < this._unitList.length; x++ )
        {
            this._unitList[ x ].setIcon( SlotUnitType.RedLightening );
            if ( x > 0 && x < this._unitList.length - 1 )
            {
                this.SetChangeSymbolPosition( x - 1 );
            }
        }
    }

    public deinitialize(): void
    {
        this._reelProperty.PlayStoppingAudio = null;
        this._reelProperty.ReelEnd = null;
    }

    public Spin(): void
    {
        if ( this._slotState === SlotState.Idle )
        {
            this._slotState = SlotState.Run;
            // this.changeIcon();
            this._canStop = false;
            this.reset();
        }
    }

    private reset()
    {
        this._isFGIconArray = [];
        this._changeSymbolPositions.splice( 0 );
        for ( let index = 0; index < this._unitList.length; index++ )
        {
            this._unitList[ index ].node.parent = this.node;
            this._unitList[ index ].node.position = new Vec3( 0,
                SlotUnitPositionHelper.Instance.rowPosition( index - this._extraUnitCount ), 0 );
            this._unitList[ index ].Idle();
            this._isFGIconArray.push( false );
        }
    }

    public setStop( reelData: number[] ): void
    {
        this._reelData = reelData;
        if ( this._canStop )
        {
            this.readyToStop();
        }
        else
        {
            this._isWaitStop = true;
        }
    }

    public SetChangeSymbolPosition( lockPositions: number )
    {
        this._changeSymbolPositions.push( lockPositions );
    }

    //播放更換動畫
    public PlayChangeAction( callFun: () => void )
    {
        let actionCount = 0;
        let endCallFun = () =>
        {
            if ( actionCount == 0 && callFun )
            {
                callFun();
                callFun = null;
            }
        }

        this._changeSymbolPositions.forEach( position =>
        {
            actionCount++;

            this._unitList[ position + 1 ].ChangeHand( () =>
            {
                actionCount--;
                endCallFun();
            } );
        } );
        endCallFun();
    }

    /**
     * @關閉SlotUnit 防止同時顯示2層圖片
     * @param positionArray 序號的Array
     * @param isRewardShow 中獎演出階段時，其他轉格變暗
     */
    public closeSlotUnit( positionArray: number[], isRewardShow: boolean ): void
    {
        for ( let index = 0; index < positionArray.length; index++ )
        {
            let unitIndex: number = positionArray[ index ] + 1;
            this._unitList[ unitIndex ].node.active = false;
        }

        if ( isRewardShow )
        {
            for ( let index = 0; index < this._unitList.length; index++ )
            {
                const element = this._unitList[ index ];

                if ( element.node.active )
                {
                    element.PlayDarkTween();
                }
            }
        }
    }

    /**
     * 關閉指定的 symbol
     * @param symbolPosition symbol in reel position 
     * @param showMask 是否要開啟遮罩
     * @returns 
     */
    public HideSymbol( symbolPosition: number, showMask: boolean = false )
    {
        console.log( "[HideSymbol]", symbolPosition )
        if ( !this._unitList[ symbolPosition + 1 ] )
        {
            console.error( "[Reel] HideSymbol fail", symbolPosition );
            return;
        }
        this._unitList[ symbolPosition + 1 ].node.active = false;
        if ( showMask )
        {
            this._unitList[ symbolPosition + 1 ].PlayDarkTween();
        }
        else
        {
            this._unitList[ symbolPosition + 1 ].PlayLightTween();
        }
    }

    /**
     * 開啟指定的 symbol
     * @param symbolPosition symbol in reel position 
     * @param showMask 是否要開啟遮罩
     * @returns 
     */
    public ShowSymbol( symbolPosition: number, showMask: boolean = false )
    {
        if ( !this._unitList[ symbolPosition + 1 ] )
        {
            console.error( "[Reel] HideSymbol fail", symbolPosition );
            return;
        }
        this._unitList[ symbolPosition + 1 ].node.active = true;
        if ( showMask )
        {
            this._unitList[ symbolPosition + 1 ].PlayDarkTween();
        }
        else
        {
            this._unitList[ symbolPosition + 1 ].PlayLightTween();
        }
    }

    //Symbol 壓黑遮罩
    public ShowMask()
    {
        this._unitList.forEach( symbol =>
        {
            symbol.PlayDarkTween();
        } );
    }

    //Symbol 壓黑遮罩關閉
    public HideMask()
    {
        this._unitList.forEach( symbol =>
        {
            symbol.PlayLightTween();
        } );
    }


    public lightNotFGSlotUnit(): void
    {
        for ( let index = 0; index < this._unitList.length; index++ )
        {
            const element = this._unitList[ index ];
            if ( this._isFGIconArray && !this._isFGIconArray[ index ] )
            {
                element.PlayLightTween();
            }
        }
    }

    public openAllSlotUnit(): void
    {
        this._unitList.forEach( ( element ) => element.node.active = true );
    }

    public openNotFGSlotUnit(): void
    {
        for ( let index = 0; index < this._unitList.length; index++ )
        {
            const element = this._unitList[ index ];
            if ( this._isFGIconArray && !this._isFGIconArray[ index ] )
            {
                element.node.active = true;
            }
        }
    }

    protected update( dt: number ): void
    {
        switch ( this._slotState )
        {
            case SlotState.Run:
                this.setCanStop();
            case SlotState.ReadyToStop:
            case SlotState.Stop:
                this.updateUnitPosition();
                break;
            case SlotState.Shock:
                this.updateShock();
                break;
            default:
                break;
        }
    }

    protected lateUpdate( dt: number ): void
    {
        if ( this._isWaitStop )   
        {
            this.readyToStop();
        }
    }

    private setCanStop(): void
    {
        if ( !this._canStop )
        {
            this._canStop = true;
        }
    }

    private updateShock(): void
    {
        this._timer += this._deltaTime;
        let normalizeTime: number = Math.min( this._timer / this._reelProperty.ShockTime, 1 );
        this._currentCenter = this._height * this._reelProperty.ShockCurve.evaluate( normalizeTime, 0 );
        this.fixingPosition();

        if ( normalizeTime === 1 )
        {
            this._slotState = SlotState.Idle;
            this.checkScatterAudio();
            this._reelProperty.ReelEnd();

        }
    }
    //檢查 Scatter 音效
    private checkScatterAudio()
    {
        if ( this.getFGIconQuantity() > 0 )
        {
            for ( let x = 1; x <= this.getFGIconQuantity(); x++ )
            {
                this._reelProperty.PlayScatterAudio( x );
            }
        }
    }

    private updateUnitPosition(): void
    {
        this._currentCenter -= this._reelProperty.StanderdSpeed * this._deltaTime;
        if ( this._currentCenter <= 0 )
        {
            if ( this._slotState === SlotState.Run || this._slotState === SlotState.ReadyToStop )
            {
                this.unitMoveTopAndChangeIcon();
            }
            this.updateReelState();
        }
        this.fixingPosition();
    }

    private updateReelState(): void
    {
        if ( this._slotState === SlotState.Stop )
        {
            this._reelProperty.PlayStoppingAudio();
            this._timer = 0;
            this._currentCenter = 0;
            this._slotState = SlotState.Shock;
            this.playUnitOnShock();
        }
        else if ( this._slotState === SlotState.ReadyToStop && this._endCount >= this._reelData.length )
        {
            this._slotState = SlotState.Stop;
        }
    }

    private playUnitOnShock()
    {
        for ( let index = 1; index < this._unitList.length - 1; index++ )
        {
            if ( this._unitList[ index ].IconType == SlotUnitType.FreeGame )
            {
                this._unitList[ index ].PlayShock();
            }
        }
    }
    private unitMoveTopAndChangeIcon(): void
    {
        this._currentCenter += this._height;
        let lastUnitIndex: number = this._unitList.length - 1;

        this._unitList.unshift( this._unitList.pop() );
        this.changeIcon();

    }

    private fixingPosition(): void
    {
        for ( let x = 0; x < this._unitList.length; x++ )
        {
            this._unitList[ x ].node.position = new Vec3( 0, this._currentCenter + this._height * ( this._extraUnitCount - x ), 0 );
        }
    }

    public setFGPosition( positionArray: number[] )
    {
        this._isFGIconArray = [];
        for ( let index = 0; index < positionArray.length; index++ )
        {
            const element = positionArray[ index ] + 1;

            this._isFGIconArray[ element ] = true;
        }
    }

    public getFGIconQuantity()
    {
        let fgIconCount: number = 0;

        this._isFGIconArray.forEach( isFgIcon =>
        {
            if ( isFgIcon )
            {
                fgIconCount++;
            }
        } );
        return fgIconCount;
    }

    private changeIcon(): void
    {
        if ( this._slotState === SlotState.ReadyToStop )
        {
            this._unitList[ 1 ].setIcon( this._reelData[ GameUtility.getSlotRow() - this._endCount - 1 ] );
            if ( this._unitList[ 1 ].IconType == SlotUnitType.FreeGame )
            {
                this._unitList[ 1 ].node.setSiblingIndex( -1 );
            }
            this._endCount++;
        }
        else
        {
            let randomSlotUnitType: number = randomIntRangeInclusive( 0, SlotUnitType.FreeGame );
            this._unitList[ 0 ].setIcon( randomSlotUnitType == SlotUnitType.FixedBall ? this.randomLighteningSymbol() : randomSlotUnitType );
            if ( this._unitList[ 0 ].IconType == SlotUnitType.FreeGame )
            {
                this._unitList[ 0 ].node.setSiblingIndex( -1 );
            }

        }

    }
    private randomLighteningSymbol()
    {
        return randomIntRangeInclusive( SlotUnitType.RedLightening, SlotUnitType.PurpleLightening );
    }
    private readyToStop(): void
    {
        this._endCount = 0;
        this._slotState = SlotState.ReadyToStop;
        this._isWaitStop = false;
    }
}