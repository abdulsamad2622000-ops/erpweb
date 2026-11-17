<?php

namespace App\Services;

use App\Models\NumberSeries;
use Illuminate\Support\Facades\DB;

class NumberSeriesService
{
    /** Agla number deta hai aur counter aage barhata hai (row lock ke saath). */
    public function next(string $key): string
    {
        return DB::transaction(function () use ($key) {
            $series = NumberSeries::where('key', $key)->lockForUpdate()->firstOrFail();
            $number = (int) $series->next_number;
            $series->next_number = $number + 1;
            $series->save();

            return $this->format($series, $number);
        });
    }

    public function preview(NumberSeries $series): string
    {
        return $this->format($series, (int) $series->next_number);
    }

    public function format(NumberSeries $series, int $number): string
    {
        $year = $series->include_year ? now()->format('Y').'-' : '';

        return $series->prefix.$year.str_pad((string) $number, (int) $series->padding, '0', STR_PAD_LEFT);
    }
}