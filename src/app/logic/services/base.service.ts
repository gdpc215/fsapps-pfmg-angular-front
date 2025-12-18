import { BehaviorSubject, EMPTY, Observable, of } from "rxjs";
import { Constants } from "../constants";

export class BaseService {
  protected apiBase = "base";
  protected loading: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(false);

  constructor(
    public serviceName: string
  ) { }

  protected buildURL(subpath: string, parameters: { [key: string]: any } = {}): string {
    let url = Constants.ENDPOINT + '/' + this.apiBase + '/' + subpath;

    // Check if parameters object is not empty
    if (parameters && Object.keys(parameters).length > 0) {
      // Construct query string from parameters object
      const queryString = Object.keys(parameters)
        .map(key => encodeURIComponent(key) + '=' + encodeURIComponent(parameters[key]))
        .join('&');

      // Append query string to URL
      url += '?' + queryString;
    }

    return url;
  }

  /**
   * Handle Http operation that failed.
   * Let the app continue.
   *
   * @param operation - name of the operation that failed
   * @param result - optional value to return as the observable result
   */
  protected handleError<T>(operation = 'operation', result?: T) {
    return (error: any): Observable<T> => {

      // TODO: send the error to remote logging infrastructure
      console.error(error); // log to console instead

      // TODO: better job of transforming error for user consumption
      console.log(`${operation} failed: ${error.message}`);

      // Let the app keep running by returning an empty result.
      if (result == EMPTY) { return EMPTY; }
      return of(result as T);
    };
  }

  public getLoading(): Observable<boolean> {
    return this.loading;
  }

  /**
   * Store a JSON string representing an object in the Local Storage (persistent through refreshes and sessions)
   *
   * @param object - the object that will be stored.
   * @param storageTag - the identifier of the object to be stored.
   */
  protected storeInLocalStorage(object: any, storageTag: string) {
    localStorage.removeItem(storageTag);
    if (object == null) {
      return;
    }
    localStorage.setItem(storageTag, JSON.stringify(object));
  }

  /**
   * Return an object from the string stored in the Local Storage
   *
   * @param storageTag - the identifier of the object to be fetched.
   */
  protected fetchFromLocalStorage<T>(storageTag: string): T | null {
    let storedValue = localStorage.getItem(storageTag);
    return (storedValue != null && storedValue != "") ? JSON.parse(storedValue) : null;
  }

  /**
   * Return an object from the string stored in the Local Storage
   *
   * @param storageTag - the identifier of the object to be fetched.
   */
  protected fetchStringFromLocalStorage<T>(storageTag: string): string | null {
    let storedValue = localStorage.getItem(storageTag);
    return (storedValue != null && storedValue != "") ? storedValue : null;
  }

  /**
   * Clear an object from the Local Storage
   *
   * @param storageTag - the identifier of the object to be cleared.
   */
  protected clearLocalStorage(storageTag: string) {
    localStorage.removeItem(storageTag);
  }

  /**
   * Store a JSON string representing an object in the Session Storage (persistent only during the session)
   *
   * @param object - the object that will be stored.
   * @param storageTag - the identifier of the object to be stored.
   */
  protected storeInSessionStorage(object: any, storageTag: string) {
    sessionStorage.removeItem(storageTag);
    if (object == null) {
      return;
    }
    sessionStorage.setItem(storageTag, JSON.stringify(object));
  }

  /**
   * Return an object from the string stored in the Session Storage
   *
   * @param storageTag - the identifier of the object to be fetched.
   */
  protected fetchFromSessionStorage<T>(storageTag: string): T | null {
    let storedValue = sessionStorage.getItem(storageTag);
    return (storedValue != null && storedValue != "") ? JSON.parse(storedValue) : null;
  }

  /**
   * Return a string from the Session Storage
   *
   * @param storageTag - the identifier of the object to be fetched.
   */
  protected fetchStringFromSessionStorage(storageTag: string): string | null {
    let storedValue = sessionStorage.getItem(storageTag);
    return (storedValue != null && storedValue != "") ? storedValue : null;
  }

  /**
   * Clear an object from the Session Storage
   * @param storageTag - the identifier of the object to be cleared.
   */
  protected clearSessionStorage(storageTag: string) {
    sessionStorage.removeItem(storageTag);
  }
}