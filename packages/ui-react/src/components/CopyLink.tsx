import { COPIED_MS, ICONS, copyToClipboard } from "@wallet-connect/core"
import { useEffect, useState } from "react"
import { useT } from "../context"
import { Icon } from "./Icon"

/**
 * "Copy link" under the session's QR code: puts the link the code encodes on the clipboard (e.g. for a wallet on
 * this computer or a test wallet that cannot scan). Without clipboard access it shows the link to copy by hand.
 */
export const CopyLink = ({ ul }: { ul: URL }) => {
  const t = useT()
  const link = ul.toString()
  const [copied, setCopied] = useState(false)
  const [manual, setManual] = useState(false)

  // an ID step hands out a new link every few seconds: "Copied" belongs to the link that was copied
  useEffect(() => setCopied(false), [link])
  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), COPIED_MS)
    return () => clearTimeout(timer)
  }, [copied])

  const copy = async () => {
    if (await copyToClipboard(link)) setCopied(true)
    else setManual(true)
  }

  return (
    <div className="wcb-copy">
      <button type="button" className="wcb-action wcb-link" data-testid="copy_link_button" onClick={() => void copy()}>
        <Icon d={copied ? ICONS.check : ICONS.copy} />
        <span aria-live="polite">{copied ? t("copy_link_copied") : t("copy_link")}</span>
      </button>
      {manual && (
        <label>
          <span>{t("copy_link_manual")}</span>
          <input readOnly value={link} data-testid="copy_link_manual" autoFocus onFocus={(e) => e.currentTarget.select()} />
        </label>
      )}
    </div>
  )
}
