import type { Feedback, FeedbackAuthor, FeedbackStatus } from "./types.js";

/**
 * Popover renderer for the composer (new pin) and thread (existing pin) UIs.
 *
 * Anchors are stored in **page space** (`pageX`, `pageY`). On scroll/resize
 * the popover re-projects to viewport space so it stays attached to the
 * underlying click point or pin.
 */

const POPOVER_OFFSET = 18;
const VIEWPORT_PADDING = 8;

export interface ComposerCallbacks {
  initialAuthor: FeedbackAuthor | null;
  onSubmit(body: string, author: FeedbackAuthor): void | Promise<void>;
  onCancel(): void;
}

export interface ThreadCallbacks {
  initialAuthor: FeedbackAuthor | null;
  onReply(body: string, author: FeedbackAuthor): void | Promise<void>;
  onStatus(status: FeedbackStatus): void | Promise<void>;
  onClose(): void;
}

export interface PopoverAnchor {
  /** Document-space x coordinate (page pixels). */
  pageX: number;
  /** Document-space y coordinate (page pixels). */
  pageY: number;
}

interface OpenState {
  type: "composer" | "thread";
  el: HTMLDivElement;
  pageX: number;
  pageY: number;
}

export class PopoverManager {
  private layer: HTMLDivElement;
  private current: OpenState | null = null;

  constructor(layer: HTMLDivElement) {
    this.layer = layer;
  }

  isOpen(): boolean {
    return this.current !== null;
  }

  /** True when the event originated inside the currently-open popover element. */
  ownsEvent(event: Event): boolean {
    if (!this.current) return false;
    const path = event.composedPath();
    return path.includes(this.current.el);
  }

  hide(): void {
    if (!this.current) return;
    this.current.el.remove();
    this.current = null;
  }

  showComposer(anchor: PopoverAnchor, cb: ComposerCallbacks): HTMLDivElement {
    this.hide();
    const el = this.buildComposer(cb);
    this.layer.appendChild(el);
    this.current = { type: "composer", el, pageX: anchor.pageX, pageY: anchor.pageY };
    this.repositionInternal();
    queueMicrotask(() => {
      const focusTarget = el.querySelector("textarea, input") as HTMLElement | null;
      focusTarget?.focus();
    });
    return el;
  }

  showThread(feedback: Feedback, anchor: PopoverAnchor, cb: ThreadCallbacks): HTMLDivElement {
    this.hide();
    const el = this.buildThread(feedback, cb);
    this.layer.appendChild(el);
    this.current = { type: "thread", el, pageX: anchor.pageX, pageY: anchor.pageY };
    this.repositionInternal();
    return el;
  }

  /** Re-project to viewport coordinates after a scroll/resize. */
  reposition(anchor?: PopoverAnchor): void {
    if (!this.current) return;
    if (anchor) {
      this.current.pageX = anchor.pageX;
      this.current.pageY = anchor.pageY;
    }
    this.repositionInternal();
  }

  private repositionInternal(): void {
    if (!this.current) return;
    const viewportX = this.current.pageX - window.scrollX;
    const viewportY = this.current.pageY - window.scrollY;
    this.applyPosition(this.current.el, viewportX, viewportY);
  }

  private applyPosition(el: HTMLElement, anchorX: number, anchorY: number): void {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const rect = el.getBoundingClientRect();
    const w = rect.width || 320;
    const h = rect.height || 200;

    let x = anchorX + POPOVER_OFFSET;
    if (x + w > vw - VIEWPORT_PADDING) x = anchorX - POPOVER_OFFSET - w;
    if (x < VIEWPORT_PADDING) x = VIEWPORT_PADDING;

    let y = anchorY;
    if (y + h > vh - VIEWPORT_PADDING) y = vh - h - VIEWPORT_PADDING;
    if (y < VIEWPORT_PADDING) y = VIEWPORT_PADDING;

    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
  }

  // ---------- Composer ----------

  private buildComposer(cb: ComposerCallbacks): HTMLDivElement {
    const root = this.makeShell("New comment", () => cb.onCancel());
    const body = root.querySelector(".popover-body") as HTMLDivElement;

    const identity = this.buildIdentityFields(cb.initialAuthor);
    body.appendChild(identity.el);

    const textarea = document.createElement("textarea");
    textarea.className = "popover-textarea";
    textarea.placeholder = "Describe what you see...";
    textarea.rows = 4;
    body.appendChild(textarea);

    const actions = document.createElement("div");
    actions.className = "popover-actions";

    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.className = "btn btn-ghost";
    cancel.textContent = "Cancel";
    cancel.addEventListener("click", () => cb.onCancel());

    const submit = document.createElement("button");
    submit.type = "button";
    submit.className = "btn btn-primary popover-submit";
    submit.textContent = "Send";
    submit.addEventListener("click", async () => {
      const text = textarea.value.trim();
      if (text.length === 0) {
        textarea.focus();
        return;
      }
      const author = identity.read();
      if (!author) return;
      submit.disabled = true;
      try {
        await cb.onSubmit(text, author);
      } finally {
        submit.disabled = false;
      }
    });

    actions.appendChild(cancel);
    actions.appendChild(submit);
    body.appendChild(actions);

    return root;
  }

