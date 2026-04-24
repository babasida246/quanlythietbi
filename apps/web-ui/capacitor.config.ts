import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
    appId: 'vn.qltb.app',
    appName: 'QLTB',
    webDir: 'build',
    server: {
        androidScheme: 'https',
    },
    plugins: {
        BarcodeScanning: {
            // No extra plugin config needed; permissions declared in AndroidManifest/Info.plist
        }
    }
};

export default config;
