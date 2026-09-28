import { CASE_CONTACTS } from '../app/core/data/sa-help';

export const environment = {
  production: false,
  appName: 'LulaFind',
  appVersion: '1.0.0',
  /**
   * supabase = this project's database, accounts, chat and photos.
   * Firebase is not the database. It only sends the normal-email account emails. Cloud Messaging stays separate. No paid plan.
   */
  dataMode: 'supabase' as 'mock' | 'firebase' | 'supabase',
  supabaseUrl: 'https://srwdtguxdjsjlkaydhet.supabase.co',
  supabaseKey: 'sb_publishable_bs3aTBGzkc3N6kpAH0oZGg_-i4v5AT3',
  firebase: {
    apiKey: 'AIzaSyAn_rXPhvO0MZvpFhkycbIqM-qkv4rHPi8',
    authDomain: 'lulafinds-app.firebaseapp.com',
    projectId: 'lulafinds-app',
    storageBucket: '',
    messagingSenderId: '359295927708',
    appId: '',
    measurementId: ''
  },
  /**
   * Real numbers the poster calls themselves. LulaFind does not transmit the case.
   * Source of truth: src/app/core/data/sa-help.ts
   */
  escalationPartners: CASE_CONTACTS
};
