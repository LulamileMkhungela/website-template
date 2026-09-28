import { describe, expect, it } from 'vitest';
import { firebaseWebConfig, missingFirebaseWebConfigKeys } from './firebase-app';

/**
 * The Firebase web config lives in src/environments/environment*.ts. The Web
 * app ID (appId) must be copied from the real Firebase app - never invented.
 * Until it is filled in, Google sign-in stays disabled with a clear warning.
 */
describe('Firebase web-app configuration', () => {

  it('still reports the blank Web app ID from the environment files', () => {
    expect(missingFirebaseWebConfigKeys()).toContain('appId');
  });

  it('accepts a complete configuration', () => {
    expect(missingFirebaseWebConfigKeys({
      apiKey: 'AIza', authDomain: 'lulafinds-app.firebaseapp.com',
      projectId: 'lulafinds-app', appId: '1:359295927708:web:real-id-from-console'
    })).toEqual([]);
  });

  it('points at the lulafinds-app Firebase project from the environment', () => {
    expect(firebaseWebConfig.projectId).toBe('lulafinds-app');
    expect(firebaseWebConfig.authDomain).toBe('lulafinds-app.firebaseapp.com');
  });
});
