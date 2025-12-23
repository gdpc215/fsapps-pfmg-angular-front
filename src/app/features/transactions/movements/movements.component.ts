import { Component, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { CatalogRoutes } from '../../../application/app.routes.catalog';
import { AccountService } from '../../../logic/services/account.service';
import { CategoryService } from '../../../logic/services/category.service';
import { CurrencyService } from '../../../logic/services/currency.service';
import { MovementService } from '../../../logic/services/movement.service';
import { Account } from '../../../logic/types/account';
import { Category } from '../../../logic/types/category';
import { Currency } from '../../../logic/types/currency';
import { Movement } from '../../../logic/types/movement';
import { CategorizeDialogComponent } from './categorize-dialog/categorize-dialog.component';
import { ImportDialogComponent } from './import-dialog/import-dialog.component';
import { MovementFormDialogComponent } from './movement-form-dialog/movement-form-dialog.component';

@Component({
  selector: 'app-movements',
  templateUrl: './movements.component.html',
  standalone: false
})
export class MovementsComponent implements OnInit {
  movements: Movement[] = [];
  filteredMovements: Movement[] = [];
  accounts: Account[] = [];
  currencies: Currency[] = [];
  categories: Category[] = [];
  topLevelCategories: Category[] = [];

  displayedColumns = ['date', 'payee', 'description', 'currency', 'amount', 'category', 'actions'];

  // Filters
  selectedAccount: string | null = null;
  selectedCategory: string | null = null;
  showStubsOnly = false;

  constructor(
    private movementService: MovementService,
    private accountService: AccountService,
    private categoryService: CategoryService,
    private currencyService: CurrencyService,
    private dialog: MatDialog,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.movementService.getMovements().subscribe(movements => {
      this.movements = movements;
      this.filterMovements();
    });

    this.accountService.getAccounts().subscribe(accounts => {
      this.accounts = accounts;
    });

    this.currencyService.getCurrencies().subscribe(currencies => {
      this.currencies = currencies;
    });

    this.categoryService.getCategories().subscribe(categories => {
      this.categories = categories;
      this.topLevelCategories = categories.filter(c => c.parentId === null);
    });
  }

  filterMovements(): void {
    let filtered = [...this.movements];

    if (this.selectedAccount) {
      filtered = filtered.filter(m => m.accountOrCardId === this.selectedAccount);
    }

    if (this.selectedCategory) {
      filtered = filtered.filter(m => m.accountOrCardId === this.selectedAccount)
    } else if (this.selectedCategory) {
      filtered = filtered.filter(m => m.categoryId === this.selectedCategory);
    }

    if (this.showStubsOnly) {
      filtered = filtered.filter(m => m.isStub);
    }

    this.filteredMovements = filtered.sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
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

  openEditDialog(movement: Movement): void {
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
    const dialogRef = this.dialog.open(ImportDialogComponent, {
      width: '800px',
      maxHeight: '90vh',
      data: { accounts: this.accounts, currencies: this.currencies, categories: this.categories }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        // Result is already added by the import dialog
        this.filterMovements();
      }
    });
  }

  categorizeMovement(movement: Movement): void {
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

  deleteMovement(movement: Movement): void {
    if (confirm('Are you sure you want to delete this movement?')) {
      this.movementService.deleteMovement(movement.id);
    }
  }

  goToAccounts(): void {
    this.router.navigate([`/${CatalogRoutes.TRANSACTIONS}/${CatalogRoutes.SETTINGS}/${CatalogRoutes.SETTINGS_ACCOUNTS}`]);
  }
}
