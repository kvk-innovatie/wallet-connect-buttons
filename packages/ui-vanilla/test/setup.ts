import { vi } from "vitest"

vi.stubGlobal("__WCB_VERSION__", "test")

// happy-dom has no 2D canvas; the QR code only needs fillStyle/fillRect
HTMLCanvasElement.prototype.getContext = function () {
  return { fillStyle: "", fillRect() {} } as unknown as CanvasRenderingContext2D
} as unknown as typeof HTMLCanvasElement.prototype.getContext
