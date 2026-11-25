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
- Initial bundle warning 760 kB (PrimeNG toast); error limit 1 MB.
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
## Labels (Step 7)
- `/products/barcodes` (`barcode.label.view`): list of serials, SKUs and bins; pick items, pick a template, print. Scan a serial to find it for reprint.
- `/products/barcodes/templates` (`barcode.label.create`): label template designer with live preview.
- Reprinting a label that was printed before needs the `barcode.label.reprint` permission and a reason (10 characters or more). Every print is saved in the history table.
- Not done yet: PDF output (browser print only).

## Purchase (Step 8)
- `/purchase/suppliers`, `/purchase/orders` (draft, approval, receive), `/purchase/grn` (scan, paste or CSV serials, accept, reject or quarantine, post).
- `/purchase/suppliers/:id/ledger`: running balance (opening balance, goods received, returns, payments).
- `/purchase/payments`: supplier payments. The amount cannot be above what is owed.
- `/purchase/grn/:id/landed-cost`: freight and other costs, shared across items by value. Only after the GRN is posted.
- `/purchase/orders/:id/matching`: compares ordered, received and the supplier invoice (matched, does not match, waiting for invoice, nothing received).
- `/purchase/returns`: return by scanning serials. One supplier per return, reason of 10 characters or more. A serial can be returned once.

Open questions for the backend (Step 8b):
- Paths and shapes of ledger, payments, landed-cost, matching/bill and returns (see `payables.service.ts`).
- Does landed cost go into the supplier ledger, or only into item cost?
- How does stock change on a purchase return (serial status "returned to supplier")?

## Inventory (Step 9)
- `/inventory/stock` (`inventory.stock.view`) and `/inventory/alerts`: stock by model and warehouse, low-stock and aging alerts.
- `/inventory/serials` and `/inventory/serials/:serial` (`inventory.serial.view`): serial list and detail with a history timeline (received, returned, adjusted, reserved, released, put away, transferred out and in).
- `/inventory/locations` (`inventory.location.view`): what is inside each bin. `/inventory/putaway` (`inventory.putaway.create`): scan a bin, then scan the serials to put away.
- `/inventory/ledger` (`inventory.ledger.view`): stock ledger.
- `/inventory/transfers` (`inventory.transfer.view`): request, approve, dispatch, receive, with discrepancy highlight.
- `/inventory/counts` (`inventory.count.view`): stock count sessions with variance review and approval.
- `/inventory/adjustments` (`inventory.adjustment.view`): adjustments with reason and approval.
- `/inventory/reservations` (`inventory.reservation.view`): reservations.

Open questions for the backend (Step 9c):
- `POST /inventory/putaway` with `{ binBarcode, serials[] }`.
- A serial should carry `binId` and `binCode`.
- An endpoint that lists the serials of one bin.
## Scanning app (Step 10)
Phone-first screens under `/scan` (own layout, large touch targets, works at 360px).
- `/scan`: home with tiles (only the ones the user has permission for) and sync status.
- `/scan/putaway` (`inventory.putaway.create`): scan the bin, then scan items. Continuous scan mode.
- `/scan/transfers` and `/scan/transfers/:id` (`inventory.transfer.create`): dispatch and receive by scanning.
- `/scan/counts` and `/scan/counts/:id` (`inventory.count.create`): stock count by scanning.
- `/scan/lookup` (`inventory.serial.view`): quick serial lookup.
- `/scan/sync`: waiting items, failed items and retry.

How it works:
- Camera scanning uses ZXing, with sound and vibration on success or error.
- Installable PWA (Angular service worker, production build only). Install prompt, iOS hint and "new version ready" banner.
- Offline queue in IndexedDB. Each action carries an `Idempotency-Key`, so retrying after a lost connection never doubles a put-away, transfer or count. A sync chip shows waiting, syncing and failed items.
- Last successful `/me` is cached for 7 days, so a refresh with no internet keeps the user signed in. Cleared on logout or 401.
- "No internet" toasts are hidden on `/scan` screens; the sync chip shows the state instead.

