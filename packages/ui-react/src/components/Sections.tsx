import { ICONS, type ErrorType, type SessionType } from "@wallet-connect/core"
import { useDialog, useT } from "../context"
import { Icon } from "./Icon"

export const LoadingIndicator = () => (
  <svg className="wcb-loading-indicator" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <circle cx="50" cy="50" r="45" />
  </svg>
)

export const LoadingSection = () => {
  const t = useT()
  return (
    <>
      <section data-testid="loading" className="wcb-text">
        <h2>{t("loading_title")}</h2>
        <p>{t("loading_body")}</p>
      </section>
      <LoadingIndicator />
    </>
  )
}

export const InProgressSection = () => {
  const t = useT()
  return (
    <>
      <Icon className="wcb-status" d={ICONS.phoneArrow} size={24} />
      <h2 data-testid="in_progress">{t("in_progress_title")}</h2>
    </>
  )
}

export const HelpLink = () => {
  const { t, helpBaseUrl } = useDialog()
  return (
    <a href={new URL("/help", helpBaseUrl).toString()} className="wcb-link" data-testid="help">
      <span>{t("need_help")}</span>
      <Icon d={ICONS.external} />
    </a>
  )
}

export const ConfirmStopSection = () => {
  const t = useT()
  return (
    <>
      <section className="wcb-text">
        <h2 data-testid="confirm_stop">{t("confirm_stop_title")}</h2>
        <p>{t("confirm_stop_body")}</p>
      </section>
      <HelpLink />
    </>
  )
}

export const SuccessSection = ({ sessionType }: { sessionType: SessionType }) => {
  const t = useT()
  if (sessionType === "same_device") {
    return (
      <>
        <Icon className="wcb-status" d={ICONS.phoneCheck} size={24} />
        <section className="wcb-text" data-testid="success_same_device">
          <h2>{t("success_title")}</h2>
          <p>{t("success_body")}</p>
        </section>
      </>
    )
  }
  return (
    <>
      <Icon className="wcb-status" d={ICONS.circleCheck} size={72} viewBox="0 0 72 72" />
      <section className="wcb-text" data-testid="success_cross_device">
        <h2>{t("success_title")}</h2>
      </section>
    </>
  )
}

export const ErrorSection = ({ errorType }: { errorType: ErrorType }) => {
  const t = useT()
  return (
    <>
      <Icon className="wcb-status" d={ICONS.phoneCross} size={24} />
      <section className="wcb-text">
        <h2 data-testid={`${errorType}_header`}>{t(`${errorType}_title`)}</h2>
        <p>{t(`${errorType}_body`)}</p>
      </section>
      <HelpLink />
    </>
  )
}
