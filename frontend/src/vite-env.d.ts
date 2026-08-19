/// <reference types="vite/client" />

interface ImportMetaEnv {
  // The only real frontend env var (see .env.example) - a Yandex Maps JS
  // API key, public but domain-restricted in the Yandex console.
  readonly VITE_YANDEX_MAPS_API_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
