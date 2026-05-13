export const CatalogRoutes = {
  APP: 'app',

  // Main routes
  HOME: 'home',
  ABOUT: 'about',
  ERROR: 'error',

  // Transactions module
  TRANSACTIONS: 'transactions',
  TRANSACTIONS_DASHBOARD: 'dashboard',
  TRANSACTIONS_MOVEMENTS: 'movements',
  TRANSACTIONS_MOVEMENTS_IMPORT: 'import',
  TRANSACTIONS_MANUAL_RECURRENTS: 'manual-recurrents',
  TRANSACTIONS_RECONCILIATION: 'reconciliation',
  
  // Settings pages
  SETTINGS: 'settings',
  SETTINGS_CURRENCIES: 'currencies',
  SETTINGS_ACCOUNTS: 'accounts',
  SETTINGS_CATEGORIES: 'categories',
  SETTINGS_CATEGORY_RULES: 'category-rules',
  SETTINGS_RECURRENT_TRANSACTIONS: 'recurrent-transactions',
  SETTINGS_DUPLICATE_DETECTION_RULES: 'duplicate-detection-rules',
  SETTINGS_SAVINGS_GOALS: 'savings-goals',
  SETTINGS_DATA_MANAGEMENT: 'data-management',

  // NESTED: {
  //   BASE: 'nested',
  //   CATEGORY: (id: string) => `${id}`,
  // },

} as const;
