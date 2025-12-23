import { environment } from "../../environments/environment";

export class Constants {
  // Time and date formats
  public static DATE_FORMAT = "yyyy-MM-dd HH:mm";

  static get ENDPOINT(): string {
    return (environment as any)?.apiBase || "";
  }
  
  public static StorageTags = class {
    public static readonly USER_OBJECT = "USER_OBJECT";
    public static readonly CURRENCIES = "CURRENCIES";
    public static readonly ACCOUNTS = "ACCOUNTS";
    public static readonly CARDS = "CARDS";
    public static readonly MOVEMENTS = "MOVEMENTS";
    public static readonly CATEGORIES = "CATEGORIES";
    public static readonly CATEGORY_RULES = "CATEGORY_RULES";
    public static readonly RECURRENT_TRANSACTIONS = "RECURRENT_TRANSACTIONS";
  }
}
