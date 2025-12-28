import { Component, ElementRef, EventEmitter, HostListener, Input, OnChanges, OnInit, Output, ViewChild } from '@angular/core';
import { Category } from '../../logic/types/category';

@Component({
  selector: 'app-category-subcategory-dropdown',
  templateUrl: './category-subcategory-dropdown.component.html',
  standalone: false
})
export class CategorySubcategoryDropdownComponent implements OnInit, OnChanges {
  @Input() categories: Category[] = [];
  @Input() selectedSubcategoryId: string | null = null;
  @Output() subcategorySelected = new EventEmitter<string | null>();
  @ViewChild('dropdownTrigger', { read: ElementRef }) dropdownTrigger?: ElementRef;
  @ViewChild('searchInput', { read: ElementRef }) searchInput?: ElementRef;

  isOpen = false;
  searchTerm = '';
  expandedCategories = new Set<string>();
  filteredCategories: { category: Category; subcategories: Category[] }[] = [];
  dropdownPosition = { top: '0px', left: '0px', width: '0px' };

  @HostListener('window:scroll')
  onWindowScroll(): void {
    if (this.isOpen) {
      this.updateDropdownPosition();
    }
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    if (this.isOpen) {
      this.updateDropdownPosition();
    }
  }

  ngOnInit(): void {
    this.buildCategoryTree();
  }

  ngOnChanges(): void {
    this.buildCategoryTree();
  }

  buildCategoryTree(): void {
    const topLevel = this.categories.filter(c => c.parentId === null);
    this.filteredCategories = topLevel.map(category => ({
      category,
      subcategories: this.categories.filter(c => c.parentId === category.id)
    })).filter(item => item.subcategories.length > 0);

    // Apply search filter
    if (this.searchTerm) {
      const lowerSearch = this.searchTerm.toLowerCase();
      this.filteredCategories = this.filteredCategories
        .map(item => ({
          category: item.category,
          subcategories: item.subcategories.filter(sub =>
            sub.name.toLowerCase().includes(lowerSearch) ||
            item.category.name.toLowerCase().includes(lowerSearch)
          )
        }))
        .filter(item => item.subcategories.length > 0);
      
      // Auto-expand categories when searching
      this.filteredCategories.forEach(item => {
        this.expandedCategories.add(item.category.id);
      });
    }
  }

  toggleDropdown(): void {
    this.isOpen = !this.isOpen;
    if (this.isOpen) {
      // Calculate position for fixed dropdown
      this.updateDropdownPosition();
      
      // Focus search input after a short delay to ensure DOM is updated
      setTimeout(() => {
        this.searchInput?.nativeElement.focus();
      }, 0);
      
      // Auto-expand category containing selected subcategory
      if (this.selectedSubcategoryId) {
        const selectedSubcat = this.categories.find(c => c.id === this.selectedSubcategoryId);
        if (selectedSubcat?.parentId) {
          this.expandedCategories.add(selectedSubcat.parentId);
        }
      }
    }
  }

  updateDropdownPosition(): void {
    if (this.dropdownTrigger) {
      const rect = this.dropdownTrigger.nativeElement.getBoundingClientRect();
      this.dropdownPosition = {
        top: `${rect.bottom + 4}px`,
        left: `${rect.left}px`,
        width: `${rect.width}px`
      };
    }
  }

  toggleCategory(categoryId: string): void {
    if (this.expandedCategories.has(categoryId)) {
      this.expandedCategories.delete(categoryId);
    } else {
      this.expandedCategories.add(categoryId);
    }
  }

  selectSubcategory(subcategoryId: string | null): void {
    this.selectedSubcategoryId = subcategoryId;
    this.subcategorySelected.emit(subcategoryId);
    this.isOpen = false;
    this.searchTerm = '';
    this.buildCategoryTree();
  }

  onSearchChange(): void {
    this.buildCategoryTree();
  }

  getSelectedSubcategoryName(): string {
    if (!this.selectedSubcategoryId) return 'None';
    const subcat = this.categories.find(c => c.id === this.selectedSubcategoryId);
    if (!subcat) return 'None';
    return subcat.name;
  }

  getSelectedCategoryName(): string | null {
    if (!this.selectedSubcategoryId) return null;
    const subcat = this.categories.find(c => c.id === this.selectedSubcategoryId);
    if (!subcat) return null;
    const parent = this.categories.find(c => c.id === subcat.parentId);
    return parent ? parent.name : null;
  }

  closeDropdown(): void {
    this.isOpen = false;
    this.searchTerm = '';
    this.buildCategoryTree();
  }
}
