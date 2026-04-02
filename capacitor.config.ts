import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'games.nofi.app',
  appName: 'NoFi Games',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      backgroundColor: '#F0F4F8',
      showSpinner: false,
      androidScaleType: 'CENTER_CROP',
      splashFullScreen: false,
      splashImmersive: false,
    },
    StatusBar: {
      style: 'LIGHT',
      backgroundColor: '#F0F4F8',
    },
    Haptics: {
      enabled: true,
    },
  },
  android: {
    allowMixedContent: false,
    backgroundColor: '#F0F4F8',
  },
  ios: {
    backgroundColor: '#F0F4F8',
    contentInset: 'automatic',
    preferredContentMode: 'mobile',
  },
};

export default config;
