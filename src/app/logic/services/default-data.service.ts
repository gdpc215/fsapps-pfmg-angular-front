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
    this.addCategory(categories, 'Home Cleaning', housingId);
    this.addCategory(categories, 'Property Tax', housingId);
    this.addCategory(categories, 'Home Insurance', housingId);

    // Transportation category and subcategories
    const transportationId = this.addCategory(categories, 'Transportation', null);
    this.addCategory(categories, 'Fuel/Gas', transportationId);
    this.addCategory(categories, 'Public Transit', transportationId);
    this.addCategory(categories, 'Parking', transportationId);
    this.addCategory(categories, 'Taxi', transportationId);
    this.addCategory(categories, 'Scooter', transportationId);

    // Food & Dining category and subcategories
    const foodId = this.addCategory(categories, 'Food & Dining', null);
    this.addCategory(categories, 'Groceries', foodId);
    this.addCategory(categories, 'Restaurants', foodId);
    this.addCategory(categories, 'Fast Food', foodId);
    this.addCategory(categories, 'Food Delivery', foodId);

    // Shopping category and subcategories
    const shoppingId = this.addCategory(categories, 'Shopping', null);
    this.addCategory(categories, 'Clothes & Shoes', shoppingId);
    this.addCategory(categories, 'Accessories', shoppingId);
    this.addCategory(categories, 'Electronics', shoppingId);
    this.addCategory(categories, 'Home Furniture', shoppingId);
    this.addCategory(categories, 'Home Appliances', shoppingId);
    this.addCategory(categories, 'Fitness Accessories', shoppingId);
    this.addCategory(categories, 'Gifts', shoppingId);
    this.addCategory(categories, 'Books & Media', shoppingId);
    this.addCategory(categories, 'Other Shopping', shoppingId);

    // Entertainment category and subcategories
    const entertainmentId = this.addCategory(categories, 'Entertainment', null);
    this.addCategory(categories, 'General Entertainment', entertainmentId);
    this.addCategory(categories, 'Alcohol', entertainmentId);
    this.addCategory(categories, 'Streaming Services', entertainmentId);
    this.addCategory(categories, 'Subscriptions', entertainmentId);
    this.addCategory(categories, 'Gaming', entertainmentId);
    this.addCategory(categories, 'Concerts & Events', entertainmentId);
    this.addCategory(categories, 'Hobbies', entertainmentId);

    // Health & Fitness category and subcategories
    const healthId = this.addCategory(categories, 'Health & Fitness', null);
    this.addCategory(categories, 'Doctor Visits', healthId);
    this.addCategory(categories, 'Pharmacy', healthId);
    this.addCategory(categories, 'Physical Therapy', healthId);
    this.addCategory(categories, 'Gym Membership', healthId);
    this.addCategory(categories, 'Sport Activities', healthId);
    this.addCategory(categories, 'Fitness Supplements', healthId);

    // Education category and subcategories
    const educationId = this.addCategory(categories, 'Education', null);
    this.addCategory(categories, 'Tuition', educationId);
    this.addCategory(categories, 'Books & Supplies', educationId);
    this.addCategory(categories, 'Online Courses', educationId);
    this.addCategory(categories, 'Training', educationId);

    // Bills & Services category and subcategories
    const billsId = this.addCategory(categories, 'Bills & Services', null);
    this.addCategory(categories, 'Phone', billsId);
    this.addCategory(categories, 'Internet', billsId);
    this.addCategory(categories, 'Banking Fees', billsId);
    this.addCategory(categories, 'Professional Services', billsId);
    this.addCategory(categories, 'Other Bills & Services', billsId);

    // Personal category and subcategories
    const personalId = this.addCategory(categories, 'Personal', null);
    this.addCategory(categories, 'Hair & Beauty', personalId);
    this.addCategory(categories, 'Personal Care', personalId);
    this.addCategory(categories, 'Laundry', personalId);
    this.addCategory(categories, 'Documentation', personalId);
    this.addCategory(categories, 'Familiar Support', personalId);
    this.addCategory(categories, 'Other Personal', personalId);

    // Travel category and subcategories
    const travelId = this.addCategory(categories, 'Travel', null);
    this.addCategory(categories, 'Flights & Transportation', travelId);
    this.addCategory(categories, 'Hotels & Accommodation', travelId);
    this.addCategory(categories, 'Vacation Activities', travelId);
    this.addCategory(categories, 'Purchases', travelId);

    // Savings & Investments category and subcategories
    const financesId = this.addCategory(categories, 'Financial Movements', null);
    this.addCategory(categories, 'Emergency Fund', financesId);
    this.addCategory(categories, 'Savings', financesId);
    this.addCategory(categories, 'Investments', financesId);
    this.addCategory(categories, 'Stocks', financesId);
    this.addCategory(categories, 'Insurances', financesId);
    this.addCategory(categories, 'Cash Withdrawal', financesId);
    this.addCategory(categories, 'Transfer', financesId);
    this.addCategory(categories, 'Credit Card Payment', financesId);
    this.addCategory(categories, 'Loan Payment', financesId);
    this.addCategory(categories, 'Charges & Fees', financesId);
    this.addCategory(categories, 'Other Financial Movements', financesId);
    this.addCategory(categories, 'Other Debt Payments', financesId);

    // Miscellaneous
    this.addCategory(categories, 'Uncategorized', null);

    return categories;
  }

  /**
   * Returns default subcategory rules for auto-categorization based on description text.
   * Each rule maps a pattern to a subcategory name (e.g., 'uber' → 'Taxi').
   *
   * Example usage: getDefaultSubcategoryRules(categories)
   */
  getDefaultSubcategoryRules(categories: Category[]): { pattern: string, subcategoryId: string, ruleType: 'contains' }[] {
    // Find subcategory IDs by name (case-insensitive)
    const findSubcat = (name: string) => {
      const match = categories.find(c => c.name.toLowerCase() === name.toLowerCase());
      return match ? match.id : '';
    };
    return [
      { pattern: 'vivanda', subcategoryId: findSubcat('Groceries'), ruleType: 'contains' },
      { pattern: 'tottus', subcategoryId: findSubcat('Groceries'), ruleType: 'contains' },
      { pattern: 'makro', subcategoryId: findSubcat('Groceries'), ruleType: 'contains' },
      { pattern: 'oxxo', subcategoryId: findSubcat('Groceries'), ruleType: 'contains' },
      { pattern: 'tambo', subcategoryId: findSubcat('Groceries'), ruleType: 'contains' },

      { pattern: 'rappi', subcategoryId: findSubcat('Food Delivery'), ruleType: 'contains' },
      { pattern: 'glovo', subcategoryId: findSubcat('Food Delivery'), ruleType: 'contains' },

      { pattern: 'starbucks', subcategoryId: findSubcat('Restaurants'), ruleType: 'contains' },
      { pattern: 'proteinfood', subcategoryId: findSubcat('Restaurants'), ruleType: 'contains' },

      { pattern: 'directvgo', subcategoryId: findSubcat('Streaming Services'), ruleType: 'contains' },
      { pattern: 'netflix', subcategoryId: findSubcat('Streaming Services'), ruleType: 'contains' },
      { pattern: 'disneyplus', subcategoryId: findSubcat('Streaming Services'), ruleType: 'contains' },
      { pattern: 'hbomax', subcategoryId: findSubcat('Streaming Services'), ruleType: 'contains' },
      { pattern: 'spotify', subcategoryId: findSubcat('Streaming Services'), ruleType: 'contains' },

      { pattern: 'blizzard', subcategoryId: findSubcat('Gaming'), ruleType: 'contains' },
      { pattern: 'steam', subcategoryId: findSubcat('Gaming'), ruleType: 'contains' },
      { pattern: 'dota', subcategoryId: findSubcat('Gaming'), ruleType: 'contains' },

      { pattern: 'googleone', subcategoryId: findSubcat('Subscriptions'), ruleType: 'contains' },

      { pattern: 'smartfit', subcategoryId: findSubcat('Gym Membership'), ruleType: 'contains' },
      { pattern: 'labnutrition', subcategoryId: findSubcat('Fitness Supplements'), ruleType: 'contains' },
      { pattern: 'nutripoint', subcategoryId: findSubcat('Fitness Supplements'), ruleType: 'contains' },

      { pattern: 'nuby0000', subcategoryId: findSubcat('Utilities'), ruleType: 'contains' },

      { pattern: 'latam', subcategoryId: findSubcat('Flights & Transportation'), ruleType: 'contains' },
      { pattern: 'airbnb', subcategoryId: findSubcat('Hotels & Accommodation'), ruleType: 'contains' },

      { pattern: 'apparka', subcategoryId: findSubcat('Parking'), ruleType: 'contains' },
      { pattern: 'parking', subcategoryId: findSubcat('Parking'), ruleType: 'contains' },

      { pattern: 'uber', subcategoryId: findSubcat('Taxi'), ruleType: 'contains' },
      { pattern: 'cabify', subcategoryId: findSubcat('Taxi'), ruleType: 'contains' },

      { pattern: 'rimacrec', subcategoryId: findSubcat('Insurances'), ruleType: 'contains' },
      { pattern: 'pacifico', subcategoryId: findSubcat('Insurances'), ruleType: 'contains' },
      { pattern: 'pago bca internet', subcategoryId: findSubcat('Credit Card Payment'), ruleType: 'contains' },
      { pattern: 'PAGO BANCA MOVIL', subcategoryId: findSubcat('Credit Card Payment'), ruleType: 'contains' },
      { pattern: 'pase cuotas', subcategoryId: findSubcat('Other Financial Movements'), ruleType: 'contains' },
      // Add more rules as needed
    ];
  }

  /**
   * Returns default duplicate detection rules for movements.
   * Each rule defines a group of equivalent descriptions, account type, and currencies.
   */
  getDefaultDetectionRules(): { descriptionGroup: string[], accountType: 'debit' | 'credit' | 'all', currencies: string[] }[] {
    return [
      { descriptionGroup: ["LP LATAM XP LIMA", "LATAM AIR LIMA PE"], accountType: 'credit', currencies: ['USD'] },
      // Add more default detection rules as needed
    ];
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
