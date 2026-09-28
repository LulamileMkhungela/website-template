import { bootstrapApplication } from '@angular/platform-browser';
import { defineCustomElements } from '@ionic/pwa-elements/loader';
import { AppComponent } from './app/app.component';
import { appConfig } from './app/app.config';
import { registerCoreIcons } from './app/core/theme/icon-registry';
import { initFirebaseWeb } from './app/core/firebase/firebase-app';

registerCoreIcons();
defineCustomElements(window).catch(() => void 0);
// Firebase (Google sign-in front door) never blocks boot: it warns and
// continues when the web config is still incomplete.
initFirebaseWeb();

bootstrapApplication(AppComponent, appConfig).catch((err) => console.error(err));
