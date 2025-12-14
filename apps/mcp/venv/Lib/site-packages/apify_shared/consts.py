from __future__ import annotations

from enum import Enum
from typing import Literal, get_args


class ActorJobStatus(str, Enum):
    """Available statuses for Actor jobs (runs or builds).

    These statuses represent the lifecycle of an Actor execution,
    from initialization to completion or termination.
    """

    READY = 'READY'
    """Actor job has been initialized but not yet started."""

    RUNNING = 'RUNNING'
    """Actor job is currently executing."""

    SUCCEEDED = 'SUCCEEDED'
    """Actor job completed successfully without errors."""

    FAILED = 'FAILED'
    """Actor job or build failed due to an error or exception."""

    TIMING_OUT = 'TIMING-OUT'
    """Actor job is currently in the process of timing out."""

    TIMED_OUT = 'TIMED-OUT'
    """Actor job was terminated due to timeout."""

    ABORTING = 'ABORTING'
    """Actor job is currently being aborted by user request."""

    ABORTED = 'ABORTED'
    """Actor job was successfully aborted by user request."""

    @property
    def is_terminal(self: ActorJobStatus) -> bool:
        """Whether this Actor job status is terminal."""
        return self in (
            ActorJobStatus.SUCCEEDED,
            ActorJobStatus.FAILED,
            ActorJobStatus.TIMED_OUT,
            ActorJobStatus.ABORTED,
        )


class ActorSourceType(str, Enum):
    """Available source code types for Actors.

    Defines how Actor source code is stored and accessed
    for building and executing Actors on the platform.
    """

    SOURCE_FILES = 'SOURCE_FILES'
    """Actor source code consists of multiple individual files uploaded directly."""

    GIT_REPO = 'GIT_REPO'
    """Actor source code is cloned from a Git repository (GitHub, GitLab, etc.)."""

    TARBALL = 'TARBALL'
    """Actor source code is downloaded from a tarball or ZIP archive."""

    GITHUB_GIST = 'GITHUB_GIST'
    """Actor source code is retrieved from a GitHub Gist."""


class ActorEventTypes(str, Enum):
    """Event types that can be sent to Actors during execution.

    These events provide real-time information about system state
    and lifecycle changes that Actors can respond to.
    """

    SYSTEM_INFO = 'systemInfo'
    """Information about resource usage and system metrics of the Actor."""

    MIGRATING = 'migrating'
    """Notification that the Actor is about to be migrated to another server."""

    PERSIST_STATE = 'persistState'
    """Signal to persist Actor state - sent every minute or before migration."""

    ABORTING = 'aborting'
    """Notification that the Actor is being terminated and should clean up."""


