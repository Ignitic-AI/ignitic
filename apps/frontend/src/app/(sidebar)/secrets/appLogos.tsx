"use client"

import { useState } from "react"

// Display name overrides when toTitleFromKey doesn't produce the right label
const DISPLAY_NAME_OVERRIDES: Record<string, string> = {
  googleSheetsApi: "Google Sheets",
  sheets: "Sheets",
  n8nTrigger: "n8n Trigger",
  hubspotPrivateApp: "HubSpot Private App",
}

export const FALLBACK_LOGO = "/white-logo.png"

// Map schema keys to domains for favicon lookup
const SCHEMA_TO_DOMAIN: Record<string, string> = {
  actionNetworkApi: "actionnetwork.com",
  affinityApi: "affinity.co",
  airtableApi: "airtable.com",
  airtableOAuth2Api: "airtable.com",
  airtableTokenApi: "airtable.com",
  airtable: "airtable.com",
  airtopApi: "airtop.ai",
  alienVaultApi: "alienvault.com",
  azureStorageOAuth2Api: "azure.microsoft.com",
  azureStorageSharedKeyApi: "azure.microsoft.com",
  baserowApi: "baserow.io",
  bitbucketApi: "bitbucket.org",
  bitlyOAuth2Api: "bitly.com",
  boxOAuth2Api: "box.com",
  brandfetchApi: "brandfetch.com",
  bubbleApi: "bubble.io",
  calApi: "cal.com",
  calendlyOAuth2Api: "calendly.com",
  carbonBlackApi: "vmware.com",
  ciscoMerakiApi: "meraki.cisco.com",
  ciscoSecureEndpointApi: "cisco.com",
  ciscoUmbrellaApi: "umbrella.com",
  ciscoWebexOAuth2Api: "webex.com",
  clickUpOAuth2Api: "clickup.com",
  crowdStrikeOAuth2Api: "crowdstrike.com",
  discordBotApi: "discord.com",
  discordOAuth2Api: "discord.com",
  discordWebhookApi: "discord.com",
  driftOAuth2Api: "drift.com",
  dropboxOAuth2Api: "dropbox.com",
  eventbriteOAuth2Api: "eventbrite.com",
  facebookGraphApi: "facebook.com",
  facebookGraphAppApi: "facebook.com",
  facebookLeadAdsOAuth2Api: "facebook.com",
  figmaApi: "figma.com",
  fileMaker: "filemaker.com",
  flowApi: "flow.io",
  formstackOAuth2Api: "formstack.com",
  gSuiteAdminOAuth2Api: "google.com",
  gmailOAuth2: "google.com",
  getResponseOAuth2Api: "getresponse.com",
  ghostAdminApi: "ghost.org",
  ghostContentApi: "ghost.org",
  githubApi: "github.com",
  githubOAuth2Api: "github.com",
  gitlabApi: "gitlab.com",
  gitlabOAuth2Api: "gitlab.com",
  goToWebinarOAuth2Api: "gotowebinar.com",
  gongOAuth2Api: "gong.io",
  googleAdsOAuth2Api: "google.com",
  googleApi: "google.com",
  googleBigQueryOAuth2Api: "google.com",
  googleBooksOAuth2Api: "google.com",
  googleBusinessProfileOAuth2Api: "google.com",
  googleCalendarOAuth2Api: "google.com",
  googleChatOAuth2Api: "google.com",
  googleCloudNaturalLanguageOAuth2Api: "google.com",
  googleCloudStorageOAuth2Api: "google.com",
  googleContactsOAuth2Api: "google.com",
  googleDocsOAuth2Api: "google.com",
  googleDriveOAuth2Api: "google.com",
  googleAnalyticsOAuth2Api: "google.com",
  googleFirebaseCloudFirestoreOAuth2Api: "firebase.google.com",
  googleFirebaseRealtimeDatabaseOAuth2Api: "firebase.google.com",
  googleOAuth2Api: "google.com",
  googlePerspectiveOAuth2Api: "google.com",
  googleSheetsApi: "google.com",
  googleSheetsTriggerOAuth2Api: "google.com",
  googleSlidesOAuth2Api: "google.com",
  googleTasksOAuth2Api: "google.com",
  googleTranslateOAuth2Api: "google.com",
  gristApi: "grist.io",
  haloPSAApi: "halopsa.com",
  harvestOAuth2Api: "getharvest.com",
  helpScoutOAuth2Api: "helpscout.com",
  highLevelApi: "gohighlevel.com",
  highLevelOAuth2Api: "gohighlevel.com",
  hubspotPrivateApp: "hubspot.com",
  humanticAiApi: "humantic.ai",
  hunterApi: "hunter.io",
  hybridAnalysisApi: "hybrid-analysis.com",
  jiraSoftwareCloudApi: "atlassian.com",
  jiraSoftwareServerApi: "atlassian.com",
  jiraSoftwareServerPatApi: "atlassian.com",
  keapOAuth2Api: "keap.com",
  kitemakerApi: "kitemaker.io",
  koBoToolboxApi: "kobotoolbox.org",
  lemlistApi: "lemlist.com",
  lineNotifyOAuth2Api: "notify-bot.line.me",
  linearApi: "linear.app",
  linearOAuth2Api: "linear.app",
  lingvaNexApi: "lingvanex.com",
  linkedInCommunityManagementOAuth2Api: "linkedin.com",
  linkedInOAuth2Api: "linkedin.com",
  loneScaleApi: "lonescale.com",
  magento2Api: "magento.com",
  mailchimpOAuth2Api: "mailchimp.com",
  mailjetEmailApi: "mailjet.com",
  mailjetSmsApi: "mailjet.com",
  mauticOAuth2Api: "mautic.com",
  mediumOAuth2Api: "medium.com",
  microsoftAzureCosmosDbSharedKeyApi: "azure.microsoft.com",
  microsoftAzureMonitorOAuth2Api: "azure.microsoft.com",
  microsoftDynamicsOAuth2Api: "dynamics.microsoft.com",
  microsoftEntraOAuth2Api: "microsoft.com",
  microsoftExcelOAuth2Api: "microsoft.com",
  microsoftGraphSecurityOAuth2Api: "microsoft.com",
  microsoftOAuth2Api: "microsoft.com",
  microsoftOneDriveOAuth2Api: "microsoft.com",
  microsoftOutlookOAuth2Api: "microsoft.com",
  microsoftSharePointOAuth2Api: "microsoft.com",
  microsoftTeamsOAuth2Api: "microsoft.com",
  microsoftToDoOAuth2Api: "microsoft.com",
  mindeeInvoiceApi: "mindee.com",
  mindeeReceiptApi: "mindee.com",
  miroOAuth2Api: "miro.com",
  mondayComOAuth2Api: "monday.com",
  n8nApi: "n8n.io",
  nextCloudApi: "nextcloud.com",
  nextCloudOAuth2Api: "nextcloud.com",
  nocoDb: "nocodb.com",
  nocoDbApiToken: "nocodb.com",
  notionApi: "notion.so",
  notionOAuth2Api: "notion.so",
  oAuth1Api: "oauth.net",
  oAuth2Api: "oauth.net",
  pipedriveOAuth2Api: "pipedrive.com",
  pushbulletOAuth2Api: "pushbullet.com",
  pagerDutyOAuth2Api: "pagerduty.com",
  quickBooksOAuth2Api: "quickbooks.intuit.com",
  raindropOAuth2Api: "raindrop.io",
  rapid7InsightVmApi: "rapid7.com",
  recordedFutureApi: "recordedfuture.com",
  redditOAuth2Api: "reddit.com",
  salesforceJwtApi: "salesforce.com",
  salesforceOAuth2Api: "salesforce.com",
  securityScorecardApi: "securityscorecard.io",
  sentryIoApi: "sentry.io",
  sentryIoOAuth2Api: "sentry.io",
  sentryIoServerApi: "sentry.io",
  serviceNowBasicApi: "servicenow.com",
  serviceNowOAuth2Api: "servicenow.com",
  shopifyAccessTokenApi: "shopify.com",
  shopifyApi: "shopify.com",
  shopifyOAuth2Api: "shopify.com",
  shufflerApi: "shuffler.io",
  signl4Api: "signl4.com",
  slackOAuth2Api: "slack.com",
  solarWindsIpamApi: "solarwinds.com",
  solarWindsObservabilityApi: "solarwinds.com",
  spotifyOAuth2Api: "spotify.com",
  storyblokContentApi: "storyblok.com",
  storyblokManagementApi: "storyblok.com",
  stravaOAuth2Api: "strava.com",
  surveyMonkeyApi: "surveymonkey.com",
  surveyMonkeyOAuth2Api: "surveymonkey.com",
  syncroMspApi: "syncromsp.com",
  taigaApi: "taiga.io",
  tapfiliateApi: "tapfiliate.com",
  todoistOAuth2Api: "todoist.com",
  trelloApi: "trello.com",
  twakeCloudApi: "twake.app",
  twakeServerApi: "twake.app",
  twitterOAuth1Api: "twitter.com",
  twitterOAuth2Api: "twitter.com",
  typeformOAuth2Api: "typeform.com",
  urlScanIoApi: "urlscan.io",
  venafiTlsProtectCloudApi: "venafi.com",
  venafiTlsProtectDatacenterApi: "venafi.com",
  virusTotalApi: "virustotal.com",
  webflowOAuth2Api: "webflow.com",
  wekanApi: "wekan.github.io",
  whatsAppApi: "whatsapp.com",
  whatsAppTriggerApi: "whatsapp.com",
  wooCommerceApi: "woocommerce.com",
  wordpressApi: "wordpress.org",
  wufooApi: "wufoo.com",
  xeroOAuth2Api: "xero.com",
  youTubeOAuth2Api: "youtube.com",
  yourlsApi: "yourls.org",
  zendeskOAuth2Api: "zendesk.com",
  zohoOAuth2Api: "zoho.com",
  zoomApi: "zoom.us",
  zoomOAuth2Api: "zoom.us",
  zscalerZiaApi: "zscaler.com",
  zulipApi: "zulip.com",
  elasticSecurityApi: "elastic.co",
  elasticsearchApi: "elastic.co",
  formIoApi: "form.io",
  gotifyApi: "gotify.net",
  impervaWafApi: "imperva.com",
  malcoreApi: "malcore.io",
  mistApi: "mistsys.com",
  sekoiaApi: "sekoia.io",
  theHiveApi: "thehive-project.org",
  theHiveProjectApi: "thehive-project.org",
  twistOAuth2Api: "twist.com",
  wiseApi: "wise.com",
  zammadBasicAuthApi: "zammad.com",
  zammadTokenAuthApi: "zammad.com",
}

