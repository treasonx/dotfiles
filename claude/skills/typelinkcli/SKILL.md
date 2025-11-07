---
skill: typelinkcli
description: Expert knowledge of the Typelink CLI including command order, session management, smart deploy, and automation patterns
tags: [typelink, cli, deployment, automation]
---

# Typelink CLI Expert Guide

This skill provides comprehensive knowledge of the Typelink CLI for automation and scripting.

## Core Concepts

### Session Management

The CLI maintains sessions in `.typelink/sessions.json`:

```json
{
  "currentTenantId": "aaaaataaaaa_tnnt",
  "sessions": {
    "0000000000000000": {
      "sessionId": "abc123...",
      "tenantId": "0000000000000000",
      "userId": "aaaaajaaaaa_user",
      "baseUrl": "http://localhost:8080",
      "loginTime": "2025-11-07T12:00:00.000Z"
    },
    "aaaaataaaaa_tnnt": {
      "sessionId": "def456...",
      "tenantId": "aaaaataaaaa_tnnt",
      "userId": "taaaajaaaaa_user",
      "baseUrl": "http://localhost:8080",
      "loginTime": "2025-11-07T12:05:00.000Z"
    }
  }
}
```

**Key Points:**
- `currentTenantId` determines which tenant context commands run in
- Sessions expire after 24 hours
- `login --save` creates/updates sessions
- `tenant switch` changes the active context

### Smart Deploy Feature

The `deploy` command automatically detects context:

```javascript
// Internal CLI logic
if (currentTenantId === '0000000000000000' || currentTenantId === 'system') {
  // Deploy to SYSTEM
  deploySystemArtifacts('artifacts/system/')
  createOrUpdateCapability()
} else {
  // Install in TENANT
  deployTenantArtifacts('artifacts/tenant/')
  installCapabilityInTenant(tenantId, capabilityName)
}
```

**Implications:**
- You can call `deploy` twice with different contexts
- First time (system context) → deploys system artifacts
- Second time (tenant context) → installs capability in tenant
- No need for separate install commands

---

## Command Reference

### Authentication

```bash
# Login to system tenant (admin)
typelink login --email admin@system.net --password <pwd> --tenant 0000000000000000 --save

# Login to specific tenant
typelink login --email user@example.com --password <pwd> --tenant <tenant-id> --save

# Logout from current session
typelink logout

# Logout from all sessions (clear all contexts)
typelink logout-all

# Show current session info
typelink session
```

**Best Practice:** Always use `--save` flag to persist sessions for subsequent commands.

### Tenant Management

```bash
# Create tenant with admin user
typelink tenant create \
  --name "myorg" \
  --display-name "My Organization" \
  --description "Description" \
  --email "admin@myorg.com" \
  --first-name "Admin" \
  --last-name "User" \
  --phone "5555550100" \
  --password "password123"

# Switch to different tenant context
typelink tenant switch <tenant-id>

# Show current tenant context
typelink tenant current

# List all tenant sessions
typelink tenant sessions
```

**Best Practice:** After `tenant create`, extract the tenant ID from output and use it with `tenant switch`.

### Deployment

```bash
# Deploy capability (context-aware)
typelink deploy

# Dry run (validate only)
typelink deploy --dry-run

# Deploy with debug logging
typelink deploy --debug true
```

**Context Detection:**
- If `currentTenantId` is system → deploys to system
- If `currentTenantId` is a tenant → installs in that tenant

### Test Data Generation

```bash
# Generate fake data for business object
typelink test fakedata \
  --type object \
  --object "inh:Donor" \
  --count 10 \
  --insert true

# Generate and save to file (no insert)
typelink test fakedata \
  --type object \
  --object "inh:Donor" \
  --count 5 \
  --output donors.json

# Generate for multiple objects at once
typelink test fakedata \
  --type object \
  --object "inh:Donor,inh:BloodCollection" \
  --count 10 \
  --insert true
```

**Requirements:**
- Must be in tenant context (not system)
- BusinessObject YAML files must exist in `artifacts/tenant/BusinessObjects/`
- Uses current session's tenant ID automatically

### Configuration

```bash
# Show current configuration
typelink config

# Show configuration for specific environment
typelink config --env staging

# Show current environment
typelink env

# List available environments
typelink env --list
```

**Configuration File:** `typelink.toml` in project directory

---

## Deployment Order of Operations

### Standard Full Deployment (Fresh Database)

