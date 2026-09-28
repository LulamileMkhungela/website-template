import { APP_INITIALIZER, ApplicationConfig, inject, provideZonelessChangeDetection } from '@angular/core';
import { provideRouter, withComponentInputBinding, withInMemoryScrolling } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular/provide';
import { IonicRouteStrategy } from '@ionic/angular/ionic-route-strategy';
import { environment } from '../environments/environment';
import { LULA_API, LulaApi, MockApi } from './core/data/api';
import { LocalDb } from './core/data/local-db';
import { FirebaseApi } from './core/data/firebase-api';
import { SupabaseApi } from './core/data/supabase-api';
import { liveSupabaseEnabled } from './core/data/supabase-client';
import { routes } from './app.routes';
import { SettingsService } from './core/services/settings.service';
import { LocationService } from './core/services/location.service';
import { DataService } from './core/services/data.service';

function apiFactory(): LulaApi {
  if (liveSupabaseEnabled()) {
    const api = new SupabaseApi();
    void api.init();
    return api;
  }
  if (environment.dataMode === 'firebase' && environment.firebase.apiKey) {
    const api = new FirebaseApi(environment.firebase as Record<string, string>);
    void api.init();
    return api;
  }
  const api = new MockApi(new LocalDb());
  void api.init();
  return api;
}

/** Services that must be alive before the first route renders. */
function bootstrapCore() {
  const settings = inject(SettingsService);
  const location = inject(LocationService);
  const data = inject(DataService);
  return () => {
    settings.init();
    void location.init();
    void data.loadStatic();
    void data.loadFeed();
    data.startAutoSync();
  };
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideZonelessChangeDetection(),
    provideRouter(
      routes,
      withComponentInputBinding(),
      withInMemoryScrolling({ anchorScrolling: 'enabled', scrollPositionRestoration: 'enabled' })
    ),
    provideIonicAngular({ rippleEffect: true, swipeBackEnabled: true }),
    { provide: IonicRouteStrategy, useValue: new IonicRouteStrategy() },
    { provide: LULA_API, useFactory: apiFactory },
    { provide: APP_INITIALIZER, useFactory: bootstrapCore, multi: true }
  ]
};
