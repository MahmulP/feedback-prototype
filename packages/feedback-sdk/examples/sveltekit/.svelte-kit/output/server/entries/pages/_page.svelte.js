import { F as head, v as escape_html, a4 as store_get, a7 as unsubscribe_stores } from "../../chunks/renderer.js";
function createInternalStore() {
  const subs = /* @__PURE__ */ new Set();
  let value = false;
  let attached = null;
  function emit() {
    for (const s of subs) s(value);
  }
  return {
    subscribe(run) {
      subs.add(run);
      run(value);
      return () => subs.delete(run);
    },
    set(next) {
      value = next;
      attached?.setEnabled(next);
      emit();
    },
    toggle() {
      this.set(!value);
    },
    attach(c) {
      attached = c;
      value = c.isEnabled();
      emit();
    },
    detach() {
      attached = null;
      value = false;
      emit();
    }
  };
}
var enabledStore = createInternalStore();
function feedbackEnabled() {
  return {
    subscribe: enabledStore.subscribe.bind(enabledStore),
    set: enabledStore.set.bind(enabledStore),
    toggle: enabledStore.toggle.bind(enabledStore)
  };
}
function createMockTransport(options = {}) {
  const items = options.initial ? options.initial.map(clone) : [];
  const genId = options.generateId ?? defaultGenerateId;
  const latency = options.latencyMs ?? 0;
  async function delay() {
    if (latency > 0) await new Promise((r) => setTimeout(r, latency));
  }
  return {
    async list(query) {
      await delay();
      const filtered = items.filter((f) => f.projectId === query.projectId).filter((f) => query.pageUrl ? f.pageUrl === query.pageUrl : true).filter((f) => query.status ? f.status === query.status : true).map(clone);
      return { items: filtered };
    },
    async create(input) {
      await delay();
      const now = (/* @__PURE__ */ new Date()).toISOString();
      const id = genId();
      const fb = {
        id,
        projectId: input.projectId,
        pageUrl: input.pageUrl,
        selector: input.selector,
        coordinates: { ...input.coordinates },
        viewport: { ...input.viewport },
        status: "open",
        thread: input.comment ? [
          {
            id: `cm_${id}_0`,
            author: { ...input.comment.author },
            body: input.comment.body,
            createdAt: now
          }
        ] : [],
        createdAt: now,
        updatedAt: now
      };
      items.push(fb);
      return clone(fb);
    },
    async reply(feedbackId, comment) {
      await delay();
      const fb = items.find((f) => f.id === feedbackId);
      if (!fb) throw new Error(`feedback not found: ${feedbackId}`);
      const now = (/* @__PURE__ */ new Date()).toISOString();
      fb.thread.push({
        id: `cm_${feedbackId}_${fb.thread.length}`,
        author: { ...comment.author },
        body: comment.body,
        createdAt: now
      });
      fb.updatedAt = now;
      return clone(fb);
    },
    async setStatus(feedbackId, status) {
      await delay();
      const fb = items.find((f) => f.id === feedbackId);
      if (!fb) throw new Error(`feedback not found: ${feedbackId}`);
      fb.status = status;
      fb.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
      return clone(fb);
    },
    async uploadScreenshot(feedbackId, _blob) {
      await delay();
      const fb = items.find((f) => f.id === feedbackId);
      if (!fb) throw new Error(`feedback not found: ${feedbackId}`);
      fb.screenshotKey = `screenshots/${feedbackId}.png`;
      fb.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
      return clone(fb);
    },
    _all() {
      return items.map(clone);
    },
    _reset() {
      items.length = 0;
    }
  };
}
function defaultGenerateId() {
  return `fb_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
function clone(value) {
  return JSON.parse(JSON.stringify(value));
}
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    var $$store_subs;
    createMockTransport();
    const enabled = feedbackEnabled();
    head("1uha8ag", $$renderer2, ($$renderer3) => {
      $$renderer3.title(($$renderer4) => {
        $$renderer4.push(`<title>Feedback SDK · SvelteKit example</title>`);
      });
    });
    $$renderer2.push(`<div><header class="hero svelte-1uha8ag"><div class="brand svelte-1uha8ag">@iwkapps/feedback-sdk</div> <h1 class="svelte-1uha8ag">Pin a comment to anything on this page.</h1> <p class="lede svelte-1uha8ag">Toggle feedback mode, hover any element, click to leave a note. Hold <kbd class="svelte-1uha8ag">Alt</kbd> while
      clicking to walk one parent up. Press <kbd class="svelte-1uha8ag">Esc</kbd> to cancel.</p> <div class="hero-actions svelte-1uha8ag"><button class="btn btn-primary svelte-1uha8ag" type="button" data-feedback-id="hero-toggle">${escape_html(store_get($$store_subs ??= {}, "$enabled", enabled) ? "Stop feedback" : "Start feedback")}</button> <button class="btn btn-ghost svelte-1uha8ag" type="button">${escape_html("Copy install")}</button></div> <small class="hint svelte-1uha8ag">Shortcut: <kbd class="svelte-1uha8ag">Ctrl/⌘ + Shift + F</kbd></small></header> <main class="cards svelte-1uha8ag"><section class="card svelte-1uha8ag" data-feedback-id="card-hero"><h2 class="svelte-1uha8ag">Hero copy</h2> <p class="svelte-1uha8ag">Click anywhere on this card while feedback mode is on. The SDK captures a stable DOM
        selector (this card has <code class="svelte-1uha8ag">data-feedback-id="card-hero"</code>), the relative position
        inside the bounding box, and the absolute page pixel as a fallback.</p></section> <section class="card svelte-1uha8ag" data-feedback-id="card-pricing"><h2 class="svelte-1uha8ag">Pricing</h2> <ul><li class="svelte-1uha8ag"><strong>Free</strong> · for prototypes and personal use</li> <li class="svelte-1uha8ag"><strong>Team</strong> · self-hosted, unlimited projects</li> <li class="svelte-1uha8ag"><strong>Enterprise</strong> · talk to us</li></ul></section> <section class="card svelte-1uha8ag" data-feedback-id="card-form"><h2 class="svelte-1uha8ag">Contact</h2> <form class="svelte-1uha8ag"><label class="svelte-1uha8ag">Email <input type="email" placeholder="you@example.com" class="svelte-1uha8ag"/></label> <label class="svelte-1uha8ag">Message <textarea rows="3" placeholder="What would you change?" class="svelte-1uha8ag"></textarea></label> <button type="submit" class="btn btn-primary svelte-1uha8ag">Send</button></form></section></main></div>`);
    if ($$store_subs) unsubscribe_stores($$store_subs);
  });
}
export {
  _page as default
};
