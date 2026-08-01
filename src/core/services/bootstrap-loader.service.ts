import { HttpClient } from '@angular/common/http';
import { Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class BootstrapLoaderService {
  readonly ready = signal(false);

  private loadPromise: Promise<void> | null = null;

  constructor(private readonly http: HttpClient) {}

  preloadCriticalData(): Promise<void> {
    if (this.loadPromise) {
      return this.loadPromise;
    }

    this.loadPromise = firstValueFrom(this.http.get('/assets/pet-lovers.json'))
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
