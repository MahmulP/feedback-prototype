# Integrasi `@mahmulp/feedback-sdk` ke SvelteKit

Panduan copy-paste untuk pasang feedback SDK di project SvelteKit-mu.

## 1. Install

```bash
bun add @mahmulp/feedback-sdk
# atau: npm install / pnpm add / yarn add
```

`html2canvas` ikut terinstall otomatis (sudah jadi direct dependency SDK).

## 2. Issue API key

1. Buka dashboard: `https://prototype.iwkapps.com`
2. Login → buat project baru → buka tab **API keys** → **Generate new key**.
3. Copy key (formatnya `mp_…`). Key ini hanya muncul **sekali** — kalau hilang, harus issue ulang.

## 3. Setup environment

Buat `.env` di root project SvelteKit-mu (Vite expose var dengan prefix `VITE_*` ke browser):

```dotenv
# .env
VITE_FEEDBACK_API_URL=https://prot-api.iwkapps.com
VITE_FEEDBACK_API_KEY=mp_xxxxxxxxxxxxxxxxxxxxxxx
```

Tambahkan ke `.gitignore`:

```
.env
.env.*
!.env.example
```

Bikin `.env.example` (committed) sebagai template:

```dotenv
# .env.example
VITE_FEEDBACK_API_URL=https://prot-api.iwkapps.com
VITE_FEEDBACK_API_KEY=
```

## 4. Pasang di layout root

Edit `src/routes/+layout.svelte`. Ada dua cara: pakai **Svelte action** (recommended), atau init manual lewat `onMount`.

### Cara A — Svelte action (paling sederhana)

```svelte
<!-- src/routes/+layout.svelte -->
<script lang="ts">
  import { feedback } from '@mahmulp/feedback-sdk/svelte';

  const apiUrl = import.meta.env.VITE_FEEDBACK_API_URL;
  const apiKey = import.meta.env.VITE_FEEDBACK_API_KEY;
</script>

<div use:feedback={{ apiUrl, apiKey }}>
  <slot />
</div>
```

Itu doang. Floating launcher otomatis muncul di pojok kanan-bawah. User klik **Feedback** → klik elemen apapun → tulis komen → kirim.

> **Nonaktifkan screenshot capture (opsional):** kalau prototype-mu pakai animasi/transition yang sensitif, atau prefer pin tanpa screenshot, tambahkan `captureScreenshots: false`:
>
> ```svelte
> <div use:feedback={{ apiUrl, apiKey, captureScreenshots: false }}>
>   <slot />
> </div>
> ```
>
> html2canvas raster jalan sinkron di main thread dan bisa overlap dengan animasi composer; matikan kalau lebih penting smooth daripada visual context.

### Cara B — Init manual (kalau butuh kontrol lebih)

```svelte
<!-- src/routes/+layout.svelte -->
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { initFeedback, destroyFeedback } from '@mahmulp/feedback-sdk';

  onMount(() => {
    initFeedback({
      apiUrl: import.meta.env.VITE_FEEDBACK_API_URL,
      apiKey: import.meta.env.VITE_FEEDBACK_API_KEY,
      // Opsional:
      captureScreenshots: true, // default true
      selectParentModifier: 'Alt', // Alt-click pilih parent element
    });
  });

  onDestroy(() => {
    destroyFeedback();
  });
</script>

<slot />
```

## 5. Toggle button kustom (opsional)

Kalau mau tombol toggle sendiri di luar launcher bawaan SDK:

```svelte
<!-- src/lib/FeedbackToggle.svelte -->
<script lang="ts">
  import { feedbackEnabled } from '@mahmulp/feedback-sdk/svelte';

  function toggle() {
    feedbackEnabled.set(!$feedbackEnabled);
  }
</script>

<button on:click={toggle} class:active={$feedbackEnabled}>
  {$feedbackEnabled ? 'Stop feedback' : 'Give feedback'}
</button>

<style>
  button.active { background: #1F5132; color: #F5FFF8; }
</style>
```

## 6. Stable selectors dengan `data-feedback-id`

SDK pakai DOM selector untuk anchor pin ke elemen yang benar. Class Tailwind / hashed CSS modules tidak stabil — kalau berubah saat refactor, pin jadi orphan.

Best practice: tambahkan `data-feedback-id` di elemen-elemen kunci (button utama, card, section title):

```svelte
<button data-feedback-id="checkout-submit" class="btn btn-primary">
  Pay now
</button>

<section data-feedback-id="hero">
  <h1>Welcome</h1>
</section>
```

SDK prioritaskan `data-feedback-id` di atas selector apapun, jadi pin yang dikomen ke elemen ini akan tahan refactor CSS dan layout shift.

## 7. SSR awareness

SDK itu browser-only. Action `use:feedback` aman dipakai langsung — Svelte hanya jalanin action di client. Tapi kalau pakai `initFeedback()` manual, **wajib** dalam `onMount` atau `if (browser) { ... }`:

```ts
import { browser } from '$app/environment';

if (browser) {
  initFeedback({ apiUrl, apiKey });
}
```

## 8. Konfigurasi CORS di sisi API

Kalau prototype-mu host di domain lain, tambahkan origin-nya ke `ALLOWED_ORIGINS` di `apps/api/.env`:

```dotenv
ALLOWED_ORIGINS=https://prototype.iwkapps.com,https://prot-api.iwkapps.com,https://your-prototype.example.com
```

Restart API setelah ubah:

```bash
sudo systemctl restart feedback-api
```

Tanpa langkah ini, browser akan blokir request SDK dengan CORS error.

## 9. Verifikasi

1. Buka prototype di browser.
2. Buka DevTools → Console. Klik launcher (pojok kanan-bawah).
3. Klik elemen apapun → form komen muncul → kirim.
4. Buka dashboard `https://prototype.iwkapps.com` → project-mu → seharusnya pin baru muncul dengan screenshot.

Kalau ada masalah, cek console:

| Error | Penyebab |
|---|---|
| `CORS policy: No 'Access-Control-Allow-Origin'` | Origin prototype belum ada di `ALLOWED_ORIGINS` API. |
| `401 Unauthorized` | `apiKey` salah atau hilang. Issue ulang dari dashboard. |
| `[feedback-sdk] screenshot capture disabled` | Bundler tidak resolve `html2canvas`. Cek `bun add @mahmulp/feedback-sdk` jalan tanpa error. |
| Pin muncul tapi orphaned | Selector elemen tidak resolve lagi (CSS class berubah). Tambahkan `data-feedback-id` di elemen kunci. |

## 10. Update SDK

```bash
bun update @mahmulp/feedback-sdk
```

Versi baru auto-tag tiap merge ke `main` di repo SDK. Cek changelog di GitHub Releases.

## Reference: option lengkap

```ts
interface FeedbackOptions {
  apiUrl: string;              // URL API, mis. "https://prot-api.iwkapps.com"
  apiKey: string;              // Key dari dashboard, format "mp_..."
  captureScreenshots?: boolean; // default: true
  selectParentModifier?: 'Alt' | 'Shift' | 'Meta' | 'Control'; // default: 'Alt'
  getPageUrl?: () => string;   // override pageUrl yang dikirim ke server
  getAuthor?: () => { name: string; email?: string } | null; // override identitas user
  setAuthor?: (author: { name: string; email?: string }) => void;
  onError?: (err: unknown) => void;
}
```
