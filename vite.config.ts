import path from "node:path";
import { cloudflare } from "@cloudflare/vite-plugin";
import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-plugin";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { defineConfig, lazyPlugins } from "vite-plus";

const isTest = Boolean(process.env.VITEST);

// https://vite.dev/config/
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src/client"),
      // vite-plugin-pwa is off under Vitest, so its virtual module needs a stand-in there.
      ...(isTest
        ? {
            "virtual:pwa-register/react": path.resolve(
              import.meta.dirname,
              "src/client/test/pwa-register-stub.ts",
            ),
          }
        : {}),
    },
  },
  staged: {
    "*": "vp check --fix",
  },
  fmt: {
    // design/ holds verbatim reference material (the Pocket Planner showcase); never reformat it.
    ignorePatterns: [
      "worker-configuration.d.ts",
      "src/client/routeTree.gen.ts",
      "drizzle/meta/**",
      "design/**",
    ],
  },
  lint: {
    ignorePatterns: ["worker-configuration.d.ts", "src/client/routeTree.gen.ts", "design/**"],
    plugins: ["react", "typescript", "oxc"],
    rules: {
      "react/rules-of-hooks": "error",
      "react/only-export-components": [
        "warn",
        {
          allowConstantExport: true,
          // shadcn files export cva variants next to the component.
          allowExportNames: ["buttonVariants", "badgeVariants", "tabsListVariants"],
        },
      ],
      "vite-plus/prefer-vite-plus-imports": "error",
    },
    overrides: [
      {
        // The router plugin splits route components out of these files, so fast refresh still works.
        files: ["src/client/routes/**"],
        rules: { "react/only-export-components": "off" },
      },
    ],
    options: {
      typeAware: true,
      typeCheck: true,
    },
    jsPlugins: [
      {
        name: "vite-plus",
        specifier: "vite-plus/oxlint-plugin",
      },
    ],
  },
  test: {
    projects: [
      {
        test: {
          name: "unit",
          include: ["src/**/*.test.{ts,tsx}", "scripts/**/*.test.ts"],
          exclude: ["src/**/*.api.test.ts"],
          environment: "node",
        },
      },
      {
        // API tests run inside workerd against a local D1 with every migration applied.
        plugins: [
          cloudflareTest(async () => ({
            wrangler: { configPath: "./wrangler.jsonc" },
            // Tests never hit the network: remote-only bindings (AI) stay unbound and go through fakes.
            remoteBindings: false,
            miniflare: {
              bindings: {
                TEST_MIGRATIONS: await readD1Migrations(path.join(import.meta.dirname, "drizzle")),
              },
            },
          })),
        ],
        test: {
          name: "api",
          include: ["src/**/*.api.test.ts"],
          setupFiles: ["./src/server/test/apply-migrations.ts"],
        },
      },
    ],
  },
  plugins: lazyPlugins(() =>
    isTest
      ? []
      : [
          tanstackRouter({
            target: "react",
            autoCodeSplitting: true,
            routesDirectory: "./src/client/routes",
            generatedRouteTree: "./src/client/routeTree.gen.ts",
          }),
          react(),
          tailwindcss(),
          // Remote-only bindings (AI) are opt-in for dev so a plain `vp dev` needs no login and costs nothing.
          cloudflare({ remoteBindings: process.env.CF_REMOTE_BINDINGS === "1" }),
          VitePWA({
            // The app shows a "new version" toast; the user decides when to reload.
            registerType: "prompt",
            // useRegisterSW (UpdatePrompt) registers the worker, so no injected script.
            injectRegister: false,
            includeAssets: ["favicon.svg", "apple-touch-icon-180x180.png"],
            manifest: {
              name: "UniLink",
              short_name: "UniLink",
              description: "An unofficial, student-run companion for NSU students",
              start_url: "/",
              scope: "/",
              display: "standalone",
              // Static Coral: the manifest and icons do not follow the chosen palette.
              theme_color: "#f3f4f8",
              background_color: "#f3f4f8",
              icons: [
                { src: "pwa-64x64.png", sizes: "64x64", type: "image/png" },
                { src: "pwa-192x192.png", sizes: "192x192", type: "image/png" },
                { src: "pwa-512x512.png", sizes: "512x512", type: "image/png" },
                {
                  src: "maskable-icon-512x512.png",
                  sizes: "512x512",
                  type: "image/png",
                  purpose: "maskable",
                },
              ],
            },
            workbox: {
              // Precache the hashed shell only. index.html is left out so it can be network-first.
              globPatterns: ["**/*.{js,css,ico,png,svg,woff2}"],
              // The push handlers are loaded with importScripts, not precached, so the browser's own
              // service worker update check sees any change to them.
              globIgnores: ["push-sw.js"],
              importScripts: ["push-sw.js"],
              navigateFallback: null,
              runtimeCaching: [
                // API data is never cached.
                {
                  urlPattern: ({ url }) => url.pathname.startsWith("/api/"),
                  handler: "NetworkOnly",
                },
                {
                  // index.html: fresh when online, last copy when the network is slow or down.
                  urlPattern: ({ request }) => request.mode === "navigate",
                  handler: "NetworkFirst",
                  options: { cacheName: "html", networkTimeoutSeconds: 3 },
                },
              ],
            },
          }),
        ],
  ),
});
