# WP14 — App Settings Page

**Depends on:** WP01, WP02, WP03  
**Spec:** DESIGN_LOCAL_v5.md §6.9, §8 (settings feature)

---

## Goal

Replace the settings stub module with a simple settings page that lets the user toggle the P2 duplication rule. This page will also serve as the home for any future app-level settings.

---

## `SettingsModule`

File: `src/app/features/settings/settings.module.ts`

Route: `''` → `AppSettingsComponent`

Import: `SharedModule`, `MatSlideToggleModule`, `MatCardModule`, `MatDividerModule`, `FormsModule`.

---

## `AppSettingsComponent`

Files:
- `src/app/features/settings/pages/app-settings/app-settings.component.ts`
- `src/app/features/settings/pages/app-settings/app-settings.component.html`

### Inject
`SettingsService`, `SnackbarService`

### State
```typescript
settings$ = this.settingsService.settings$;
```

### Template

**Page title:** "Settings"

**Section: Import Settings**

```html
<mat-card class="max-w-lg">
  <mat-card-header>
    <mat-card-title>Import Settings</mat-card-title>
  </mat-card-header>
  <mat-card-content>
    <mat-divider class="mb-4"></mat-divider>

    <div class="flex items-start justify-between gap-4 py-3">
      <div>
        <p class="font-medium">P2 Duplicate Detection Rule</p>
        <p class="text-sm text-gray-500 mt-1">
          When enabled, flags transactions with the same amount within 3 days as
          potential duplicates — even if the description differs. This catches more
          duplicates but may produce false positives.
        </p>
      </div>
      <mat-slide-toggle
        [checked]="(settings$ | async)?.boolP2RuleEnabled"
        (change)="onP2Toggle($event.checked)">
      </mat-slide-toggle>
    </div>
  </mat-card-content>
</mat-card>
```

### Toggle handler

```typescript
onP2Toggle(enabled: boolean): void {
  this.settingsService.saveSettings({ boolP2RuleEnabled: enabled });
  this.snackbar.success(enabled ? 'P2 rule enabled.' : 'P2 rule disabled.');
}
```

### Future settings placeholder

After the P2 toggle, add a `<mat-divider>` and a grayed-out section:

```html
<div class="mt-6 text-sm text-gray-400 italic">
  More settings coming soon.
</div>
```

---

## Acceptance Criteria

- Toggling P2 rule updates `localStorage` under `pfmg_settings` immediately.
- Page re-renders correctly when navigating away and back (reads from `SettingsService`).
- The toggle reflects the persisted value on page load (not always "off").
- Snackbar confirms the change.
