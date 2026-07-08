import { _decorator, SpriteFrame } from 'cc';
import { Singleton } from './Singleton';

const { ccclass, property, menu } = _decorator;

/**
 * ResourceManager
 * 符號圖庫的集中式資源單例：掛載於場景中單一節點，於其 Inspector 一次性指派 `symbolFrames`，
 * 讓各 `ReelView` 改為向本單例取圖，不再各自於 Inspector 掛載圖片陣列（單一真實來源）。
 * 全場景僅應有一個實例；若偵測到重複掛載，後者不覆蓋既有 instance（保留先登記者）。
 */
@ccclass( 'ResourceManager' )
@menu( 'Custom/ResourceManager' )
export class ResourceManager extends Singleton
{
    public static instance: ResourceManager | null = null;

    @property( { type: [ SpriteFrame ], tooltip: '符號圖庫（集中管理）：各 ReelView 共用此圖庫抽圖，無需各自於 Inspector 掛載' } )
    public symbolFrames: SpriteFrame[] = [];

    protected _registerInstance(): void
    {
        if ( ResourceManager.instance === null )
        {
            ResourceManager.instance = this;
        }
    }

    protected _clearInstance(): void
    {
        if ( ResourceManager.instance === this )
        {
            ResourceManager.instance = null;
        }
    }

    /** 取得目前完整符號圖庫（可能為長度 0 的陣列，永不回 null） */
    public getSymbolFrames(): SpriteFrame[]
    {
        return this.symbolFrames;
    }

    /** 從圖庫隨機抽一張符號 SpriteFrame；圖庫為空時回 null（FR-006，呼叫端須容忍） */
    public getRandomSymbolFrame(): SpriteFrame | null
    {
        const length = this.symbolFrames.length;
        if ( length === 0 )
        {
            return null;
        }
        return this.symbolFrames[ Math.floor( Math.random() * length ) ];
    }
}
