import { ICONS, onboardingParams, storeForDevice, storeUrl, type InstallRole, type RequestedCredential, type Store, type Word } from "@wallet-connect/core"
import { useDialog, useT } from "../context"
import { Icon } from "./Icon"

/** The usual black App Store / Google Play badge: a link on a phone, a button (install QR code) on a desktop. */
export const StoreBadge = ({ store, href, label, testId, onClick }: { store: Store; href?: string; label: string; testId: string; onClick: () => void }) => {
  const t = useT()
  const icon = store === "apple" ? ICONS.apple : store === "google" ? ICONS.google : ICONS.download
  const content = (
    <>
      <Icon className="wcb-store-badge-icon" d={icon} aria-hidden="true" />
      <span className="wcb-store-badge-text">
        <small>{t(`${store}_store_line1` as Word)}</small>
        <strong>{t(`${store}_store_line2` as Word)}</strong>
      </span>
    </>
  )
  const className = `wcb-store-badge wcb-${store}`
  return href ? (
    <a className={className} href={href} target="_blank" rel="noopener noreferrer" aria-label={label} data-testid={testId} onClick={onClick}>
      {content}
    </a>
  ) : (
    <button type="button" className={className} aria-label={label} data-testid={testId} onClick={onClick}>
      {content}
    </button>
  )
}

/** Download badges per role (brands with store links and a registration id), one badge for an issuance, else the website link. */
export const HelpSection = ({ onInstall }: { onInstall: (role: InstallRole) => void }) => {
  const { t, brand, device, helpBaseUrl, clientId, issuance } = useDialog()
  const showRoleBadges = !!brand.store && !!clientId && !issuance
  const showHolderBadge = !!brand.store && !!clientId && issuance
  const store = storeForDevice(device.isMobile, device.isAndroid)
  const badgeHref = (role: InstallRole) => (device.isMobile && brand.store ? storeUrl(brand.store, store, onboardingParams(clientId as string, role)) : undefined)
  const onBadge = (role: InstallRole) => () => {
    if (!device.isMobile) onInstall(role)
  }

  if (showRoleBadges) {
    const employeeHref = badgeHref("employee")
    return (
      <section className="wcb-download" data-testid="download_section">
        <div className="wcb-options">
          <div className="wcb-option" data-testid="download_director">
            <p className="wcb-option-title">{t("help_director_title")}</p>
            <p>{t("help_director_description")}</p>
            <StoreBadge store={store} href={badgeHref("director")} label={t("help_director_link")} testId="download_director_badge" onClick={onBadge("director")} />
          </div>
        </div>
        <p className="wcb-employee">
          {employeeHref ? (
            <a className="wcb-link" href={employeeHref} target="_blank" rel="noopener noreferrer" data-testid="download_employee_link" onClick={onBadge("employee")}>
              {t("help_employee_link")}
            </a>
          ) : (
            <button type="button" className="wcb-link" data-testid="download_employee_link" onClick={onBadge("employee")}>
              {t("help_employee_link")}
            </button>
          )}
        </p>
      </section>
    )
  }
  if (showHolderBadge) {
    return (
      <section className="wcb-download" data-testid="download_section">
        <div className="wcb-options">
          <div className="wcb-option" data-testid="download_holder">
            <p className="wcb-option-title">{t("help_issuance_title")}</p>
            <p>{t("help_issuance_description")}</p>
            <StoreBadge store={store} href={badgeHref("holder")} label={t("help_issuance_link")} testId="download_holder_badge" onClick={onBadge("holder")} />
          </div>
        </div>
      </section>
    )
  }
  return (
    <section className="wcb-website" data-testid="website_link">
      <p>{t("help_title")}</p>
      <p>
        <a href={helpBaseUrl.toString()} className="wcb-link">
          <Icon d={ICONS.external} />
          <span>{t("help_to_website")}</span>
        </a>
      </p>
    </section>
  )
}

/** The credentials the registration asks for, with a link to where each can be obtained. */
export const RequestedCredentials = ({ credentials }: { credentials: RequestedCredential[] }) => {
  const { lang } = useDialog()
  if (credentials.length === 0) return null
  const nl = lang === "nl"
  return (
    <section className="wcb-credentials" data-testid="required_credentials">
      <h3>{nl ? "Benodigde Attestaties:" : "Required Credentials:"}</h3>
      {credentials.map((c) => (
        <div key={c.credentialKey} className="wcb-credential">
          <span>{nl ? c.credentialName.nl : c.credentialName.en}</span>
          {c.websiteUrl && (
            <a href={c.websiteUrl} target="_blank" rel="noopener noreferrer">
              {nl ? "→ Verkrijg attestatie" : "→ Get credential"}
            </a>
          )}
        </div>
      ))}
    </section>
  )
}
