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
  
  // Settings pages
  SETTINGS: 'settings',
  SETTINGS_CURRENCIES: 'currencies',
  SETTINGS_ACCOUNTS: 'accounts',
  SETTINGS_CARDS: 'cards',
  SETTINGS_CATEGORIES: 'categories',

  // NESTED: {
  //   BASE: 'nested',
  //   CATEGORY: (id: string) => `${id}`,
  // },

} as const;