```bash
# Step 1: Clear all sessions
typelink logout-all

# Step 2: Deploy to System
typelink login --email admin@system.net --password 1 --tenant 0000000000000000 --save
typelink deploy
# → Deploys: BusinessObjects, EnumDefinitions to system
# → Creates capability record

# Step 3: Create Tenant
TENANT_OUTPUT=$(typelink tenant create \
  --name "myorg" \
  --display-name "My Organization" \
  --email "admin@myorg.com" \
  --first-name "Admin" \
  --last-name "User" \
  --password "admin123")

# Extract tenant ID
TENANT_ID=$(echo "$TENANT_OUTPUT" | grep -o 'ID: [a-z0-9_]*' | cut -d' ' -f2)

# Step 4: Install Capability in Tenant
typelink login --email "admin@myorg.com" --password "admin123" --tenant "${TENANT_ID}" --save
typelink tenant switch "${TENANT_ID}"
typelink deploy
# → Deploys: ObjectMetrics, ObjectCollections, EnumDefinitions to tenant
# → Installs capability for tenant

# Step 5: Generate Demo Data
typelink test fakedata --type object --object "ns:Object1" --count 10 --insert true
typelink test fakedata --type object --object "ns:Object2" --count 10 --insert true
# Repeat for each business object...

# Step 6: Create Demo User (API call - no CLI command exists)
curl -X POST http://localhost:8080/api/v1/auth/users \
  -H "X-Organization-Id: ${TENANT_ID}" \
  -H "X-Session-Id: ${SESSION_ID}" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "demo@demo.com",
    "firstName": "Demo",
    "lastName": "User",
    "userType": "Standard",
    "password": "1"
  }'
```

### Quick Re-deployment (Existing Tenant)

```bash
# If tenant already exists and you just want to update artifacts
typelink login --email admin@system.net --password 1 --tenant 0000000000000000 --save
typelink deploy  # Update system artifacts

typelink tenant switch <existing-tenant-id>
typelink deploy  # Update tenant artifacts
```

---

## Artifact Structure

### System Artifacts (`artifacts/system/`)

**Must be deployed at system level ONLY:**

```
artifacts/system/
├── BusinessObjects/          # Core data models (SYSTEM ONLY)
│   ├── ns--Object1.yaml
│   ├── ns--Object2.yaml
│   └── ...
└── EnumDefinitions/          # Shared enums
    ├── ns--StatusEnum.yaml
    └── ...
```

**Key Rule:** BusinessObjects can ONLY be deployed to system. Attempting to deploy them to a tenant will fail with:
```
"Artifact not supported in current tenant context: BusinessObject (supports: SYSTEM_ONLY, current: INDIVIDUAL)"
```

### Tenant Artifacts (`artifacts/tenant/`)

**Deployed to each tenant individually:**

```
artifacts/tenant/
├── EnumDefinitions/          # Tenant-specific enum values
│   ├── ns--CustomEnum.yaml
│   └── ...
├── ObjectMetrics/            # Dashboard metrics/reports
│   ├── ns--MetricName.yaml
│   └── ...
└── ObjectCollections/        # Custom views/filters
    ├── ns--CollectionName.yaml
    └── ...
```

**Special Case for Fake Data:**
- The `fakedata` command needs to READ BusinessObject schemas
- Copy BusinessObject YAMLs from `artifacts/system/` to `artifacts/tenant/BusinessObjects/` temporarily
- Only for schema reading - they won't be deployed
- Remove after data generation to avoid confusion

---

## Common Patterns

### Pattern 1: Context Verification

Always verify context before critical operations:

```bash
# Verify we're in the right tenant
CURRENT_CONTEXT=$(typelink tenant current | grep "Tenant ID" | awk '{print $3}')
if [ "$CURRENT_CONTEXT" != "$EXPECTED_TENANT_ID" ]; then
    echo "Wrong context!"
    exit 1
fi

# Now safe to deploy
typelink deploy
```

### Pattern 2: Handle "Already Exists" Gracefully

```bash
# Tenant creation
TENANT_OUTPUT=$(typelink tenant create ... 2>&1)
TENANT_ID=$(echo "$TENANT_OUTPUT" | grep -o 'ID: [a-z0-9_]*' | cut -d' ' -f2)

if [ -z "$TENANT_ID" ]; then
    # Check if already exists
    if echo "$TENANT_OUTPUT" | grep -q "already exists"; then
        echo "Tenant already exists"
        # Try to extract ID from sessions or API
        TENANT_ID=$(extract_existing_tenant_id)
    else
        echo "Failed to create tenant"
        exit 1
    fi
fi
```

### Pattern 3: Session Management in Scripts

