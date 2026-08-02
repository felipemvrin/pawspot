import {
  HttpErrorResponse,
  HttpEvent,
  HttpHandlerFn,
  HttpRequest,
  HttpResponse,
} from '@angular/common/http';
import { Place } from '../models/place.model';
import { Observable, delay, of, throwError } from 'rxjs';

const MOCK_PLACES: Place[] = [
  {
    id: 'park-recoleta-1',
    name: 'Parque Canino Recoleta',
    category: 'park',
    rating: 4.8,
    address: 'Santos Dumont con Av. Peru (referencia)',
    lat: -33.4166,
    lng: -70.6438,
  },
  {
    id: 'cafe-bellavista-1',
    name: 'Cafe Pet Bellavista Norte',
    category: 'cafe',
    rating: 4.6,
    address: 'Av. Peru, Recoleta',
    lat: -33.4157,
    lng: -70.6426,
  },
  {
    id: 'vet-recoleta-1',
    name: 'Clinica Veterinaria Recoleta',
    category: 'veterinary',
    rating: 4.7,
    address: 'Sector Patronato',
    lat: -33.4178,
    lng: -70.6461,
  },
  {
    id: 'trail-san-cristobal-1',
    name: 'Sendero Urbano San Cristobal',
    category: 'trail',
    rating: 4.5,
    address: 'Acceso cercano a Recoleta',
    lat: -33.4149,
    lng: -70.6412,
  },
  {
    id: 'hotel-pet-recoleta-1',
    name: 'Hotel Pet Friendly Recoleta',
    category: 'hotel',
    rating: 4.4,
    address: 'Entorno Bellavista-Recoleta',
    lat: -33.4187,
    lng: -70.6423,
  },
  {
    id: 'restaurant-patronato-1',
    name: 'Bistro Patitas Patronato',
    category: 'restaurant',
    rating: 4.3,
    address: 'Patronato 350, Recoleta',
    lat: -33.4201,
    lng: -70.6472,
  },
  {
    id: 'pet-shop-recoleta-1',
    name: 'Paw Market Recoleta',
    category: 'shopping',
    rating: 4.5,
    address: 'Loreto 120, Recoleta',
    lat: -33.4144,
    lng: -70.6466,
  },
  {
    id: 'grooming-recoleta-1',
    name: 'Peluqueria Canina Andes',
    category: 'hairSalon',
    rating: 4.2,
    address: 'Av. Mexico 88, Recoleta',
    lat: -33.4213,
    lng: -70.6449,
  },
  {
    id: 'park-independencia-1',
    name: 'Plaza de la Independencia Pet Zone',
    category: 'petFriendly',
    rating: 4.6,
    address: 'Independencia 640, Santiago',
    lat: -33.431,
    lng: -70.646,
  },
  {
    id: 'vet-independencia-2',
    name: 'Urgencias Veterinarias Norte',
    category: 'veterinary',
    rating: 4.9,
    address: 'Av. La Paz 1012, Independencia',
    lat: -33.4266,
    lng: -70.652,
  },
  {
    id: 'cafe-barrio-bellas-artes-1',
    name: 'Cafe Huellas Bellas Artes',
    category: 'cafe',
    rating: 4.4,
    address: 'Merced 380, Santiago Centro',
    lat: -33.4377,
    lng: -70.6415,
  },
  {
    id: 'trail-cerro-blanco-1',
    name: 'Ruta Cerro Blanco',
    category: 'trail',
    rating: 4.7,
    address: 'Acceso por Recoleta 901',
    lat: -33.4252,
    lng: -70.6436,
  },
];

type PaginatedPlacesResponse = {
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

function toPositiveInt(value: string | null, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
}

function buildPaginatedResponse(request: HttpRequest<unknown>): PaginatedPlacesResponse {
  const page = toPositiveInt(request.params.get('page'), 1);
  const pageSize = Math.min(toPositiveInt(request.params.get('pageSize'), 8), 50);

  const totalItems = MOCK_PLACES.length;
  const totalPages = Math.max(Math.ceil(totalItems / pageSize), 1);
  const safePage = Math.min(page, totalPages);

  const start = (safePage - 1) * pageSize;
  const end = start + pageSize;

  return {
    data: MOCK_PLACES.slice(start, end),
    meta: {
      page: safePage,
      pageSize,
      totalItems,
      totalPages,
      hasNextPage: safePage < totalPages,
      hasPreviousPage: safePage > 1,
    },
  };
}

function toLatencyMs(request: HttpRequest<unknown>): number {
  const latencyParam = request.params.get('mockLatencyMs');
  const latencyFromParam = toPositiveInt(latencyParam, 350);
  return Math.min(latencyFromParam, 10000);
}

function shouldReturnServerError(request: HttpRequest<unknown>): boolean {
  const forceError = request.params.get('mockError');
  if (forceError === '500' || forceError === 'true') {
    return true;
  }

  const errorRateParam = request.params.get('mockErrorRate');
  if (!errorRateParam) {
    return false;
  }

  const rate = Number.parseFloat(errorRateParam);
  if (!Number.isFinite(rate)) {
    return false;
  }

  const boundedRate = Math.max(0, Math.min(rate, 1));
  return Math.random() < boundedRate;
}

export function mockApiInterceptor(
  request: HttpRequest<unknown>,
  next: HttpHandlerFn,
): Observable<HttpEvent<unknown>> {
  if (!(request.url.endsWith('/api/places') && request.method === 'GET')) {
    return next(request);
  }

  const latencyMs = toLatencyMs(request);

  if (shouldReturnServerError(request)) {
    return throwError(
      () =>
        new HttpErrorResponse({
          status: 500,
          statusText: 'Mock Internal Server Error',
          url: request.urlWithParams,
          error: {
            message: 'Falla simulada por mock interceptor.',
            code: 'MOCK_500',
          },
        }),
    ).pipe(delay(latencyMs));
  }

  const responseBody = buildPaginatedResponse(request);

  return of(
    new HttpResponse<PaginatedPlacesResponse>({
      status: 200,
      url: request.urlWithParams,
      body: responseBody,
    }),
  ).pipe(delay(latencyMs));
}