class ActorEnvVars(str, Enum):
    """Environment variables with ACTOR_ prefix set by the Apify platform.

    These variables provide essential context about the current Actor run,
    including identifiers, resource limits, and configuration details.
    All variables are automatically set by the platform during Actor execution.
    """

    BUILD_ID = 'ACTOR_BUILD_ID'
    """Unique identifier of the Actor build used for this run."""

    BUILD_NUMBER = 'ACTOR_BUILD_NUMBER'
    """Sequential build number of the Actor build used for this run."""

    BUILD_TAGS = 'ACTOR_BUILD_TAGS'
    """Comma-separated list of tags associated with the Actor build."""

    DEFAULT_DATASET_ID = 'ACTOR_DEFAULT_DATASET_ID'
    """Unique identifier of the default dataset for storing Actor results."""

    DEFAULT_KEY_VALUE_STORE_ID = 'ACTOR_DEFAULT_KEY_VALUE_STORE_ID'
    """Unique identifier of the default key-value store for Actor data."""

    DEFAULT_REQUEST_QUEUE_ID = 'ACTOR_DEFAULT_REQUEST_QUEUE_ID'
    """Unique identifier of the default request queue for Actor URLs."""

    EVENTS_WEBSOCKET_URL = 'ACTOR_EVENTS_WEBSOCKET_URL'
    """WebSocket URL for receiving real-time events from the platform."""

    FULL_NAME = 'ACTOR_FULL_NAME'
    """Full Actor name in format 'username/actor-name' for identification."""

    ID = 'ACTOR_ID'
    """Unique identifier of the Actor definition."""

    INPUT_KEY = 'ACTOR_INPUT_KEY'
    """Key in the default key-value store where Actor input is stored (usually 'INPUT')."""

    MAX_PAID_DATASET_ITEMS = 'ACTOR_MAX_PAID_DATASET_ITEMS'
    """Maximum number of dataset items that will be charged for pay-per-result Actors."""

    MAX_TOTAL_CHARGE_USD = 'ACTOR_MAX_TOTAL_CHARGE_USD'
    """Maximum total charge limit in USD for pay-per-event Actors."""

    MEMORY_MBYTES = 'ACTOR_MEMORY_MBYTES'
    """Amount of memory allocated to the Actor run in megabytes."""

    RUN_ID = 'ACTOR_RUN_ID'
    """Unique identifier of this specific Actor run execution."""

    STANDBY_PORT = 'ACTOR_STANDBY_PORT'
    """TCP port number for Actor standby mode HTTP server."""

    STANDBY_URL = 'ACTOR_STANDBY_URL'
    """Public URL for accessing the Actor in standby mode."""

    STARTED_AT = 'ACTOR_STARTED_AT'
    """ISO 8601 timestamp when the Actor run was started (UTC timezone)."""

    TASK_ID = 'ACTOR_TASK_ID'
    """Unique identifier of the Actor task (empty if run directly via API)."""

    TIMEOUT_AT = 'ACTOR_TIMEOUT_AT'
    """ISO 8601 timestamp when the Actor run will timeout (UTC timezone)."""

    WEB_SERVER_PORT = 'ACTOR_WEB_SERVER_PORT'
    """TCP port number for the Actor's built-in HTTP web server."""

    WEB_SERVER_URL = 'ACTOR_WEB_SERVER_URL'
    """Public URL for accessing the Actor's built-in HTTP web server."""


