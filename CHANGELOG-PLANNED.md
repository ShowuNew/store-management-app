# 修改列表 — 店鋪工作日誌

> 建立日期：2026-03-27

---

## 1. 小店長連結（臨時人員免登入入口）

### 需求說明
**店長**可從系統中產生一組限時連結，將連結傳給**臨時人員（小店長）**。
臨時人員點開連結後，**不需登入**，直接進入「每日確認（店鋪工作日誌）」頁面進行填寫。
機制與神秘客連結完全相同（token URL）。

### 運作流程
```
店長 → 系統產生 token → /?sub-token=xxxx
臨時人員點開連結 → 直接進入 DailyWorkPage → 填寫完成儲存
```

### 修改範圍

#### `src/App.tsx`
- 新增偵測 URL 參數 `sub-token`（類似現有 `token` 給神秘客）：
  ```ts
  const SUB_TOKEN = new URLSearchParams(window.location.search).get('sub-token')
  ```
- 若有 `sub-token`，不需登入，直接渲染 `<SubManagerFormPage token={SUB_TOKEN} />`

#### `src/pages/SubManagerFormPage.tsx`（新建）
- 載入時向 Supabase 驗證 `sub_manager_sessions` token 是否有效（未過期、未使用完）
- 若無效 → 顯示「連結已失效」提示
- 若有效 → 直接渲染工作日誌填寫表單（複用 DailyWorkPage 的表單邏輯）
- 顯示門市名稱，讓臨時人員確認是正確的門市

#### `src/pages/DashboardPage.tsx`（店長首頁）
- 在店長（`role === 'manager'`）首頁新增「產生小店長連結」入口按鈕
- 點開後彈出 Modal 或跳至獨立頁面

#### `src/pages/SubManagerManagePage.tsx`（新建）或 Modal
- 功能與 `MysteryManagePage` 類似：
  - 輸入連結有效期（1天 / 3天 / 7天）
  - 按下「產生連結」→ 寫入 Supabase `sub_manager_sessions`，顯示完整 URL
  - 一鍵複製連結
  - 查看歷史連結（狀態：待使用 / 已填寫 / 已過期）

#### Supabase（`sub_manager_sessions` 資料表）
```sql
id           uuid primary key default gen_random_uuid()
token        text unique not null
store_id     text not null
store_name   text
created_by   text              -- 產生連結的店長名稱
expires_at   timestamptz not null
status       text default 'pending'  -- pending / completed / expired
created_at   timestamptz default now()
```

#### `src/types/index.ts`
- `Page` 新增 `'sub-manager-manage'`（若做獨立頁面）

---

## 2. 溫度填寫預設值 / 帶出上一次資料

### 需求說明
在「每日確認（DailyWorkPage）」的溫度欄位中，自動帶出**同一門市最近一筆紀錄的溫度值**作為預設值，讓人員確認後再儲存，減少重複輸入。

### 修改範圍

#### `src/pages/DailyWorkPage.tsx`
- 在頁面載入時（`useEffect`）從 Supabase 查詢同門市最新一筆溫度紀錄：
  ```ts
  const { data } = await supabase
    .from('daily_work_records')
    .select('temperatures')
    .eq('store_id', user.storeId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()
  ```
- 若有資料，將各溫度欄位的初始值設為上一筆的值
- 若無資料，保留空白
- 溫度欄位旁顯示灰色小字提示：`「帶入上次值」`

---

## 3. 咖啡自檢模組

### 需求說明
根據咖啡機列印的**自檢明細收據**（coffee.png），新增咖啡機自主檢查表單。
收據內容為機器自動量測結果，人員需手動輸入數值並確認是否正常。

### 自檢項目（依 coffee.png）

收據格式：
```
自檢機號：02
中熱套式  溫度(度)：77.8°C  正常/異常
         重量(克)：311.9g  正常/異常
中熱拿鐵  溫度(度)：67.8°C  正常/異常
         重量(克)：289.1g  正常/異常
本次自檢無異常 / 本次自檢有異常
```

### 表單欄位設計

| 欄位 | 輸入類型 | 說明 |
|------|---------|------|
| 自檢機號 | 文字輸入 | 例如：02 |
| 中熱套式 — 溫度 | 數字輸入 (°C) | 正常範圍參考：~77°C |
| 中熱套式 — 溫度狀態 | 正常 / 異常 切換 | |
| 中熱套式 — 重量 | 數字輸入 (g) | 正常範圍參考：~311g |
| 中熱套式 — 重量狀態 | 正常 / 異常 切換 | |
| 中熱拿鐵 — 溫度 | 數字輸入 (°C) | 正常範圍參考：~67°C |
| 中熱拿鐵 — 溫度狀態 | 正常 / 異常 切換 | |
| 中熱拿鐵 — 重量 | 數字輸入 (g) | 正常範圍參考：~289g |
| 中熱拿鐵 — 重量狀態 | 正常 / 異常 切換 | |
| 整體結論 | 自動判斷（全正常則顯示「本次自檢無異常」） | |
| 備註 | 文字輸入（選填） | 異常時填寫說明 |