Open questions for the backend:
- Idempotency-Key support on put-away, transfer and count endpoints.
- Conflict response (409) shape when a serial changed while the phone was offline.

## Sales (Steps 11 to 13)
- `/sales/quotations`, `/sales/orders`, `/sales/challans`, `/sales/invoices` (`sales.quotation.view`, `sales.order.view`, `sales.challan.view`, `sales.invoice.view`): wholesale flow. A quotation can be sent, edited, cancelled or converted to an order. Prices follow the customer's price tier. Create and edit need `sales.quotation.create` / `sales.quotation.edit` and `sales.order.create`.
- Challans are made from an order by scanning serials (partial delivery is allowed). An invoice is made from the delivered challans.
- `/sales/pos` (`pos.sale.create`): retail counter. Open and close a shift, scan or search items, hold and recall bills, split payment, discount limits per user, walk-in or saved customer.
- `/sales/returns` (`sales.return.view`): sales returns by serial.
- `/customers` (`customers.customer.view`): customers with type, price tier, credit limit and terms. `/customers/:id/ledger` is the ledger and `/customers/aging` is receivable aging.

## Warranty and service (Step 14)
- `/warranty` (`warranty.claim.view`), `/warranty/new` (`warranty.claim.create`) and `/warranty/:id`: repair jobs and warranty claims, including parts taken from stock.

## Reports and dashboard (Step 15)
- `/dashboard` (`dashboard.view.view`): today and month sales, profit, receivable, payable, stock value, open repairs and orders, last 14 days chart, top items.
- `/reports` (`reports.report.view`): tabbed reports with group-by and CSV export, including the profit and loss tab. Cost and profit figures depend on the user's permissions.

## Accounts and email (Step 16)
- `/accounts/expenses` (`accounts.expense.view`): expenses with categories and void. `/accounts/cashbook` (`accounts.cashbook.view`): cash book by payment method.
- `/email` (`email.template.view`): email templates, test send and send log. Mailer status is shown when it is not set up.

## Not built yet
- Website module (Step 17): hidden by the `website` feature flag until the client confirms the platform.
- Urdu and RTL were removed; the app is English only. Ask before adding them back.
- Step 18: Playwright critical flows (login, GRN, transfer, wholesale, POS and return, warranty, cost hidden), responsive audit at 360/768/1280px (`npx playwright test -c playwright.audit.config.ts`) and an axe accessibility scan are done.

## Quality audits (Step 18)
Audits live in `e2e/audit` and use `playwright.audit.config.ts` (long timeout, one worker).
- Accessibility (axe): `npx playwright test -c playwright.audit.config.ts e2e/audit/a11y.audit.ts`
- Responsive (360, 768, 1280 px): `npx playwright test -c playwright.audit.config.ts e2e/audit/responsive.audit.ts` (about 6 minutes)
- Critical flows: `npm run e2e` (login, GRN, transfer, wholesale, POS, warranty, cost hidden for Store Keeper).
- Status: axe and responsive audits pass. Lint, unit tests and production build pass. Initial bundle is under 1 MB.
- Website module (Step 17) is hidden by a feature flag until the client confirms the platform.

## PrimeUI license key (required before first run)
PrimeNG 22 needs a PrimeUI key (Community license, up to 4 seats).
1. Copy `src/app/core/config/primeui-license.example.ts` to `src/app/core/config/primeui-license.ts`.
2. Replace `PASTE_YOUR_KEY_HERE` with your own key from PrimeStore (primeui.store).
3. Never commit `primeui-license.ts` (it is gitignored). Never share the key in chats or screenshots.
Without a key the app still runs but shows an "Invalid PrimeUI License" badge.
Community keys are valid for 12 months and need yearly eligibility renewal.
