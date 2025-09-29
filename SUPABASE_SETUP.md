# Supabase 設置指南

本指南將幫助您將 SHPH 醫療管理系統連接到 Supabase 數據庫。

## 1. 創建 Supabase 項目

1. 訪問 [Supabase](https://supabase.com)
2. 註冊或登錄您的帳戶
3. 點擊 "New Project" 創建新項目
4. 選擇組織和項目名稱
5. 設置數據庫密碼（請記住這個密碼）
6. 選擇地區（建議選擇離您最近的）
7. 點擊 "Create new project"

## 2. 獲取項目憑證

項目創建完成後，您需要獲取以下憑證：

1. 在項目儀表板中，點擊左側菜單的 "Settings"
2. 選擇 "API" 選項卡
3. 複製以下值：
   - **Project URL** (NEXT_PUBLIC_SUPABASE_URL)
   - **anon public** key (NEXT_PUBLIC_SUPABASE_ANON_KEY)

## 3. 設置數據庫

### 方法 1: 使用 SQL 編輯器（推薦）

1. 在 Supabase 儀表板中，點擊左側菜單的 "SQL Editor"
2. 點擊 "New query"
3. 複製 `supabase-schema.sql` 文件的全部內容
4. 粘貼到 SQL 編輯器中
5. 點擊 "Run" 執行 SQL 腳本

### 方法 2: 使用 Supabase CLI

```bash
# 安裝 Supabase CLI
npm install -g supabase

# 初始化項目
supabase init

# 登錄 Supabase
supabase login

# 鏈接到您的項目
supabase link --project-ref your-project-ref

# 推送數據庫架構
supabase db push
```

## 4. 配置環境變量

1. 複製 `env.example` 文件並重命名為 `.env.local`
2. 填入您的 Supabase 憑證：

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

## 5. 設置身份驗證

### 啟用 Email 身份驗證

1. 在 Supabase 儀表板中，點擊 "Authentication"
2. 選擇 "Settings" 選項卡
3. 在 "Auth Providers" 部分，確保 "Email" 已啟用
4. 配置 SMTP 設置（可選，用於發送驗證郵件）

### 設置 Row Level Security (RLS)

數據庫架構已經包含了基本的 RLS 策略，但您可能需要根據具體需求進行調整：

1. 在 Supabase 儀表板中，點擊 "Authentication"
2. 選擇 "Policies" 選項卡
3. 檢查各個表的 RLS 策略是否符合您的需求

## 6. 測試連接

1. 啟動開發服務器：
```bash
pnpm dev
```

2. 訪問 http://localhost:3000
3. 嘗試使用以下測試帳戶登錄：
   - **管理員**: admin@demo.com / admin123
   - **醫生**: doctor@demo.com / doctor123
   - **VHV**: vhv@demo.com / vhv123
   - **患者**: patient@demo.com / patient123

## 7. 數據庫管理

### 查看數據

使用 Supabase 儀表板的 "Table Editor" 查看和管理數據：

1. 點擊左側菜單的 "Table Editor"
2. 選擇要查看的表
3. 您可以查看、編輯、添加或刪除記錄

### 實時功能

Supabase 支持實時數據更新。在您的應用中，您可以訂閱數據庫更改：

```typescript
import { supabase } from './lib/supabase'

// 訂閱患者數據更改
const subscription = supabase
  .channel('patients')
  .on('postgres_changes', 
    { event: '*', schema: 'public', table: 'patients' },
    (payload) => console.log('Change received!', payload)
  )
  .subscribe()
```

## 8. 生產環境部署

### Vercel 部署

1. 在 Vercel 項目設置中添加環境變量：
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`

2. 部署項目：
```bash
vercel --prod
```

### 其他平台

確保在您的部署平台中設置相同的環境變量。

## 9. 故障排除

### 常見問題

1. **連接錯誤**: 檢查環境變量是否正確設置
2. **認證失敗**: 確保 RLS 策略正確配置
3. **數據不顯示**: 檢查用戶權限和 RLS 策略

### 調試

啟用 Supabase 客戶端調試：

```typescript
const supabase = createClient(url, key, {
  auth: {
    debug: true
  }
})
```

### 日誌

在 Supabase 儀表板中查看：
- **Logs**: 查看 API 請求和錯誤
- **Database**: 查看數據庫查詢和性能

## 10. 安全建議

1. **環境變量**: 永遠不要將 Supabase 密鑰提交到版本控制
2. **RLS 策略**: 仔細檢查和測試 Row Level Security 策略
3. **API 密鑰**: 定期輪換 API 密鑰
4. **備份**: 定期備份您的數據庫

## 11. 性能優化

1. **索引**: 確保為常用查詢字段創建索引
2. **查詢優化**: 使用 Supabase 的查詢分析工具
3. **緩存**: 考慮使用 Redis 或其他緩存解決方案
4. **CDN**: 使用 Supabase 的 CDN 進行文件存儲

## 12. 監控

1. **Supabase 儀表板**: 監控數據庫性能和錯誤
2. **日誌**: 設置日誌監控和警報
3. **指標**: 跟踪關鍵業務指標

---

如果您遇到任何問題，請查看 [Supabase 文檔](https://supabase.com/docs) 或聯繫支持團隊。
