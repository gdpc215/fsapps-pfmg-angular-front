import { Component, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { AccountService } from '../../../logic/services/account.service';
import { CardService } from '../../../logic/services/card.service';
import { CategoryService } from '../../../logic/services/category.service';
import { MovementService } from '../../../logic/services/movement.service';
import { Account } from '../../../logic/types/account';
import { Card } from '../../../logic/types/card';
import { Category } from '../../../logic/types/category';
import { Movement } from '../../../logic/types/movement';
import { CategorizeDialogComponent } from './categorize-dialog/categorize-dialog.component';
import { ImportDialogComponent } from './import-dialog/import-dialog.component';

@Component({
  selector: 'app-movements',
  templateUrl: './movements.component.html',
  standalone: false
})
export class MovementsComponent implements OnInit {
  movements: Movement[] = [];
  filteredMovements: Movement[] = [];
  accounts: Account[] = [];
  cards: Card[] = [];
  categories: Category[] = [];
  topLevelCategories: Category[] = [];

  displayedColumns = ['date', 'description', 'currency', 'amount', 'category', 'actions'];

  // Filters
  selectedAccountOrCard: string | null = null;
  selectedCategory: string | null = null;
  showStubsOnly = false;

  constructor(
    private movementService: MovementService,
    private accountService: AccountService,
    private cardService: CardService,
    private categoryService: CategoryService,
    private dialog: MatDialog
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

    this.cardService.getCards().subscribe(cards => {
      this.cards = cards;
    });

    this.categoryService.getCategories().subscribe(categories => {
      this.categories = categories;
      this.topLevelCategories = categories.filter(c => c.parentId === null);
    });
  }

  filterMovements(): void {
    let filtered = [...this.movements];

    if (this.selectedAccountOrCard) {
      filtered = filtered.filter(m => m.accountOrCardId === this.selectedAccountOrCard);
    }

    if (this.selectedCategory === 'uncategorized') {
      filtered = filtered.filter(m => !m.categoryId);
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

  openImportDialog(): void {
    const dialogRef = this.dialog.open(ImportDialogComponent, {
      width: '800px',
      maxHeight: '90vh',
      data: { accounts: this.accounts, cards: this.cards }
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
}
