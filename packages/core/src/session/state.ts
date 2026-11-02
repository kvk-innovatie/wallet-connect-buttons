import { type SessionType } from "./openid4vc"

const errors = ["failed", "cancelled", "expired", "network"] as const
export type ErrorType = (typeof errors)[number]

export const isError = (e: any): e is ErrorType => errors.includes(e)

/**
 * Role a relying-party download button installs the app for: `director` and
 * `employee` for a disclosure, `holder` for an issuance (any wallet holder can
 * collect an attestation).
 */
export type InstallRole = "director" | "employee" | "holder"

export type Session = {
  statusUrl: URL
  sessionType: SessionType
  sessionToken: string
}

export type ModalType =
  | { strategy: "dynamic"; usecase: string; startUrl: URL }
  | { strategy: "static"; sameDeviceUl: URL; crossDeviceUl: URL }

export type ModalState =
  | { kind: "creating" }
  | {
      kind: "created"
      sameDeviceUl: URL
      crossDeviceUl: URL
      session: Session
    }
  | { kind: "loading"; session: Session }
  | {
      kind: "in-progress"
      session: Session
    }
  | { kind: "success"; session: Session }
  | { kind: "error"; errorType: ErrorType; session?: Session }
  | { kind: "confirm-stop"; prev: ModalState; session: Session }
