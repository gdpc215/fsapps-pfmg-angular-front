
export class Utilities {
  public static generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
  
  public static parseJson(json: string): any {
    if (!json || json.trim() === '') {
      return json;
    }
    
    try {
      return JSON.parse(json);
    } catch {
      return null;
    }
  }
}