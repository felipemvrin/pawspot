import { Injectable } from '@angular/core';
import { Observable, delay, of } from 'rxjs';

import { Place } from '../models/place.model';

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

@Injectable({
  providedIn: 'root',
})
export class PlaceCatalogMockService {
  fetchPlaces(): Observable<Place[]> {
    return of(MOCK_PLACES).pipe(delay(320));
  }
}
