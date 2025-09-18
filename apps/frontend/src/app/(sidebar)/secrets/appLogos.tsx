export type AppLogoEntry = {
  file?: string
  displayName?: string
}

// Map schema keys (or common aliases) to local logos in public/logos
export const APP_LOGOS: Record<string, AppLogoEntry> = {
  shopifyApi: { file: "/logos/shopify.svg", displayName: "Shopify" },
  shopify: { file: "/logos/shopify.svg", displayName: "Shopify" },
  wixApi: { file: "/logos/wix-logo-1.svg", displayName: "Wix" },
  wix: { file: "/logos/wix-logo-1.svg", displayName: "Wix" },
  googleApi: { file: "/logos/google-icon.svg", displayName: "Google" },
  google: { file: "/logos/google-icon.svg", displayName: "Google" },
  googleSheetsApi: { file: "/logos/google-spreadsheets.svg", displayName: "Google Sheets" },
  sheets: { file: "/logos/google-spreadsheets.svg", displayName: "Sheets" },
  aws: { file: "/white-logo.png", displayName: "AWS" },
}

export const FALLBACK_LOGO = "/white-logo.png"

export function toTitleFromKey(key: string): string {
  return key
    .replace(/Api$/i, "")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/^\w/, (m) => m.toUpperCase())
}

export function getAppLogoUrl(schemaKey: string): string {
  const exact = APP_LOGOS[schemaKey]
  if (exact?.file) return exact.file
  // Try convention-based local file first (if you add files matching keys)
  return FALLBACK_LOGO
}

export function getDisplayNameFromKey(schemaKey: string): string {
  return APP_LOGOS[schemaKey]?.displayName || toTitleFromKey(schemaKey)
}

export function AppLogo({ appKey, alt, size = 24 }: { appKey: string; alt?: string; size?: number }) {
  const src = getAppLogoUrl(appKey)
  const aria = alt || getDisplayNameFromKey(appKey)
  // Using <img> keeps it simple for public assets
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={aria} width={size} height={size} style={{ width: size, height: size }} />
}


