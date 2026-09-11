# Runtime 驗證通道：MCP 內建 Runtime Inspector

> 狀態：v2.0.0 單一擴充套件（2026-09-11）；遊戲端事件埋點（`RuntimeReporter`）待做。
> 歷程：2026-09-10 先以獨立 CocosInspector 擴充套件當 transport（`Editor.Message.request('cocos_inspector','runtime-*')`）驗證通過；2026-09-11 整套併入 `cocos-mcp-server/inspector/`，改為同 process 直呼。

## Context（為何做）

`cocos-mcp-server` 原本只能操作／讀回**編輯器狀態**（節點 dump、磁碟 .scene），對 Play/preview 執行結果是盲的：

- `debug_execute_script` 跑在編輯器 scene process（`source/scene.ts`），不是遊戲頁面。
- `debug_get_console_logs` buffer 從未被填入；`broadcast_*` 是模擬；`project_start_preview_server` / `run_project` 硬編碼失敗。
- 所有 Play 驗證都停在「待使用者手動驗」（見 [reel-spin.md](reel-spin.md) 驗證方式）。

Runtime Inspector（原 Cocos Store「Cocos Inspector」的 TS 重寫）是獨立 Electron 視窗，把 preview 遊戲載入 `<webview src="http://localhost:<previewPort>/">`，本來就擁有 runtime 存取能力。現在它住在 `extensions/cocos-mcp-server/inspector/`，同時服務人（節點樹／DevTools 視窗）與 AI（`runtime_*` 工具）。

## 架構

```
Claude ──MCP(http://127.0.0.1:<port>/mcp)──▶ cocos-mcp-server (extension host, 單一 process)
                                              │  RuntimeTools  (source/tools/runtime-tools.ts)
                                              │  getInspector().runtime.*   (source/inspector-host.ts → inspector/dist/main.js)
                                              ▼
                                           inspector/src/main/runtime-api.ts
                                              │  BrowserWindow.webContents 'did-attach-webview' → game guest WebContents
                                              │  guest.executeJavaScript / capturePage / 'console-message'
                                              ▼
                                           preview 遊戲頁面 (window.cc, cc.director.getScene() …)
```

職責切分：**inspector 只做 transport**（status / open / eval / capture / console），
**工具語意**（節點快照、等待條件、事件契約、安全序列化）全在 `RuntimeTools`。

## 檔案地圖（`extensions/cocos-mcp-server`）

| 檔案 | 內容 |
|---|---|
| `inspector/src/main/runtime-api.ts` | 追蹤遊戲 guest（URL `^https?:`；devtools guest 忽略）、console ring buffer（500 筆、遞增 `seq`）、`evalInGame` / `capture` / `readConsole` / `waitForGameReady`；全部回 `{ ok:false, error }` 不 throw |
| `inspector/src/main/main.ts` | `load/unload/methods`（4 個選單 method）+ **`runtime`** 物件（status / open / eval / capture / console / clearConsole）供 host 直呼 |
| `inspector/src/main/window.ts` | `openInspector( mode )` 可 await（等遊戲頁 load，15 s）；`additionalArguments` 把設定檔路徑傳給 renderer |
| `inspector/src/main/config.ts` | 設定檔：`<project>/settings/cocos-inspector.json` → 舊 `extensions/cocos-inspector-config.json` → 內建 `config.json` |
| `inspector/build.js` | esbuild 5 個 bundle（main / mainPreload / gamePreload：cjs；renderer / injected：iife）；`absWorkingDir = __dirname`、版本讀 host `package.json` |
| `source/inspector-host.ts` | `getInspector()`：動態 `require('../inspector/dist/main.js')`，型別在 `source/types/inspector.ts` |
| `source/tools/runtime-tools.ts` | `RuntimeTools`（10 個工具）；註冊於 `mcp-server.ts initializeTools()` |
| `source/main.ts` | `load()` 先 `getInspector().load()` 再啟 server；`methods` 併入 `previewMode` 等 4 個 |

建置：`npm run build`（= `tsc && node inspector/build.js`）；`npm run typecheck:inspector`。`dist/`、`inspector/dist/`、`package.json` 變更**需重啟編輯器**（Extension Manager 重載常因 require cache 不生效）。

## 工具