```bash
# Get session ID from sessions.json
get_session_id() {
    local tenant_id=$1
    grep -A 5 "\"${tenant_id}\"" .typelink/sessions.json | \
        grep "sessionId" | head -1 | cut -d'"' -f4
}

# Use for API calls
SESSION_ID=$(get_session_id "${TENANT_ID}")
curl -H "X-Session-Id: ${SESSION_ID}" ...
```

### Pattern 4: Retry on Session Expiry

```bash
# The CLI automatically retries with fresh session on 403 errors
# But in scripts, you may need manual retry:

deploy_with_retry() {
    OUTPUT=$(typelink deploy 2>&1)
    if echo "$OUTPUT" | grep -q "unauthorized\|expired"; then
        echo "Session expired, re-logging..."
        typelink login --email "$EMAIL" --password "$PWD" --tenant "$TENANT_ID" --save
        typelink deploy
    fi
}
```

---

## Troubleshooting

### Issue: "Smart deploy deploying to wrong context"

**Symptom:** Running `deploy` in tenant context but it deploys to system instead.

**Cause:** `currentTenantId` in sessions.json is not set correctly.

**Solution:**
```bash
# Verify current context
typelink tenant current

# If wrong, switch explicitly
typelink tenant switch <correct-tenant-id>

# Verify again
typelink tenant current

# Then deploy
typelink deploy
```

### Issue: "No valid session found"

**Symptom:** Commands fail with "No valid session found for tenant: X"

**Cause:** Session expired or never created.

**Solution:**
```bash
# Create new session
typelink login --email user@example.com --password pwd --tenant <tenant-id> --save

# Switch to it
typelink tenant switch <tenant-id>
```

### Issue: "BusinessObject deployment fails in tenant"

**Symptom:** Error: "Artifact not supported in current tenant context: BusinessObject"

**Cause:** BusinessObjects can only be deployed at system level.

**Solution:**
- Deploy BusinessObjects from system context first
- Don't include BusinessObjects in `artifacts/tenant/` during deployment
- Only copy them there temporarily for fakedata schema reading

### Issue: "Demo user login fails after creation"

**Symptom:** User created successfully but can't login immediately.

**Cause:** Possible database transaction commit delay.

**Solution:**
```bash
# Add verification with retry
create_user_response=$(curl -X POST ...)

# Wait and verify
sleep 2
login_test=$(curl -X POST .../auth/login ...)
if ! echo "$login_test" | grep -q sessionId; then
    echo "Login verification failed"
    exit 1
fi
```

---

## Best Practices for Automation

### 1. Always Use Explicit Context

```bash
# BAD - relies on implicit context
typelink deploy

# GOOD - explicit context management
typelink logout-all
typelink login --tenant 0000000000000000 --save
typelink deploy
```

### 2. Verify Before Deploy

```bash
# Check artifacts exist
if [ ! -f "capability.yaml" ]; then
    echo "Not in capability directory"
    exit 1
fi

# Verify session is valid
if ! typelink session > /dev/null 2>&1; then
    echo "No valid session"
    exit 1
fi
```

### 3. Capture and Parse Output

```bash
# Capture output for error handling
OUTPUT=$(typelink deploy 2>&1)
STATUS=$?

if [ $STATUS -eq 0 ]; then
    echo "Success"
else
    echo "Failed: $OUTPUT"
    exit 1
fi
```

### 4. Use TOML Config

Create `typelink.toml` in project root:

```toml
[platform]
base_url = "http://localhost:8080"
log_level = "INFO"

[system_admin]
email = "admin@system.net"
password = "1"
tenant_id = "0000000000000000"

[project]
namespace = "myns"
capability = "my_capability"

[env.local]
base_url = "http://localhost:8080"

[env.staging]
base_url = "http://staging.example.com"
```

### 5. Idempotent Scripts

Design scripts that can be run multiple times safely:

```bash
# Check if tenant exists before creating
if tenant_exists "myorg"; then
    echo "Tenant exists, skipping creation"
    TENANT_ID=$(get_existing_tenant_id "myorg")
else
    TENANT_ID=$(create_tenant "myorg")
fi
```

---

## API Fallbacks

Some operations require direct API calls (no CLI command):

### Create Standard User

```bash
curl -X POST http://localhost:8080/api/v1/auth/users \
  -H "X-Organization-Id: ${TENANT_ID}" \
  -H "X-Session-Id: ${SESSION_ID}" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "firstName": "First",
    "lastName": "Last",
    "userType": "Standard",
    "password": "password123"
  }'
```

### List Tenants