  // ---------- Thread ----------

  private buildThread(feedback: Feedback, cb: ThreadCallbacks): HTMLDivElement {
    const titleText = `Status: ${feedback.status}`;
    const root = this.makeShell(titleText, () => cb.onClose());
    root.classList.add("popover-thread");
    root.dataset.status = feedback.status;
    const body = root.querySelector(".popover-body") as HTMLDivElement;

    const toolbar = document.createElement("div");
    toolbar.className = "popover-toolbar";
    const transitions = nextStatuses(feedback.status);
    for (const status of transitions) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "btn btn-toolbar";
      btn.dataset.status = status;
      btn.textContent = labelForStatusTransition(status);
      btn.addEventListener("click", () => {
        void cb.onStatus(status);
      });
      toolbar.appendChild(btn);
    }
    body.appendChild(toolbar);

    const list = document.createElement("ul");
    list.className = "popover-thread-list";
    if (feedback.thread.length === 0) {
      const empty = document.createElement("li");
      empty.className = "popover-empty";
      empty.textContent = "No comments yet.";
      list.appendChild(empty);
    } else {
      for (const c of feedback.thread) {
        const item = document.createElement("li");
        item.className = "popover-comment";
        const meta = document.createElement("div");
        meta.className = "popover-comment-meta";
        meta.textContent = c.author.name;
        const text = document.createElement("div");
        text.className = "popover-comment-body";
        text.textContent = c.body;
        item.appendChild(meta);
        item.appendChild(text);
        list.appendChild(item);
      }
    }
    body.appendChild(list);

    const identity = this.buildIdentityFields(cb.initialAuthor);
    body.appendChild(identity.el);

    const reply = document.createElement("textarea");
    reply.className = "popover-textarea";
    reply.placeholder = "Reply...";
    reply.rows = 3;
    body.appendChild(reply);

    const actions = document.createElement("div");
    actions.className = "popover-actions";
    const submit = document.createElement("button");
    submit.type = "button";
    submit.className = "btn btn-primary popover-submit";
    submit.textContent = "Reply";
    submit.addEventListener("click", async () => {
      const text = reply.value.trim();
      if (text.length === 0) {
        reply.focus();
        return;
      }
      const author = identity.read();
      if (!author) return;
      submit.disabled = true;
      try {
        await cb.onReply(text, author);
      } finally {
        submit.disabled = false;
      }
    });
    actions.appendChild(submit);
    body.appendChild(actions);

    return root;
  }

  // ---------- Shared bits ----------

  private makeShell(title: string, onClose: () => void): HTMLDivElement {
    const root = document.createElement("div");
    root.className = "popover";
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-label", title);

    const header = document.createElement("div");
    header.className = "popover-header";
    const titleEl = document.createElement("span");
    titleEl.className = "popover-title";
    titleEl.textContent = title;
    header.appendChild(titleEl);

    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "popover-close";
    closeBtn.setAttribute("aria-label", "Close");
    closeBtn.textContent = "\u00D7";
    closeBtn.addEventListener("click", () => onClose());
    header.appendChild(closeBtn);
    root.appendChild(header);

    const body = document.createElement("div");
    body.className = "popover-body";
    root.appendChild(body);

    return root;
  }

  private buildIdentityFields(initial: FeedbackAuthor | null): {
    el: HTMLElement;
    read: () => FeedbackAuthor | null;
  } {
    const wrap = document.createElement("div");
    wrap.className = "popover-identity";

    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.placeholder = "Your name";
    nameInput.className = "popover-input popover-name";
    nameInput.required = true;
    nameInput.autocomplete = "name";

    const emailInput = document.createElement("input");
    emailInput.type = "email";
    emailInput.placeholder = "Email (optional)";
    emailInput.className = "popover-input popover-email";
    emailInput.autocomplete = "email";

    if (initial) {
      nameInput.value = initial.name;
      if (initial.email) emailInput.value = initial.email;
    }

    wrap.appendChild(nameInput);
    wrap.appendChild(emailInput);

    return {
      el: wrap,
      read(): FeedbackAuthor | null {
        const name = nameInput.value.trim();
        if (name.length === 0) {
          nameInput.focus();
          return null;
        }
        const email = emailInput.value.trim();
        return email.length > 0 ? { name, email } : { name };
      },
    };
  }
}

function nextStatuses(current: FeedbackStatus): FeedbackStatus[] {
  switch (current) {
    case "open":
      return ["resolved", "archived"];
    case "resolved":
      return ["open", "archived"];
    case "archived":
      return ["open"];
  }
}

function labelForStatusTransition(target: FeedbackStatus): string {
  switch (target) {
    case "open":
      return "Reopen";
    case "resolved":
      return "Resolve";
    case "archived":
      return "Archive";
  }
}
