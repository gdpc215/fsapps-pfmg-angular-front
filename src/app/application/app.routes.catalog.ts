export const CatalogRoutes = {
  APP: 'app',

  // Main routes
  HOME: 'home',
  ABOUT: 'about',
  ERROR: 'error',

  // Transactions module
  TRANSACTIONS: 'transactions',
  TRANSACTIONS_DASHBOARD: 'dashboard',
  TRANSACTIONS_CURRENCIES: 'currencies',
  TRANSACTIONS_ACCOUNTS: 'accounts',
  TRANSACTIONS_CARDS: 'cards',
  TRANSACTIONS_MOVEMENTS: 'movements',
  TRANSACTIONS_CATEGORIES: 'categories',

  // NESTED: {
  //   BASE: 'nested',
  //   CATEGORY: (id: string) => `${id}`,
  // },

} as const;
