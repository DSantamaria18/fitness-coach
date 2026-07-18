import "@testing-library/jest-dom/vitest";

// recharts (informe de progreso) mide su contenedor con ResizeObserver antes
// de decidir si tiene tamaño válido para renderizar el SVG interno; jsdom no
// implementa ResizeObserver ni layout real (getBoundingClientRect siempre
// devuelve 0), así que sin este polyfill los gráficos no llegarían a
// renderizar nada en los tests. Global porque solo lo necesitan los tests
// que usan recharts, pero no interfiere con el resto (nadie más depende de
// getBoundingClientRect devolviendo 0).
class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver =
    ResizeObserverMock as unknown as typeof ResizeObserver;
}

Object.defineProperty(HTMLElement.prototype, "getBoundingClientRect", {
  configurable: true,
  value: () => ({
    width: 800,
    height: 400,
    top: 0,
    left: 0,
    bottom: 400,
    right: 800,
    x: 0,
    y: 0,
    toJSON() {},
  }),
});
