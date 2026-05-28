# WP02 — App Shell & Routing

**Depends on:** WP01  
**Spec:** DESIGN_LOCAL_v5.md §8 (component structure), route catalog

---

## Goal

Replace the placeholder app shell with the PFMG shell: a `mat-sidenav-container` layout with a persistent sidenav and `<router-outlet>`. Wire up all lazy-loaded feature routes. The existing placeholder pages (Home, About) can remain in place for now — they will be replaced as feature WPs land.

---

## Step 1 — Replace `app.routes.catalog.ts`

File: `src/app/application/app.routes.catalog.ts`

Replace the entire file with:

```typescript
export const ROUTES = {
  CREDIT_CARDS:            'credit-cards',
  TRANSACTIONS:            'transactions',
  IMPORT:                  'import',
  CATEGORIES:              'categories',
  CATEGORY_RULES:          'categories/rules',
  DUPLICATION_COLLECTIONS: 'categories/duplications',
  CONCILIATION:            'conciliation',
  DEBIT_ACCOUNTS:          'debit-accounts',
  RECURRENT_TRANSACTIONS:  'recurrent-transactions',
  RECURRENT_DASHBOARD:     'recurrent-transactions/dashboard',
  EXPLORER:                'explorer',
  DASHBOARD_MONTHLY:       'dashboard/monthly',
  DASHBOARD_CYCLE:         'dashboard/cycle',
  SETTINGS:                'settings',
} as const;
```

---

## Step 2 — Create `LayoutModule`

Directory: `src/app/layout/`

Create `src/app/layout/layout.module.ts`:

```typescript
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ShellComponent } from './shell/shell.component';
import { SidenavComponent } from './sidenav/sidenav.component';

@NgModule({
  declarations: [ShellComponent, SidenavComponent],
  imports: [
    CommonModule,
    RouterModule,
    MatSidenavModule,
    MatListModule,
    MatIconModule,
    MatToolbarModule,
    MatButtonModule,
    MatTooltipModule,
  ],
  exports: [ShellComponent],
})
export class LayoutModule {}
```

---

## Step 3 — `ShellComponent`

Files:
- `src/app/layout/shell/shell.component.ts`
- `src/app/layout/shell/shell.component.html`

```typescript
import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-shell',
  standalone: false,
  templateUrl: './shell.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShellComponent {}
```

Template uses `mat-sidenav-container` (fixed, full height). Left side: `<app-sidenav>`. Right side: `<router-outlet>` wrapped in a scrollable content area.

```html
<mat-sidenav-container class="h-screen">
  <mat-sidenav mode="side" opened class="w-56">
    <app-sidenav></app-sidenav>
  </mat-sidenav>
  <mat-sidenav-content class="overflow-y-auto p-4">
    <router-outlet></router-outlet>
  </mat-sidenav-content>
</mat-sidenav-container>
```

---

## Step 4 — `SidenavComponent`

Files:
- `src/app/layout/sidenav/sidenav.component.ts`
- `src/app/layout/sidenav/sidenav.component.html`

```typescript
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ROUTES } from '../../application/app.routes.catalog';

@Component({
  selector: 'app-sidenav',
  standalone: false,
  templateUrl: './sidenav.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SidenavComponent {
  readonly ROUTES = ROUTES;
}
```

Template is a `mat-nav-list` with `routerLink` and `routerLinkActive="active"` on each item. Group items visually with Tailwind dividers. Use `mat-list-item` for each route.

Nav items in order:
1. **Accounts** section: Credit Cards (`/credit-cards`), Debit Accounts (`/debit-accounts`)
2. **Import** section: Import Wizard (`/import`)
3. **Analysis** section: Monthly Dashboard (`/dashboard/monthly`), Cycle Dashboard (`/dashboard/cycle`), Explorer (`/explorer`)
4. **Management** section: Conciliation (`/conciliation`), Recurrent Transactions (`/recurrent-transactions`), Recurrent Dashboard (`/recurrent-transactions/dashboard`)
5. **Config** section: Categories (`/categories`), Rules (`/categories/rules`), Duplication Collections (`/categories/duplications`), Settings (`/settings`)

Each item: mat-icon + label. Use Material icons: `credit_card`, `account_balance`, `upload_file`, `bar_chart`, `loop`, `search`, `sync`, `repeat`, `dashboard`, `category`, `tune`, `filter_list`, `settings`.

