import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { combineLatest, map, Observable } from 'rxjs';
import { SettingsService } from '../../../../core/services/settings.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { GmailCardMapEntry } from '../../../../core/models/app-settings.model';
import { AccountType } from '../../../../core/models/transaction.model';
import { CreditCardService } from '../../../credit-cards/services/credit-card.service';
import { DebitAccountService } from '../../../debit-accounts/services/debit-account.service';

interface AccountOption {
  accountId: string;
  accountType: AccountType;
  label: string;
}

@Component({
  selector: 'app-app-settings',
  standalone: false,
  templateUrl: './app-settings.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppSettingsComponent implements OnInit {
  settings$ = this.settingsService.settings$;

  accountOptions$: Observable<AccountOption[]> = combineLatest([
    this.creditCardService.cards$,
    this.debitAccountService.accounts$,
  ]).pipe(
    map(([cards, accounts]) => [
      ...cards.map(c => ({ accountId: c.id, accountType: 'CREDIT_CARD' as AccountType, label: c.strName })),
      ...accounts.map(a => ({ accountId: a.id, accountType: 'DEBIT_ACCOUNT' as AccountType, label: a.strName })),
    ]),
  );

  gmailUrl = '';
  gmailToken = '';
  cardMapDraft: GmailCardMapEntry[] = [];

  constructor(
    private settingsService: SettingsService,
    private snackbar: SnackbarService,
    private creditCardService: CreditCardService,
    private debitAccountService: DebitAccountService,
  ) {}

  ngOnInit(): void {
    const s = this.settingsService.getSettings();
    this.gmailUrl = s.strGmailSyncUrl ?? '';
    this.gmailToken = s.strGmailSyncToken ?? '';
    this.cardMapDraft = (s.gmailCardMap ?? []).map(e => ({ ...e }));
  }

  onP2Toggle(enabled: boolean): void {
    this.settingsService.saveSettings({ boolP2RuleEnabled: enabled });
    this.snackbar.success(enabled ? 'P2 rule enabled.' : 'P2 rule disabled.');
  }

  addCardMapRow(): void {
    this.cardMapDraft = [
      ...this.cardMapDraft,
      { strLast4: '', accountId: '', accountType: 'CREDIT_CARD' },
    ];
  }

  removeCardMapRow(i: number): void {
    this.cardMapDraft = this.cardMapDraft.filter((_, idx) => idx !== i);
  }

  onAccountIdPicked(i: number, accountId: string, options: AccountOption[]): void {
    const opt = options.find(o => o.accountId === accountId);
    if (!opt) return;
    this.cardMapDraft[i] = {
      ...this.cardMapDraft[i],
      accountId: opt.accountId,
      accountType: opt.accountType,
    };
  }

  saveGmailSettings(): void {
    const cleanedMap = this.cardMapDraft
      .map(e => ({ ...e, strLast4: e.strLast4.trim() }))
      .filter(e => e.strLast4 && e.accountId);
    this.settingsService.saveSettings({
      strGmailSyncUrl: this.gmailUrl.trim(),
      strGmailSyncToken: this.gmailToken.trim(),
      gmailCardMap: cleanedMap,
    });
    this.cardMapDraft = cleanedMap;
    this.snackbar.success('Gmail sync settings saved.');
  }
}
