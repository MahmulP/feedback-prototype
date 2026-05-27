<script lang="ts">
  import { onMount } from "svelte";
  import { feedback, feedbackEnabled } from "@mahmulp/feedback-sdk/svelte";
  import { createMockTransport } from "@mahmulp/feedback-sdk/mock";

  // Demo-only: mock transport so the example runs end-to-end without a backend.
  // Replace with `apiUrl: import.meta.env.VITE_FEEDBACK_API` once the API exists.
  const transport = createMockTransport();
  const enabled = feedbackEnabled();

  let copied = false;
  function copyInstall() {
    navigator.clipboard.writeText("bun add @mahmulp/feedback-sdk");
    copied = true;
    setTimeout(() => (copied = false), 1200);
  }

  onMount(() => {
    // Keyboard shortcut: âŒ˜/Ctrl + Shift + F toggles feedback mode.
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "f") {
        e.preventDefault();
        enabled.toggle();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });
</script>

<svelte:head>
  <title>Feedback SDK Â· SvelteKit example</title>
</svelte:head>

<div use:feedback={{ projectId: "demo", transport, captureScreenshots: false }}>
  <header class="hero">
    <div class="brand">@mahmulp/feedback-sdk</div>
    <h1>Pin a comment to anything on this page.</h1>
    <p class="lede">
      Toggle feedback mode, hover any element, click to leave a note. Hold <kbd>Alt</kbd> while
      clicking to walk one parent up. Press <kbd>Esc</kbd> to cancel.
    </p>
    <div class="hero-actions">
      <button
        class="btn btn-primary"
        type="button"
        data-feedback-id="hero-toggle"
        on:click={() => enabled.toggle()}
      >
        {$enabled ? "Stop feedback" : "Start feedback"}
      </button>
      <button class="btn btn-ghost" type="button" on:click={copyInstall}>
        {copied ? "Copied" : "Copy install"}
      </button>
    </div>
    <small class="hint">Shortcut: <kbd>Ctrl/âŒ˜ + Shift + F</kbd></small>
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
        <li><strong>Free</strong> Â· for prototypes and personal use</li>
        <li><strong>Team</strong> Â· self-hosted, unlimited projects</li>
        <li><strong>Enterprise</strong> Â· talk to us</li>
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
