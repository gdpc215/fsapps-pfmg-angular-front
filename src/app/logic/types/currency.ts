export class Currency {
  id: string;
  code: string;
  symbol: string;
  name: string;
  conversionRate: number; // Conversion rate to PEN (e.g., 1 USD = 3.36 PEN)

  constructor() {
    this.id = "";
    this.code = "";
    this.symbol = "";
    this.name = "";
    this.conversionRate = 1;
  }
}
