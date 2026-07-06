# TypeScript Code Standards (TypeScript 程式碼標準)

此文件定義了團隊的 TypeScript 程式碼標準與重要準則，適用於所有 TypeScript 相關的程式碼審查與開發工作。

## Core Principles (重要原則)

### 設計原則
* **單一責任原則 (Single Responsibility Principle)**：每個 Class 或 Function 應該只有一個明確的責任。
* **耦合度 (Coupling)**：盡量降低模組之間的依賴關係，使其更容易維護和測試。
* **內聚力 (Cohesion)**：確保模組內部的元素緊密相關，以提高模組的可理解性和可重用性。
* **避免過度設計 (Avoid Over-Engineering)**：設計時須考量未來可能的擴充方向，預留適當的擴展空間（scale），以避免日後大規模重構。重點在於「適當」——不過度堆疊用不到的抽象與設定，也不為求短期簡潔而犧牲合理的延展性，在兩者間取得平衡。

### 程式碼品質
* **可讀性 (Readability)**：確保程式碼清晰易懂。
* **命名規範 (Naming Conventions)**：確保變數、函數和類的命名清晰且具有描述性，而且內容要與其功能相符。
* **Magic Number**：避免在程式碼中使用未解釋的數字，應該使用具名常數來提高可讀性。
* **重複代碼 (Code Duplication)**：識別並消除重複的程式碼，建議抽象出共用的函數或模組。

### 健壯性與安全性
* **安全性 (Security)**：檢查是否存在安全漏洞。
* **錯誤處理 (Error Handling)**：確保程式碼中有適當的錯誤處理機制，避免未捕獲的異常導致應用崩潰。
* **性能優化 (Performance)**：識別性能瓶頸，提供優化建議。

## Team Code Style (團隊程式碼風格)

### 空格規範
* `( condition )`：括號內統一加上空格
* `array[ index ]`：方括號內統一加上空格
* `function( arg1, arg2 )`：函數括號內統一加上空格
* `index as TokenType`：as 關鍵字前後統一加上空格

### 全域型別 (Global Types)
下列型別為專案層級全域宣告，**無需 import**，可直接在任何 TypeScript 檔案中使用：
* `BigNumber`：大數值型別，已於專案 `tsconfig` / 全域型別檔中配置，Review 時看到 `BigNumber` 未 import 為正常現象。
  
### 範例
```typescript
// 正確
if ( condition ) {
	const value = array[ index ];
	myFunction( arg1, arg2 );
	const type = index as TokenType;
}

// 錯誤
if (condition) {
	const value = array[index];
	myFunction(arg1, arg2);
	const type = index as TokenType;
}
```

## 檢查清單 (Review Checklist)

- [ ] 遵循單一責任原則
- [ ] 降低模組間耦合度
- [ ] 提高模組內聚力
- [ ] 避免過度設計（預留適當擴展空間，於延展性與簡潔間取得平衡）
- [ ] 無安全漏洞
- [ ] 適當的錯誤處理
- [ ] 無性能瓶頸
- [ ] 程式碼清晰易懂
- [ ] 無 Magic Number
- [ ] 無重複代碼
- [ ] 命名清晰且具描述性
- [ ] 遵循團隊空格規範
- [ ] 遵循亂數使用規則（Framework 層禁止 Math.random()）

---

**最後更新**: 2026年6月24日
**版本**: 1.3.0
