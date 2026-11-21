<?php

use App\Http\Controllers\Api\InventoryController;
use App\Http\Controllers\Api\LabelsController;
use App\Http\Controllers\Api\PayablesController;
use App\Http\Controllers\Api\AccountsController;
use App\Http\Controllers\Api\CustomerLedgerController;
use App\Http\Controllers\Api\EmailController;
use App\Http\Controllers\Api\PosController;
use App\Http\Controllers\Api\RepairController;
use App\Http\Controllers\Api\ReportsController;
use App\Http\Controllers\Api\WholesaleController;
use App\Http\Controllers\Api\PurchaseController;
use App\Http\Controllers\Api\StockControlController;
use Illuminate\Support\Facades\Route;

// Purchase (Step 8), inventory (Step 9), labels (Step 7). api.php ke v1 group mein require hota hai.
Route::middleware('auth:sanctum')->group(function () {
    $p = fn (string $key) => 'permission:'.$key;

    // Suppliers
    Route::get('purchase/suppliers', [PurchaseController::class, 'suppliers'])->middleware($p('purchase.supplier.view'));
    Route::post('purchase/suppliers', [PurchaseController::class, 'storeSupplier'])->middleware($p('purchase.supplier.create'));
    Route::put('purchase/suppliers/{supplier}', [PurchaseController::class, 'updateSupplier'])->middleware($p('purchase.supplier.edit'));
    Route::delete('purchase/suppliers/{supplier}', [PurchaseController::class, 'destroySupplier'])->middleware($p('purchase.supplier.edit'));
    Route::get('purchase/suppliers/{supplier}/ledger', [PayablesController::class, 'ledger'])->middleware($p('purchase.payment.view'));

    // Purchase orders
    Route::get('purchase/orders', [PurchaseController::class, 'orders'])->middleware($p('purchase.order.view'));
    Route::get('purchase/orders/{order}', [PurchaseController::class, 'order'])->middleware($p('purchase.order.view'));
    Route::post('purchase/orders', [PurchaseController::class, 'storeOrder'])->middleware($p('purchase.order.create'));
    Route::put('purchase/orders/{order}', [PurchaseController::class, 'updateOrder'])->middleware($p('purchase.order.edit'));
    foreach (['submit' => 'purchase.order.edit', 'cancel' => 'purchase.order.edit', 'approve' => 'purchase.order.approve', 'reject' => 'purchase.order.approve'] as $a => $perm) {
        Route::post("purchase/orders/{order}/{$a}", [PurchaseController::class, 'orderAction'])->defaults('action', $a)->middleware($p($perm));
    }
    Route::get('purchase/orders/{order}/matching', [PayablesController::class, 'matching'])->middleware($p('purchase.order.view'));
    Route::post('purchase/orders/{order}/bill', [PayablesController::class, 'saveBill'])->middleware($p('purchase.payment.create'));

    // GRN
    Route::get('purchase/grns', [PurchaseController::class, 'grns'])->middleware($p('purchase.grn.view'));
    Route::get('purchase/grns/{grn}', [PurchaseController::class, 'grn'])->middleware($p('purchase.grn.view'));
    Route::post('purchase/grns', [PurchaseController::class, 'storeGrn'])->middleware($p('purchase.grn.create'));
    Route::put('purchase/grns/{grn}', [PurchaseController::class, 'saveGrn'])->middleware($p('purchase.grn.create'));
    Route::post('purchase/grns/{grn}/post', [PurchaseController::class, 'postGrn'])->middleware($p('purchase.grn.create'));
    Route::get('purchase/grns/{grn}/landed-cost', [PayablesController::class, 'landedCost'])->middleware($p('purchase.grn.view'));
    Route::put('purchase/grns/{grn}/landed-cost', [PayablesController::class, 'saveLandedCost'])->middleware($p('purchase.grn.create'));
    Route::post('purchase/serials/check', [PurchaseController::class, 'checkSerial'])->middleware($p('purchase.grn.create'));

    // Payments, returns
    Route::get('purchase/payments', [PayablesController::class, 'payments'])->middleware($p('purchase.payment.view'));
    Route::post('purchase/payments', [PayablesController::class, 'storePayment'])->middleware($p('purchase.payment.create'));
    Route::get('purchase/returns', [PayablesController::class, 'returns'])->middleware($p('purchase.return.view'));
    Route::get('purchase/returns/serial/{serial}', [PayablesController::class, 'returnableSerial'])->middleware($p('purchase.return.create'));
    Route::post('purchase/returns', [PayablesController::class, 'storeReturn'])->middleware($p('purchase.return.create'));

    // Inventory
    Route::get('inventory/stock', [InventoryController::class, 'stock'])->middleware($p('inventory.stock.view'));
    Route::get('inventory/serials', [InventoryController::class, 'serials'])->middleware($p('inventory.serial.view'));
    Route::get('inventory/serials/{serial}', [InventoryController::class, 'serial'])->middleware($p('inventory.serial.view'));
    Route::get('inventory/ledger', [InventoryController::class, 'ledger'])->middleware($p('inventory.ledger.view'));
    Route::get('inventory/transfers', [InventoryController::class, 'transfers'])->middleware($p('inventory.transfer.view'));
    Route::get('inventory/transfers/{transfer}', [InventoryController::class, 'transfer'])->middleware($p('inventory.transfer.view'));
    Route::post('inventory/transfers', [InventoryController::class, 'storeTransfer'])->middleware($p('inventory.transfer.create'));
    foreach (['dispatch' => 'inventory.transfer.create', 'receive' => 'inventory.transfer.create', 'cancel' => 'inventory.transfer.create',
        'approve' => 'inventory.transfer.approve', 'reject' => 'inventory.transfer.approve'] as $a => $perm) {
        Route::post("inventory/transfers/{transfer}/{$a}", [InventoryController::class, 'transferAction'])->defaults('action', $a)->middleware([$p($perm), 'idempotent']);
    }

    Route::post('inventory/putaway', [InventoryController::class, 'putaway'])->middleware([$p('inventory.putaway.create'), 'idempotent']);

    // Counts, adjustments, reservations (Step 9b)
    Route::get('inventory/counts', [StockControlController::class, 'counts'])->middleware($p('inventory.count.view'));
    Route::get('inventory/counts/{id}', [StockControlController::class, 'count'])->whereNumber('id')->middleware($p('inventory.count.view'));
    Route::post('inventory/counts', [StockControlController::class, 'storeCount'])->middleware($p('inventory.count.create'));
    foreach (['submit' => 'inventory.count.create', 'approve' => 'inventory.count.approve', 'reject' => 'inventory.count.approve'] as $a => $perm) {
        Route::post("inventory/counts/{id}/{$a}", [StockControlController::class, 'countAction'])->whereNumber('id')->defaults('action', $a)->middleware([$p($perm), 'idempotent']);
    }
    Route::get('inventory/adjustments', [StockControlController::class, 'adjustments'])->middleware($p('inventory.adjustment.view'));
    Route::get('inventory/adjustments/{id}', [StockControlController::class, 'adjustment'])->whereNumber('id')->middleware($p('inventory.adjustment.view'));
    Route::post('inventory/adjustments', [StockControlController::class, 'storeAdjustment'])->middleware($p('inventory.adjustment.create'));
    foreach (['approve', 'reject'] as $a) {
        Route::post("inventory/adjustments/{id}/{$a}", [StockControlController::class, 'adjustmentAction'])->whereNumber('id')->defaults('action', $a)->middleware($p('inventory.adjustment.approve'));
    }
    Route::get('inventory/reservations', [StockControlController::class, 'reservations'])->middleware($p('inventory.reservation.view'));
    Route::get('inventory/reservations/{id}', [StockControlController::class, 'reservation'])->whereNumber('id')->middleware($p('inventory.reservation.view'));
    Route::post('inventory/reservations', [StockControlController::class, 'storeReservation'])->middleware($p('inventory.reservation.create'));
    Route::post('inventory/reservations/{id}/release', [StockControlController::class, 'releaseReservation'])->whereNumber('id')->middleware($p('inventory.reservation.create'));

    // Labels
    Route::get('labels/templates', [LabelsController::class, 'templates'])->middleware($p('barcode.label.view'));
    Route::post('labels/templates', [LabelsController::class, 'storeTemplate'])->middleware($p('barcode.label.create'));
    Route::put('labels/templates/{template}', [LabelsController::class, 'updateTemplate'])->middleware($p('barcode.label.create'));
    Route::get('labels/items', [LabelsController::class, 'items'])->middleware($p('barcode.label.view'));
    Route::get('labels/lookup/{code}', [LabelsController::class, 'lookup'])->middleware($p('barcode.label.view'));
    Route::get('labels/grns', [LabelsController::class, 'grns'])->middleware($p('barcode.label.view'));
    Route::get('labels/print-log', [LabelsController::class, 'log'])->middleware($p('barcode.label.view'));
    Route::post('labels/print-log', [LabelsController::class, 'record'])->middleware($p('barcode.label.print'));

    // Retail POS (Step 12)
    $sale = $p('pos.sale.create');
    Route::get('pos/shift', [PosController::class, 'shift'])->middleware($sale);
    Route::post('pos/shift/open', [PosController::class, 'openShiftAction'])->middleware($sale);
    Route::post('pos/shift/close', [PosController::class, 'closeShift'])->middleware($sale);
    Route::get('pos/scan/{code}', [PosController::class, 'scan'])->middleware($sale);
    Route::get('pos/search', [PosController::class, 'search'])->middleware($sale);
    Route::post('pos/sales', [PosController::class, 'storeSale'])->middleware($sale);
    Route::get('pos/sales', [PosController::class, 'recentSales'])->middleware($sale);
    Route::get('pos/sales/{id}', [PosController::class, 'sale'])->whereNumber('id')->middleware($p('sales.invoice.view'));
    Route::get('pos/sales/find/{code}', [PosController::class, 'findSale'])->middleware($p('sales.return.view'));
    Route::get('pos/holds', [PosController::class, 'holds'])->middleware($sale);
    Route::post('pos/holds', [PosController::class, 'storeHold'])->middleware($sale);
    Route::delete('pos/holds/{id}', [PosController::class, 'deleteHold'])->whereNumber('id')->middleware($sale);
    Route::post('pos/returns', [PosController::class, 'storeReturn'])->middleware($p('sales.return.create'));
    Route::get('customers', [PosController::class, 'customers'])->middleware($p('customers.customer.view'));
    Route::post('customers', [PosController::class, 'storeCustomer'])->middleware($p('customers.customer.create'));
    Route::get('customers/{id}', [PosController::class, 'customer'])->whereNumber('id')->middleware($p('customers.customer.view'));
    Route::put('customers/{id}', [PosController::class, 'updateCustomer'])->whereNumber('id')->middleware($p('customers.customer.edit'));

    // Customer ledger, receipts, aging (Step 13)
    Route::get('customers/aging', [CustomerLedgerController::class, 'aging'])->middleware($p('customers.customer.view'));
    Route::get('customers/{id}/ledger', [CustomerLedgerController::class, 'ledger'])->whereNumber('id')->middleware($p('customers.customer.view'));
    Route::post('customers/{id}/receipts', [CustomerLedgerController::class, 'storeReceipt'])->whereNumber('id')->middleware([$p('sales.invoice.edit'), 'idempotent']);
    Route::get('customer-receipts/{id}', [CustomerLedgerController::class, 'receipt'])->whereNumber('id')->middleware($p('customers.customer.view'));

    // Accounts: expenses + cash book
    $A = AccountsController::class;
    Route::get('accounts/expense-categories', [$A, 'categories'])->middleware($p('accounts.expense.view'));
    Route::post('accounts/expense-categories', [$A, 'storeCategory'])->middleware($p('accounts.expense.edit'));
    Route::get('accounts/expenses', [$A, 'expenses'])->middleware($p('accounts.expense.view'));
    Route::post('accounts/expenses', [$A, 'storeExpense'])->middleware([$p('accounts.expense.create'), 'idempotent']);
    Route::put('accounts/expenses/{id}', [$A, 'updateExpense'])->whereNumber('id')->middleware($p('accounts.expense.edit'));
    Route::post('accounts/expenses/{id}/void', [$A, 'voidExpense'])->whereNumber('id')->middleware($p('accounts.expense.edit'));
    Route::get('accounts/cashbook', [$A, 'cashbook'])->middleware($p('accounts.cashbook.view'));

    // Email
    $E = EmailController::class;
    Route::get('email/templates', [$E, 'templates'])->middleware($p('email.template.view'));
    Route::put('email/templates/{key}', [$E, 'update'])->where('key', '[a-z_]+')->middleware($p('email.template.edit'));
    Route::post('email/templates/{key}/test', [$E, 'test'])->where('key', '[a-z_]+')->middleware($p('email.template.edit'));
    Route::get('email/logs', [$E, 'logs'])->middleware($p('email.template.view'));
    Route::post('sales/invoices/{id}/email', [$E, 'sendInvoice'])->whereNumber('id')->middleware($p('email.message.send'));
    Route::post('customers/{id}/statement-email', [$E, 'sendStatement'])->whereNumber('id')->middleware($p('email.message.send'));
    Route::post('warranty/jobs/{id}/email', [$E, 'sendRepairReady'])->whereNumber('id')->middleware($p('email.message.send'));

    // Dashboard + reports (Step 15)
    Route::get('dashboard', [ReportsController::class, 'dashboard'])->middleware($p('dashboard.view.view'));
    foreach (['sales', 'stock', 'purchases', 'repairs', 'profit'] as $r) {
        Route::get("reports/{$r}", [ReportsController::class, $r])->middleware($p('reports.report.view'));
    }

    // Warranty & repairs (Step 14)
    $R = RepairController::class;
    Route::get('warranty/check/{serial}', [$R, 'check'])->middleware($p('warranty.claim.view'));
    Route::get('warranty/jobs', [$R, 'index'])->middleware($p('warranty.claim.view'));
    Route::get('warranty/jobs/{id}', [$R, 'show'])->whereNumber('id')->middleware($p('warranty.claim.view'));
    Route::post('warranty/jobs', [$R, 'store'])->middleware([$p('warranty.claim.create'), 'idempotent']);
    Route::put('warranty/jobs/{id}', [$R, 'update'])->whereNumber('id')->middleware($p('warranty.claim.edit'));
    Route::post('warranty/jobs/{id}/status', [$R, 'status'])->whereNumber('id')->middleware($p('warranty.claim.edit'));
    Route::post('warranty/jobs/{id}/deliver', [$R, 'deliver'])->whereNumber('id')->middleware([$p('warranty.claim.edit'), 'idempotent']);

    // Wholesale (Step 11)
    $W = WholesaleController::class;
    Route::get('sales/price', [$W, 'price'])->middleware($p('sales.quotation.view'));
    Route::get('sales/quotations', [$W, 'quotations'])->middleware($p('sales.quotation.view'));
    Route::get('sales/quotations/{id}', [$W, 'quotation'])->whereNumber('id')->middleware($p('sales.quotation.view'));
    Route::post('sales/quotations', [$W, 'storeQuotation'])->middleware($p('sales.quotation.create'));
    Route::put('sales/quotations/{id}', [$W, 'updateQuotation'])->whereNumber('id')->middleware($p('sales.quotation.edit'));
    foreach (['send' => 'sales.quotation.edit', 'cancel' => 'sales.quotation.edit', 'convert' => 'sales.order.create'] as $a => $perm) {
        Route::post("sales/quotations/{id}/{$a}", [$W, 'quotationAction'])->whereNumber('id')->defaults('action', $a)->middleware($p($perm));
    }
    Route::get('sales/orders', [$W, 'orders'])->middleware($p('sales.order.view'));
    Route::get('sales/orders/{id}', [$W, 'order'])->whereNumber('id')->middleware($p('sales.order.view'));
    Route::post('sales/orders', [$W, 'storeOrder'])->middleware($p('sales.order.create'));
    Route::post('sales/orders/{id}/cancel', [$W, 'cancelOrder'])->whereNumber('id')->middleware($p('sales.order.edit'));
    Route::get('sales/challans', [$W, 'challans'])->middleware($p('sales.challan.view'));
    Route::get('sales/challans/{id}', [$W, 'challan'])->whereNumber('id')->middleware($p('sales.challan.view'));
    Route::post('sales/challans', [$W, 'storeChallan'])->middleware([$p('sales.challan.create'), 'idempotent']);
    Route::get('sales/invoices', [$W, 'invoices'])->middleware($p('sales.invoice.view'));
    Route::get('sales/invoices/{id}', [$W, 'invoice'])->whereNumber('id')->middleware($p('sales.invoice.view'));
    Route::post('sales/invoices', [$W, 'storeInvoice'])->middleware([$p('sales.invoice.create'), 'idempotent']);
    Route::post('sales/invoices/{id}/payments', [$W, 'receivePayment'])->whereNumber('id')->middleware([$p('sales.invoice.edit'), 'idempotent']);
});
