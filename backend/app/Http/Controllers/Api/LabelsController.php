<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Grn;
use App\Models\LabelPrintLog;
use App\Models\LabelTemplate;
use App\Models\Location;
use App\Models\ProductVariant;
use App\Models\StockSerial;
use App\Models\Warehouse;
use App\Services\PermissionResolver;
use App\Services\ProductInfo;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/** Step 7: barcode/label templates, printable items (SKU, serial, bin), lookup, print history with reprint control. */
class LabelsController extends Controller
{
    private const FIELDS = ['company', 'name', 'sku', 'serial', 'specs', 'price', 'bin', 'code'];

    public function templates(): JsonResponse
    {
        return response()->json(LabelTemplate::orderBy('kind')->orderBy('name')->get()->map(fn ($t) => $this->templateOut($t)));
    }

    public function storeTemplate(Request $request): JsonResponse
    {
        $t = DB::transaction(function () use ($request) {
            $t = LabelTemplate::create($this->templateData($request));
            $this->oneDefault($t);

            return $t;
        });

        return response()->json($this->templateOut($t), 201);
    }

    public function updateTemplate(Request $request, LabelTemplate $template): JsonResponse
    {
        DB::transaction(function () use ($request, $template) {
            $template->update($this->templateData($request));
            $this->oneDefault($template);
        });

        return response()->json($this->templateOut($template->fresh()));
    }

    private function templateData(Request $request): array
    {
        $d = $request->validate([
            'name' => 'required|string|max:60',
            'kind' => 'required|in:sku,serial,bin',
            'widthMm' => 'required|integer|min:20|max:150',
            'heightMm' => 'required|integer|min:15|max:150',
            'symbology' => 'required|in:code128,qr,ean13',
            'fields' => 'required|array|min:1',
            'fields.*' => 'in:'.implode(',', self::FIELDS),
            'showLogo' => 'required|boolean',
            'isDefault' => 'required|boolean',
        ], ['fields.required' => 'Pick at least one field.', 'fields.min' => 'Pick at least one field.']);

        return ['name' => trim($d['name']), 'kind' => $d['kind'], 'width_mm' => $d['widthMm'], 'height_mm' => $d['heightMm'],
            'symbology' => $d['symbology'], 'fields' => array_values(array_unique($d['fields'])), 'show_logo' => $d['showLogo'], 'is_default' => $d['isDefault']];
    }

    private function oneDefault(LabelTemplate $t): void
    {
        if ($t->is_default) {
            LabelTemplate::where('kind', $t->kind)->whereKeyNot($t->id)->update(['is_default' => false]);
        }
    }

    private function templateOut(LabelTemplate $t): array
    {
        return ['id' => $t->id, 'name' => $t->name, 'kind' => $t->kind, 'widthMm' => (int) $t->width_mm, 'heightMm' => (int) $t->height_mm,
            'symbology' => $t->symbology, 'fields' => $t->fields, 'showLogo' => (bool) $t->show_logo, 'isDefault' => (bool) $t->is_default];
    }

    /** ?kind=sku|serial|bin&q=&grn= */
    public function items(Request $request): JsonResponse
    {
        $kind = $request->query('kind', 'serial');
        $q = trim((string) $request->query('q', ''));
        $grn = trim((string) $request->query('grn', ''));
        $items = match ($kind) {
            'sku' => $this->skuItems($q),
            'bin' => $this->binItems($q),
            default => $this->serialItems($q, $grn),
        };

        return response()->json($this->withCounts($items)->values());
    }

    public function lookup(string $code): JsonResponse
    {
        $code = strtoupper(trim(urldecode($code)));
        $item = $this->serialItems('', '', $code)->first()
            ?? $this->skuItems('', $code)->first()
            ?? $this->binItems('', $code)->first();
        abort_unless($item, 404, 'No serial, SKU or bin matches this code.');

        return response()->json($this->withCounts(collect([$item]))->first());
    }

    public function grns(): JsonResponse
    {
        return response()->json(Grn::where('status', 'posted')->whereIn('id', StockSerial::select('grn_id'))->orderBy('number')->pluck('number'));
    }

    public function log(): JsonResponse
    {
        return response()->json(LabelPrintLog::with('printer')->orderByDesc('id')->limit(300)->get()->map(fn ($l) => [
            'id' => $l->id, 'templateId' => (int) $l->label_template_id, 'templateName' => $l->template_name, 'codes' => $l->codes,
            'isReprint' => (bool) $l->is_reprint, 'reason' => $l->reason, 'printedAt' => $l->created_at?->toIso8601String(),
            'printedBy' => (string) $l->printer?->name,
        ]));
    }

