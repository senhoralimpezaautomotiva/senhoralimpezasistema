import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({ mode }) => {
  const allowedModes = new Set(['development', 'staging', 'production', 'test']);
  if (!allowedModes.has(mode)) {
    throw new Error('Modo de build não reconhecido.');
  }
  const publicEnvironment = loadEnv(mode, process.cwd(), 'VITE_');
  const rawClientPortalEnabled =
    publicEnvironment.VITE_ENABLE_CLIENT_PORTAL || 'true';
  if (!['true', 'false'].includes(rawClientPortalEnabled)) {
    throw new Error('VITE_ENABLE_CLIENT_PORTAL deve ser true ou false.');
  }
  const clientPortalEnabled = rawClientPortalEnabled === 'true';

  return {
    plugins: [react(), tailwindcss()],
    envPrefix: 'VITE_',
    define: {
      __PUBLIC_SUPABASE_URL__: JSON.stringify(
        publicEnvironment.VITE_SUPABASE_URL || ''
      ),
      __PUBLIC_SUPABASE_ANON_KEY__: JSON.stringify(
        publicEnvironment.VITE_SUPABASE_ANON_KEY || ''
      ),
      __CLIENT_PORTAL_ENABLED__: JSON.stringify(clientPortalEnabled),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      fs: {
        strict: true,
      },
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
    build: {
      sourcemap: false,
      emptyOutDir: true,
      manifest: false,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules/@supabase/')) return 'vendor-supabase';
            if (id.includes('node_modules/motion/')) return 'vendor-motion';
            if (id.includes('node_modules/react/')) return 'vendor-react';
            return undefined;
          },
        },
      },
    },
    esbuild: {
      legalComments: 'none',
    },
  };
});
