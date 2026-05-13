import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Category } from '../../../../logic/types/category';
import { Currency } from '../../../../logic/types/currency';
import { ImportDateGroup } from '../../../../logic/types/import-date-group';
import { ImportingTransaction } from '../../../../logic/types/importing-transaction';
import { Transaction } from '../../../../logic/types/transaction';
import { SharedModule } from '../../../../shared/shared.module';

@Component({
  selector: 'app-import-only',
  standalone: true,
  imports: [SharedModule],
  templateUrl: './import-only.component.html'
})
export class ImportOnlyComponent {
  @Input() importDateGroups: ImportDateGroup[] = [];
  @Input() earliestFileDate: string | null = null;
  @Input() categories: Category[] = [];
  @Input() currencies: Currency[] = [];
  @Input() markedForDeletion: Set<string> = new Set<string>();

  @Output() toggleExclude = new EventEmitter<ImportingTransaction>();
  @Output() toggleDeleteMark = new EventEmitter<Transaction>();
  @Output() updatePayee = new EventEmitter<{ item: ImportingTransaction; payee?: string }>();
  @Output() onSubcategoryChange = new EventEmitter<{ item: ImportingTransaction; id: string | null }>();
  @Output() openDescriptionDialog = new EventEmitter<ImportingTransaction>();

  getCurrencyDetails(code: string) {
    return this.currencies.find(c => c.code === code) ? { name: code, symbol: this.currencies.find(c => c.code === code)!.symbol } : null;
  }

  trackByDate(_index: number, group: any): string {
    return group?.dateKey || group?.date?.toString();
  }

  trackByRow(_index: number, row: any): string {
    return row?.id;
  }

  trackByExisting(_index: number, existing: any): string {
    return existing?.id;
  }
}
