import { InjectionToken } from '@angular/core';

export type DataSourceMode = 'mock' | 'api';

export const DATA_SOURCE_MODE = new InjectionToken<DataSourceMode>('DATA_SOURCE_MODE', {
  factory: () => 'mock',
});

export const API_BASE_URL = new InjectionToken<string>('API_BASE_URL', {
  factory: () => '/api',
});
