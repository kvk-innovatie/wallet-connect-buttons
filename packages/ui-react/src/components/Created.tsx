import { ICONS, onboardingLink, type InstallRole, type SessionType } from "@wallet-connect/core"
import { useDialog, useT } from "../context"
import { Icon } from "./Icon"
import { QrCode } from "./QrCode"

export const DeviceChoice = ({ ul, onChoice }: { ul: URL; onChoice: (sessionType: SessionType) => void }) => {
  const t = useT()
  return (
    <>
      <h2>{t("device_choice_title")}</h2>
      <section className="wcb-buttons" data-testid="device_choice">
        <a role="button" href={ul.toString()} target="_blank" className="wcb-action wcb-primary" data-testid="same_device_button" onClick={() => onChoice("same_device")}>
          <Icon d={ICONS.forward} />
          <span>{t("device_choice_same_device")}</span>
        </a>
        <button type="button" className="wcb-action wcb-secondary" data-testid="cross_device_button" onClick={() => onChoice("cross_device")}>
          <Icon d={ICONS.forward} />
          <span>{t("device_choice_cross_device")}</span>
        </button>
      </section>
    </>
  )
}

export const CreatedSection = ({ sameDeviceUl, crossDeviceUl, sessionType, onChoice }: { sameDeviceUl: URL; crossDeviceUl: URL; sessionType: SessionType; onChoice: (sessionType: SessionType) => void }) =>
  sessionType === "same_device" ? <DeviceChoice ul={sameDeviceUl} onChoice={onChoice} /> : <QrCode ul={crossDeviceUl} />

/** Desktop hand-off to the phone: the onboarding link as a QR code for the chosen role. */
export const InstallSection = ({ role }: { role: InstallRole }) => {
  const { t, helpBaseUrl, clientId } = useDialog()
  return (
    <section className="wcb-install" data-testid="install_section" data-role={role}>
      {role === "employee" && (
        <div className="wcb-intro" data-testid="install_employee_intro">
          <p className="wcb-intro-title">{t("help_employee_title")}</p>
          <p>{t("help_employee_description")}</p>
        </div>
      )}
      <QrCode ul={onboardingLink(helpBaseUrl, clientId as string, role, true)} title={t("install_title")} />
      <p>{t("install_body")}</p>
    </section>
  )
}
