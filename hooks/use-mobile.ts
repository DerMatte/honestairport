import * as React from "react"

const MOBILE_BREAKPOINT = 768

function getIsMobile() {
  return window.innerWidth < MOBILE_BREAKPOINT
}

export function useIsMobile() {
  return React.useSyncExternalStore(
    (onStoreChange) => {
      const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
      mql.addEventListener("change", onStoreChange)
      return () => mql.removeEventListener("change", onStoreChange)
    },
    getIsMobile,
    () => false,
  )
}

// Matches Tailwind's `lg` breakpoint.
const DESKTOP_BREAKPOINT = 1024

function getIsDesktop() {
  return window.innerWidth >= DESKTOP_BREAKPOINT
}

export function useIsDesktop() {
  return React.useSyncExternalStore(
    (onStoreChange) => {
      const mql = window.matchMedia(`(min-width: ${DESKTOP_BREAKPOINT}px)`)
      mql.addEventListener("change", onStoreChange)
      return () => mql.removeEventListener("change", onStoreChange)
    },
    getIsDesktop,
    () => false,
  )
}
