import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { API_BASE_URL, DATA_SOURCE_MODE } from '../core/config/data-source.config';
import { mockApiInterceptor } from '../core/interceptors/mock-api.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideHttpClient(withInterceptors([mockApiInterceptor])),
    provideRouter(routes),
    { provide: DATA_SOURCE_MODE, useValue: 'mock' },
    { provide: API_BASE_URL, useValue: '/api' },
  ],
};
