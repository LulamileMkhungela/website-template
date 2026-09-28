import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.lulafind.app',
  appName: 'LulaFind',
  webDir: 'www',
  server: { androidScheme: 'https', iosScheme: 'https' },
  android: {
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false
  },
  ios: {
    contentInset: 'never',
    scrollEnabled: true
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      launchAutoHide: true,
      backgroundColor: '#0A1024',
      androidSplashResourceName: 'splash',
      showSpinner: false
    },
    Keyboard: { resize: 'ionic', resizeOnFullScreen: true },
    PushNotifications: { presentationOptions: ['badge', 'sound', 'alert'] }
  }
};

export default config;
