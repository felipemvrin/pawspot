import { Injectable, signal } from '@angular/core';

const FAVORITES_STORAGE_KEY = 'pawspot.favoritePlaceIds';

@Injectable({
  providedIn: 'root',
})
export class FavoritesService {
  readonly favoritePlaceIds = signal<Set<string>>(new Set<string>());

  loadFromStorage(): void {
    try {
      const rawValue = localStorage.getItem(FAVORITES_STORAGE_KEY);
      if (!rawValue) {
        this.favoritePlaceIds.set(new Set<string>());
        return;
      }

      const parsedValue = JSON.parse(rawValue) as unknown;
      if (!Array.isArray(parsedValue)) {
        this.favoritePlaceIds.set(new Set<string>());
        return;
      }

      this.favoritePlaceIds.set(
        new Set<string>(parsedValue.filter((id) => typeof id === 'string')),
      );
    } catch {
      this.favoritePlaceIds.set(new Set<string>());
    }
  }

  isFavorite(placeId: string): boolean {
    return this.favoritePlaceIds().has(placeId);
  }

  toggle(placeId: string): void {
    const nextFavorites = new Set<string>(this.favoritePlaceIds());

    if (nextFavorites.has(placeId)) {
      nextFavorites.delete(placeId);
    } else {
      nextFavorites.add(placeId);
    }

    this.favoritePlaceIds.set(nextFavorites);
    this.persistToStorage(nextFavorites);
  }

  private persistToStorage(value: Set<string>): void {
    try {
      localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify([...value]));
    } catch {
      // Ignorar errores de almacenamiento para no romper la UX.
    }
  }
}