### 修改範圍

#### `src/types/index.ts`
- `Page` 新增 `'coffee-check'`

#### `src/App.tsx`
- 引入 `CoffeeCheckPage`
- `staffTabs` 新增 tab（使用 lucide-react `Coffee` icon）
- `NAV_PAGES` 新增 `'coffee-check'`
- `renderPage` 新增 case

#### `src/pages/CoffeeCheckPage.tsx`（新建）
- 仿照 DailyWorkPage 的 UI 風格
- 頁面頂部顯示咖啡圖示（Coffee icon）
- 輸入完成後儲存至 Supabase `coffee_check_records`

#### Supabase（`coffee_check_records` 資料表）
```sql
id              uuid primary key default gen_random_uuid()
store_id        text not null
store_name      text
staff_name      text
check_date      date not null
machine_no      text
medium_hot_set_temp    float8
medium_hot_set_temp_ok boolean
medium_hot_set_weight  float8
medium_hot_set_weight_ok boolean
medium_latte_temp      float8
medium_latte_temp_ok   boolean
medium_latte_weight    float8
medium_latte_weight_ok boolean
overall_ok      boolean
note            text
gps_lat         float8
gps_lng         float8
gps_accuracy    float8
created_at      timestamptz default now()
```

---

## 4. GPS 功能

### 需求說明
在相關表單儲存時，自動取得 GPS 座標並記錄，驗證紀錄是否在門市現場填寫。

### 通用 Hook：`src/hooks/useGeolocation.ts`（新建）
```ts
import { useState, useCallback } from 'react'

export interface GeoPosition {
  lat: number
  lng: number
  accuracy: number  // 精度（公尺）
}

export function useGeolocation() {
  const [position, setPosition] = useState<GeoPosition | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const getPosition = useCallback((): Promise<GeoPosition> => {
    return new Promise((resolve, reject) => {
      setLoading(true)
      setError(null)
      if (!navigator.geolocation) {
        const msg = '此裝置不支援 GPS'
        setError(msg); setLoading(false); reject(new Error(msg)); return
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const geo = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }
          setPosition(geo); setLoading(false); resolve(geo)
        },
        (err) => {
          const msg = err.code === 1 ? '已拒絕位置存取授權' : 'GPS 定位失敗'
          setError(msg); setLoading(false); reject(new Error(msg))
        },
        { timeout: 10000, enableHighAccuracy: true }
      )
    })
  }, [])

  return { position, error, loading, getPosition }
}
```

### 整合範圍

| 頁面 | Supabase 資料表 |
|------|----------------|
| `DailyWorkPage` | `daily_work_records` |
| `CoffeeCheckPage` | `coffee_check_records` |
| `SubManagerFormPage` | `daily_work_records`（或同表標記來源） |
| `AnomalyPage` | `anomaly_reports` |

### Supabase — 現有資料表新增欄位
```sql
ALTER TABLE daily_work_records ADD COLUMN gps_lat float8;
ALTER TABLE daily_work_records ADD COLUMN gps_lng float8;
ALTER TABLE daily_work_records ADD COLUMN gps_accuracy float8;

ALTER TABLE anomaly_reports    ADD COLUMN gps_lat float8;
ALTER TABLE anomaly_reports    ADD COLUMN gps_lng float8;
ALTER TABLE anomaly_reports    ADD COLUMN gps_accuracy float8;
```

### UI 說明
- 儲存按鈕點擊後先取得 GPS，再送出資料
- GPS 失敗 → 顯示警示但**仍允許儲存**，欄位記為 `null`
- 成功後提示：`定位成功 (精度 ±XX 公尺)`
- Admin 後台紀錄可顯示 GPS 座標，可連結 Google Maps

---

## 優先實作順序

| 優先度 | 項目 | 難度 |
|--------|------|------|
| P0 | 1. 小店長連結（token URL） | 中 |
| P0 | 2. 溫度預設值 | 低 |
| P1 | 3. 咖啡自檢頁面 | 中 |
| P1 | 4. GPS Hook | 低 |
| P2 | 4. GPS 整合各頁面 | 中 |
