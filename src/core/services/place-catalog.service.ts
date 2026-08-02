import { Injectable, inject } from '@angular/core';
import { Observable, catchError, firstValueFrom, map, of, shareReplay, throwError } from 'rxjs';

import { DATA_SOURCE_MODE } from '../config/data-source.config';
import { Place } from '../models/place.model';
import { PlaceCatalogApiService } from './place-catalog-api.service';
import { PlaceCatalogMockService } from './place-catalog-mock.service';

@Injectable({
  providedIn: 'root',
})
export class PlaceCatalogService {
  private readonly mode = inject(DATA_SOURCE_MODE);
  private readonly apiDataSource = inject(PlaceCatalogApiService);
  private readonly mockDataSource = inject(PlaceCatalogMockService);

  private readonly places$ = this.getActiveDataSource()
    .fetchPlaces()
    .pipe(
      catchError((error) => {
        if (this.mode !== 'api') {
          return throwError(() => error);
        }

        return this.mockDataSource.fetchPlaces();
      }),
    )
    .pipe(shareReplay({ bufferSize: 1, refCount: false }));

  getPlaces(): Observable<Place[]> {
    return this.places$;
  }

  preloadCriticalData(): Promise<void> {
    return firstValueFrom(
      this.places$.pipe(
        map(() => undefined),
        catchError(() => of(undefined)),
      ),
    );
  }

  private getActiveDataSource(): PlaceCatalogApiService | PlaceCatalogMockService {
    if (this.mode === 'api') {
      return this.apiDataSource;
    }

    return this.mockDataSource;
  }
}