    public function record(Request $request): JsonResponse
    {
        $d = $request->validate([
            'templateId' => 'required|integer|exists:label_templates,id',
            'codes' => 'required|array|min:1|max:500',
            'codes.*' => 'required|string|max:64',
            'reason' => 'nullable|string|max:500',
        ], ['codes.required' => 'Template and at least one label are required.']);
        $user = $request->user();
        $codes = array_values(array_unique($d['codes']));

        $log = DB::transaction(function () use ($d, $codes, $user) {
            $printed = DB::table('label_print_counts')->whereIn('code', $codes)->where('count', '>', 0)->exists();
            $reason = trim((string) ($d['reason'] ?? ''));
            if ($printed) {
                if ($user->type !== 'super_admin' && ! app(PermissionResolver::class)->has($user, 'barcode.label.reprint')) {
                    abort(403, 'You need the label reprint permission to print these labels again.');
                }
                if (mb_strlen($reason) < 10) {
                    throw ValidationException::withMessages(['reason' => 'A reason is required to reprint labels.']);
                }
            }
            foreach ($codes as $c) {
                if (! DB::table('label_print_counts')->where('code', $c)->increment('count')) {
                    DB::table('label_print_counts')->insert(['code' => $c, 'count' => 1]);
                }
            }
            $t = LabelTemplate::find($d['templateId']);
            $log = LabelPrintLog::create(['label_template_id' => $t->id, 'template_name' => $t->name, 'codes' => $codes,
                'is_reprint' => $printed, 'reason' => $printed ? $reason : null, 'printed_by' => $user->id]);
            AuditLog::record($user, $printed ? 'labels.reprinted' : 'labels.printed', null, ['count' => count($codes), 'template' => $t->name]);

            return $log;
        });

        return response()->json([
            'id' => $log->id, 'templateId' => $log->label_template_id, 'templateName' => $log->template_name, 'codes' => $log->codes,
            'isReprint' => (bool) $log->is_reprint, 'reason' => $log->reason, 'printedAt' => $log->created_at?->toIso8601String(), 'printedBy' => $user->name,
        ], 201);
    }

    private function item(string $kind, string $code, array $o): array
    {
        return $o + ['kind' => $kind, 'code' => $code, 'name' => '', 'sku' => null, 'serial' => null, 'specs' => null, 'price' => null, 'bin' => null,
            'grn' => null, 'printCount' => 0];
    }

    private function serialItems(string $q, string $grn, ?string $exact = null): Collection
    {
        $query = StockSerial::with('grn')->whereIn('status', ['in_stock', 'quarantine'])->orderByDesc('received_at');
        if ($exact) {
            $query->where('serial', $exact);
        }
        if ($grn) {
            $query->whereHas('grn', fn ($g) => $g->where('number', $grn));
        }
        if ($q) {
            $query->where(fn ($w) => $w->where('serial', 'like', "%{$q}%")->orWhereHas('product', fn ($p) => $p->where('name', 'like', "%{$q}%")));
        }

        return $query->limit(500)->get()->map(function ($s) {
            $p = ProductInfo::get($s->product_id);

            return $this->item('serial', $s->serial, ['name' => $p['name'], 'sku' => $p['sku'], 'serial' => $s->serial, 'specs' => $p['specs'],
                'price' => $p['price'], 'grn' => $s->grn?->number]);
        });
    }

    private function skuItems(string $q, ?string $exact = null): Collection
    {
        $query = ProductVariant::query()->where('is_active', true)->orderBy('sku');
        if ($exact) {
            $query->where(fn ($w) => $w->whereRaw('UPPER(sku) = ?', [$exact])->orWhere('barcode', $exact));
        }
        if ($q) {
            $query->where(fn ($w) => $w->where('sku', 'like', "%{$q}%")->orWhere('barcode', 'like', "%{$q}%")
                ->orWhereHas('product', fn ($p) => $p->where('name', 'like', "%{$q}%")));
        }

        return $query->limit(500)->get()->map(function ($v) {
            $p = ProductInfo::get($v->product_id);
            $name = $v->name ? "{$p['name']} ({$v->name})" : $p['name'];
            $price = $v->prices()->whereHas('tier', fn ($t) => $t->where('key', 'retail'))->value('price');

            return $this->item('sku', $v->barcode ?: $v->sku, ['name' => $name, 'sku' => $v->sku, 'specs' => $p['specs'],
                'price' => $price !== null ? (float) $price : null]);
        });
    }

    private function binItems(string $q, ?string $exact = null): Collection
    {
        $query = Location::query()->where('is_active', true)->orderBy('warehouse_id')->orderBy('code');
        if ($exact) {
            $code = str_starts_with($exact, 'BIN-') ? substr($exact, 4) : null;
            $query->where(fn ($w) => $w->where('barcode', $exact)->when($code, fn ($x) => $x->orWhereRaw('UPPER(code) = ?', [$code])));
        }
        if ($q) {
            $query->where(fn ($w) => $w->where('code', 'like', "%{$q}%")->orWhere('name', 'like', "%{$q}%")->orWhere('barcode', 'like', "%{$q}%"));
        }
        $warehouses = Warehouse::pluck('name', 'id');

        return $query->limit(500)->get()->map(fn ($l) => $this->item('bin', $l->barcode ?: 'BIN-'.$l->code,
            ['name' => (string) ($warehouses[$l->warehouse_id] ?? ''), 'bin' => $l->code]));
    }

    private function withCounts(Collection $items): Collection
    {
        $counts = DB::table('label_print_counts')->whereIn('code', $items->pluck('code'))->pluck('count', 'code');

        return $items->map(fn ($i) => array_merge($i, ['printCount' => (int) ($counts[$i['code']] ?? 0)]));
    }
}
