import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'currencyPen', standalone: false })
export class CurrencyPenPipe implements PipeTransform {
  transform(value: number | null | undefined, showSign = false): string {
    if (value == null) return 'S/ 0.00';
    const formatted = Math.abs(value).toLocaleString('es-PE', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    const prefix = showSign && value < 0 ? '−' : '';
    return `${prefix}S/ ${formatted}`;
  }
}
