import "@testing-library/jest-dom/vitest";

// jsdom implements none of these, and Radix Dialog/Checkbox reach for them as soon as a
// FormDialog opens. Each is defined only when missing, so a real DOM is never shadowed.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver;
Element.prototype.hasPointerCapture ??= () => false;
Element.prototype.releasePointerCapture ??= () => {};
Element.prototype.scrollIntoView ??= () => {};
