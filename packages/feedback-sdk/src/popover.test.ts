import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Feedback } from "./types.js";
import { PopoverManager } from "./popover.js";

let layer: HTMLDivElement;
let popover: PopoverManager;

beforeEach(() => {
  layer = document.createElement("div");
  document.body.appendChild(layer);
  popover = new PopoverManager(layer);
});

afterEach(() => {
  popover.hide();
  layer.remove();
});

const sampleFeedback: Feedback = {
  id: "fb_1",
  projectId: "demo",
  pageUrl: "/",
  selector: "#x",
  coordinates: { xPercent: 0, yPercent: 0, xPx: 0, yPx: 0 },
  viewport: { width: 1024, height: 768, devicePixelRatio: 1 },
  status: "open",
  thread: [
    {
      id: "cm_1",
      author: { name: "Anita" },
      body: "Hello",
      createdAt: "2024-01-01T00:00:00Z",
    },
  ],
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
};

describe("PopoverManager â€” composer", () => {
  it("renders a composer with prefilled author when provided", () => {
    popover.showComposer(
      { pageX: 100, pageY: 100 },
      {
        initialAuthor: { name: "Anita", email: "a@example.com" },
        onSubmit: vi.fn(),
        onCancel: vi.fn(),
      }
    );
    const nameInput = layer.querySelector(".popover-name") as HTMLInputElement;
    const emailInput = layer.querySelector(".popover-email") as HTMLInputElement;
    expect(nameInput.value).toBe("Anita");
    expect(emailInput.value).toBe("a@example.com");
  });

  it("does not call onSubmit when the comment body is empty", () => {
    const onSubmit = vi.fn();
    popover.showComposer(
      { pageX: 100, pageY: 100 },
      { initialAuthor: { name: "Anita" }, onSubmit, onCancel: vi.fn() }
    );
    const submit = layer.querySelector(".popover-submit") as HTMLButtonElement;
    submit.click();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("does not call onSubmit when the author name is missing", () => {
    const onSubmit = vi.fn();
    popover.showComposer(
      { pageX: 100, pageY: 100 },
      { initialAuthor: null, onSubmit, onCancel: vi.fn() }
    );
    const textarea = layer.querySelector(".popover-textarea") as HTMLTextAreaElement;
    textarea.value = "needs a fix";
    const submit = layer.querySelector(".popover-submit") as HTMLButtonElement;
    submit.click();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("submits trimmed body + author when both fields are valid", async () => {
    const onSubmit = vi.fn();
    popover.showComposer(
      { pageX: 100, pageY: 100 },
      { initialAuthor: { name: "Anita" }, onSubmit, onCancel: vi.fn() }
    );
    const textarea = layer.querySelector(".popover-textarea") as HTMLTextAreaElement;
    textarea.value = "  needs a fix  ";
    const submit = layer.querySelector(".popover-submit") as HTMLButtonElement;
    submit.click();
    await Promise.resolve();
    expect(onSubmit).toHaveBeenCalledWith("needs a fix", { name: "Anita" });
  });

  it("calls onCancel when the cancel button is clicked", () => {
    const onCancel = vi.fn();
    popover.showComposer(
      { pageX: 100, pageY: 100 },
      { initialAuthor: { name: "Anita" }, onSubmit: vi.fn(), onCancel }
    );
    const cancel = layer.querySelector(".btn-ghost") as HTMLButtonElement;
    cancel.click();
    expect(onCancel).toHaveBeenCalled();
  });
});

describe("PopoverManager â€” thread", () => {
  it("renders existing comments", () => {
    popover.showThread(
      sampleFeedback,
      { pageX: 0, pageY: 0 },
      {
        initialAuthor: null,
        onReply: vi.fn(),
        onStatus: vi.fn(),
        onClose: vi.fn(),
      }
    );
    const items = layer.querySelectorAll(".popover-comment");
    expect(items).toHaveLength(1);
    expect(items[0]?.textContent).toContain("Anita");
    expect(items[0]?.textContent).toContain("Hello");
  });

  it("offers resolve and archive transitions when status is open", () => {
    popover.showThread(
      sampleFeedback,
      { pageX: 0, pageY: 0 },
      { initialAuthor: null, onReply: vi.fn(), onStatus: vi.fn(), onClose: vi.fn() }
    );
    const buttons = Array.from(layer.querySelectorAll(".btn-toolbar")) as HTMLButtonElement[];
    const targets = buttons.map((b) => b.dataset.status);
    expect(targets).toEqual(expect.arrayContaining(["resolved", "archived"]));
  });

  it("calls onStatus with the chosen transition", () => {
    const onStatus = vi.fn();
    popover.showThread(
      sampleFeedback,
      { pageX: 0, pageY: 0 },
      { initialAuthor: null, onReply: vi.fn(), onStatus, onClose: vi.fn() }
    );
    const resolveBtn = layer.querySelector('.btn-toolbar[data-status="resolved"]') as HTMLButtonElement;
    resolveBtn.click();
    expect(onStatus).toHaveBeenCalledWith("resolved");
  });

  it("calls onReply with body + author and clears the popover dialog dom on hide", async () => {
    const onReply = vi.fn();
    popover.showThread(
      sampleFeedback,
      { pageX: 0, pageY: 0 },
      {
        initialAuthor: { name: "Budi" },
        onReply,
        onStatus: vi.fn(),
        onClose: vi.fn(),
      }
    );
    const textarea = layer.querySelector(".popover-textarea") as HTMLTextAreaElement;
    textarea.value = "Replied";
    const submit = layer.querySelector(".popover-submit") as HTMLButtonElement;
    submit.click();
    await Promise.resolve();
    expect(onReply).toHaveBeenCalledWith("Replied", { name: "Budi" });

    popover.hide();
    expect(layer.querySelector(".popover")).toBeNull();
  });

  it("ownsEvent returns true for clicks inside the popover", () => {
    popover.showThread(
      sampleFeedback,
      { pageX: 0, pageY: 0 },
      { initialAuthor: null, onReply: vi.fn(), onStatus: vi.fn(), onClose: vi.fn() }
    );
    const popoverEl = layer.querySelector(".popover") as HTMLDivElement;
    const evt = { composedPath: () => [popoverEl, layer, document.body, document] } as unknown as Event;
    expect(popover.ownsEvent(evt)).toBe(true);
  });

  it("ownsEvent returns false for clicks outside", () => {
    popover.showThread(
      sampleFeedback,
      { pageX: 0, pageY: 0 },
      { initialAuthor: null, onReply: vi.fn(), onStatus: vi.fn(), onClose: vi.fn() }
    );
    const evt = { composedPath: () => [document.body, document] } as unknown as Event;
    expect(popover.ownsEvent(evt)).toBe(false);
  });
});
