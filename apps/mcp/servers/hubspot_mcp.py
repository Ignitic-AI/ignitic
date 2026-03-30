from fastmcp import FastMCP

from servers.middlewares import AuthenticationMiddleware, ExecutionLoggingMiddleware
from servers.tools.crm.hubspot.association_tools import (
    hubspot_associations_archive_batch,
    hubspot_associations_create_batch,
    hubspot_associations_read_batch,
    hubspot_association_labels_list,
)
from servers.tools.crm.hubspot.crm_tools import (
    hubspot_contacts_merge,
    hubspot_crm_archive,
    hubspot_crm_batch_archive,
    hubspot_crm_batch_create,
    hubspot_crm_batch_read,
    hubspot_crm_batch_update,
    hubspot_crm_batch_upsert,
    hubspot_crm_create,
    hubspot_crm_get,
    hubspot_crm_properties_list,
    hubspot_crm_search,
    hubspot_crm_update,
    hubspot_custom_object_schemas,
    hubspot_deal_pipelines,
    hubspot_owners_list,
    hubspot_ticket_pipelines,
)
from servers.tools.crm.hubspot.extended_tools import (
    hubspot_communication_preferences_definitions,
    hubspot_communication_preferences_statuses_get,
    hubspot_companies_merge,
    hubspot_crm_pipelines_list,
    hubspot_file_get,
    hubspot_files_search,
    hubspot_folder_get,
    hubspot_forms_list,
    hubspot_list_get,
    hubspot_list_memberships_add_remove,
    hubspot_list_memberships_join_order,
    hubspot_list_record_memberships,
    hubspot_lists_search,
    hubspot_marketing_emails_list,
)

app = FastMCP("HubSpot MCP", streamable_http_path="/")

_meta = "ignitic_identifier"

app.tool(hubspot_crm_search, meta={_meta: "tools.hubspot_agent.hubspot_crm_search"})
app.tool(hubspot_crm_get, meta={_meta: "tools.hubspot_agent.hubspot_crm_get"})
app.tool(hubspot_crm_create, meta={_meta: "tools.hubspot_agent.hubspot_crm_create"})
app.tool(hubspot_crm_update, meta={_meta: "tools.hubspot_agent.hubspot_crm_update"})
app.tool(hubspot_crm_archive, meta={_meta: "tools.hubspot_agent.hubspot_crm_archive"})
app.tool(
    hubspot_crm_batch_read,
    meta={_meta: "tools.hubspot_agent.hubspot_crm_batch_read"},
)
app.tool(
    hubspot_crm_batch_create,
    meta={_meta: "tools.hubspot_agent.hubspot_crm_batch_create"},
)
app.tool(
    hubspot_crm_batch_update,
    meta={_meta: "tools.hubspot_agent.hubspot_crm_batch_update"},
)
app.tool(
    hubspot_crm_batch_archive,
    meta={_meta: "tools.hubspot_agent.hubspot_crm_batch_archive"},
)
app.tool(
    hubspot_crm_batch_upsert,
    meta={_meta: "tools.hubspot_agent.hubspot_crm_batch_upsert"},
)
app.tool(
    hubspot_contacts_merge,
    meta={_meta: "tools.hubspot_agent.hubspot_contacts_merge"},
)
app.tool(
    hubspot_crm_properties_list,
    meta={_meta: "tools.hubspot_agent.hubspot_crm_properties_list"},
)
app.tool(
    hubspot_deal_pipelines,
    meta={_meta: "tools.hubspot_agent.hubspot_deal_pipelines"},
)
app.tool(
    hubspot_ticket_pipelines,
    meta={_meta: "tools.hubspot_agent.hubspot_ticket_pipelines"},
)
app.tool(
    hubspot_owners_list,
    meta={_meta: "tools.hubspot_agent.hubspot_owners_list"},
)
app.tool(
    hubspot_custom_object_schemas,
    meta={_meta: "tools.hubspot_agent.hubspot_custom_object_schemas"},
)
app.tool(
    hubspot_association_labels_list,
    meta={_meta: "tools.hubspot_agent.hubspot_association_labels_list"},
)
app.tool(
    hubspot_associations_create_batch,
    meta={_meta: "tools.hubspot_agent.hubspot_associations_create_batch"},
)
app.tool(
    hubspot_associations_read_batch,
    meta={_meta: "tools.hubspot_agent.hubspot_associations_read_batch"},
)
app.tool(
    hubspot_associations_archive_batch,
    meta={_meta: "tools.hubspot_agent.hubspot_associations_archive_batch"},
)

app.tool(
    hubspot_companies_merge,
    meta={_meta: "tools.hubspot_agent.hubspot_companies_merge"},
)
app.tool(hubspot_lists_search, meta={_meta: "tools.hubspot_agent.hubspot_lists_search"})
app.tool(hubspot_list_get, meta={_meta: "tools.hubspot_agent.hubspot_list_get"})
app.tool(
    hubspot_list_memberships_join_order,
    meta={_meta: "tools.hubspot_agent.hubspot_list_memberships_join_order"},
)
app.tool(
    hubspot_list_memberships_add_remove,
    meta={_meta: "tools.hubspot_agent.hubspot_list_memberships_add_remove"},
)
app.tool(
    hubspot_list_record_memberships,
    meta={_meta: "tools.hubspot_agent.hubspot_list_record_memberships"},
)
app.tool(hubspot_files_search, meta={_meta: "tools.hubspot_agent.hubspot_files_search"})
app.tool(hubspot_file_get, meta={_meta: "tools.hubspot_agent.hubspot_file_get"})
app.tool(hubspot_folder_get, meta={_meta: "tools.hubspot_agent.hubspot_folder_get"})
app.tool(hubspot_forms_list, meta={_meta: "tools.hubspot_agent.hubspot_forms_list"})
app.tool(
    hubspot_communication_preferences_definitions,
    meta={_meta: "tools.hubspot_agent.hubspot_communication_preferences_definitions"},
)
app.tool(
    hubspot_communication_preferences_statuses_get,
    meta={_meta: "tools.hubspot_agent.hubspot_communication_preferences_statuses_get"},
)
app.tool(
    hubspot_crm_pipelines_list,
    meta={_meta: "tools.hubspot_agent.hubspot_crm_pipelines_list"},
)
app.tool(
    hubspot_marketing_emails_list,
    meta={_meta: "tools.hubspot_agent.hubspot_marketing_emails_list"},
)

app.add_middleware(AuthenticationMiddleware())
app.add_middleware(ExecutionLoggingMiddleware())