```bash
curl -s http://localhost:8080/api/v1/tenants \
  -H "X-Organization-Id: 0000000000000000" \
  -H "X-Session-Id: ${SESSION_ID}"
```

### Get Tenant by Name

```bash
# No direct CLI command, use API
TENANTS=$(curl -s http://localhost:8080/api/v1/tenants ...)
TENANT_ID=$(echo "$TENANTS" | jq -r '.[] | select(.name=="myorg") | .id')
```

---

## Script Template

Here's a complete template for capability deployment scripts:

```bash
#!/bin/bash
set -e  # Exit on error

# Configuration
CLI_CMD="node /path/to/cli/dist/index.js"
PROJECT_DIR="/path/to/project"
TENANT_NAME="myorg"

# Change to project directory
cd "${PROJECT_DIR}"

# Step 1: Deploy to System
echo "Deploying to system..."
$CLI_CMD logout-all
$CLI_CMD login --email admin@system.net --password 1 --tenant 0000000000000000 --save
$CLI_CMD deploy

# Step 2: Create Tenant
echo "Creating tenant..."
TENANT_OUTPUT=$($CLI_CMD tenant create \
    --name "${TENANT_NAME}" \
    --display-name "My Organization" \
    --email "admin@${TENANT_NAME}.com" \
    --password "admin123")

TENANT_ID=$(echo "$TENANT_OUTPUT" | grep -o 'ID: [a-z0-9_]*' | cut -d' ' -f2)

if [ -z "$TENANT_ID" ]; then
    echo "Failed to get tenant ID"
    exit 1
fi

echo "Tenant created: ${TENANT_ID}"

# Step 3: Install in Tenant
echo "Installing capability in tenant..."
$CLI_CMD login --email "admin@${TENANT_NAME}.com" --password "admin123" --tenant "${TENANT_ID}" --save
$CLI_CMD tenant switch "${TENANT_ID}"

# Verify context
CURRENT=$(typelink tenant current 2>&1 | grep "Tenant ID" | awk '{print $3}')
if [ "$CURRENT" != "$TENANT_ID" ]; then
    echo "Context verification failed"
    exit 1
fi

$CLI_CMD deploy

# Step 4: Generate Data
echo "Generating demo data..."
for obj in "ns:Object1" "ns:Object2"; do
    $CLI_CMD test fakedata --type object --object "$obj" --count 10 --insert true
done

echo "Deployment complete!"
echo "Tenant ID: ${TENANT_ID}"
```

---

## When to Use Claude for Automation

**Good Use Cases:**
- Writing deployment scripts
- Debugging session/context issues
- Creating idempotent automation
- Generating test data scripts
- Troubleshooting "smart deploy" behavior

**Provide Claude With:**
- Current working directory
- Contents of `typelink.toml`
- Output of `typelink tenant current`
- Contents of `.typelink/sessions.json` (for debugging)
- Error messages from failed commands

**Example Prompt:**
```
I need to automate deploying my capability to a new tenant.
My project is in /path/to/project with typelink.toml configured.
The capability has BusinessObjects: X, Y, Z
I want to create a tenant, deploy, and generate 50 test records.
Can you write a bash script using the Typelink CLI?
```

---

## Version Information

This skill is based on the Typelink CLI version with:
- TOML-based configuration
- Smart deploy (context-aware deployment)
- Multi-tenant session management
- Fake data generation with schema reading

**CLI Location:** Typically at `./cli/dist/index.js` relative to project root.

---

## Quick Reference Card

```bash
# Context Management
typelink logout-all                    # Clear all sessions
typelink login --tenant X --save       # Login and save
typelink tenant switch X               # Switch context
typelink tenant current                # Show context

# Deployment
typelink deploy                        # Context-aware deploy
typelink deploy --dry-run              # Validate only

# Tenant Operations
typelink tenant create ...             # Create tenant + admin
typelink tenant sessions               # List sessions

# Data Generation
typelink test fakedata --object X      # Generate fake data

# Debugging
typelink session                       # Show current session
typelink config                        # Show configuration
cat .typelink/sessions.json            # Inspect sessions
```

---

## Remember

1. **System artifacts first, tenant artifacts second**
2. **BusinessObjects are system-only**
3. **Always verify context before deploy**
4. **Sessions expire after 24 hours**
5. **Smart deploy reads currentTenantId**
6. **Use `--save` flag to persist sessions**
7. **Tenant switch updates currentTenantId**
8. **No CLI command for creating standard users yet**

This knowledge will help automate Typelink CLI operations correctly and avoid common pitfalls!
