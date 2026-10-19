import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv, type Plugin, type PluginOption } from 'vite';
import { buildHeadersFile, buildSecurityHeaders } from './config/security-headers.ts';
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

// Bind IPv4 loopback explicitly: 'localhost' resolves to ::1 first on many systems (incl. GitHub
// runners), which would break the documented URLs, Supabase redirect URLs and Playwright.
const HOST = '127.0.0.1';

export default defineConfig(({ command, mode, isPreview }) => {
  const plugins: PluginOption[] = [react(), tailwindcss()];

  // `vite preview` also runs with command 'serve'; it serves the production build, so it gets the
  // same validated environment and security headers as a deployment (lets e2e catch CSP problems).
  const productionLike = command === 'build' || isPreview === true;
  // Fail early on a broken or unsafe configuration instead of shipping it.
  const env = productionLike ? parseEnv(loadEnv(mode, process.cwd(), 'VITE_')) : undefined;
  if (command === 'build' && env) plugins.push(securityHeaders(env.VITE_SUPABASE_URL));

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
              // entriesAware keeps libraries used only by lazy routes out of the initial bundle.
              { name: 'vendor', test: /node_modules[\\/]/, priority: 10, entriesAware: true },
            ],
          },
        },
      },
    },
    server: { host: HOST, port: 5173, strictPort: true },
    preview: {
      host: HOST,
      port: 4173,
      strictPort: true,
      ...(env ? { headers: buildSecurityHeaders(env.VITE_SUPABASE_URL) } : {}),
    },
  };
});
