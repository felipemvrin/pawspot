import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('../features/map/map-page.component').then((component) => component.MapPageComponent),
  },
  {
    path: '**',
    redirectTo: '',
  },
];