const NO_FAVICON_KEYS = new Set([
  "amqp", "ftp", "imap", "ldap", "kafka", "mqtt", "postgres", "redis", "mySql",
  "mongoDb", "s3", "sftp", "smtp", "httpBasicAuth", "httpBearerAuth", "httpCustomAuth",
  "httpDigestAuth", "httpHeaderAuth", "httpQueryAuth", "httpSslAuth", "jwtAuth",
  "sshPassword", "sshPrivateKey", "gitPassword", "crateDb", "timescaleDb",
  "microsoftSql", "questDb", "snowflake", "aws",
])

export function getDomainFromSchemaKey(schemaKey: string): string | null {
  const override = SCHEMA_TO_DOMAIN[schemaKey]
  if (override) return override
  if (NO_FAVICON_KEYS.has(schemaKey)) return null
  let base = schemaKey
    .replace(/Api$|OAuth2Api$|OAuth2$|OAuth$/i, "")
    .replace(/([a-z])([A-Z])/g, "$1$2")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
  if (!base || base.length < 2) return null
  if (base.length > 20) {
    const first = schemaKey.replace(/Api$|OAuth2Api$|OAuth2$|OAuth$/i, "").match(/^[A-Z]?[a-z]+/)?.[0]?.toLowerCase()
    if (first && first.length >= 2) base = first
  }
  return `${base}.com`
}