class ApifyEnvVars(str, Enum):
    """Environment variables with APIFY_ prefix set by the Apify platform.

    These variables provide configuration, authentication, and platform-specific
    settings for Actors running on the Apify platform. They control behavior
    like logging, proxy settings, browser configuration, and platform integration.
    """

    API_BASE_URL = 'APIFY_API_BASE_URL'
    """Base URL of the Apify API (typically 'https://api.apify.com')."""

    API_PUBLIC_BASE_URL = 'APIFY_API_PUBLIC_BASE_URL'
    """Public URL of the Apify API accessible from external networks."""

    DEDICATED_CPUS = 'APIFY_DEDICATED_CPUS'
    """Number of dedicated CPU cores allocated to the Actor based on memory allocation."""

    DEFAULT_BROWSER_PATH = 'APIFY_DEFAULT_BROWSER_PATH'
    """File system path to the default browser executable for web scraping."""

    DISABLE_BROWSER_SANDBOX = 'APIFY_DISABLE_BROWSER_SANDBOX'
    """Set to '1' to disable browser sandbox mode for compatibility with containerized environments."""

    DISABLE_OUTDATED_WARNING = 'APIFY_DISABLE_OUTDATED_WARNING'
    """Set to '1' to suppress warnings about outdated SDK versions."""

    FACT = 'APIFY_FACT'
    """Fun fact about the Apify platform displayed during Actor startup."""

    HEADLESS = 'APIFY_HEADLESS'
    """Set to '1' to run browsers in headless mode without graphical interface."""

    INPUT_SECRETS_PRIVATE_KEY_FILE = 'APIFY_INPUT_SECRETS_PRIVATE_KEY_FILE'
    """Path to the private key file used for decrypting secret input values."""

    INPUT_SECRETS_PRIVATE_KEY_PASSPHRASE = 'APIFY_INPUT_SECRETS_PRIVATE_KEY_PASSPHRASE'
    """Passphrase for unlocking the private key file used for secret decryption."""

    IS_AT_HOME = 'APIFY_IS_AT_HOME'
    """Set to '1' when the Actor is running on official Apify platform infrastructure."""

    LOCAL_STORAGE_DIR = 'APIFY_LOCAL_STORAGE_DIR'
    """Local file system directory path where Actor data and storage is persisted."""

    LOG_FORMAT = 'APIFY_LOG_FORMAT'
    """Logging output format: 'pretty' for human-readable, 'json' for structured logs."""

    LOG_LEVEL = 'APIFY_LOG_LEVEL'
    """Minimum logging level: 'DEBUG', 'INFO', 'WARNING', 'ERROR' in ascending order."""

    MAX_USED_CPU_RATIO = 'APIFY_MAX_USED_CPU_RATIO'
    """Maximum CPU utilization ratio (0.0-1.0) that the Actor should not exceed."""

    META_ORIGIN = 'APIFY_META_ORIGIN'
    """How the Actor run was initiated: 'WEB', 'API', 'SCHEDULER', 'TEST', etc."""

    METAMORPH_AFTER_SLEEP_MILLIS = 'APIFY_METAMORPH_AFTER_SLEEP_MILLIS'
    """Milliseconds to wait before Actor metamorphosis (transformation) occurs."""

    PERSIST_STATE_INTERVAL_MILLIS = 'APIFY_PERSIST_STATE_INTERVAL_MILLIS'
    """Interval in milliseconds for automatic state persistence (default: 60000ms)."""

    PERSIST_STORAGE = 'APIFY_PERSIST_STORAGE'
    """Set to '1' to persist Actor storage data after run completion."""

    PROXY_HOSTNAME = 'APIFY_PROXY_HOSTNAME'
    """Hostname for Apify Proxy service (typically 'proxy.apify.com')."""

    PROXY_PASSWORD = 'APIFY_PROXY_PASSWORD'
    """Authentication password for accessing Apify Proxy services."""

    PROXY_PORT = 'APIFY_PROXY_PORT'
    """TCP port number for connecting to Apify Proxy (typically 8000)."""

    PROXY_STATUS_URL = 'APIFY_PROXY_STATUS_URL'
    """URL endpoint for retrieving Apify Proxy status and connection information."""

    PURGE_ON_START = 'APIFY_PURGE_ON_START'
    """Set to '1' to clear all local storage before Actor execution begins."""

    SDK_LATEST_VERSION = 'APIFY_SDK_LATEST_VERSION'
    """Latest available version of the Apify SDK for update notifications."""

    SYSTEM_INFO_INTERVAL_MILLIS = 'APIFY_SYSTEM_INFO_INTERVAL_MILLIS'
    """Interval in milliseconds for sending system resource usage information."""

    TOKEN = 'APIFY_TOKEN'
    """API authentication token of the user who initiated the Actor run."""

    USER_ID = 'APIFY_USER_ID'
    """Unique identifier of the user who started the Actor (may differ from Actor owner)."""

    USER_IS_PAYING = 'APIFY_USER_IS_PAYING'
    """Set to '1' if the user who started the Actor has an active paid subscription."""

    WORKFLOW_KEY = 'APIFY_WORKFLOW_KEY'
    """Unique identifier for grouping related Actor runs and API operations together."""


class ActorExitCodes(int, Enum):
    """Standard exit codes used by Actors to indicate run completion status.

    These codes follow Unix conventions where 0 indicates success
    and non-zero values indicate various types of failures.
    """

    SUCCESS = 0
    """Actor completed successfully without any errors."""

    ERROR_USER_FUNCTION_THREW = 91
    """Actor failed because the main function threw an unhandled exception."""


class WebhookEventType(str, Enum):
    """Event types that can trigger webhook notifications.

    These events are sent to configured webhook URLs when specific
    Actor run or build lifecycle events occur, enabling integration
    with external systems and automated workflows.
    """

    ACTOR_RUN_CREATED = 'ACTOR.RUN.CREATED'
    """Triggered when a new Actor run is created and initialized."""

    ACTOR_RUN_SUCCEEDED = 'ACTOR.RUN.SUCCEEDED'
    """Triggered when an Actor run completes successfully."""

    ACTOR_RUN_FAILED = 'ACTOR.RUN.FAILED'
    """Triggered when an Actor run fails due to an error."""

    ACTOR_RUN_TIMED_OUT = 'ACTOR.RUN.TIMED_OUT'
    """Triggered when an Actor run is terminated due to timeout."""

    ACTOR_RUN_ABORTED = 'ACTOR.RUN.ABORTED'
    """Triggered when an Actor run is manually aborted by user."""

    ACTOR_RUN_RESURRECTED = 'ACTOR.RUN.RESURRECTED'
    """Triggered when a previously failed Actor run is automatically resurrected."""

    ACTOR_BUILD_CREATED = 'ACTOR.BUILD.CREATED'
    """Triggered when a new Actor build process is initiated."""

    ACTOR_BUILD_SUCCEEDED = 'ACTOR.BUILD.SUCCEEDED'
    """Triggered when an Actor build completes successfully."""

    ACTOR_BUILD_FAILED = 'ACTOR.BUILD.FAILED'
    """Triggered when an Actor build fails due to compilation or setup errors."""

    ACTOR_BUILD_TIMED_OUT = 'ACTOR.BUILD.TIMED_OUT'
    """Triggered when an Actor build process exceeds the time limit."""

    ACTOR_BUILD_ABORTED = 'ACTOR.BUILD.ABORTED'
    """Triggered when an Actor build is manually cancelled by user."""


