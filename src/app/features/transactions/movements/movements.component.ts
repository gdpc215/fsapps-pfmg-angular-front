import { Component, OnInit, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { CatalogRoutes } from '../../../application/app.routes.catalog';
import { AccountService } from '../../../logic/services/account.service';
import { CardBalanceSnapshotService } from '../../../logic/services/card-balance-snapshot.service';
import { CategoryService } from '../../../logic/services/category.service';
import { CurrencyService } from '../../../logic/services/currency.service';
import { MovementService } from '../../../logic/services/movement.service';
import { TransactionService } from '../../../logic/services/transaction.service';
import { Account, AccountType } from '../../../logic/types/account';
import { Category } from '../../../logic/types/category';
import { Currency } from '../../../logic/types/currency';
import { Transaction, TransactionType } from '../../../logic/types/transaction';
import { CheckpointDialogComponent } from '../settings/accounts/checkpoint-dialog/checkpoint-dialog.component';
import { CategorizeDialogComponent } from './categorize-dialog/categorize-dialog.component';
import { MovementFormDialogComponent } from './movement-form-dialog/movement-form-dialog.component';

@Component({
  selector: 'app-movements',
  templateUrl: './movements.component.html',
  standalone: false
})
export class MovementsComponent implements OnInit {
  movements: Transaction[] = [];
  filteredMovements: Transaction[] = [];
  accounts: Account[] = [];
  currencies: Currency[] = [];
  categories: Category[] = [];
  topLevelCategories: Category[] = [];

  displayedColumns = ['date', 'payee', 'category', 'description', 'currency', 'amount', 'actions'];

  // Filters
  selectedAccount: string | null = null;
  selectedCategory: string | null = null;
  showStubsOnly = false;
  searchText = '';
  dateFrom: string | null = null;
  dateTo: string | null = null;

  // Lookup maps for transfer visualization
  private txMap = new Map<string, Transaction>();
  private sourceNameMap = new Map<string, string>();

  TransactionType = TransactionType;

  constructor(
    private dialog: MatDialog,
    private router: Router
  ) {}

  private movementService = inject(MovementService);
  private accountService = inject(AccountService);
  private categoryService = inject(CategoryService);
  private currencyService = inject(CurrencyService);
  private transactionService = inject(TransactionService);
  private cardBalanceSnapshotService = inject(CardBalanceSnapshotService);

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.accountService.getAccounts().subscribe(accounts => {
      this.accounts = accounts;
      // Auto-select first account if available
      if (accounts.length > 0 && !this.selectedAccount) {
        this.selectedAccount = accounts[0].id;
        this.loadMovementsForAccount();
      }
    });

    this.currencyService.getCurrencies().subscribe(currencies => {
      this.currencies = currencies;
    });

    this.categoryService.getCategories().subscribe(categories => {
      this.categories = categories;
      this.topLevelCategories = categories.filter(c => c.parentId === null);
    });
  }

  loadMovementsForAccount(): void {
    // Rebuild txMap and sourceNameMap for transfer lookups
    const allTx = this.transactionService.getCurrentTransactions();
    this.txMap = new Map(allTx.map(t => [t.id, t]));
    const allAccounts = this.accountService.getAccountsSync();
    this.sourceNameMap = new Map(allAccounts.map(a => [a.id, a.name]));

    if (this.selectedAccount) {
      this.movements = this.movementService.getMovementsByAccountOrCard(this.selectedAccount);
      this.filterMovements();
    } else {
      this.movements = [];
      this.filterMovements();
    }
  }

  filterMovements(): void {
    let filtered = [...this.movements];

    if (this.selectedCategory === 'uncategorized') {
      filtered = filtered.filter(m => !m.categoryId);
    } else if (this.selectedCategory) {
      filtered = filtered.filter(m => m.categoryId === this.selectedCategory);
    }

    if (this.showStubsOnly) {
      filtered = filtered.filter(m => m.isStub);
    }

    if (this.dateFrom) {
      const from = new Date(this.dateFrom).getTime();
      filtered = filtered.filter(m => new Date(m.date).getTime() >= from);
    }

    if (this.dateTo) {
      const to = new Date(this.dateTo).getTime();
      filtered = filtered.filter(m => new Date(m.date).getTime() <= to);
    }

    if (this.searchText.trim()) {
      const q = this.searchText.trim().toLowerCase();
      filtered = filtered.filter(m =>
        (m.description ?? '').toLowerCase().includes(q) ||
        (m.userDescription ?? '').toLowerCase().includes(q) ||
        (m.notes ?? '').toLowerCase().includes(q)
      );
    }

    this.filteredMovements = filtered.sort((a, b) =>
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }

  getLinkedSourceName(tx: Transaction): string {
    if (!tx.linkedTransactionId) return '';
    const linked = this.txMap.get(tx.linkedTransactionId);
    if (!linked) return '';
    return this.sourceNameMap.get(linked.sourceId) ?? '';
  }

  onAccountChange(): void {
    this.loadMovementsForAccount();
  }

  getCategoryName(categoryId: string): string {
    const category = this.categories.find(c => c.id === categoryId);
    return category ? category.name : 'Unknown';
  }

  deleteAllMovements(): void {
    if (confirm('Are you sure you want to delete ALL movements? This cannot be undone!')) {
      this.movementService.deleteAll();
    }
  }

  openAddDialog(): void {
    const dialogRef = this.dialog.open(MovementFormDialogComponent, {
      width: '600px',
      data: { 
        movement: null, 
        accounts: this.accounts, 
        currencies: this.currencies,
        categories: this.categories
      }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.movementService.addMovement(result);
      }
    });
  }

  openEditDialog(movement: Transaction): void {
    const dialogRef = this.dialog.open(MovementFormDialogComponent, {
      width: '600px',
      data: { 
        movement: { ...movement }, 
        accounts: this.accounts, 
        currencies: this.currencies,
        categories: this.categories
      }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.movementService.updateMovement(result);
      }
    });
  }

  openImportDialog(): void {
    this.router.navigate([`/${CatalogRoutes.TRANSACTIONS}/${CatalogRoutes.TRANSACTIONS_MOVEMENTS}/${CatalogRoutes.TRANSACTIONS_MOVEMENTS_IMPORT}`]);
  }

  categorizeMovement(movement: Transaction): void {
    const dialogRef = this.dialog.open(CategorizeDialogComponent, {
      width: '500px',
      data: { 
        movement,
        categories: this.topLevelCategories,
        allCategories: this.categories
      }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.movementService.categorizeMovement(movement.id, result.categoryId, result.subcategoryId);
      }
    });
  }

  deleteMovement(movement: Transaction): void {
    if (confirm('Are you sure you want to delete this movement?')) {
      this.movementService.deleteMovement(movement.id);
    }
  }

  goToAccounts(): void {
    this.router.navigate([`/${CatalogRoutes.TRANSACTIONS}/${CatalogRoutes.SETTINGS}/${CatalogRoutes.SETTINGS_ACCOUNTS}`]);
  }

  get selectedAccountObj(): Account | null {
    return this.accounts.find(a => a.id === this.selectedAccount) ?? null;
  }

  openCheckpointDialog(): void {
    const account = this.selectedAccountObj;
    if (!account) return;

    const dialogRef = this.dialog.open(CheckpointDialogComponent, {
      width: '400px',
      data: { entity: account, type: 'account' }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result !== undefined && result !== null) {
         // For credit cards, create CardBalanceSnapshot; otherwise just update balance
        if (account.type === AccountType.CREDIT) {
           this.cardBalanceSnapshotService.addSnapshot({
             accountId: account.id,
             snapshotDate: new Date(),
             owedAmount: Number(result),
             notes: 'Manual checkpoint'
           });
         } else {
           // For debit accounts, just update the current balance
           account.currentBalance = Number(result);
           this.accountService.updateAccount(account);
         }
      }
    });
  }
}
