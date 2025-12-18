import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, catchError, finalize, tap } from 'rxjs';
import { Constants } from '../constants';
import { User } from '../types/user';
import { BaseService } from './base.service';


@Injectable({ providedIn: 'root' })
export class TestService extends BaseService {

  constructor(
    private http: HttpClient,
  ) {
    super('TestService');
    this.apiBase = "test";
  }

  getBase() {
    return this.apiBase;
  }

  //#region API Calls
  /**
   * Gets an object by its ID.
   * @param id - The ID of the object to retrieve.
   * @returns Observable<User> - An observable of the retrieved user.
   */
  private get(id: string, getDetails: boolean, storeInCache: boolean = true): Observable<User> {
    console.log(`Getting user from server.`);
    this.loading.next(true);
    const serviceUrl = this.buildURL("get", { id: id, details: getDetails.toString() });

    return this.http
      .get<User>(serviceUrl)
      .pipe(
        tap(user => {
          if (storeInCache) {
            this.storeToCache(user, `Acquired user`);
          }
        }),
        catchError(this.handleError<User>('get')),
        finalize(() => this.loading.next(false))
      );
  }
  //#endregion

  //#region Local Cache
  private storeToCache(user: User | null, message: string = "") {
    if (message) console.log(message);
    this.loading.next(false);
    this.storeInLocalStorage(user, Constants.StorageTags.USER_OBJECT);
  }

  private fetchFromCache(): User {
    return this.fetchFromLocalStorage<User>(Constants.StorageTags.USER_OBJECT) ?? new User();
  }
  //#endregion

}
