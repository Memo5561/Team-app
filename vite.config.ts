import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv, type Plugin, type PluginOption } from 'vite';
import { buildHeadersFile } from './config/security-headers.ts';
import { parseEnv } from './src/lib/env-schema.ts';

/** Emits the Cloudflare Pages `_headers` file (CSP etc.) for the environment being built. */
function securityHeaders(supabaseUrl: string): Plugin {
  return {
    name: 'teampanel:security-headers',
    apply: 'build',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: '_headers', source: buildHeadersFile(supabaseUrl) });
    },
  };
}

export default defineConfig(({ command, mode }) => {
  const plugins: PluginOption[] = [react(), tailwindcss()];

  if (command === 'build') {
    // Fail the build early on a broken or unsafe configuration instead of shipping it.
    const env = parseEnv(loadEnv(mode, process.cwd(), 'VITE_'));
    plugins.push(securityHeaders(env.VITE_SUPABASE_URL));
  }

  return {
    plugins,
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
    build: {
      rolldownOptions: {
        output: {
          // Long-lived vendor chunks: library updates are rarer than app deploys (spec §63).
          codeSplitting: {
            groups: [
              {
                name: 'vendor-react',
                test: /node_modules[\\/](react|react-dom|react-router|scheduler)[\\/]/,
                priority: 20,
              },
              { name: 'vendor', test: /node_modules[\\/]/, priority: 10 },
            ],
          },
        },
      },
    },
    server: { port: 5173, strictPort: true },
    preview: { port: 4173, strictPort: true },
  };
});
