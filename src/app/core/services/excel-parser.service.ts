import { Injectable } from '@angular/core';
import * as XLSX from 'xlsx';
import { RawImportRow, ParseFileResult } from '../models/import-batch.model';

const COL_FECHA         = 'Fecha';
const COL_DESCRIPCION   = 'Descripcion';
const COL_MONEDA        = 'Moneda';
const COL_MONTO         = 'Monto';
const COL_OPERACION     = 'N° Operacion';
const COL_OPERACION_ALT = 'Operacion';

export class ParseValidationError extends Error {
  constructor(message: string) { super(message); }
}

@Injectable({ providedIn: 'root' })
export class ExcelParserService {

  async parseFile(file: File, usdExchangeRate: number): Promise<ParseFileResult> {
    if (!file.name.toLowerCase().endsWith('.xlsx')) {
      throw new ParseValidationError('Only .xlsx files are supported.');
    }
    if (file.size > 10 * 1024 * 1024) {
      throw new ParseValidationError('File is too large (max 10 MB).');
    }

    const buffer   = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
    const hasMultipleSheets = workbook.SheetNames.length > 1;

    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rawRows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: null });

    const rows: RawImportRow[] = rawRows
      .filter(r =>
        r[COL_FECHA]       != null &&
        r[COL_DESCRIPCION] != null &&
        r[COL_MONEDA]      != null &&
        r[COL_MONTO]       != null
      )
      .map(r => {
        const currency = String(r[COL_MONEDA]).trim() === '$' ? 'USD' : 'PEN';
        const amount   = this.parseAmount(r[COL_MONTO]);
        return {
          dateTransaction: this.parseDate(r[COL_FECHA]),
          description:     String(r[COL_DESCRIPCION]).trim(),
          currency,
          amount,
          amountPen: currency === 'PEN' ? amount : amount * usdExchangeRate,
          strOperationNumber: r[COL_OPERACION] != null
            ? String(r[COL_OPERACION]).trim()
            : r[COL_OPERACION_ALT] != null
              ? String(r[COL_OPERACION_ALT]).trim()
              : undefined,
        } satisfies RawImportRow;
      });

    return {
      rows,
      hasMultipleSheets,
      hasUsdRows: rows.some(r => r.currency === 'USD'),
    };
  }

  private parseDate(value: any): string {
    if (value instanceof Date) {
      const y = value.getFullYear();
      const m = String(value.getMonth() + 1).padStart(2, '0');
      const d = String(value.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
    const str = String(value).trim();
    // DD/MM/YYYY (common Peruvian bank format)
    const ddmm = str.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (ddmm) return `${ddmm[3]}-${ddmm[2]}-${ddmm[1]}`;
    // YYYY-MM-DD passthrough
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
    return str; // unknown; will fail row-level validation downstream
  }

  private parseAmount(raw: any): number {
    if (raw == null) return 0;
    const cleaned = String(raw).replace(/,/g, '');
    const n = Number(cleaned);
    return isNaN(n) ? 0 : n;
  }
}
