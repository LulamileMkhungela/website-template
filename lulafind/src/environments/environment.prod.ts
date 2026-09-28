import { CASE_CONTACTS } from '../app/core/data/sa-help';

export const environment = {
  production: true,
  appName: 'LulaFind',
  appVersion: '1.0.0',
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
  escalationPartners: CASE_CONTACTS
};
