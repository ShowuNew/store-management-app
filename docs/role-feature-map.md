# 角色 × 功能 對應表

## 角色說明

| 角色 | 中文名稱 | 登入方式 | 登入後首頁 |
|------|---------|---------|-----------|
| `staff` | 店員 | 登入頁 | `dashboard` |
| `manager` | 店長 | 登入頁 | `dashboard` |
| `sub-manager` | 小店長 | `?sub-token=xxx` URL（無需登入） | `dashboard` |
| `supervisor` | 擔當 | 登入頁 | `admin-dashboard` |
| `admin` | 系統管理員 | 登入頁 | `admin-dashboard` |

---

## 功能權限總表

| 功能頁面 | staff 店員 | manager 店長 | sub-manager 小店長 | supervisor 擔當 | admin 管理員 |
|---------|:---------:|:------------:|:-----------------:|:--------------:|:------------:|
| `dashboard` 員工首頁 | ✅ | ✅ | ✅ | — | — |
| `daily-work` 每日工作確認 | ✅ | ✅ | ✅ | — | — |
| `hygiene` 衛生自主管理 | ✅ | ✅ | ✅ | — | — |
| `inspection` 店鋪點檢 | ✅ | ✅ | ✅ | — | — |
| `anomaly` 異常回報 | ✅ | ✅ | ✅ | — | — |
| `equipment` 設備清潔保養 | ✅ | ✅ | ✅ | — | — |
| `coffee-check` 咖啡機自檢 | ✅ | ✅ | ✅ | — | — |
| `stats` 月報統計 | ✅ | ✅ | ✅ | — | — |
| `sub-manager-manage` 小店長連結 | — | ✅ | — | — | — |
| `admin-dashboard` 管理總覽 | — | — | — | ✅ | ✅ |
| `admin-store-status` 店鋪狀況 | — | — | — | ✅ | ✅ |
| `admin-records` 紀錄查閱 | — | — | — | ✅ | ✅ |
| `admin-anomaly` 異常管理 | — | — | — | ✅ | ✅ |
| `admin-stats` 數據統計 | — | — | — | ✅ | ✅ |
| `mystery-manage` 神秘客稽查 | — | — | — | ✅ | ✅ |

---

## 現有問題（待修）

| # | 問題 | 修法 |
|---|------|------|
| 1 | `sub-manager-manage` 無 role guard，任何員工角色都能進 | `renderPage()` 加判斷，非 `manager` → 轉回 `dashboard` |
| 2 | `mystery-manage` 在 `adminTabs`（桌機 sidebar）和 `AdminBottomNav`（手機）都沒有導覽入口 | `adminTabs` 新增神秘客項目、`AdminBottomNav` 新增一項 |
| 3 | `stats` 月報在桌機 sidebar 有入口，手機 `BottomNav` 沒有 | `BottomNav` 新增月報（第 6 項）|
