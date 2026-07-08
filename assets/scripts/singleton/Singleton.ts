import { Component } from 'cc';

/**
 * Singleton
 * 極薄的通用單例基底：僅提供「onLoad 登記、onDestroy 清除」的生命週期骨架，
 * 供 Component 型 manager（如 ResourceManager）繼承沿用。
 * 本身不持有任何具體單例狀態——具型別的 `static instance` 欄位與登記/清除邏輯
 * 由各子類自行宣告與實作，避免跨子類共用同一個 static 欄位造成型別失真。
 */
export abstract class Singleton extends Component
{
    protected onLoad(): void
    {
        this._registerInstance();
    }

    protected onDestroy(): void
    {
        this._clearInstance();
    }

    /** 登記自身為單例（由子類實作，寫入子類自己的 static instance 欄位） */
    protected abstract _registerInstance(): void;

    /** 清除單例登記（由子類實作；僅在目前 instance 為自身時才清除，避免誤清後來登記者） */
    protected abstract _clearInstance(): void;
}
