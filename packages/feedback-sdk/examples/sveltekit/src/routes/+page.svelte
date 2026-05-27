<script lang="ts">
  import { feedback } from "@mahmulp/feedback-sdk/svelte";
  import { createMockTransport } from "@mahmulp/feedback-sdk/mock";

  // If VITE_FEEDBACK_API_KEY is set, the example talks to a real API.
  // Otherwise it falls back to the in-memory mock so the demo runs solo.
  const apiUrl = import.meta.env.VITE_FEEDBACK_API_URL ?? "http://localhost:8787";
  const apiKey = import.meta.env.VITE_FEEDBACK_API_KEY ?? "";
  const usingApi = apiKey.length > 0;

  const transport = usingApi ? undefined : createMockTransport();
  const captureScreenshots = usingApi;

  let copied = false;
  function copyInstall() {
    navigator.clipboard.writeText("bun add @mahmulp/feedback-sdk");
    copied = true;
    setTimeout(() => (copied = false), 1200);
  }
</script>

<svelte:head>
  <title>Feedback SDK · SvelteKit example</title>
</svelte:head>

<div use:feedback={{ apiUrl, apiKey, transport, captureScreenshots }}>
  <header class="hero">
    <div class="brand">@mahmulp/feedback-sdk</div>
    <h1>Pin a comment to anything on this page.</h1>
    <p class="lede">
      Use the floating launcher in the bottom-right corner to toggle feedback mode, hide pins, or
      hide the launcher itself. Hold <kbd>Alt</kbd> while clicking to walk one parent up; press
      <kbd>Esc</kbd> to cancel.
    </p>
    <div class="hero-actions">
      <button class="btn btn-ghost" type="button" on:click={copyInstall}>
        {copied ? "Copied" : "Copy install"}
      </button>
    </div>
    <small class="hint">
      Shortcut: <kbd>Ctrl/⌘ + Shift + F</kbd>
      {#if usingApi}
        · <span class="badge live">live API</span> {apiUrl}
      {:else}
        · <span class="badge mock">mock transport</span> — set <code>VITE_FEEDBACK_API_KEY</code> in <code>.env</code> to sync with the real API
      {/if}
    </small>
  </header>

  <main class="cards">
    <section class="card" data-feedback-id="card-hero">
      <h2>Hero copy</h2>
      <p>
        Click anywhere on this card while feedback mode is on. The SDK captures a stable DOM
        selector (this card has <code>data-feedback-id="card-hero"</code>), the relative position
        inside the bounding box, and the absolute page pixel as a fallback.
      </p>
    </section>

    <section class="card" data-feedback-id="card-pricing">
      <h2>Pricing</h2>
      <ul>
        <li><strong>Free</strong> · for prototypes and personal use</li>
        <li><strong>Team</strong> · self-hosted, unlimited projects</li>
        <li><strong>Enterprise</strong> · talk to us</li>
      </ul>
    </section>

    <section class="card" data-feedback-id="card-form">
      <h2>Contact</h2>
      <form on:submit|preventDefault={() => alert("not implemented in the demo")}>
        <label>
          Email
          <input type="email" placeholder="you@example.com" />
        </label>
        <label>
          Message
          <textarea rows="3" placeholder="What would you change?" />
        </label>
        <button type="submit" class="btn btn-primary">Send</button>
      </form>
    </section>
  </main>
</div>

<style>
  .hero {
    padding: 64px 24px 32px;
    max-width: 880px;
    margin: 0 auto;
    text-align: center;
  }
  .brand {
    display: inline-block;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 12px;
    color: var(--muted);
    background: var(--card);
    padding: 4px 10px;
    border-radius: 999px;
    border: 1px solid var(--border);
  }
  h1 {
    margin: 12px 0 8px;
    font-size: clamp(28px, 4vw, 44px);
    line-height: 1.15;
    letter-spacing: -0.01em;
  }
  .lede {
    color: var(--muted);
    margin: 0 auto 16px;
    max-width: 540px;
  }
  .hero-actions {
    display: flex;
    gap: 8px;
    justify-content: center;
    margin-bottom: 8px;
  }
  .hint {
    color: var(--muted);
    font-size: 12px;
  }
  .badge {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 999px;
    font-size: 11px;
    font-weight: 600;
    border: 1px solid var(--border);
  }
  .badge.live {
    background: rgba(31, 81, 50, 0.12);
    color: var(--primary);
    border-color: rgba(31, 81, 50, 0.32);
  }
  .badge.mock {
    background: var(--card);
    color: var(--muted);
  }

  .cards {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
    gap: 16px;
    padding: 16px 24px 96px;
    max-width: 1080px;
    margin: 0 auto;
  }
  .card {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 20px;
  }
  .card h2 {
    margin: 0 0 8px;
    font-size: 16px;
    color: var(--primary);
  }
  .card p,
  .card li {
    color: var(--muted);
    line-height: 1.55;
  }
  .card code {
    font-size: 12px;
    background: rgba(0, 0, 0, 0.05);
    padding: 1px 4px;
    border-radius: 4px;
  }

  form {
    display: grid;
    gap: 8px;
  }
  label {
    display: grid;
    gap: 4px;
    font-size: 12px;
    color: var(--muted);
  }
  input,
  textarea {
    padding: 8px 10px;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: transparent;
    color: inherit;
    font: inherit;
    resize: vertical;
  }
  input:focus,
  textarea:focus {
    outline: none;
    border-color: var(--primary);
    box-shadow: 0 0 0 3px rgba(31, 81, 50, 0.18);
  }

  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 10px 16px;
    border-radius: 8px;
    border: 1px solid transparent;
    font: 600 14px/1 inherit;
    cursor: pointer;
    background: transparent;
    color: inherit;
  }
  .btn-primary {
    background: var(--primary);
    color: var(--primary-foreground);
  }
  .btn-ghost {
    border-color: var(--border);
  }
  kbd {
    background: var(--card);
    border: 1px solid var(--border);
    border-bottom-width: 2px;
    border-radius: 4px;
    padding: 1px 6px;
    font-size: 11px;
    font-family: ui-monospace, monospace;
  }
</style>
