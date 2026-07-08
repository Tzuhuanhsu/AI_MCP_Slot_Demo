# Product Steering — MCPCocosDemo

> 持久化的產品願景文件，供所有 spec 開發（`/spec-create`、`/spec-design`、`/spec-tasks`、`/spec-execute`）對齊。

## 產品定位

MCPCocosDemo 是一個 **雙重目標的實驗性專案**，兩條主線並重：

1. **MCP 整合驗證場域** — 驗證 `cocos-mcp-server` 擴充套件能否讓 Claude Code 透過 MCP 協定直接操控 Cocos Creator 編輯器（場景、節點、元件、資產、prefab）。踩坑紀錄與修正沉澱於 `extensions/cocos-mcp-server/` 原始碼與專案 memory。
2. **拉霸機（slot machine）玩法開發** — 以做出一個結構清晰、可玩的拉霸機為載體，實地磨合上述 MCP 工作流與 MVC 架構。

兩者互為表裡：拉霸機的每次功能演進，同時是對 MCP 操控能力的實測。

## 目標使用者

- **主要使用者：開發者本身**。透過 Claude Code + MCP 直接操控 Cocos 編輯器進行開發實驗，而非終端玩家。
- 產品面向的「玩家體驗」（轉輪手感、UI 呈現）是開發驗證的品質標準，而非商業發行對象。

## 核心功能

- **三輪轉輪**：同時起轉 → 依序減速停輪對齊；格內鋸齒位移 + 整排級聯換圖的捲動手感（見 `.claude/library/reel-spin.md`）。
- **符號圖庫**：集中式管理（`ResourceManager` 單例），各 `ReelView` 共用同一圖庫抽圖。
- **下注與顯示**：Balance / Bet / Win 的 UI 呈現與 Bet 的 clamp/step 規則。
- **MCP 可操控性**：場景/節點/元件/資產皆可經 MCP 建立與修改，並能讀磁碟序列化驗證。

## 業務目標

- 建立一套可重複、可信賴的「Claude Code 經 MCP 開發 Cocos」工作流。
- 沉澱可複用的實作知識（`.claude/library/`）與踩坑紀錄（memory），降低重複推導成本。
- 維持拉霸機程式碼的架構清晰度，作為 MCP 工作流成熟度的具體展示。

## 成功指標

- MCP 操作能穩定完成場景/元件/資產變更，並通過「讀磁碟序列化」驗證。
- 拉霸機在 Cocos **Play 模式手動實跑**下行為正確（轉輪手感、停輪對齊、下注顯示）。
- 新功能能依既有 MVC + 集中式設定架構落地，不引入架構破口。

## 非目標

- 非商業發行的完整拉霸機產品（無帳務、無伺服器結算、無多語系/多平台發行需求）。
- 不追求自動化測試覆蓋率（現階段以 Play 模式手動驗證為主，見 `structure.md`）。
