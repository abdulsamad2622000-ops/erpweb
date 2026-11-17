# Laptop ERP - Web (Angular)

Frontend for the inventory-centric laptop/computer ERP (Novastack Hub).

## Stack
Angular 22 (standalone, Signals), PrimeNG, Tailwind v4, NgRx Signals, Transloco (EN/UR, RTL), Vitest.

## Commands
- `npm start` : dev server
- `npx ng build` : production build
- `npx ng test --watch=false` : unit tests
- `npx ng lint` : ESLint

## Structure
- `src/app/core` : config, http (interceptors), mock (fixtures), i18n, theme, nav
- `src/app/shared/ui` : reusable UI (page-header, empty/error state, skeleton)
- `src/app/layout` : shell, sidebar, topbar, breadcrumbs
- `src/app/features` : one folder per module (placeholders for now)

## Mock mode
Default on (`APP_CONFIG.mockDefault`). Override in browser console:
`localStorage.setItem('erp.mock','false')` then reload.
Fixtures live only in `src/app/core/mock/fixtures`.

## Decisions (Step 1)
- Initial bundle warning 700 kB (PrimeNG toast); error limit 1 MB.
- Permission keys in `menu.config.ts` are drafts; backend owns the final list.
- Website module hidden by feature flag.
## PrimeUI license key (required before first run)
PrimeNG 22 needs a PrimeUI key (Community license, up to 4 seats).
1. Copy `src/app/core/config/primeui-license.example.ts` to `src/app/core/config/primeui-license.ts`.
2. Replace `PASTE_YOUR_KEY_HERE` with your own key from PrimeStore (primeui.store).
3. Never commit `primeui-license.ts` (it is gitignored). Never share the key in chats or screenshots.
Without a key the app still runs but shows an "Invalid PrimeUI License" badge.
Community keys are valid for 12 months and need yearly eligibility renewal.