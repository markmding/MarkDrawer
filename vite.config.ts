import { readFileSync } from 'node:fs'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig, type Plugin } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'

// Tauri sets this when developing against a physical device / LAN.
const host = process.env.TAURI_DEV_HOST

const packageJsonPath = fileURLToPath(new URL('./package.json', import.meta.url))

// package.json is the single source of truth for the app version; Tauri's
// `version` points at the same file, so bundles and the UI always agree.
const { version } = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as { version: string }

/**
 * `define` is baked when the server starts, so `npm run version:*` would leave a
 * running dev server showing the previous number (the welcome page said 0.4.0
 * for a whole round after the bump). Restarting is cheap and keeps the UI honest.
 */
function restartOnVersionChange(): Plugin {
  return {
    name: 'mark-drawer:version-restart',
    configureServer(server) {
      server.watcher.add(packageJsonPath)
      server.watcher.on('change', (file) => {
        if (file !== packageJsonPath) return
        server.config.logger.info('[mark-drawer] package.json 已更新，重启以刷新 __APP_VERSION__')
        server.restart()
      })
    }
  }
}

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(version)
  },
  plugins: [svelte(), restartOnVersionChange()],
  resolve: {
    alias: {
      $lib: fileURLToPath(new URL('./src/lib', import.meta.url))
    }
  },
  // Prevents Vite from clearing Rust compiler output.
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host ? { protocol: 'ws', host, port: 1421 } : undefined,
    watch: {
      ignored: ['**/src-tauri/**']
    }
  },
  envPrefix: ['VITE_', 'TAURI_ENV_*'],
  build: {
    // Tauri uses WebView2 (Chromium) on Windows and WKWebView on macOS.
    target: 'es2021',
    minify: 'esbuild',
    sourcemap: !!process.env.TAURI_ENV_DEBUG,
    // Mermaid is intentionally a large lazy chunk; see renderMermaid().
    chunkSizeWarningLimit: 3000
  }
})
