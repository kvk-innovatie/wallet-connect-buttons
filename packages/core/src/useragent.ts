/// Decide whether a desktop is used. The implementation is loosely based on
// https://developer.mozilla.org/en-US/docs/Web/HTTP/Browser_detection_using_the_user_agent#mobile_tablet_or_desktop
export const isDesktop = (userAgent: string, maxTouchPoints = 0): boolean => {
  const mobile = /Mobi/.test(userAgent)
  const android = /Android/i.test(userAgent)
  const iPhone = /iPhone/.test(userAgent)
  const iPad = /iPad/.test(userAgent) || (userAgent.includes("Macintosh") && maxTouchPoints > 1)

  return !(mobile || android || iPhone || iPad)
}

// True on an Android phone or tablet; decides which app store a download
// button points at (everything else mobile gets the App Store).
export const isAndroid = (userAgent: string): boolean => /Android/i.test(userAgent)

/** Device facts the UI needs, read from a navigator (or faked in tests). */
export interface Device {
  isMobile: boolean
  isAndroid: boolean
}

export const detectDevice = (navigator?: Pick<Navigator, "userAgent" | "maxTouchPoints">): Device => {
  if (!navigator) return { isMobile: false, isAndroid: false }
  return {
    isMobile: !isDesktop(navigator.userAgent, navigator.maxTouchPoints),
    isAndroid: isAndroid(navigator.userAgent),
  }
}
