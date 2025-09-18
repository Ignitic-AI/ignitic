export type AppLogoEntry = {
  file?: string
  displayName?: string
}

// Map schema keys (or common aliases) to local logos in public/logos
export const APP_LOGOS: Record<string, AppLogoEntry> = {
  // E-commerce platforms
  shopifyApi: { file: "/logos/shopify.svg", displayName: "Shopify" },
  shopify: { file: "/logos/shopify.svg", displayName: "Shopify" },
  wixApi: { file: "/logos/wix-logo-1.svg", displayName: "Wix" },
  wix: { file: "/logos/wix-logo-1.svg", displayName: "Wix" },
  
  // Google services
  googleApi: { file: "/logos/google-icon.svg", displayName: "Google" },
  google: { file: "/logos/google-icon.svg", displayName: "Google" },
  googleSheetsApi: { file: "/logos/google-spreadsheets.svg", displayName: "Google Sheets" },
  sheets: { file: "/logos/google-spreadsheets.svg", displayName: "Sheets" },
  
  // CRM & Marketing
  agileCrmApi: { file: "/logos/agile-crm.webp", displayName: "Agile CRM" },
  agileCrm: { file: "/logos/agile-crm.webp", displayName: "Agile CRM" },
  activeCampaignApi: { file: "/logos/ActiveCampaign-review.webp", displayName: "ActiveCampaign" },
  activeCampaign: { file: "/logos/ActiveCampaign-review.webp", displayName: "ActiveCampaign" },
  
  // Database & Collaboration
  airtableApi: { file: "/logos/Airtable-Logo.png", displayName: "Airtable" },
  airtable: { file: "/logos/Airtable-Logo.png", displayName: "Airtable" },
  
  // App Development
  adaloApi: { file: "/logos/adalo_logo.png", displayName: "Adalo" },
  adalo: { file: "/logos/adalo_logo.png", displayName: "Adalo" },
  
  // Scheduling & Events
  acuitySchedulingApi: { file: "/logos/acuity-scheduling.png", displayName: "Acuity Scheduling" },
  acuityScheduling: { file: "/logos/acuity-scheduling.png", displayName: "Acuity Scheduling" },
  activeNetworkApi: { file: "/logos/Activenetwork_logo_page.png", displayName: "Active Network" },
  activeNetwork: { file: "/logos/Activenetwork_logo_page.png", displayName: "Active Network" },
  
  // Cloud Storage
  dropboxApi: { file: "/logos/dropbox-svgrepo-com.svg", displayName: "Dropbox" },
  dropbox: { file: "/logos/dropbox-svgrepo-com.svg", displayName: "Dropbox" },
  
  // Messaging & Streaming
  kafkaApi: { file: "/logos/kafka-svgrepo-com.svg", displayName: "Apache Kafka" },
  kafka: { file: "/logos/kafka-svgrepo-com.svg", displayName: "Apache Kafka" },
  
  // Cloud Services
  aws: { file: "/white-logo.png", displayName: "AWS" },
  s3: { file: "/logos/s3.png", displayName: "Amazon S3" },
  netlify: { file: "/logos/netlify.svg", displayName: "Netlify" },
  supabase: { file: "/logos/supabase.svg", displayName: "Supabase" },
  
  // Authentication & Security
  okta: { file: "/logos/Okta.dark.svg", displayName: "Okta" },
  ldap: { file: "/logos/ldap.svg", displayName: "LDAP" },
  securityScorecard: { file: "/logos/securityScorecard.svg", displayName: "SecurityScorecard" },
  
  // Communication & Messaging
  slack: { file: "/logos/slack.svg", displayName: "Slack" },
  mattermost: { file: "/logos/mattermost.svg", displayName: "Mattermost" },
  rocketchat: { file: "/logos/rocketchat.svg", displayName: "Rocket.Chat" },
  matrix: { file: "/logos/matrix.png", displayName: "Matrix" },
  messagebird: { file: "/logos/messagebird.svg", displayName: "MessageBird" },
  msg91: { file: "/logos/msg91.svg", displayName: "MSG91" },
  plivo: { file: "/logos/plivo.svg", displayName: "Plivo" },
  mocean: { file: "/logos/mocean.svg", displayName: "Mocean" },
  pushbullet: { file: "/logos/pushbullet.svg", displayName: "Pushbullet" },
  signl4: { file: "/logos/signl4.png", displayName: "SIGNL4" },
  
  // Email Marketing
  mailchimp: { file: "/logos/mailchimp.svg", displayName: "Mailchimp" },
  mailerLite: { file: "/logos/MailerLite.svg", displayName: "MailerLite" },
  mailgun: { file: "/logos/mailgun.svg", displayName: "Mailgun" },
  mailjet: { file: "/logos/mailjet.svg", displayName: "Mailjet" },
  mandrill: { file: "/logos/mandrill.svg", displayName: "Mandrill" },
  sendGrid: { file: "/logos/sendGrid.svg", displayName: "SendGrid" },
  postmark: { file: "/logos/postmark.png", displayName: "Postmark" },
  sendy: { file: "/logos/sendy.png", displayName: "Sendy" },
  mailcheck: { file: "/logos/mailcheck.svg", displayName: "Mailcheck" },
  
  // CRM & Sales
  salesforce: { file: "/logos/salesforce.svg", displayName: "Salesforce" },
  pipedrive: { file: "/logos/pipedrive.svg", displayName: "Pipedrive" },
  salesmate: { file: "/logos/salesmate.png", displayName: "Salesmate" },
  monicaCrm: { file: "/logos/monicaCrm.png", displayName: "Monica CRM" },
  mautic: { file: "/logos/mautic.svg", displayName: "Mautic" },
  lemlist: { file: "/logos/lemlist.svg", displayName: "Lemlist" },
  
  // Project Management
  mondayCom: { file: "/logos/mondayCom.svg", displayName: "Monday.com" },
  linear: { file: "/logos/linear.svg", displayName: "Linear" },
  stackby: { file: "/logos/stackby.png", displayName: "Stackby" },
  quickbase: { file: "/logos/quickbase.png", displayName: "Quickbase" },
  
  // Databases
  mongodb: { file: "/logos/mongodb.svg", displayName: "MongoDB" },
  mysql: { file: "/logos/mysql.svg", displayName: "MySQL" },
  postgres: { file: "/logos/postgres.svg", displayName: "PostgreSQL" },
  redis: { file: "/logos/redis.svg", displayName: "Redis" },
  questdb: { file: "/logos/questdb.png", displayName: "QuestDB" },
  snowflake: { file: "/logos/snowflake.svg", displayName: "Snowflake" },
  
  // Analytics & Monitoring
  metabase: { file: "/logos/metabase.svg", displayName: "Metabase" },
  postHog: { file: "/logos/postHog.svg", displayName: "PostHog" },
  sentryio: { file: "/logos/sentryio.svg", displayName: "Sentry" },
  segment: { file: "/logos/segment.svg", displayName: "Segment" },
  splunk: { file: "/logos/splunk.svg", displayName: "Splunk" },
  profitwell: { file: "/logos/profitwell.svg", displayName: "ProfitWell" },
  
  // AI & Machine Learning
  openAi: { file: "/logos/openAi.svg", displayName: "OpenAI" },
  mistralAi: { file: "/logos/mistralAi.svg", displayName: "Mistral AI" },
  perplexity: { file: "/logos/perplexity.svg", displayName: "Perplexity" },
  mindee: { file: "/logos/mindee.svg", displayName: "Mindee" },
  
  // Payment & Finance
  stripe: { file: "/logos/stripe.svg", displayName: "Stripe" },
  paypal: { file: "/logos/paypal.svg", displayName: "PayPal" },
  paddle: { file: "/logos/paddle.png", displayName: "Paddle" },
  quickbooks: { file: "/logos/quickbooks.svg", displayName: "QuickBooks" },
  
  // E-commerce
  magento: { file: "/logos/magento.svg", displayName: "Magento" },
  
  // Social Media
  linkedin: { file: "/logos/linkedin.svg", displayName: "LinkedIn" },
  reddit: { file: "/logos/reddit.svg", displayName: "Reddit" },
  medium: { file: "/logos/medium.png", displayName: "Medium" },
  strava: { file: "/logos/strava.svg", displayName: "Strava" },
  spotify: { file: "/logos/spotify.svg", displayName: "Spotify" },
  
  // Development Tools
  n8n: { file: "/logos/n8n.svg", displayName: "n8n" },
  n8nTrigger: { file: "/logos/n8nTrigger.svg", displayName: "n8n Trigger" },
  npm: { file: "/logos/npm.svg", displayName: "npm" },
  strapi: { file: "/logos/strapi.svg", displayName: "Strapi" },
  storyblok: { file: "/logos/storyblok.svg", displayName: "Storyblok" },
  nocodb: { file: "/logos/nocodb.svg", displayName: "NocoDB" },
  nextcloud: { file: "/logos/nextcloud.svg", displayName: "Nextcloud" },
  
  // Messaging & Streaming
  rabbitmq: { file: "/logos/rabbitmq.svg", displayName: "RabbitMQ" },
  mqtt: { file: "/logos/mqtt.svg", displayName: "MQTT" },
  
  // APIs & Services
  onesimpleapi: { file: "/logos/onesimpleapi.svg", displayName: "OneSimpleAPI" },
  merge: { file: "/logos/merge.svg", displayName: "Merge" },
  postbin: { file: "/logos/postbin.svg", displayName: "Postbin" },
  peekalink: { file: "/logos/peekalink.png", displayName: "Peekalink" },
  phantombuster: { file: "/logos/phantombuster.png", displayName: "PhantomBuster" },
  
  // Weather & Data
  openWeatherMap: { file: "/logos/openWeatherMap.svg", displayName: "OpenWeatherMap" },
  marketstack: { file: "/logos/marketstack.svg", displayName: "Marketstack" },
  nasa: { file: "/logos/nasa.png", displayName: "NASA" },
  
  // IoT & Hardware
  philipshue: { file: "/logos/philipshue.png", displayName: "Philips Hue" },
  oura: { file: "/logos/oura.svg", displayName: "Oura" },
  
  // Business Tools
  odoo: { file: "/logos/odoo.svg", displayName: "Odoo" },
  servicenow: { file: "/logos/servicenow.svg", displayName: "ServiceNow" },
  pagerDuty: { file: "/logos/pagerDuty.svg", displayName: "PagerDuty" },
  rundeck: { file: "/logos/rundeck.png", displayName: "Rundeck" },
  onfleet: { file: "/logos/Onfleet.svg", displayName: "Onfleet" },
  syncromsp: { file: "/logos/syncromsp.png", displayName: "SyncroMSP" },
  
  // Content & Documentation
  markdown: { file: "/logos/markdown.svg", displayName: "Markdown" },
  orbit: { file: "/logos/orbit.svg", displayName: "Orbit" },
  raindrop: { file: "/logos/raindrop.svg", displayName: "Raindrop" },
  spontit: { file: "/logos/spontit.png", displayName: "Spontit" },
  
  // Translation & Language
  lingvanex: { file: "/logos/lingvanex.png", displayName: "Lingvanex" },
  openthesaurus: { file: "/logos/openthesaurus.png", displayName: "OpenThesaurus" },
  
  // Charts & Visualization
  quickChart: { file: "/logos/quickChart.svg", displayName: "QuickChart" },
  
  // Other Services
  line: { file: "/logos/line.png", displayName: "LINE" },
  loneScale: { file: "/logos/loneScale.svg", displayName: "LoneScale" },
  misp: { file: "/logos/misp.svg", displayName: "MISP" },
  netscaler: { file: "/logos/netscaler.svg", displayName: "NetScaler" },
  seven: { file: "/logos/seven.svg", displayName: "Seven" },
  seaTable: { file: "/logos/seaTable.svg", displayName: "SeaTable" },
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


