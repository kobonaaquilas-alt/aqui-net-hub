import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.aquinet.hub',
  appName: 'AQUI NET HUB',
  webDir: 'dist',
  bundledWebRuntime: false,
  android: {
    backgroundColor: '#0D1729',
    allowMixedContent: false,
  },
}

export default config
