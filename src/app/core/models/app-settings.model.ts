import { AccountType } from './transaction.model';

export interface GmailCardMapEntry {
  strLast4: string;
  accountId: string;
  accountType: AccountType;
}

export interface AppSettings {
  boolP2RuleEnabled: boolean;

  /** Deployment URL of the BCP Gmail connector Web App (…/exec). */
  strGmailSyncUrl?: string;
  /** Shared secret matching the connector's API_TOKEN script property. */
  strGmailSyncToken?: string;
  /** ISO timestamp of the last successful Gmail import (the run's "until"). */
  strLastGmailSyncAt?: string;
  /** Card last-4 → account resolution for parsed BCP movements. */
  gmailCardMap?: GmailCardMapEntry[];
  /** Gmail messageIds already imported — a capped guard against re-import. */
  arrProcessedGmailMessageIds?: string[];
}

export const DEFAULT_APP_SETTINGS: AppSettings = {
  boolP2RuleEnabled: false,
  strGmailSyncUrl: '',
  strGmailSyncToken: '',
  gmailCardMap: [],
  arrProcessedGmailMessageIds: [],
};