| 工具 | 參數 | 說明 |
|---|---|---|
| `runtime_get_status` | — | `windowOpen / gameReady / gameUrl / previewPort / consoleSeq` |
| `runtime_open_inspector` | `mode?` = preview \| buildMobile \| buildDesktop \| custom | 開視窗、等頁面 load、再等 `cc.director.getScene()` 存在（`sceneReady:true`）——等同播放 preview |
| `runtime_eval` | `code` | 在遊戲頁執行 JS；單一表達式自動 return，多句／以語句關鍵字開頭者需自己 `return` |
| `runtime_get_node_snapshot` | `target, includePrivate?` | `cc.find(path)` 找不到則以 name BFS；回 transform / active / children / components props |
| `runtime_get_console_logs` | `sinceSeq?, level?` | 遊戲頁 console（含 `cc.log`，probe 會轉到 console） |
| `runtime_clear_console_logs` | — | |
| `runtime_capture_screenshot` | `outPath?` | 預設 `temp/mcp-runtime/<ts>.png`；`tools/call` 回應附 image content |
| `runtime_wait_for_condition` | `expression, timeoutMs?` | 每 100ms 輪詢至 truthy |
| `runtime_get_events` | `sinceSeq?, name?` | 讀 `window.__mcpEvents` |
| `runtime_wait_for_event` | `name, sinceSeq?, timeoutMs?` | 輪詢 `__mcpEvents` |

### `window.__mcpEvents` 契約（遊戲端待實作）

遊戲腳本 push `{ seq: number(遞增), t: Date.now(), name: string, payload?: any }` 到 `globalThis.__mcpEvents`（陣列，自行建立、建議上限 200 筆）。
規劃：`assets/scripts/debug/RuntimeReporter.ts` 靜態 `emit( name, payload )`；`GameController` 於 `spinAll()` 發 `spin.start`、全部 idle 時發 `spin.end`；`ReelView` 停輪經 controller 發 `reel.stop { reelIndex, symbols }`。契約與遊戲類型無關（補魚機／RPG 換事件名即可）。

## 關鍵機制／踩坑

- **回傳值必須 structured-cloneable**：`cc.Node` 有循環參照。`RuntimeTools` 把使用者程式碼包進 `__mcpSafe`（深度 6、陣列 100、`instanceof cc.Node/Component/Asset` 縮為 `{ __type, name, uuid }`、`{x,y,z}` 保留）。曾用「有 name+uuid 欄位」鴨子判斷，連快照本身都被縮掉——要用 `instanceof`。
- **頁面 load 完 ≠ 引擎就緒**：`did-finish-load` 後 `cc.director.getScene()` 仍可能是 null（`no running scene`）；`open_inspector` 因此多等一段 `sceneReady`。
- **視窗必須開著**：webview 只在 inspector 視窗存在時存在；關窗後所有 runtime 工具回 `inspector window not open`。
- **minimized 會截到黑圖**：`capture()` 前會 `restore()/show()`。
- **Preview server 不需按 Play**：Creator 3.8 編輯器開著就跑（port 由 `server:query-port` 取得，本機為 7458）；webview 載入即播放。
- **ipcMain channel 前綴**是 `cocos-mcp-server:*`（`inspector/src/shared/protocol.ts PKG_NAME`），host 本身不註冊 ipcMain，無碰撞。
- **renderer 沒有 `Editor` 全域**：設定檔路徑靠 `webPreferences.additionalArguments` 的 `--inspector-config=` 傳入 preload。
- **root `tsconfig.json` 必須 `include: ["source/**/*"]`**，否則 `tsc` 會把 `inspector/src` 掃進來報 rootDir 錯（且會在 `inspector/src` 旁邊噴出 `.js`）。
- **預覽畫面被裁切／放大**（2026-09-11 修）：兩個原因疊加——(1) 檢查器遊戲視圖尺寸來自使用者選的模擬裝置尺寸（舊設定 `size:[423,677]`），與設計解析度 960×640 比例不合，Fit Width 下上下被切；→ 新增 `matchDesign`（預設 true）讓視圖自動等於專案 `designResolution`（main 讀 `settings/v2/packages/project.json`，以 `--design-size=` 傳給 renderer），解析度選單首項「Design 960x640」。(2) 視圖 resize 後 Canvas 節點有重新對齊，但 **UI 相機 `orthoHeight` 停在舊值**（296 而非 320）→ 畫面放大 1.08×、上下各切 ~24 單位；→ probe 的 `refreshDesignResolution()` 補 `refreshCanvasCameras()`：把每個 `cc.Canvas.cameraComponent.orthoHeight` 設為 `visibleSize.height/2`。診斷手法：`runtime_eval` 讀 `cc.view.getVisibleSize()`、`Canvas.position`、`cameraComponent.orthoHeight` 三者比對。

