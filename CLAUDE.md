# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 程式碼標準

設計與撰寫腳本時，**務必**參考 `.claude/instructions/typescript-code-standards.md` 的團隊規範進行設計（含設計原則、命名、空格規範、避免過度設計等）。當規格有調整時，也**務必**回頭修正該文件，保持規範與實作一致。

## Cocos 任務一律交由 cocos-creator-developer agent 執行

凡是 **Cocos Creator 開發任務** —— 修改場景、建立/調整 UI、節點與元件操作、prefab、資產、遊戲邏輯、
腳本（含 MVC 各層）等 —— **務必**透過 Agent 工具啟動 `.claude/agents/cocos-creator-developer.md`
（agent 名稱 `cocos-creator-developer`）來執行，不要自行直接動手。

該 agent 的固定工作流為「先查 `.claude/library/` 知識庫 → 擬計畫等使用者確認 → 才執行」，
其中所有 Cocos IDE 實際操作（inspector／node／prefab／scene／asset 等）再委由 `cocos-mcp-dev-assistant` 進行。

## 知識庫（`.claude/library/`）

`.claude/library/` 收錄已完成並驗證的功能實作知識（設計決策、關鍵機制、場景異動、踩坑紀錄）。

- **實作前**：**務必**先查閱 `.claude/library/README.md` 索引，確認是否有可參考的既有知識（相似功能、可複用模式、已知陷阱），避免重複踩坑或重新推導。
- **計畫完成後**：**務必**回頭在 `.claude/library/` 更新資訊 —— 新功能新增一份文件並登錄於 `README.md` 索引；既有功能有擴充或修正時更新對應文件，保持知識與實作一致。

## 專案概述

MCPCocosDemo 是一個 **Cocos Creator 3.8.3+ 3D 遊戲場景測試專案**，整合了 `cocos-mcp-server` 擴充套件（v1.4.0），讓 Claude Code 可透過 MCP 協定直接操控 Cocos 編輯器場景。

- **設計解析度**：960 × 640
- **MCP Server 端點**：`http://127.0.0.1:3000/mcp`（Port 3000，需在 Cocos 編輯器手動啟動）

## Extension 開發指令

`cocos-mcp-server` 擴充套件的原始碼位於 `extensions/cocos-mcp-server/`：

```bash
# 安裝依賴
cd extensions/cocos-mcp-server && npm install

# 編譯 TypeScript（輸出至 dist/）
npm run build

# 監聽模式（開發中）
npm run watch
```

TypeScript 設定繼承自 `./temp/tsconfig.cocos.json`（Cocos 自動產生），`strict: false`。

## 架構說明

### MCP 工具層（`extensions/cocos-mcp-server/dist/tools/`）
- `node-tools.js`：節點建立、刪除、移動、屬性設定、Transform 操作
- `component-tools.js`：元件新增/移除、屬性設定（含 Color/Size 特殊處理）
- 工具總數 120+，分 14 類，全部在 `settings/tool-manager.json` 中登錄

### 場景結構（`assets/scene/main.scene`）
```
main (Scene)
├── Main Light (DirectionalLight)
├── Background (2D 環境節點)
└── GameNodes (3D 互動節點)
```

### 設定檔
- `settings/mcp-server.json`：Port、AutoStart（預設 false）、連線數
- `settings/tool-manager.json`：所有 MCP 工具的啟用清單
- `.mcp.json`：Claude Code 連接 MCP Server 的端點設定

## 已知 Bug（cocos-mcp-server v1.4.0）— 已全數修正

詳細記錄於 `extensions/cocos-mcp-server/cocos_creator_mcp_Bug.md`。以下 bug 均已於 `source/tools/*.ts` 修正、`npm run build`，並以 MCP 實測 + 讀磁碟序列化驗證通過（2026-06-30）：

| Bug | 影響 | 狀態 |
|-----|------|------|
| `set_node_transform` Vec3 dump 格式 | 位置/旋轉/縮放損毀為 0 | ✅ 已修（`buildVec3Dump()`：`{type:'cc.Vec3', value:{x,y,z}}` 帶 type + 純數字） |
| `color` 屬性只接受 hex 字串 | 設色失敗 | ✅ 已修（`normalizeStructuredValue()`，現可接受 RGBA 物件） |
| `size`/`contentSize` 不接受物件值 | 無法設 contentSize | ✅ 已修（同上） |
| asset 陣列塞進單一 `__uuid__` | 無法設 `SpriteFrame[]` 等 | ✅ 已修（新增 `assetArray`/`spriteFrameArray`/`prefabArray`） |
| `instantiate_prefab` 實例 `_prefab` 為 null | 節點未與 prefab 連結，無法 revert/同步 prefab 更新 | ✅ 已修（`create-node` options 補 `type:'cc.Prefab'`、位置改用 `position` 欄位；附帶修好 `debug_execute_script`，新增 `scene.ts` 的 `executeScript`） |

**根本原因**：MCP JSON 傳輸格式與 Cocos 編輯器 dump 期望格式之間的值轉換不一致；prefab 實例化則因 `create-node` 未指定 `type` 而未走預製體連結分支。原始碼已提交至 `https://github.com/Tzuhuanhsu/CocosMCP.git`。

`main.scene.bak` 是早期 Bug 修復前的場景備份。

## MCP 操作注意事項

- 修改場景後須呼叫 `scene_save_scene` 才會持久化
- 改 `dist/*.js` 後，執行中的 MCP server 不會熱載入，須**重載擴充套件或重啟編輯器**才生效
- `color` 可傳 RGBA 物件 `{r,g,b,a}` 或 hex 字串 `"#RRGGBBAA"`（皆已支援）
- 設 `SpriteFrame[]` 等資產陣列：用 `propertyType: 'spriteFrameArray'`，`value` 傳 uuid 字串陣列
- Server AutoStart 為 false，需在 Cocos 編輯器的 MCP Server 面板手動啟動
