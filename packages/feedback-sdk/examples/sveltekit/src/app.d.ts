declare global {
  namespace App {
    // interface Error {}
    // interface Locals {}
    // interface PageData {}
    // interface PageState {}
    // interface Platform {}
  }
}

interface ImportMetaEnv {
  readonly VITE_FEEDBACK_API_URL?: string;
  readonly VITE_FEEDBACK_API_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

export {};