class MetaOrigin(str, Enum):
    """Origins indicating how Actor runs were initiated.

    This information helps track and analyze how Actors are being used
    across different interfaces and automation systems on the platform.
    """

    DEVELOPMENT = 'DEVELOPMENT'
    """Actor run started from the Developer Console source code section."""

    WEB = 'WEB'
    """Actor run initiated through the Apify Console web interface."""

    API = 'API'
    """Actor run started programmatically via the Apify API."""

    SCHEDULER = 'SCHEDULER'
    """Actor run triggered automatically by a scheduled task."""

    TEST = 'TEST'
    """Actor run initiated from the test/try functionality in Console."""

    WEBHOOK = 'WEBHOOK'
    """Actor run triggered by an incoming webhook request."""

    ACTOR = 'ACTOR'
    """Actor run started by another Actor during its execution."""

    STANDBY = 'STANDBY'
    """Actor run initiated through the Actor Standby mode."""

    CLI = 'CLI'
    """Actor run started using the Apify command-line interface."""


class StorageGeneralAccess(str, Enum):
    """Access levels for Apify storage resources (key-value stores, datasets, request queues).

    These access levels control who can interact with storage resources and how,
    providing fine-grained security for shared data and collaboration scenarios.
    """

    RESTRICTED = 'RESTRICTED'
    """Access limited to the resource owner and explicitly granted users or organizations."""

    PUBLIC_READ = 'PUBLIC_READ'
    """Resource data can be read by anyone, but only the owner can modify it."""

    PUBLIC_WRITE = 'PUBLIC_WRITE'
    """Full public access - anyone can read, write, and modify the resource."""


class RunGeneralAccess(str, Enum):
    """Access levels for Actor runs and their associated data.

    These settings control who can view Actor run details, including logs,
    outputs, and metadata, enabling secure sharing of execution results.
    """

    RESTRICTED = 'RESTRICTED'
    """Access limited to the Actor owner and explicitly authorized users."""

    PUBLIC_READ = 'PUBLIC_READ'
    """Run details and outputs are publicly visible but cannot be modified by others."""


class ActorPermissionLevel(str, Enum):
    """Determines permissions that the Actor is granted when running.

    Based on this value, the Apify platform generates a scoped run token with a corresponding permission scope and
    injects it into the Actor runtime.

    Warning: Make sure you know what you are doing when changing this value!
    """

    FULL_PERMISSIONS = 'FULL_PERMISSIONS'
    """Full permission Actors have access to all user data in the account."""

    LIMITED_PERMISSIONS = 'LIMITED_PERMISSIONS'
    """Limited permission Actors have access only to specific resources:
        - default storages
        - storages provided via input
        - the current run
        - ...

    Broadly speaking, limited permission Actors cannot access any account data not related to the current run.
    For details refer to the Apify documentation.
    """


INTEGER_ENV_VARS_TYPE = Literal[
    # Actor env vars
    ActorEnvVars.MAX_PAID_DATASET_ITEMS,
    ActorEnvVars.MEMORY_MBYTES,
    ActorEnvVars.STANDBY_PORT,
    ActorEnvVars.WEB_SERVER_PORT,
    # Apify env vars
    ApifyEnvVars.DEDICATED_CPUS,
    ApifyEnvVars.LOG_LEVEL,
    ApifyEnvVars.METAMORPH_AFTER_SLEEP_MILLIS,
    ApifyEnvVars.PERSIST_STATE_INTERVAL_MILLIS,
    ApifyEnvVars.PROXY_PORT,
    ApifyEnvVars.SYSTEM_INFO_INTERVAL_MILLIS,
]

