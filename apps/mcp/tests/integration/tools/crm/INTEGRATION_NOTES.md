# HubSpot CRM Integration Tests

## Overview
Live HubSpot integration tests in this folder validate tool functionality against real HubSpot API endpoints. Tests are gated by `RUN_LIVE_INTEGRATION=1` and require valid OAuth credentials in `JWT_BEARER`.

## Known Limitations & Scope Requirements

### 1. Tools Requiring Additional Scopes (403 MISSING_SCOPES)
These tools will fail if your HubSpot OAuth app token lacks the required scopes:

#### Files API (requires `files`, `files.ui_hidden.read` scopes)
- `hubspot_files_search`
- `hubspot_file_get`
- `hubspot_folder_get`

**Fix**: Add file-related scopes to your HubSpot app's OAuth scopes and re-authorize.

#### Forms API (requires `forms-access`, `form-submissions`, or `forms-read` scope)
- `hubspot_forms_list`

**Fix**: Add forms scope to your HubSpot app's OAuth scopes and re-authorize.

#### Content/Marketing Email API (requires `content` scope)
- `hubspot_marketing_emails_list`

**Fix**: Add content scope to your HubSpot app's OAuth scopes and re-authorize.

#### Communication Preferences (requires `communication-preferences:read` scope)
- `hubspot_communication_preferences_statuses_get`

**Fix**: Add communication preferences scope to your HubSpot app's OAuth scopes and re-authorize.

### 2. Tools Requiring Valid Real Data (404 OBJECT_NOT_FOUND)
These tools perform operations on specific CRM objects and require valid object IDs from your HubSpot account:

- `hubspot_crm_get`: Replace `object_id: "123"` with actual contact/company/deal ID
- `hubspot_crm_update`: Replace `object_id: "123"` with actual object ID
- `hubspot_crm_batch_upsert`: Replace `id: "integration@example.com"` with valid email or object ID
- `hubspot_contacts_merge`: Replace `primary_object_id` and `object_id_to_merge` with real contact IDs
- `hubspot_companies_merge`: Replace IDs with real company IDs
- `hubspot_associations_archive_batch`: Replace IDs in `inputs` array with real association pairs
- `hubspot_list_get`: Replace `list_id: "123"` with real list ID from your account
- `hubspot_list_memberships_join_order`: Replace `list_id: "123"` with real list ID

**Fix**: Update `tests/integration/live_payloads/crm_tool_payloads.json` with real object IDs from your HubSpot account.

### 3. Tools with Read-Only Safe Payloads
These tools use generic/search payloads that don't require specific object IDs and should pass consistently:

- `hubspot_crm_search`: Generic search (should work)
- `hubspot_crm_create`: Creates new contact with email (should work)
- `hubspot_crm_archive`: Can use placeholder ID (may fail if ID doesn't exist, but that's API validation)
- `hubspot_crm_batch_create`: Creates new batch (should work)
- `hubspot_crm_batch_update`: Uses placeholder (will fail if ID doesn't exist)
- `hubspot_crm_batch_archive`: Uses placeholder (will fail if IDs don't exist)
- `hubspot_crm_properties_list`: Generic list (should work)
- `hubspot_deal_pipelines`: Generic list (should work)
- `hubspot_ticket_pipelines`: Generic list (should work)
- `hubspot_owners_list`: Generic list (should work)
- `hubspot_custom_object_schemas`: Generic list (should work)
- `hubspot_association_labels_list`: Generic list (should work)
- `hubspot_associations_create_batch`: Creates new associations (may fail depending on object validity)
- `hubspot_associations_read_batch`: Uses placeholder ID in read (will fail if ID doesn't exist)
- `hubspot_lists_search`: Generic search (should work)
- `hubspot_list_record_memberships`: Uses placeholder (will fail if IDs don't exist)

## How to Fix Test Failures

### Step 1: Identify the Failure Category
Check the error message in test output:
- **403 MISSING_SCOPES**: Scope issue (see section 1 above)
- **404 OBJECT_NOT_FOUND**: Missing real data (see section 2 above)
- **400 Bad Request**: Validation error in payload structure (rare; report as bug)

### Step 2: For Scope Issues
1. Go to your HubSpot app settings
2. Add the missing scopes to your app's OAuth configuration
3. Re-authorize the app to get a new token with updated scopes
4. Update `JWT_BEARER` in `.env` with the new token
5. Re-run the tests

### Step 3: For Missing Data Issues
1. Open your HubSpot account and retrieve real object IDs:
   - Contact ID: Get from Contacts page
   - Company ID: Get from Companies page
   - List ID: Get from Lists/Audiences page
   - File ID: Get from Files manager
   - etc.

2. Update `tests/integration/live_payloads/crm_tool_payloads.json` with your real IDs:
   ```json
   "tools.hubspot_agent.hubspot_crm_get": {
       "object_type": "contacts",
       "object_id": "YOUR_REAL_CONTACT_ID"
   }
   ```

3. Re-run the tests

## Test Execution

### Run all HubSpot CRM tests
```bash
RUN_LIVE_INTEGRATION=1 pytest -q tests/integration/tools/crm/hubspot/
```

### Run specific test
```bash
RUN_LIVE_INTEGRATION=1 pytest -q tests/integration/tools/crm/hubspot/test_tools_integration.py::test_hubspot_tool_live_integration[hubspot_crm_get-tools.hubspot_agent.hubspot_crm_get]
```

### Skip tests that require scopes you don't have
```bash
# Skip file-related tests
RUN_LIVE_INTEGRATION=1 pytest -q tests/integration/tools/crm/hubspot/ -k "not (files or file_get or folder_get or forms or marketing_emails or communication_preferences)"
```

## Token Refresh
If your JWT_BEARER token expires or changes, update it in `.env`:

```env
JWT_BEARER="Bearer <your-new-token>"
```

The conftest.py will automatically reload it on the next test run.
