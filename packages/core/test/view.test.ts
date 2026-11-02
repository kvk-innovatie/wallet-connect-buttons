import { describe, expect, it } from "vitest"
import type { ModalState, Session } from "../src/session/state"
import { footerActions, mainView, modalClassNames, showBackArrow, showHelpSection } from "../src/view"

const session: Session = { statusUrl: new URL("http://s"), sessionType: "cross_device", sessionToken: "t" }
const created: ModalState = { kind: "created", sameDeviceUl: new URL("x://a"), crossDeviceUl: new URL("x://b"), session }
const ids = (state: ModalState, role: "director" | null = null) => footerActions(state, role).map((a) => a.testId)

describe("footer actions (ModalFooter.vue as data)", () => {
  it("offers help and stop while busy", () => {
    expect(ids({ kind: "creating" })).toEqual(["help", "cancel_button"])
    expect(ids({ kind: "loading", session })).toEqual(["help", "cancel_button"])
    expect(ids({ kind: "in-progress", session })).toEqual(["help", "cancel_button"])
    const cancel = footerActions({ kind: "in-progress", session }, null)[1]
    expect(cancel).toMatchObject({ variant: "secondary", word: "stop", command: "confirmStop" })
  })
  it("asks to confirm a stop", () => {
    const actions = footerActions({ kind: "confirm-stop", prev: { kind: "in-progress", session }, session }, null)
    expect(actions.map((a) => a.testId)).toEqual(["cancel_button", "back_button"])
    expect(actions[0]).toMatchObject({ variant: "error", word: "yes_stop", command: "stop" })
  })
  it("closes (by cancelling) from the created screen, or says the app is installed", () => {
    expect(footerActions(created, null)).toEqual([expect.objectContaining({ testId: "close_button", variant: "link", command: "stop" })])
    expect(ids(created, "director")).toEqual(["installed_button"])
  })
  it("retries and closes after an error, closes after success", () => {
    expect(ids({ kind: "error", errorType: "failed", session })).toEqual(["retry_button", "close_button"])
    expect(footerActions({ kind: "success", session }, null)[0]).toMatchObject({ testId: "close_button", variant: "link", command: "close" })
    expect(footerActions({ kind: "success", session: { ...session, sessionType: "same_device" } }, null)[0]).toMatchObject({ variant: "primary" })
  })
})

describe("main view and classes", () => {
  it("maps states to sections", () => {
    expect(mainView({ kind: "creating" }, null)).toBe("loading")
    expect(mainView(created, null)).toBe("created")
    expect(mainView(created, "director", "c")).toBe("install")
    expect(mainView(created, "director", undefined)).toBe("created")
    expect(mainView({ kind: "success", session }, null)).toBe("success")
  })
  it("classes carry state, session type and install view", () => {
    expect(modalClassNames({ kind: "success", session }, null)).toEqual(["wcb-success", "wcb-cross_device"])
    expect(modalClassNames(created, "employee")).toEqual(["wcb-created", "wcb-install"])
    expect(showHelpSection(created, null)).toBe(true)
    expect(showHelpSection(created, "employee")).toBe(false)
    expect(showBackArrow(created, "employee")).toBe(true)
  })
})
