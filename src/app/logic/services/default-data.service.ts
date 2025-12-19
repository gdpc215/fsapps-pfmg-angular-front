import { Injectable } from '@angular/core';
import { Category } from '../types/category';
import { Currency } from '../types/currency';
import { Utilities } from '../utilities';

@Injectable({ providedIn: 'root' })
export class DefaultDataService {

  getDefaultCurrencies(): Currency[] {
    return [
      this.createCurrency('PEN', 'S/', 'Sol Peruano', 1),       // Base currency
      this.createCurrency('USD', '$', 'US Dollar', 3.36)        // 1 USD = 3.36 PEN
    ];
  }

  getDefaultCategories(): Category[] {
    const categories: Category[] = [];

    // Income category and subcategories
    const incomeId = this.addCategory(categories, 'Income', null);
    this.addCategory(categories, 'Salary', incomeId);
    this.addCategory(categories, 'Freelance', incomeId);
    this.addCategory(categories, 'Investment Returns', incomeId);
    this.addCategory(categories, 'Business Income', incomeId);
    this.addCategory(categories, 'Other Income', incomeId);

    // Housing category and subcategories
    const housingId = this.addCategory(categories, 'Housing', null);
    this.addCategory(categories, 'Rent/Mortgage', housingId);
    this.addCategory(categories, 'Utilities', housingId);
    this.addCategory(categories, 'Home Maintenance', housingId);
    this.addCategory(categories, 'Property Tax', housingId);
    this.addCategory(categories, 'Home Insurance', housingId);

    // Transportation category and subcategories
    const transportationId = this.addCategory(categories, 'Transportation', null);
    this.addCategory(categories, 'Fuel/Gas', transportationId);
    this.addCategory(categories, 'Public Transit', transportationId);
    this.addCategory(categories, 'Car Payment', transportationId);
    this.addCategory(categories, 'Car Maintenance', transportationId);
    this.addCategory(categories, 'Car Insurance', transportationId);
    this.addCategory(categories, 'Parking', transportationId);
    this.addCategory(categories, 'Ride Share/Taxi', transportationId);

    // Food & Dining category and subcategories
    const foodId = this.addCategory(categories, 'Food & Dining', null);
    this.addCategory(categories, 'Groceries', foodId);
    this.addCategory(categories, 'Restaurants', foodId);
    this.addCategory(categories, 'Coffee Shops', foodId);
    this.addCategory(categories, 'Fast Food', foodId);
    this.addCategory(categories, 'Food Delivery', foodId);

    // Shopping category and subcategories
    const shoppingId = this.addCategory(categories, 'Shopping', null);
    this.addCategory(categories, 'Clothing', shoppingId);
    this.addCategory(categories, 'Electronics', shoppingId);
    this.addCategory(categories, 'Home Goods', shoppingId);
    this.addCategory(categories, 'Personal Care', shoppingId);
    this.addCategory(categories, 'Gifts', shoppingId);
    this.addCategory(categories, 'Books & Media', shoppingId);

    // Entertainment category and subcategories
    const entertainmentId = this.addCategory(categories, 'Entertainment', null);
    this.addCategory(categories, 'Movies & Shows', entertainmentId);
    this.addCategory(categories, 'Streaming Services', entertainmentId);
    this.addCategory(categories, 'Games', entertainmentId);
    this.addCategory(categories, 'Concerts & Events', entertainmentId);
    this.addCategory(categories, 'Hobbies', entertainmentId);

    // Health & Fitness category and subcategories
    const healthId = this.addCategory(categories, 'Health & Fitness', null);
    this.addCategory(categories, 'Doctor Visits', healthId);
    this.addCategory(categories, 'Pharmacy', healthId);
    this.addCategory(categories, 'Health Insurance', healthId);
    this.addCategory(categories, 'Gym Membership', healthId);
    this.addCategory(categories, 'Sports', healthId);

    // Education category and subcategories
    const educationId = this.addCategory(categories, 'Education', null);
    this.addCategory(categories, 'Tuition', educationId);
    this.addCategory(categories, 'Books & Supplies', educationId);
    this.addCategory(categories, 'Online Courses', educationId);
    this.addCategory(categories, 'Training', educationId);

    // Bills & Services category and subcategories
    const billsId = this.addCategory(categories, 'Bills & Services', null);
    this.addCategory(categories, 'Internet', billsId);
    this.addCategory(categories, 'Phone', billsId);
    this.addCategory(categories, 'Subscriptions', billsId);
    this.addCategory(categories, 'Banking Fees', billsId);
    this.addCategory(categories, 'Professional Services', billsId);

    // Personal category and subcategories
    const personalId = this.addCategory(categories, 'Personal', null);
    this.addCategory(categories, 'Hair & Beauty', personalId);
    this.addCategory(categories, 'Clothing & Accessories', personalId);
    this.addCategory(categories, 'Laundry', personalId);
    this.addCategory(categories, 'Pet Care', personalId);

    // Travel category and subcategories
    const travelId = this.addCategory(categories, 'Travel', null);
    this.addCategory(categories, 'Flights', travelId);
    this.addCategory(categories, 'Hotels', travelId);
    this.addCategory(categories, 'Vacation Activities', travelId);
    this.addCategory(categories, 'Travel Insurance', travelId);

    // Savings & Investments category and subcategories
    const savingsId = this.addCategory(categories, 'Savings & Investments', null);
    this.addCategory(categories, 'Emergency Fund', savingsId);
    this.addCategory(categories, 'Retirement', savingsId);
    this.addCategory(categories, 'Stocks', savingsId);
    this.addCategory(categories, 'Real Estate', savingsId);

    // Debt Payments category and subcategories
    const debtId = this.addCategory(categories, 'Debt Payments', null);
    this.addCategory(categories, 'Credit Card Payment', debtId);
    this.addCategory(categories, 'Student Loan', debtId);
    this.addCategory(categories, 'Personal Loan', debtId);
    this.addCategory(categories, 'Other Debt', debtId);

    // Miscellaneous
    this.addCategory(categories, 'Uncategorized', null);
    this.addCategory(categories, 'Cash Withdrawal', null);
    this.addCategory(categories, 'Transfer', null);

    return categories;
  }

  private createCurrency(code: string, symbol: string, name: string, conversionRate: number = 1): Currency {
    const currency = new Currency();
    currency.id = Utilities.generateUUID();
    currency.code = code;
    currency.symbol = symbol;
    currency.name = name;
    currency.conversionRate = conversionRate;
    return currency;
  }

  private addCategory(categories: Category[], name: string, parentId: string | null): string {
    const category = new Category();
    category.id = Utilities.generateUUID();
    category.name = name;
    category.parentId = parentId;
    categories.push(category);
    return category.id;
  }
}
