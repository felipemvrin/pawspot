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
import * as L from 'leaflet';
import 'leaflet.markercluster';

type QuickFilter = {
  label: string;
  ariaLabel: string;
};

type PlaceCategory = 'park' | 'restaurant' | 'cafe' | 'petFriendly' | 'veterinary' | 'beach';

type PlaceMarker = {
  name: string;
  category: PlaceCategory;
  rating: number;
  address: string;
  lat: number;
  lng: number;
};

@Component({
  selector: 'app-map-page',
  standalone: true,
  templateUrl: './map-page.component.html',
  styleUrl: './map-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MapPageComponent implements AfterViewInit {
  @ViewChild('mapContainer', { static: true })
  private readonly mapContainer!: ElementRef<HTMLDivElement>;

  private readonly destroyRef = inject(DestroyRef);
  private readonly zone = inject(NgZone);

  private map: L.Map | null = null;
  private userMarker: L.CircleMarker | null = null;
  private userAccuracyCircle: L.Circle | null = null;
  private clusterLayer: L.MarkerClusterGroup | null = null;
  private readonly standardLayer = L.tileLayer(
    'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    },
  );
  private readonly humanitarianLayer = L.tileLayer(
    'https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png',
    {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors, Humanitarian style',
    },
  );
  private isHumanitarianLayer = false;

  protected readonly mapStatus = signal('Cargando mapa real de OpenStreetMap...');

  protected readonly quickFilters = signal<QuickFilter[]>([
    { label: '🐶 Pet Friendly', ariaLabel: 'Filter pet friendly places' },
    { label: '🌳 Parques', ariaLabel: 'Filter parks' },
    { label: '🍽 Restaurantes', ariaLabel: 'Filter restaurants' },
    { label: '☕ Cafés', ariaLabel: 'Filter cafes' },
    { label: '⭐ Mejor valorados', ariaLabel: 'Filter top rated places' },
    { label: '📍 Cerca de mí', ariaLabel: 'Filter places near me' },
  ]);

  ngAfterViewInit(): void {
    this.initializeMap();
    this.addClusteredMarkers();

    this.destroyRef.onDestroy(() => {
      this.map?.remove();
      this.map = null;
    });
  }

  protected locateUser(): void {
    if (!this.map) {
      return;
    }

    if (!('geolocation' in navigator)) {
      this.mapStatus.set('Tu navegador no soporta geolocalización.');
      return;
    }

    this.mapStatus.set('Buscando tu ubicación actual...');
    this.map.locate({
      enableHighAccuracy: true,
      maxZoom: 16,
      setView: true,
      timeout: 10000,
    });
  }

  protected focusMarkers(): void {
    if (!this.map || !this.clusterLayer) {
      return;
    }

    const bounds = this.clusterLayer.getBounds();
    if (bounds.isValid()) {
      this.map.fitBounds(bounds.pad(0.2));
      this.mapStatus.set('Mostrando resultados pet friendly en el mapa.');
    }
  }

  protected toggleLayers(): void {
    if (!this.map) {
      return;
    }

    if (this.isHumanitarianLayer) {
      this.map.removeLayer(this.humanitarianLayer);
      this.standardLayer.addTo(this.map);
      this.mapStatus.set('Capa estándar de OpenStreetMap activa.');
    } else {
      this.map.removeLayer(this.standardLayer);
      this.humanitarianLayer.addTo(this.map);
      this.mapStatus.set('Capa Humanitarian de OpenStreetMap activa.');
    }

    this.isHumanitarianLayer = !this.isHumanitarianLayer;
  }

  protected zoomIn(): void {
    this.map?.zoomIn();
  }

  protected zoomOut(): void {
    this.map?.zoomOut();
  }

  private initializeMap(): void {
    this.map = L.map(this.mapContainer.nativeElement, {
      center: [4.711, -74.0721],
      zoom: 12,
      zoomControl: false,
      preferCanvas: true,
    });

    this.standardLayer.addTo(this.map);
    L.control.zoom({ position: 'bottomright' }).addTo(this.map);

    this.map.on('locationfound', (event: L.LocationEvent) => {
      this.zone.run(() => {
        this.paintUserLocation(event);
        this.mapStatus.set('Ubicación actual detectada con éxito.');
      });
    });

    this.map.on('locationerror', () => {
      this.zone.run(() => {
        this.mapStatus.set('No fue posible obtener tu ubicación. Verifica permisos del navegador.');
      });
    });

    this.mapStatus.set('Mapa cargado. Ya puedes explorar lugares pet friendly.');
  }

  private paintUserLocation(event: L.LocationEvent): void {
    this.userMarker?.remove();
    this.userAccuracyCircle?.remove();

    this.userMarker = L.circleMarker(event.latlng, {
      radius: 8,
      weight: 2,
      color: '#FFFFFF',
      fillColor: '#2F855A',
      fillOpacity: 1,
    })
      .addTo(this.map as L.Map)
      .bindPopup('Tu ubicación actual');

    this.userAccuracyCircle = L.circle(event.latlng, {
      radius: event.accuracy,
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

    const places: PlaceMarker[] = [
      {
        name: 'Parque de los Novios',
        category: 'park',
        rating: 4.7,
        address: 'Av. Calle 63 #45-10',
        lat: 4.6579,
        lng: -74.0912,
      },
      {
        name: 'Cafe Moka Pet',
        category: 'cafe',
        rating: 4.6,
        address: 'Chapinero Alto',
        lat: 4.6473,
        lng: -74.0609,
      },
      {
        name: 'VetCare 24h',
        category: 'veterinary',
        rating: 4.8,
        address: 'Calle 116 #15-42',
        lat: 4.6986,
        lng: -74.045,
      },
      {
        name: 'Bistro Patitas',
        category: 'restaurant',
        rating: 4.5,
        address: 'Usaquen',
        lat: 4.7028,
        lng: -74.0324,
      },
      {
        name: 'Playa Canina Simulada',
        category: 'beach',
        rating: 4.3,
        address: 'Zona recreativa',
        lat: 4.7364,
        lng: -74.0822,
      },
      {
        name: 'Zona Pet Friendly 85',
        category: 'petFriendly',
        rating: 4.6,
        address: 'Zona T',
        lat: 4.6674,
        lng: -74.0535,
      },
    ];

    this.clusterLayer = L.markerClusterGroup({
      maxClusterRadius: 46,
      showCoverageOnHover: false,
      spiderfyOnMaxZoom: true,
    });

    places.forEach((place) => {
      const marker = L.marker([place.lat, place.lng], {
        icon: this.buildCategoryIcon(place.category),
      }).bindPopup(this.buildPopup(place));

      this.clusterLayer?.addLayer(marker);
    });

    this.map.addLayer(this.clusterLayer);
  }

  private buildCategoryIcon(category: PlaceCategory): L.DivIcon {
    const metadata: Record<PlaceCategory, { emoji: string; color: string }> = {
      park: { emoji: '🌳', color: '#22C55E' },
      restaurant: { emoji: '🍽', color: '#F59E0B' },
      cafe: { emoji: '☕', color: '#7C3AED' },
      petFriendly: { emoji: '🐶', color: '#2F855A' },
      veterinary: { emoji: '🐾', color: '#EF4444' },
      beach: { emoji: '🏖', color: '#3B82F6' },
    };

    const icon = metadata[category];

    return L.divIcon({
      className: 'pawspot-marker-icon',
      html: `<span style="background:${icon.color}">${icon.emoji}</span>`,
      iconSize: [34, 34],
      iconAnchor: [17, 17],
      popupAnchor: [0, -16],
    });
  }

  private buildPopup(place: PlaceMarker): string {
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
