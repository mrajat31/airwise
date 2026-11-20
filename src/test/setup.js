import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  localStorage.clear();
  sessionStorage.clear();
  vi.unstubAllEnvs();
  delete document.documentElement.dataset.theme;
});

// jsdom does not implement these browser APIs.
if (!window.matchMedia) {
  window.matchMedia = (query) => ({
    matches: false,
    media: query,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    onchange: null,
    dispatchEvent: () => false,
  });
}
window.scrollTo = () => {};

// jsdom has no canvas; returning null exercises the text-share fallback without console noise.
HTMLCanvasElement.prototype.getContext = () => null;
