import '@testing-library/jest-dom/vitest'

// jsdom implements no layout, so scrollIntoView does not exist on elements. Components
// that scroll a result into view would throw in tests without this stub.
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {}
}
