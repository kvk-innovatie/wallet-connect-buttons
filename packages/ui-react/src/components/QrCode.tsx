import { drawCanvas, qrcodegen } from "@wallet-connect/core"
import { useEffect, useRef } from "react"
import { useT } from "../context"

export const QrCode = ({ ul, title }: { ul: URL; title?: string }) => {
  const t = useT()
  const canvas = useRef<HTMLCanvasElement>(null)
  const text = ul.toString()
  useEffect(() => {
    if (canvas.current) {
      // MEDIUM recovers 15% of the code: the logo overlay hides about 5% of the modules, which LOW (7%) cannot reliably absorb.
      drawCanvas(qrcodegen.QrCode.encodeText(text, qrcodegen.QrCode.Ecc.MEDIUM), canvas.current)
    }
  }, [text])
  return (
    <>
      <h2>{title ?? t("qr_code_title")}</h2>
      <div className="wcb-qr" data-testid="qr">
        <canvas ref={canvas} />
        <div role="img" className="wcb-logo" aria-label={t("qr_code_label")} />
      </div>
    </>
  )
}
