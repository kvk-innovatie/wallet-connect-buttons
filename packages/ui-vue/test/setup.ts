HTMLCanvasElement.prototype.getContext = function () {
  return { fillStyle: "", fillRect() {} } as unknown as CanvasRenderingContext2D
} as unknown as typeof HTMLCanvasElement.prototype.getContext