## 實測紀錄

### 2026-09-10（獨立 CocosInspector 當 transport，全部通過）

| # | 檢查 | 結果 |
|---|---|---|
| 1 | `tools/list` 出現 10 個 `runtime_*` | ✅ |
| 2 | 關窗狀態 `runtime_open_inspector` | ✅ `gameReady:true, sceneReady:true, gameUrl:http://localhost:7458/` |
| 3 | `runtime_eval` 讀場景階層／元件類名 | ✅ |
| 4 | eval 觸發 `GameController.spinAll()` → `runtime_wait_for_condition`（三輪 `isIdle()`） | ✅ 2348 ms 命中 |
| 5 | `runtime_capture_screenshot` | ✅ 759×474 PNG，回應含 image content，可見轉動中轉輪 |
| 6 | `runtime_get_console_logs`（`console.warn` / `cc.log` / `console.log`） | ✅ warning/info/info；引擎啟動 log 也在 |
| 7 | 遊戲內 throw（含裸 `throw` 語句） | ✅ `success:false` + 真實 stack |
| 8 | `runtime_get_node_snapshot Reel_1 includePrivate` | ✅ `_currentSpeed:0 / _stepAccurate:0 / _remainingSteps:-1` |
| 9 | `runtime_get_events` / `wait_for_event` | ✅ 空陣列／乾淨 timeout（遊戲端未埋點） |
| 10 | 關窗後任何 runtime 工具 | ✅ `inspector window not open` |

### 2026-09-11（v2.0.0 單一擴充套件，全部通過）

| # | 檢查 | 結果 |
|---|---|---|
| 1 | 重啟編輯器、不按任何按鈕 | ✅ 11:00:40 `Cocos MCP Server extension loaded` → `[cocos-inspector] main loaded (v2.0.0)` → `HTTP server started on :1000`；`settings/mcp-server.json` 與 `.mcp.json` 同步 |
| 2 | `GET /health` | ✅ `{ tools:167, port:1000, project:{ name:MCPCocosDemo, path:D:\MCPCocosDemo, uuid } }` |
| 3 | `runtime_open_inspector`（關窗狀態） | ✅ `gameReady / sceneReady: true`，`http://localhost:7458/` |
| 4 | eval `spinAll()` → screenshot → `wait_for_condition` 三輪 idle | ✅ 2961 ms 命中；PNG 759×474 附 image content |
| 5 | `get_node_snapshot Reel_1 includePrivate` | ✅ props 完整（深度 6）：`_currentSpeed:0 / _remainingSteps:0 / _stepAccurate:0` |
| 6 | console（warn 過濾）、裸 `throw`、`get_events` | ✅ / ✅ 真實 stack / ✅ 空 |
| 7 | `disabledTools` 黑名單 | ✅ `update-settings {disabledTools:['validation_format_mcp_request']}` → `tools/list` 166 且該工具消失；還原後 167（server 在 process 內重啟，port 不變） |
| 8 | `npm run pack` | ✅ 輸出含 `inspector/{index.html,dist,config.json,…}`，不含 `inspector/src`、`build.js`、`tsconfig.json`、`esbuild`；35 MB |

| 9 | 關窗後 runtime 工具 | ✅ `inspector window not open` |
| 10 | 預覽裁切修正（重開視窗自動生效） | ✅ 視圖 961×640、`visibleSize` 960×639.3、`Canvas.position` (480,320)、`orthoHeight` 319.67；截圖 1076×717 完整含底部 UI |

備註：`Editor.Message.request('cocos-mcp-server','update-settings', partial)` 可從 `debug_execute_script` 內呼叫來改設定並在 process 內重啟 server，不需重啟編輯器。renderer／probe bundle（`renderer.js`、`injected.js`、preload）只需重開檢查器視窗即載入新版；`inspector/dist/main.js` 才需重啟編輯器。