---

## Step 5 — Update `app.routes.module.ts`

Replace the existing routes with the PFMG lazy-loaded routes. The shell wraps all feature routes as children.

```typescript
import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ShellComponent } from '../layout/shell/shell.component';

const routes: Routes = [
  {
    path: '',
    component: ShellComponent,
    children: [
      { path: '', redirectTo: 'dashboard/cycle', pathMatch: 'full' },
      {
        path: 'credit-cards',
        loadChildren: () =>
          import('../features/credit-cards/credit-cards.module').then(m => m.CreditCardsModule),
      },
      {
        path: 'debit-accounts',
        loadChildren: () =>
          import('../features/debit-accounts/debit-accounts.module').then(m => m.DebitAccountsModule),
      },
      {
        path: 'import',
        loadChildren: () =>
          import('../features/import/import.module').then(m => m.ImportModule),
      },
      {
        path: 'categories',
        loadChildren: () =>
          import('../features/categories/categories.module').then(m => m.CategoriesModule),
      },
      {
        path: 'conciliation',
        loadChildren: () =>
          import('../features/conciliation/conciliation.module').then(m => m.ConciliationModule),
      },
      {
        path: 'recurrent-transactions',
        loadChildren: () =>
          import('../features/recurrent-transactions/recurrent-transactions.module').then(m => m.RecurrentTransactionsModule),
      },
      {
        path: 'explorer',
        loadChildren: () =>
          import('../features/explorer/explorer.module').then(m => m.ExplorerModule),
      },
      {
        path: 'dashboard',
        loadChildren: () =>
          import('../features/dashboard/dashboard.module').then(m => m.DashboardModule),
      },
      {
        path: 'settings',
        loadChildren: () =>
          import('../features/settings/settings.module').then(m => m.SettingsModule),
      },
      {
        path: 'transactions',
        loadChildren: () =>
          import('../features/transactions/transactions.module').then(m => m.TransactionsModule),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule],
})
export class AppRoutesModule {}
```

**Important:** The lazy-loaded modules do not exist yet — this will cause build errors until WP07–WP14 create them. To keep the build passing during development, create stub modules for each feature (see Step 6).

---

## Step 6 — Create Stub Feature Modules

For each feature that doesn't exist yet, create a minimal stub module so the lazy routes resolve. This allows the shell to render and the sidenav to work before the feature pages are built.

For each feature in the list below, create:
- `src/app/features/<feature>/<feature>.module.ts`
- `src/app/features/<feature>/pages/<feature-page>/<feature-page>.component.ts`
- A minimal route in the module pointing to the stub component.

Features to stub (one stub component each, route at `''`):
- `credit-cards` → `CreditCardsModule`, component selector `app-credit-cards`
- `debit-accounts` → `DebitAccountsModule`, component selector `app-debit-accounts`
- `import` → `ImportModule`, component selector `app-import`
- `categories` → `CategoriesModule`, component selector `app-categories`
- `conciliation` → `ConciliationModule`, component selector `app-conciliation`
- `recurrent-transactions` → `RecurrentTransactionsModule`, component selector `app-recurrent-transactions`
- `explorer` → `ExplorerModule`, component selector `app-explorer`
- `dashboard` → `DashboardModule`, component selector `app-dashboard` (child routes: `monthly`, `cycle`)
- `settings` → `SettingsModule`, component selector `app-settings`
- `transactions` → `TransactionsModule`, component selector `app-transactions`

Stub component template: `<p class="p-4">{{ title }} — coming soon</p>` with a `title` property.

---

## Step 7 — Update `AppModule`

Add imports:
```typescript
import { LayoutModule } from '../layout/layout.module';
import { CoreModule } from '../core/core.module';
```

Add to `imports` array: `LayoutModule`, `CoreModule`.

Update `AppComponent` template (`app.component.html`) to just render the shell:
```html
<app-shell></app-shell>
```

Remove any existing placeholder content from `app.component.html`.

---

## Acceptance Criteria

- `npm run build` passes (all stub modules exist and resolve).
- `npm start` launches and the sidenav renders with all navigation items.
- Clicking each sidenav item navigates to the stub "coming soon" page for that feature.
- `routerLinkActive` highlights the active sidenav item.
- Default route (`/`) redirects to `/dashboard/cycle`.
