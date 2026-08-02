import { Injectable, signal } from '@angular/core';

import { FavoritesService } from './favorites.service';
import { PlaceCatalogService } from './place-catalog.service';

@Injectable({
  providedIn: 'root',
})
export class BootstrapLoaderService {
  readonly ready = signal(false);

  private loadPromise: Promise<void> | null = null;

  constructor(
    private readonly placeCatalog: PlaceCatalogService,
    private readonly favorites: FavoritesService,
  ) {}

  preloadCriticalData(): Promise<void> {
    if (this.loadPromise) {
      return this.loadPromise;
    }

    const placesTask = this.placeCatalog.preloadCriticalData();
    const favoritesTask = Promise.resolve().then(() => this.favorites.loadFromStorage());

    this.loadPromise = Promise.all([placesTask, favoritesTask])
      .then(() => {
        this.ready.set(true);
      })
      .catch(() => {
        // La app no debe quedar bloqueada por una falla de red durante splash.
        this.ready.set(true);
      });

    return this.loadPromise;
  }
}
