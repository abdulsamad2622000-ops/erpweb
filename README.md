# Laptop ERP - Web (Angular)

Frontend for the inventory-centric laptop/computer ERP (Novastack Hub).

## Stack
Angular 22 (standalone, Signals), PrimeNG, Tailwind v4, NgRx Signals, Transloco (English only; Urdu and RTL were removed), Vitest.

## Commands
- `npm start` : dev server
- `npx ng build` : production build
- `npx ng test --watch=false` : unit tests
- `npx ng lint` : ESLint

## Structure
- `src/app/core` : config, http (interceptors), mock (fixtures), i18n, theme, nav
- `src/app/shared/ui` : reusable UI (page-header, empty/error state, skeleton)
- `src/app/layout` : shell, sidebar, topbar, breadcrumbs
- `src/app/features` : one folder per module (products, users, settings built; the rest are placeholders)

## Mock mode
Default on (`APP_CONFIG.mockDefault`). Override in browser console:
`localStorage.setItem('erp.mock','false')` then reload.
Fixtures live only in `src/app/core/mock/fixtures`.

## Decisions (Step 1)
- Initial bundle warning 700 kB (PrimeNG toast); error limit 1 MB.
- Permission keys in `menu.config.ts` are drafts; backend owns the final list.
- Website module hidden by feature flag.

## Products (Step 6)
Routes (permission in brackets):
- `/products/brands` (`products.brand.view`), `/products/categories` (`products.category.view`, tree)
- `/products/list` (`products.product.view`): list with SKU, name, brand, category path, specs, barcode, retail price, cost price (only with `products.cost.view`), tracking, active
- `/products/list/new` (`products.product.create`) and `/products/list/:id/edit` (`products.product.edit`): form tabs Basics, Specs, Variants, Pricing, Warranty and stock, Images
- `/products/list/import` (`products.product.create`): Excel/CSV import with validation preview

Rules:
- Item types are only Serialized and Batch/Lot. No accessories, bundles or service items.
- A variant has its own SKU. A variant SKU cannot equal the product SKU or another variant SKU.
- No price tier can be lower than the minimum price (floor).
- Cost price is shown and sent only with `products.cost.view`, so an old value is never overwritten.
- Barcodes: no spaces or special characters, and no duplicates between a product and its variants.
- Images: JPG, PNG or WebP, up to 2 MB each, up to 8, exactly one main image.
- Price history (edit page, under the Pricing tab) is recorded on every price change.
- Import: columns SKU, Name, Barcode, Brand, Category, Tracking, Warranty months, Retail price, Wholesale price, Dealer price. Brand and category are matched by name. Rows are saved one by one and failures are listed.

Open questions for the backend:
- Images are sent inside the product JSON (data URLs in mock). An upload endpoint returning URLs is better.
- Price tiers are per product. Ask whether a price per variant is needed.
- Price history endpoint: `GET /products/{id}/history`.
- A bulk import endpoint (frontend sends one `POST /products` per row now).
## PrimeUI license key (required before first run)
PrimeNG 22 needs a PrimeUI key (Community license, up to 4 seats).
1. Copy `src/app/core/config/primeui-license.example.ts` to `src/app/core/config/primeui-license.ts`.
2. Replace `PASTE_YOUR_KEY_HERE` with your own key from PrimeStore (primeui.store).
3. Never commit `primeui-license.ts` (it is gitignored). Never share the key in chats or screenshots.
Without a key the app still runs but shows an "Invalid PrimeUI License" badge.
Community keys are valid for 12 months and need yearly eligibility renewal.