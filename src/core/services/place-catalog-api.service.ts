import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map, Observable } from 'rxjs';

import { API_BASE_URL } from '../config/data-source.config';
import { Place } from '../models/place.model';

type PlacesApiResponse =
  | Place[]
  | {
      data: Place[];
      meta: {
        page: number;
        pageSize: number;
        totalItems: number;
        totalPages: number;
        hasNextPage: boolean;
        hasPreviousPage: boolean;
      };
    };

@Injectable({
  providedIn: 'root',
})
export class PlaceCatalogApiService {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = inject(API_BASE_URL);

  fetchPlaces(): Observable<Place[]> {
    return this.http
      .get<PlacesApiResponse>(`${this.apiBaseUrl}/places`, {
        params: {
          page: 1,
          pageSize: 20,
        },
      })
      .pipe(map((response) => (Array.isArray(response) ? response : response.data)));
  }
}
