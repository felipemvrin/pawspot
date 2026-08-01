import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  NgZone,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import * as L from 'leaflet';
import 'leaflet.markercluster';

import { Place, PlaceCategory } from '../../core/models/place.model';
import { PlaceCatalogService } from '../../core/services/place-catalog.service';

type QuickFilter = {
  label: string;
  ariaLabel: string;
  token: QuickFilterToken;
};

type QuickFilterToken = PlaceCategory | 'topRated' | 'nearby';

type MapStatusTone = 'info' | 'success' | 'error';

type MapStatusState = {
  message: string;
  tone: MapStatusTone;
  id: number;
};

type MapSkin = {
  name: string;
  layer: L.TileLayer;
};

type SearchSuggestion = {
  label: string;
  lat: number;
  lng: number;
};

type NearbySource = 'search' | 'location';

@Component({
  selector: 'app-map-page',
  standalone: true,
  templateUrl: './map-page.component.html',
  styleUrl: './map-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MapPageComponent implements AfterViewInit {
  private static readonly STATUS_AUTO_DISMISS_MS = 6000;
  private static readonly RECOLETA_CENTER: [number, number] = [-33.4166, -70.6438];

  @ViewChild('mapContainer', { static: true })
  private readonly mapContainer!: ElementRef<HTMLDivElement>;
  @ViewChild('mapStatusElement')
  private mapStatusElement?: ElementRef<HTMLParagraphElement>;

  private readonly destroyRef = inject(DestroyRef);
  private readonly zone = inject(NgZone);
  private readonly placeCatalog = inject(PlaceCatalogService);

  private map: L.Map | null = null;
  private userMarker: L.CircleMarker | null = null;
  private userAccuracyCircle: L.Circle | null = null;
  private clusterLayer: L.MarkerClusterGroup | null = null;
  private readonly mapSkins: MapSkin[] = [
    {
      name: 'Carto Positron',
      layer: L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 20,
        subdomains: 'abcd',
        attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
      }),
    },
    {
      name: 'Alidade Smooth',
      layer: L.tileLayer('https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}{r}.png', {
        maxZoom: 20,
        attribution: '&copy; Stadia Maps &copy; OpenMapTiles &copy; OpenStreetMap contributors',
      }),
    },
    {
      name: 'Carto Voyager',
      layer: L.tileLayer(
        'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
        {
          maxZoom: 20,
          subdomains: 'abcd',
          attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
        },
      ),
    },
  ];
  private currentSkinIndex = 0;
  private isLocatingUser = false;
  private statusSequence = 0;
  private statusDismissTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private statusHideAnimationTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private searchDebounceTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private searchAbortController: AbortController | null = null;
  private lastKnownUserLocation: L.LatLng | null = null;
  private searchResultMarker: L.Marker | null = null;
  private readonly categoryMetadata: Record<PlaceCategory, { emoji: string; color: string }> = {
    park: { emoji: '🌳', color: '#7ED957' },
    restaurant: { emoji: '🍽', color: '#FF9F43' },
    cafe: { emoji: '☕', color: '#C89B72' },
    petFriendly: { emoji: '🐶', color: '#4D96FF' },
    veterinary: { emoji: '🏥', color: '#FF6B6B' },
    trail: { emoji: '🥾', color: '#2E8B57' },
    hotel: { emoji: '🏨', color: '#8B5CF6' },
    shopping: { emoji: '🛒', color: '#FFD700' },
    hairSalon: { emoji: '✂️', color: '#FF69B4' },
  };
  private places: Place[] = [];

  protected readonly mapStatus = signal<MapStatusState>({
    message: 'Cargando mapa real de OpenStreetMap...',
    tone: 'info',
    id: 0,
  });
  protected readonly isStatusVisible = signal(true);
  protected readonly isStatusLeaving = signal(false);
  protected readonly areFiltersVisible = signal(false);
  protected readonly searchQuery = signal('');
  protected readonly searchSuggestions = signal<SearchSuggestion[]>([]);
  protected readonly isSuggestionsOpen = signal(false);
  protected readonly isSearchingSuggestions = signal(false);
  protected readonly isMapLegendVisible = signal(false);
  protected readonly nearbyPlacesCount = signal(0);

  protected readonly quickFilters = signal<QuickFilter[]>([
    { label: '🌳 Parques', ariaLabel: 'Filter parks', token: 'park' },
    { label: '🥾 Senderos', ariaLabel: 'Filter trails', token: 'trail' },
    { label: '☕ Cafés', ariaLabel: 'Filter cafes', token: 'cafe' },
    { label: '🍽 Restaurantes', ariaLabel: 'Filter restaurants', token: 'restaurant' },
    { label: '🏥 Veterinaria', ariaLabel: 'Filter veterinary clinics', token: 'veterinary' },
    { label: '🛒 Tienda Mascotas', ariaLabel: 'Filter pet stores', token: 'shopping' },
    { label: '✂️ Peluquería Canina', ariaLabel: 'Filter dog grooming', token: 'hairSalon' },
    { label: '🏨 Hotel Pet Friendly', ariaLabel: 'Filter pet friendly hotels', token: 'hotel' },
    { label: '⭐ Mejor valorados', ariaLabel: 'Filter top rated places', token: 'topRated' },
    { label: '📍 Cerca de mí', ariaLabel: 'Filter places near me', token: 'nearby' },
  ]);

  ngAfterViewInit(): void {
    this.initializeMap();
    this.loadPlacesAndRender();

    this.destroyRef.onDestroy(() => {
      this.clearStatusDismissTimeout();
      this.clearStatusHideAnimationTimeout();
      this.clearSearchDebounceTimeout();
      this.cancelSearchRequest();
      this.map?.remove();
      this.map = null;
    });
  }

  private loadPlacesAndRender(): void {
    this.placeCatalog
      .getPlaces()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (places) => {
          this.places = places;
          this.addClusteredMarkers();

          if (places.length === 0) {
            this.setStatusInfo('Catalogo cargado sin lugares disponibles por ahora.');
            return;
          }

          this.setStatusSuccess(`Catalogo cargado con ${places.length} lugares pet friendly.`);
        },
        error: () => {
          this.setStatusError('No pudimos cargar el catalogo de lugares.');
        },
      });
  }

  protected onSearchInput(query: string): void {
    this.searchQuery.set(query);
    this.clearSearchDebounceTimeout();
    this.cancelSearchRequest();

    const normalizedQuery = query.trim();
    if (normalizedQuery.length < 5) {
      this.searchSuggestions.set([]);
      this.isSuggestionsOpen.set(false);
      this.isSearchingSuggestions.set(false);
      return;
    }

    this.isSearchingSuggestions.set(true);
    this.searchDebounceTimeoutId = setTimeout(() => {
      this.fetchSearchSuggestions(normalizedQuery);
    }, 280);
  }

  protected onSearchSubmit(event?: Event): void {
    event?.preventDefault();
    this.isSuggestionsOpen.set(false);
    this.locateUser('search');
  }

  protected onSearchBlur(): void {
    setTimeout(() => {
      this.isSuggestionsOpen.set(false);
    }, 120);
  }

  protected selectSuggestion(suggestion: SearchSuggestion): void {
    this.searchQuery.set(suggestion.label);
    this.isSuggestionsOpen.set(false);

    if (!this.map) {
      return;
    }

    const suggestionLocation = L.latLng(suggestion.lat, suggestion.lng);
    this.searchResultMarker?.remove();
    this.searchResultMarker = L.marker(suggestionLocation)
      .addTo(this.map)
      .bindPopup(suggestion.label);
    this.map.setView(suggestionLocation, 15, { animate: true });
    this.searchResultMarker.openPopup();
    this.updateLegendFromNearbyResults(suggestionLocation, 'search');
    this.setStatusSuccess('Ubicación sugerida encontrada.');
  }

  protected locateUser(source: NearbySource = 'location'): void {
    if (!this.map || this.isLocatingUser) {
      return;
    }

    if (!('geolocation' in navigator)) {
      this.setStatusError('Tu navegador no soporta geolocalización.');
      return;
    }

    this.isLocatingUser = true;
    this.setStatusInfo('Solicitando permisos de ubicación...');

    const geolocation = navigator.geolocation;
    const onSuccess = (position: GeolocationPosition) => {
      this.zone.run(() => {
        const latlng = L.latLng(position.coords.latitude, position.coords.longitude);
        this.paintUserLocation({ latlng, accuracy: position.coords.accuracy } as L.LocationEvent);
        this.map?.setView(latlng, 16, { animate: true });
        this.updateLegendFromNearbyResults(latlng, source);
        this.setStatusSuccess('Ubicación actual detectada con éxito.');
        this.isLocatingUser = false;
      });
    };

    const onError = (error: GeolocationPositionError) => {
      this.zone.run(() => {
        if (error.code === error.PERMISSION_DENIED) {
          this.setStatusError(
            'Permiso de ubicación denegado. Actívalo en el navegador para centrar el mapa.',
          );
        } else if (error.code === error.TIMEOUT) {
          this.setStatusError('La ubicación tardó demasiado. Intenta nuevamente.');
        } else {
          this.setStatusError(
            'No fue posible obtener tu ubicación. Verifica permisos del navegador.',
          );
        }

        this.isLocatingUser = false;
      });
    };

    const requestPosition = () => {
      this.setStatusInfo('Buscando tu ubicación actual...');
      geolocation.getCurrentPosition(onSuccess, onError, {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      });
    };

    if (!('permissions' in navigator)) {
      requestPosition();
      return;
    }

    navigator.permissions
      .query({ name: 'geolocation' })
      .then((permissionStatus) => {
        this.zone.run(() => {
          if (permissionStatus.state === 'denied') {
            this.setStatusError(
              'Permiso de ubicación bloqueado. Habilítalo en el navegador para continuar.',
            );
            this.isLocatingUser = false;
            return;
          }

          requestPosition();
        });
      })
      .catch(() => {
        this.zone.run(() => {
          requestPosition();
        });
      });
  }

  protected toggleFilters(): void {
    const nextState = !this.areFiltersVisible();
    this.areFiltersVisible.set(nextState);

    if (!nextState) {
      this.setStatusInfo('Filtros rápidos ocultos.');
      return;
    }

    this.focusMarkers();
  }

  private focusMarkers(): void {
    if (!this.map || !this.clusterLayer) {
      return;
    }

    const bounds = this.clusterLayer.getBounds();
    if (bounds.isValid()) {
      this.map.fitBounds(bounds.pad(0.2));
      this.setStatusInfo('Mostrando resultados pet friendly en el mapa.');
    }
  }

  protected toggleLayers(): void {
    if (!this.map) {
      return;
    }

    const currentSkin = this.mapSkins[this.currentSkinIndex];
    this.map.removeLayer(currentSkin.layer);

    this.currentSkinIndex = (this.currentSkinIndex + 1) % this.mapSkins.length;
    const nextSkin = this.mapSkins[this.currentSkinIndex];
    nextSkin.layer.addTo(this.map);

    this.setStatusInfo(`Capa ${nextSkin.name} activa.`);
  }

  protected zoomIn(): void {
    this.map?.zoomIn();
  }

  protected zoomOut(): void {
    this.map?.zoomOut();
  }

  private initializeMap(): void {
    this.map = L.map(this.mapContainer.nativeElement, {
      center: MapPageComponent.RECOLETA_CENTER,
      zoom: 15,
      zoomControl: false,
      preferCanvas: true,
    });

    this.mapSkins[this.currentSkinIndex].layer.addTo(this.map);

    this.setStatusInfo('Mapa centrado en Santos Dumont con Av. Perú.');
  }

  private setStatusInfo(message: string): void {
    this.setStatus(message, 'info');
  }

  private setStatusError(message: string): void {
    this.setStatus(message, 'error');
  }

  private setStatusSuccess(message: string): void {
    this.setStatus(message, 'success');
  }

  private setStatus(message: string, tone: MapStatusTone): void {
    this.clearStatusDismissTimeout();
    this.clearStatusHideAnimationTimeout();
    this.isStatusVisible.set(true);
    this.isStatusLeaving.set(false);

    const id = ++this.statusSequence;
    this.mapStatus.set({ message, tone, id });
    this.playStatusAnimation();

    this.statusDismissTimeoutId = setTimeout(() => {
      const currentStatus = this.mapStatus();
      if (currentStatus.id === id) {
        this.dismissStatusWithFade(id);
      }
      this.statusDismissTimeoutId = null;
    }, MapPageComponent.STATUS_AUTO_DISMISS_MS);
  }

  private clearStatusDismissTimeout(): void {
    if (this.statusDismissTimeoutId) {
      clearTimeout(this.statusDismissTimeoutId);
      this.statusDismissTimeoutId = null;
    }
  }

  private clearStatusHideAnimationTimeout(): void {
    if (this.statusHideAnimationTimeoutId) {
      clearTimeout(this.statusHideAnimationTimeoutId);
      this.statusHideAnimationTimeoutId = null;
    }
  }

  private dismissStatusWithFade(expectedId: number): void {
    this.clearStatusHideAnimationTimeout();
    this.isStatusLeaving.set(true);

    this.statusHideAnimationTimeoutId = setTimeout(() => {
      const currentStatus = this.mapStatus();
      if (currentStatus.id !== expectedId) {
        return;
      }

      this.isStatusVisible.set(false);
      this.isStatusLeaving.set(false);
      this.mapStatus.set({ message: '', tone: 'info', id: ++this.statusSequence });
      this.statusHideAnimationTimeoutId = null;
    }, 260);
  }

  private playStatusAnimation(): void {
    const statusElement = this.mapStatusElement?.nativeElement;
    if (!statusElement) {
      return;
    }

    statusElement.animate(
      [
        { opacity: 0.3, transform: 'translate3d(-50%, 0.5rem, 0) scale(0.98)' },
        { opacity: 1, transform: 'translate3d(-50%, 0, 0) scale(1)' },
      ],
      {
        duration: 280,
        easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
    );
  }

  private paintUserLocation(location: { latlng: L.LatLng; accuracy: number }): void {
    this.lastKnownUserLocation = location.latlng;
    this.userMarker?.remove();
    this.userAccuracyCircle?.remove();

    this.userMarker = L.circleMarker(location.latlng, {
      radius: 8,
      weight: 2,
      color: '#FFFFFF',
      fillColor: '#2F855A',
      fillOpacity: 1,
    })
      .addTo(this.map as L.Map)
      .bindPopup('Tu ubicación actual');

    this.userAccuracyCircle = L.circle(location.latlng, {
      radius: location.accuracy,
      weight: 1,
      color: '#2F855A',
      fillColor: '#2F855A',
      fillOpacity: 0.12,
    }).addTo(this.map as L.Map);
  }

  private addClusteredMarkers(): void {
    if (!this.map) {
      return;
    }

    this.clusterLayer?.remove();

    this.clusterLayer = L.markerClusterGroup({
      maxClusterRadius: 46,
      showCoverageOnHover: false,
      spiderfyOnMaxZoom: true,
    });

    this.places.forEach((place) => {
      const marker = L.marker([place.lat, place.lng], {
        icon: this.buildCategoryIcon(place.category),
      }).bindPopup(this.buildPopup(place));

      this.clusterLayer?.addLayer(marker);
    });

    this.map.addLayer(this.clusterLayer);
  }

  private async fetchSearchSuggestions(query: string): Promise<void> {
    this.cancelSearchRequest();
    this.searchAbortController = new AbortController();

    try {
      const center =
        this.lastKnownUserLocation ?? this.map?.getCenter() ?? L.latLng(4.711, -74.0721);
      const delta = 0.2;
      const viewbox = `${center.lng - delta},${center.lat + delta},${center.lng + delta},${center.lat - delta}`;

      const searchParams = new URLSearchParams({
        q: query,
        format: 'jsonv2',
        limit: '6',
        bounded: '1',
        viewbox,
        'accept-language': 'es',
      });

      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?${searchParams.toString()}`,
        {
          signal: this.searchAbortController.signal,
          headers: {
            Accept: 'application/json',
          },
        },
      );

      if (!response.ok) {
        throw new Error('No se pudo consultar Nominatim.');
      }

      const results = (await response.json()) as Array<{
        display_name: string;
        lat: string;
        lon: string;
      }>;

      const suggestions = results
        .map((result) => ({
          label: result.display_name,
          lat: Number(result.lat),
          lng: Number(result.lon),
        }))
        .filter((result) => Number.isFinite(result.lat) && Number.isFinite(result.lng));

      this.searchSuggestions.set(suggestions);
      this.isSuggestionsOpen.set(suggestions.length > 0);

      if (suggestions.length === 0) {
        this.setStatusInfo('No encontramos sugerencias cercanas para ese texto.');
      }
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        this.setStatusError('No fue posible obtener sugerencias de búsqueda.');
      }
    } finally {
      this.isSearchingSuggestions.set(false);
      this.searchAbortController = null;
    }
  }

  private clearSearchDebounceTimeout(): void {
    if (this.searchDebounceTimeoutId) {
      clearTimeout(this.searchDebounceTimeoutId);
      this.searchDebounceTimeoutId = null;
    }
  }

  private cancelSearchRequest(): void {
    if (this.searchAbortController) {
      this.searchAbortController.abort();
      this.searchAbortController = null;
    }
  }

  private updateLegendFromNearbyResults(center: L.LatLng, source: NearbySource): void {
    const nearbyCount = this.getNearbyPlacesCount(center);
    this.nearbyPlacesCount.set(nearbyCount);

    if (nearbyCount > 0) {
      this.isMapLegendVisible.set(true);
      return;
    }

    this.isMapLegendVisible.set(false);

    if (source === 'search') {
      this.setStatusInfo('No encontramos lugares cercanos para la búsqueda.');
      return;
    }

    this.setStatusInfo('No encontramos lugares cercanos a tu ubicación.');
  }

  private getNearbyPlacesCount(center: L.LatLng): number {
    const nearbyThresholdMeters = 2000;

    return this.places.filter(
      (place) => center.distanceTo(L.latLng(place.lat, place.lng)) <= nearbyThresholdMeters,
    ).length;
  }

  private buildCategoryIcon(category: PlaceCategory): L.DivIcon {
    const icon = this.categoryMetadata[category];

    return L.divIcon({
      className: 'pawspot-marker-icon',
      html: `<span style="background:${icon.color}">${icon.emoji}</span>`,
      iconSize: [34, 34],
      iconAnchor: [17, 17],
      popupAnchor: [0, -16],
    });
  }

  private buildPopup(place: Place): string {
    return `
      <div class="pawspot-popup">
        <strong>${place.name}</strong>
        <p>${place.address}</p>
        <p>⭐ ${place.rating.toFixed(1)}</p>
        <button type="button">Como llegar</button>
      </div>
    `;
  }
}
