# WP08 — Categories, Rules & Duplication Collections Pages

**Depends on:** WP01, WP02, WP03, WP05  
**Spec:** DESIGN_LOCAL_v5.md §8; BUSINESS_LOGIC_v2.md §3

---

## Goal

Replace the categories stub module with three fully functional pages: category/subcategory management, category rules management (with drag-to-reorder), and duplication collection management.

---

## `CategoriesModule`

File: `src/app/features/categories/categories.module.ts`

Routes:
```
''            → CategoryListComponent
'rules'       → CategoryRuleListComponent
'duplications' → DuplicationCollectionListComponent
```

Import in NgModule: `SharedModule`, `ReactiveFormsModule`, `DragDropModule` (from `@angular/cdk/drag-drop`), plus needed Material modules (`MatExpansionModule`, `MatChipsModule`, `MatFormFieldModule`, `MatInputModule`, `MatIconModule`, `MatTableModule`, `MatSelectModule`, `MatButtonModule`, `MatTooltipModule`).

---

## Page 1 — `CategoryListComponent`

Files:
- `src/app/features/categories/pages/category-list/category-list.component.ts`
- `src/app/features/categories/pages/category-list/category-list.component.html`

### Data
```typescript
categories$  = categoryService.categories$;
subcategories$ = categoryService.subcategories$;
```

### Template structure

Page title: "Categories & Subcategories"

**Add category** inline form at top: `[Category name]` input + `[Add]` button. On submit: `categoryService.saveCategory({ strName })`.

For each category (use `mat-expansion-panel` or a card):
- Header: category name + `[Edit name]` icon + `[Delete category]` icon (danger).
- Expanded content: list of subcategories + "Add subcategory" inline form.
- Each subcategory row: subcategory name + `[Edit]` icon + `[Delete]` icon.

**Delete category confirm:**
```
Title: "Delete category?"
Message: "Deleting '[cat.strName]' will also remove [N] subcategories and clear categories from all associated transactions."
danger: true
```
N = number of subcategories in this category.

**Delete subcategory confirm:**
```
Title: "Delete subcategory?"
Message: "Deleting '[sub.strName]' will clear its category from all associated transactions."
danger: true
```

**Edit inline:** clicking "edit" on a category or subcategory name replaces it with an input field inline. Pressing Enter or clicking a checkmark icon saves; pressing Escape cancels.

---

## Page 2 — `CategoryRuleListComponent`

Files:
- `src/app/features/categories/pages/category-rule-list/category-rule-list.component.ts`
- `src/app/features/categories/pages/category-rule-list/category-rule-list.component.html`

### Purpose

Display all `CategoryRule[]` sorted by `intPriority ASC`. Allow reordering (which reassigns priorities), editing, deleting, and adding new rules.

### Data
```typescript
rules$         = categoryService.rules$;
subcategories$ = categoryService.subcategories$;
categories$    = categoryService.categories$;
```

### Template structure

Page title: "Category Rules" + brief explanation: *"Rules are evaluated top-to-bottom. First match wins."*

**Add rule form** (above the list):
- Match type: `<mat-select>` with options `STARTS_WITH`, `CONTAINS`, `ENDS_WITH`, `EQUALS`.
- Match string: text input (required).
- Subcategory: `<mat-select>` with `<mat-optgroup>` grouping subcategories by their parent category name. Options: `[Category] → Subcategory`.
- `[Add Rule]` button. On submit: auto-assign `intPriority = (max existing priority) + 1`. If no existing rules, `intPriority = 1`. Call `categoryService.saveRule()`. Handle thrown priority-conflict errors (shouldn't happen with auto-assign but wrap in try/catch for safety).

**Rules list — drag-to-reorder:**

Use Angular CDK `cdkDropList` + `cdkDrag` on the list container and each row.

```html
<div cdkDropList (cdkDropListDropped)="onDrop($event)">
  <div *ngFor="let rule of rules$ | async; let i = index"
       cdkDrag class="flex items-center gap-2 p-2 border-b">
    <mat-icon cdkDragHandle class="cursor-grab text-gray-400">drag_indicator</mat-icon>
    <span class="w-6 text-xs text-gray-400 font-mono">{{ rule.intPriority }}</span>
    <mat-chip>{{ rule.strMatchType }}</mat-chip>
    <span class="flex-1 font-mono text-sm">{{ rule.strMatchString }}</span>
    <span class="text-sm text-gray-600">→ {{ resolveSubcategoryLabel(rule.subcategoryId) }}</span>
    <button mat-icon-button (click)="deleteRule(rule)" matTooltip="Delete rule">
      <mat-icon>delete</mat-icon>
    </button>
  </div>
</div>
```

**`onDrop(event: CdkDragDrop<CategoryRule[]>)`:**
```typescript
onDrop(event: CdkDragDrop<CategoryRule[]>): void {
  const rules = [...this.categoryService.getRules()]
    .sort((a, b) => a.intPriority - b.intPriority);
  moveItemInArray(rules, event.previousIndex, event.currentIndex);
  // Reassign contiguous priorities 1..N
  const reordered = rules.map((r, idx) => ({ ...r, intPriority: idx + 1 }));
  this.categoryService.saveAllRules(reordered);
}
```

**Up/Down arrow buttons** (accessibility alternative to drag):
Each row also has `[↑]` and `[↓]` icon buttons that swap the rule with its neighbor and rewrite priorities identically to `onDrop`.

**`resolveSubcategoryLabel(subcategoryId)`:**
Returns `"Category → Subcategory"` string for display. Computed from `subcategories` and `categories` arrays.

---

## Page 3 — `DuplicationCollectionListComponent`

Files:
- `src/app/features/categories/pages/duplication-collection-list/duplication-collection-list.component.ts`
- `src/app/features/categories/pages/duplication-collection-list/duplication-collection-list.component.html`

### Purpose

Manage `DuplicationCollection[]` — named sets of strings used by the P3 duplication rule. Each collection has a name and an array of strings.

### Template structure

Page title: "Duplication Collections"
Explanation: *"Collections group merchant name variations for duplicate detection. A transaction is flagged if its description matches any string in a collection that also matches an existing transaction."*

**List** — one card per collection:
- Collection name (editable inline on click).
- String chips: `mat-chip-set` with each string as a chip. Each chip has a `×` to remove it.
- "Add string" inline input inside the chip set: typing and pressing Enter adds the string to the collection's `strings` array, then saves.
- `[Delete collection]` button (danger, confirm dialog).

**Add collection form** at top:
- Collection name input + `[Add Collection]` button.
- Creates a new `DuplicationCollection` with `strings: []`.

**Save on every mutation:**
After any chip add/remove or name edit: `duplicationCollectionService.save({ ...collection })`.

**Delete collection confirm:**
```
Title: "Delete collection?"
Message: "Remove collection '[col.strName]'? Rows using this collection will no longer be detected by the P3 rule."
danger: true
```

---

## Acceptance Criteria

- Category list shows categories with expandable subcategory lists.
- Adding a subcategory appears immediately under the correct category.
- Deleting a category shows a confirm dialog counting its subcategories.
- Deleting a subcategory calls `clearSubcategoryRef` on the transaction service.
- Rules list is drag-reorderable; after dragging, priorities are reassigned 1..N and persisted.
- Up/down buttons on rules produce the same result as drag.
- Adding a rule auto-assigns the next priority.
- Subcategory select in rule form shows `mat-optgroup` grouping by category.
- Duplication collections support adding/removing string chips with live save.
