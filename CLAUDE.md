# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

全家便利商店（FamilyMart）店鋪工作日誌系統 — a mobile-first PWA for store operations management. UI is entirely in Traditional Chinese.

## Commands

```bash
npm run dev       # Start dev server (Vite HMR)
npm run build     # TypeScript check + Vite production build
npm run lint      # ESLint
npm run preview   # Preview production build locally
```

No test framework is configured.

## Architecture

### Routing
There is **no React Router**. All navigation is client-side state in `App.tsx` via `useState<Page>`. The `Page` union type (`src/types/index.ts`) is the canonical list of all screens. To add a new page: add to the `Page` union, add a `case` in `renderPage()`, and add to `NAV_PAGES` or `ADMIN_NAV_PAGES` if it needs a nav item.

### Two public (token-gated) entry points — no login required
- `?token=xxx` → renders `<MysteryFormPage>` directly (mystery shopper survey)
- `?sub-token=xxx` → renders `<SubManagerFormPage>` (temp staff access with manager-level permissions)

These are checked at the top of `App.tsx` before any auth state.

### User roles and view split
```
staff / manager / sub-manager  → staff pages  (BottomNav + staffTabs sidebar)
supervisor / admin             → admin pages  (AdminBottomNav + adminTabs sidebar)
```
After login, `supervisor`/`admin` land on `admin-dashboard`; others land on `dashboard`.

### Backend
All data access goes through the single Supabase client at `src/lib/supabase.ts`. There is no API layer — pages call `supabase` directly. The anon key is hardcoded (public project).

### Layout pattern
- Desktop: fixed left sidebar (`w-56`) + scrollable main area (`md:ml-56`)
- Mobile: bottom nav bar + `pb-16` padding on main to avoid overlap
- Brand green: `#00a040` / dark: `#007d30`

### Component conventions
- Pages accept `{ user: User, onBack: () => void }` (or `onNavigate`/`onLogout` for dashboard pages)
- `PageHeader` component is the standard top bar for inner pages
- Animations use `framer-motion` (`motion.div` with `initial/animate/transition`)
- Icons from `lucide-react`
- Styling is Tailwind CSS v4 utility classes; no CSS modules