INTEGER_ENV_VARS: list[INTEGER_ENV_VARS_TYPE] = list(get_args(INTEGER_ENV_VARS_TYPE))

FLOAT_ENV_VARS_TYPE = Literal[
    # Actor env vars
    ActorEnvVars.MAX_TOTAL_CHARGE_USD,
    # Apify env vars
    ApifyEnvVars.MAX_USED_CPU_RATIO,
]

FLOAT_ENV_VARS: list[FLOAT_ENV_VARS_TYPE] = list(get_args(FLOAT_ENV_VARS_TYPE))

BOOL_ENV_VARS_TYPE = Literal[
    ApifyEnvVars.DISABLE_BROWSER_SANDBOX,
    ApifyEnvVars.DISABLE_OUTDATED_WARNING,
    ApifyEnvVars.HEADLESS,
    ApifyEnvVars.IS_AT_HOME,
    ApifyEnvVars.PERSIST_STORAGE,
    ApifyEnvVars.PURGE_ON_START,
    ApifyEnvVars.USER_IS_PAYING,
]

BOOL_ENV_VARS: list[BOOL_ENV_VARS_TYPE] = list(get_args(BOOL_ENV_VARS_TYPE))

DATETIME_ENV_VARS_TYPE = Literal[
    ActorEnvVars.STARTED_AT,
    ActorEnvVars.TIMEOUT_AT,
]

DATETIME_ENV_VARS: list[DATETIME_ENV_VARS_TYPE] = list(get_args(DATETIME_ENV_VARS_TYPE))

STRING_ENV_VARS_TYPE = Literal[
    # Actor env vars
    ActorEnvVars.BUILD_ID,
    ActorEnvVars.BUILD_NUMBER,
    ActorEnvVars.DEFAULT_DATASET_ID,
    ActorEnvVars.DEFAULT_KEY_VALUE_STORE_ID,
    ActorEnvVars.DEFAULT_REQUEST_QUEUE_ID,
    ActorEnvVars.EVENTS_WEBSOCKET_URL,
    ActorEnvVars.FULL_NAME,
    ActorEnvVars.ID,
    ActorEnvVars.INPUT_KEY,
    ActorEnvVars.RUN_ID,
    ActorEnvVars.STANDBY_URL,
    ActorEnvVars.TASK_ID,
    ActorEnvVars.WEB_SERVER_URL,
    # Apify env vars
    ApifyEnvVars.API_BASE_URL,
    ApifyEnvVars.API_PUBLIC_BASE_URL,
    ApifyEnvVars.DEFAULT_BROWSER_PATH,
    ApifyEnvVars.FACT,
    ApifyEnvVars.INPUT_SECRETS_PRIVATE_KEY_FILE,
    ApifyEnvVars.INPUT_SECRETS_PRIVATE_KEY_PASSPHRASE,
    ApifyEnvVars.LOCAL_STORAGE_DIR,
    ApifyEnvVars.LOG_FORMAT,
    ApifyEnvVars.META_ORIGIN,
    ApifyEnvVars.PROXY_HOSTNAME,
    ApifyEnvVars.PROXY_PASSWORD,
    ApifyEnvVars.PROXY_STATUS_URL,
    ApifyEnvVars.SDK_LATEST_VERSION,
    ApifyEnvVars.TOKEN,
    ApifyEnvVars.USER_ID,
    ApifyEnvVars.WORKFLOW_KEY,
]

STRING_ENV_VARS: list[STRING_ENV_VARS_TYPE] = list(get_args(STRING_ENV_VARS_TYPE))

COMMA_SEPARATED_LIST_ENV_VARS_TYPE = Literal[ActorEnvVars.BUILD_TAGS,]

COMMA_SEPARATED_LIST_ENV_VARS: list[COMMA_SEPARATED_LIST_ENV_VARS_TYPE] = list(
    get_args(COMMA_SEPARATED_LIST_ENV_VARS_TYPE)
)
