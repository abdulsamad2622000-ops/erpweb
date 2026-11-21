<?php

use App\Http\Controllers\Api\InventoryController;
use App\Http\Controllers\Api\LabelsController;
use App\Http\Controllers\Api\PayablesController;
use App\Http\Controllers\Api\PurchaseController;
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
        Route::post("inventory/transfers/{transfer}/{$a}", [InventoryController::class, 'transferAction'])->defaults('action', $a)->middleware($p($perm));
    }

    // Labels
    Route::get('labels/templates', [LabelsController::class, 'templates'])->middleware($p('barcode.label.view'));
    Route::post('labels/templates', [LabelsController::class, 'storeTemplate'])->middleware($p('barcode.label.create'));
    Route::put('labels/templates/{template}', [LabelsController::class, 'updateTemplate'])->middleware($p('barcode.label.create'));
    Route::get('labels/items', [LabelsController::class, 'items'])->middleware($p('barcode.label.view'));
    Route::get('labels/lookup/{code}', [LabelsController::class, 'lookup'])->middleware($p('barcode.label.view'));
    Route::get('labels/grns', [LabelsController::class, 'grns'])->middleware($p('barcode.label.view'));
    Route::get('labels/print-log', [LabelsController::class, 'log'])->middleware($p('barcode.label.view'));
    Route::post('labels/print-log', [LabelsController::class, 'record'])->middleware($p('barcode.label.print'));
});