export function getFaviconUrl(domain: string, size = 64): string {
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=${size}`
}

export function toTitleFromKey(key: string): string {
  return key
    .replace(/Api$/i, "")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/^\w/, (m) => m.toUpperCase())
}

export function getAppLogoUrl(schemaKey: string): string {
  const domain = getDomainFromSchemaKey(schemaKey)
  if (domain) return getFaviconUrl(domain)
  return FALLBACK_LOGO
}

export function getDisplayNameFromKey(schemaKey: string): string {
  return DISPLAY_NAME_OVERRIDES[schemaKey] || toTitleFromKey(schemaKey)
}

export function AppLogo({ appKey, alt, size = 24 }: { appKey: string; alt?: string; size?: number }) {
  const [faviconError, setFaviconError] = useState(false)
  const primarySrc = getAppLogoUrl(appKey)
  const src = faviconError ? FALLBACK_LOGO : primarySrc
  const aria = alt || getDisplayNameFromKey(appKey)

  return (
    <span
      className="inline-flex shrink-0 items-center justify-center overflow-hidden rounded-md bg-white/90 ring-1 ring-slate-200/80 dark:bg-slate-800/90 dark:ring-slate-700/80"
      style={{ width: size, height: size }}
    >
      {/* External favicon URLs — use native img */}
      <img
        src={src}
        alt={aria}
        width={size}
        height={size}
        onError={() => setFaviconError(true)}
        className="max-h-full max-w-full object-contain"
        loading="lazy"
        decoding="async"
      />
    </span>
  )
}
