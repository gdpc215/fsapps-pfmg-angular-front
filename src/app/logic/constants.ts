import { environment } from "../../environments/environment";

export class Constants {
  // Time and date formats
  public static DATE_FORMAT = "yyyy-MM-dd HH:mm";

  static get ENDPOINT(): string {
    return (environment as any)?.apiBase || "";
  }
  
  public static StorageTags = class {
    public static readonly USER_OBJECT = "USER_OBJECT";
  }
}
