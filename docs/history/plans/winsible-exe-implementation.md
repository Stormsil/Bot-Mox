# Winsible EXE Implementation Plan

## Context

The playbook management system (DB, backend API, frontend editor, queue processor ISO integration) is **already fully implemented**. What remains is implementing the two C# .NET 8 executables that run **on the provisioned Windows VM**:

1. **Winsible.Bootstrap** — minimal "evergreen" EXE that configures network, validates token, downloads runner
2. **Winsible.App** — playbook runner that executes YAML playbooks to fully provision the VM

The C# solution already exists at `Winsible/src/` with skeleton projects and a partially-ported engine core (PlaybookExecutor, TaskRunner, VariableResolver, ConditionEvaluator, ModuleFactory, 29 modules). Both apps publish as single-file self-contained win-x64 EXEs.

---

## What Already Exists

### Winsible.Bootstrap (stub)
- `Program.cs` — Serilog logger + placeholder comments
- `Config/BootstrapConfig.cs` — model with Uuid, Token, ServerUrl, NetworkConfig
- Deps: Polly (retries), Serilog, System.Management
- Publishes as single-file self-contained EXE

### Winsible.App (stub)
- `Program.cs` — Terminal.Gui TUI app (placeholder menu)
- `WinsibleApp.cs` — stub TUI with menu bar
- Deps: Terminal.Gui (TUI), Serilog, references Winsible.Core
- Publishes as single-file self-contained EXE

### Winsible.Core (partially ported)
- **Engine**: PlaybookExecutor, TaskRunner, VariableResolver, ConditionEvaluator, DesiredStateChecker, RoleLoader — all implemented
- **Modules**: 29 modules declared in ModuleFactory, RegistryModule fully implemented, others are stubs
- **Facts**: FactCollector (OS, CPU, RAM, GPU, Network, Hostname)
- **State**: StateManager (.winsible_state.json persistence)
- **YAML**: YamlParser + models (Playbook, TaskDefinition, RoleDefinition, StateCheck)
- Deps: YamlDotNet, Serilog

### Winsible.Shared
- Constants (task statuses, module names, file names)
- Config: AppSettings, ConfigPaths (root discovery)

### Backend API (ready)
- `POST /api/v1/provisioning/validate-token` → returns presigned S3 URLs
- `POST /api/v1/provisioning/report-progress` → stores step/status in DB
- provision.json format: `{ version, vm_uuid, ip: {address, netmask, gateway, dns}, token, s3_endpoint, api_endpoint }`

---

## Phase 1: Winsible.Bootstrap — Full Implementation

### File: `Winsible/src/Winsible.Bootstrap/Program.cs`

Replace the stub with complete bootstrap logic:

```
Flow:
1. Find provision.json on any mounted drive (scan all FileSystem drives)
2. Parse JSON → BootstrapConfig
3. Configure network (static IP, gateway, DNS) via netsh or PowerShell
4. Read machine UUID from WMI (with Proxmox byte-order flip)
5. POST /api/v1/provisioning/validate-token { token, vm_uuid }
   - On failure (no subscription, invalid token) → log error + exit
6. Report progress: step=windows_installed, status=completed
7. Download Winsible.App EXE from presigned S3 URL (app_url from validate response)
8. Report progress: step=app_downloaded, status=completed
9. Copy playbook.yml from ISO drive to C:\Winsible\playbook.yml
10. Save provision.json to C:\Winsible\provision.json (for app to use)
11. Launch Winsible.App.exe --config C:\Winsible\provision.json --playbook C:\Winsible\playbook.yml
```

### New classes to add:

**`Services/ProvisionLoader.cs`** — finds and parses provision.json from any drive
```csharp
public static class ProvisionLoader
{
    public static (ProvisionConfig config, string isoRoot) Load();
    // Scans all drives for provision.json, returns parsed config + drive root path
}
```

**`Services/NetworkConfigurator.cs`** — applies static IP
```csharp
public static class NetworkConfigurator
{
    public static async Task ConfigureAsync(IpConfig ip);
    // Uses Process to run netsh or PowerShell New-NetIPAddress
}
```

**`Services/UuidReader.cs`** — reads VM UUID with Proxmox byte flip
```csharp
public static class UuidReader
{
    public static string GetMachineUuid();
    // WMI: Win32_ComputerSystemProduct.UUID → flip first 3 groups
}
```

**`Services/ApiClient.cs`** — HTTP client for Bot-Mox API
```csharp
public class ApiClient
{
    public async Task<ValidateTokenResponse> ValidateTokenAsync(string token, string vmUuid);
    public async Task ReportProgressAsync(string token, string vmUuid, string step, string status, object? details = null);
}
```

**`Services/Downloader.cs`** — downloads files from S3 with retry (Polly)
```csharp
public static class Downloader
{
    public static async Task DownloadFileAsync(string url, string destPath, ILogger logger);
    // Atomic: download to .tmp, then File.Move
    // Polly retry with exponential backoff
}
```

**`Config/ProvisionConfig.cs`** — matches provision.json format
```csharp
public class ProvisionConfig
{
    public int Version { get; set; }
    public string VmUuid { get; set; }
    public IpConfig Ip { get; set; }
    public string Token { get; set; }
    public string S3Endpoint { get; set; }
    public string ApiEndpoint { get; set; }
}
```

### Update `Winsible.Bootstrap.csproj`
- Already has Polly, Serilog, System.Management — sufficient

---

## Phase 2: Winsible.App — Headless Playbook Runner Mode

The TUI is nice but the VM provisioning use case needs a **headless mode** (no Terminal.Gui). The app should support two modes:

### `--headless --config <path> --playbook <path>` mode (new)

```
Flow:
1. Parse CLI args (--config provision.json, --playbook playbook.yml)
2. Load provision.json → get token, api_endpoint, s3_endpoint
3. Report progress: step=playbook_running, status=running
4. Initialize Winsible.Core engine:
   - YamlParser → parse playbook.yml
   - FactCollector → collect system facts
   - StateManager → load/create state file
   - ModuleFactory → register all modules
   - VariableResolver, ConditionEvaluator, DesiredStateChecker
   - RoleLoader → resolve roles from embedded or S3-downloaded roles
5. Execute playbook via PlaybookExecutor.ExecuteAsync()
   - For each role task, if file downloads needed → use S3 presigned URLs
6. Report progress: step=completed, status=completed (or failed)
7. Mark token as used via report-progress
8. Exit
```

### Files to modify/create:

**`Program.cs`** — add CLI argument parsing, branch to headless or TUI mode
```csharp
if (args.Contains("--headless"))
    await HeadlessRunner.RunAsync(args);
else
    // existing Terminal.Gui code
```

**`HeadlessRunner.cs`** — orchestrates headless playbook execution
```csharp
public static class HeadlessRunner
{
    public static async Task RunAsync(string[] args);
    // Parses args, loads config, initializes engine, executes playbook, reports progress
}
```

**`Services/S3Downloader.cs`** — downloads role files from S3 on demand
```csharp
public class S3Downloader
{
    // Called by modules when they need files (e.g., APP_Chrome.exe)
    // Gets presigned URL from API, downloads to cache dir
    public async Task<string> EnsureFileAsync(string filename);
}
```

### Winsible.Core module completions needed

The following modules need real implementations (currently stubs). Priority order based on the default playbook:

1. **PackageModule** (+ ExePackageModule) — install from EXE/MSI with args
2. **PowerShellModule** — execute inline PowerShell
3. **ScriptModule** — execute .ps1/.cmd files
4. **ServiceModule** — start/stop/enable Windows services
5. **PowerPlanModule** — set power scheme
6. **NetworkProfileModule** — set network type
7. **FirewallModule** — add/remove firewall rules
8. **StaticIpModule** — configure static IP
9. **WallpaperModule** — set desktop wallpaper
10. **ThemeModule** — dark/light mode + accent
11. **TaskbarModule** — configure taskbar settings
12. **AutoLoginModule** — configure auto-login
13. **EnvironmentVariableModule** — set env vars
14. **FileCopyModule** — copy files
15. **FileContentModule** — write file content

RegistryModule is already fully implemented.

---

## Phase 3: Roles as Embedded Resources or S3 Download

Roles (tasks YAML) need to be available on the VM. Two options:

**Option A (recommended):** Embed roles in Winsible.App EXE as resources
- Add `Roles/` folder to Winsible.App project as EmbeddedResource
- RoleLoader reads from embedded resources at runtime
- Roles update when app EXE is updated on S3

**Option B:** Download roles from S3
- Bootstrap downloads roles.zip alongside the app
- More flexible but more moving parts

### Implementation for Option A:

**Modify `Winsible.App.csproj`:**
```xml
<ItemGroup>
  <EmbeddedResource Include="..\..\Roles\**\*" LinkBase="Roles" />
</ItemGroup>
```

**Modify `Winsible.Core/Engine/RoleLoader.cs`:**
- Add fallback to read from Assembly embedded resources when file path not found
- `Assembly.GetExecutingAssembly().GetManifestResourceStream("Winsible.App.Roles.base-system.tasks.main.yml")`

---

## File Change Summary

### New files:
| File | Description |
|------|-------------|
| `Winsible/src/Winsible.Bootstrap/Services/ProvisionLoader.cs` | Find & parse provision.json |
| `Winsible/src/Winsible.Bootstrap/Services/NetworkConfigurator.cs` | Apply static IP |
| `Winsible/src/Winsible.Bootstrap/Services/UuidReader.cs` | WMI UUID with byte flip |
| `Winsible/src/Winsible.Bootstrap/Services/ApiClient.cs` | HTTP calls to Bot-Mox API |
| `Winsible/src/Winsible.Bootstrap/Services/Downloader.cs` | S3 file downloads with retry |
| `Winsible/src/Winsible.Bootstrap/Config/ProvisionConfig.cs` | provision.json model |
| `Winsible/src/Winsible.App/HeadlessRunner.cs` | Headless playbook execution |
| `Winsible/src/Winsible.App/Services/S3Downloader.cs` | On-demand S3 file downloads |

### Modified files:
| File | Change |
|------|--------|
| `Winsible/src/Winsible.Bootstrap/Program.cs` | Full bootstrap implementation |
| `Winsible/src/Winsible.App/Program.cs` | Add --headless CLI branch |
| `Winsible/src/Winsible.App/Winsible.App.csproj` | Embed Roles as resources |
| `Winsible/src/Winsible.Core/Engine/RoleLoader.cs` | Support embedded resource loading |
| `Winsible/src/Winsible.Core/Modules/Package/PackageModule.cs` | Full EXE installer implementation |
| `Winsible/src/Winsible.Core/Modules/PowerShell/PowerShellModule.cs` | Full PS execution |
| `Winsible/src/Winsible.Core/Modules/Script/ScriptModule.cs` | Full script execution |
| `Winsible/src/Winsible.Core/Modules/Service/ServiceModule.cs` | Full service control |
| `Winsible/src/Winsible.Core/Modules/System/PowerPlanModule.cs` | Full power plan |
| + 10 more module implementations | Fill stubs |

---

## Build & Deploy

```bash
# Build Bootstrap (single-file ~15MB)
dotnet publish Winsible/src/Winsible.Bootstrap -c Release -r win-x64

# Build App (single-file ~25MB)
dotnet publish Winsible/src/Winsible.App -c Release -r win-x64

# Upload to S3
aws s3 cp publish/Winsible.Bootstrap.exe s3://botmox-provisioning/bootstrap/downloader.exe
aws s3 cp publish/Winsible.App.exe s3://botmox-provisioning/apps/winsible-setup.exe
```

---

## Verification

1. `dotnet build Winsible/Winsible.sln` — all projects compile
2. `dotnet test Winsible/tests/` — unit tests pass
3. `dotnet publish` both projects — single-file EXEs generated
4. Manual test: run Bootstrap.exe on a VM with provision.json on CD-ROM
5. Verify: network configured → token validated → app downloaded → playbook executed → progress reported

---

## Implementation Order

```
Phase 1: Winsible.Bootstrap (full implementation)
  ├── ProvisionConfig model
  ├── ProvisionLoader (find provision.json)
  ├── NetworkConfigurator (static IP)
  ├── UuidReader (WMI + byte flip)
  ├── ApiClient (validate-token, report-progress)
  ├── Downloader (S3 with Polly retry)
  └── Program.cs (orchestrate all steps)

Phase 2: Winsible.App headless mode
  ├── CLI args parsing + HeadlessRunner
  ├── S3Downloader (on-demand file downloads for modules)
  ├── Complete critical modules (Package, PowerShell, Script, Service)
  └── Complete remaining modules (15 more)

Phase 3: Role embedding + RoleLoader update
  ├── Embed Roles/ in .csproj
  └── RoleLoader embedded resource fallback
```

---

# Previous Plan (Playbook Backend/Frontend — COMPLETED)

## Phase 1: Database — `playbooks` table

**New file:** `supabase/migrations/20260216001000_create_playbooks.sql`

```sql
CREATE TABLE IF NOT EXISTS playbooks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   TEXT NOT NULL DEFAULT 'default',
  user_id     UUID NOT NULL,
  name        TEXT NOT NULL,
  is_default  BOOLEAN DEFAULT false,
  content     TEXT NOT NULL,          -- raw YAML
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, user_id, name)
);

CREATE INDEX IF NOT EXISTS idx_playbooks_user ON playbooks(tenant_id, user_id);

ALTER TABLE provisioning_tokens
  ADD COLUMN IF NOT EXISTS playbook_id UUID REFERENCES playbooks(id) ON DELETE SET NULL;
```

Same isolation pattern as `unattend_profiles`. The `provisioning_tokens.playbook_id` tracks which playbook was used for each VM.

---

## Phase 2: Backend — Playbook Service + Routes + Schema Updates

### 2.1 Zod schemas

**Modify:** `apps/backend-legacy/src/contracts/schemas.js`

Add playbook validation schemas:
- `playbookRoleEntrySchema` — `{ role, when?, tags?, vars? }`
- `playbookContentStructureSchema` — `{ name, vars?, roles[], pre_checks?, notifications? }`
- `playbookCreateSchema` — `{ name, is_default?, content (max 64KB) }`
- `playbookUpdateSchema` — partial of create

### 2.2 Playbook service

**New file:** `apps/backend-legacy/src/modules/playbooks/service.js`

Pattern: same as `apps/backend-legacy/src/modules/provisioning/service.js`

Methods:
- `listPlaybooks({ tenantId, userId })`
- `getPlaybook({ tenantId, userId, playbookId })`
- `getDefaultPlaybook({ tenantId, userId })`
- `createPlaybook({ tenantId, userId, name, isDefault, content })`
- `updatePlaybook({ tenantId, userId, playbookId, updates })`
- `deletePlaybook({ tenantId, userId, playbookId })`
- `validatePlaybookContent(yamlString)` — parse YAML with `js-yaml`, validate against Zod schema, warn on unknown role names

**New dep:** `js-yaml` in `apps/backend-legacy/package.json`

### 2.3 Playbook routes

**New file:** `apps/backend-legacy/src/modules/v1/playbooks.routes.js`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/playbooks` | List user's playbooks |
| GET | `/api/v1/playbooks/:id` | Get single playbook |
| POST | `/api/v1/playbooks` | Create (validates YAML) |
| PUT | `/api/v1/playbooks/:id` | Update (validates YAML) |
| DELETE | `/api/v1/playbooks/:id` | Delete |
| POST | `/api/v1/playbooks/validate` | Validate without saving |

### 2.4 Register routes

**Modify:** `apps/backend-legacy/src/modules/v1/index.js`

Import + register `createPlaybookRoutes` after provisioning routes (~line 133).

### 2.5 Update ISO generation to include playbook

**Modify:** `apps/backend-legacy/src/modules/v1/provisioning.routes.js`

In `POST /provisioning/generate-iso-payload`:
1. Accept optional `playbook_id` in request body
2. Load playbook from DB (or user's default if not specified)
3. Add `'playbook.yml': Buffer.from(content).toString('base64')` to response `files`
4. Store `playbook_id` on the provisioning token record

**Modify:** `apps/backend-legacy/src/contracts/schemas.js` — add `playbook_id` to `generateIsoPayloadSchema`

### 2.6 Token changes

**Modify:** `apps/backend-legacy/src/modules/provisioning/service.js`
- Change default `expiresInDays` to `3650` (10 years ≈ permanent)
- In `validateToken()`: add subscription status check before approving

---

## Phase 3: Agent — No code changes needed

The agent's `proxmox.create-provision-iso` handler (line 630 of `agent/src/executors/proxmox.ts`) already iterates dynamically over all keys in the `files` object:

```typescript
for (const [filename, b64content] of Object.entries(files)) {
  const safeName = String(filename).replace(/[^a-zA-Z0-9._-]/g, '_');
  writeCommands.push(`echo '${b64content}' | base64 -d > ${tmpDir}/${safeName}`);
}
```

When the backend adds `playbook.yml` to the files map, the agent writes it into the ISO automatically.

---

## Phase 4: Frontend — Queue Processor + Playbook Tab

### 4.1 Wire ISO creation into queue processor (NEW Phase 3 in processor)

**Modify:** `apps/frontend/src/hooks/vm/queue/processor.ts`

After the existing Phase 2 (Configuration), add **Phase 3 — Provisioning ISO**:

```
For each successfully configured VM:
1. Call generateIsoPayload({ vm_uuid, ip, profile_id?, playbook_id? })
   → gets back { files, token, ... }
2. Call executeVmOps('proxmox', 'create-provision-iso', { vmid, files, isoName })
   → creates ISO on Proxmox host local storage
3. Call executeVmOps('proxmox', 'attach-cdrom', { vmid, isoPath })
   → attaches ISO as ide2 CD-ROM to VM
```

Update queue item statuses: add `'provisioning'` state between `'configuring'` and `'done'`.

**Modify:** `apps/frontend/src/hooks/vm/queue/types.ts` — add `playbookId` to `AddToQueueOverrides`

**Modify:** `apps/frontend/src/types/vm.ts`:
- Add `playbookId?: string` to `VMQueueItem`
- Add `'provisioning'` to `VMQueueItemStatus` if not present

**Modify:** `apps/frontend/src/services/unattendProfileService.ts`:
- Add `playbook_id?: string` to `GenerateIsoPayloadRequest`

### 4.2 Playbook service (frontend)

**New file:** `apps/frontend/src/services/playbookService.ts`

Pattern: same as `unattendProfileService.ts`

```typescript
export interface Playbook {
  id: string; tenant_id: string; user_id: string;
  name: string; is_default: boolean; content: string;
  created_at: string; updated_at: string;
}

// CRUD: listPlaybooks, createPlaybook, updatePlaybook, deletePlaybook
// Validation: validatePlaybook(content) → { valid, errors?, warnings? }
```

### 4.3 PlaybookTab component

**New file:** `apps/frontend/src/components/vm/settingsForm/PlaybookTab.tsx`

Layout mirrors `UnattendTab.tsx`:

```
┌─────────────────────────────────────────────┐
│ [+ New Playbook]                            │
│ ┌──────────┐ ┌────────────────────────────┐ │
│ │ Sidebar  │ │ Name: [___________] [Save] │ │
│ │          │ │ [x] Default   [Delete]     │ │
│ │ ● Default│ │                            │ │
│ │   Custom │ │ ┌────────────────────────┐ │ │
│ │   ...    │ │ │   Monaco YAML Editor   │ │ │
│ │          │ │ │   (syntax highlight)   │ │ │
│ │          │ │ │                        │ │ │
│ │          │ │ │                        │ │ │
│ │          │ │ └────────────────────────┘ │ │
│ │          │ │ Validation: ✓ Valid        │ │
│ │          │ │ [Import] [Export]          │ │
│ └──────────┘ └────────────────────────────┘ │
└─────────────────────────────────────────────┘
```

Uses `@monaco-editor/react` (already in dependencies) with `language="yaml"`.

### 4.4 Register tab in VMSettingsForm

**Modify:** `apps/frontend/src/components/vm/VMSettingsForm.tsx`

Add 4th tab `{ key: 'playbooks', label: 'Playbooks', children: <PlaybookTab /> }`

**Modify:** `apps/frontend/src/components/vm/settingsForm/index.ts` — export PlaybookTab

### 4.5 Playbook selector in VM queue

**Modify:** `apps/frontend/src/pages/vms/VMsPage.tsx` (or queue panel)

Add a `<Select>` dropdown for playbook when adding VMs to queue. Pre-selects the user's default playbook. Selected ID flows into `VMQueueItem.playbookId`.

**Modify:** `apps/frontend/src/pages/vms/hooks/useVmStartAndQueueActions.ts` — pass `playbookId` through.

---

## Phase 5: Default Playbook Content

**New file:** `apps/frontend/src/data/default-playbook.ts` (exported as string constant)

YAML that replicates the current Winsible `Main.ps1` + `setup_config.json` workflow:

```yaml
name: Bot-Mox Standard Provisioning
vars:
  vm_user: "User"
  power_plan: "high_performance"

pre_checks:
  - name: Check internet
    check: "Test-Connection 8.8.8.8 -Count 1 -Quiet"

roles:
  - role: base-system
    tags: [system]
    vars: { disable_defender: true, disable_windows_update: true }
  - role: privacy-debloat
    tags: [privacy]
  - role: network-config
    tags: [network]
  - role: common-apps
    tags: [apps]
    vars:
      apps:
        - { name: ".NET 8 SDK", file: "APP_SDKNET8.exe", args: "/install /quiet /norestart" }
        - { name: "WebView2", file: "APP_WebView2.exe", args: "/silent /install" }
        - { name: "Chrome", file: "APP_Chrome.exe", args: "/silent /install" }
        - { name: "Notepad++", file: "APP_Notepad.exe", args: "/S" }
        - { name: "WinRAR", file: "APP_WinRAR.exe", args: "/S" }
        - { name: "Syncthing", file: "APP_SyncThing.exe", args: "/silent /allusers" }
  - role: personalization
    tags: [visual]
  - role: nvidia-driver
    tags: [drivers]
    when: "facts.gpu.vendor == 'NVIDIA'"
  - role: syncthing
    tags: [sync]
  - role: proxifier
    tags: [network]
  - role: post-reboot
    tags: [final]
```

Offered as template when creating first playbook.

---

## File Change Summary

### New files (6):
| File | Description |
|------|-------------|
| `supabase/migrations/20260216001000_create_playbooks.sql` | DB migration |
| `apps/backend-legacy/src/modules/playbooks/service.js` | Playbook CRUD + YAML validation |
| `apps/backend-legacy/src/modules/v1/playbooks.routes.js` | REST endpoints |
| `apps/frontend/src/services/playbookService.ts` | Frontend API service |
| `apps/frontend/src/components/vm/settingsForm/PlaybookTab.tsx` | YAML editor tab |
| `apps/frontend/src/data/default-playbook.ts` | Default playbook template |

### Modified files (12):
| File | Change |
|------|--------|
| `apps/backend-legacy/src/contracts/schemas.js` | Add playbook Zod schemas + `playbook_id` to ISO schema |
| `apps/backend-legacy/src/modules/v1/index.js` | Register playbook routes |
| `apps/backend-legacy/src/modules/v1/provisioning.routes.js` | Include playbook in ISO payload |
| `apps/backend-legacy/src/modules/provisioning/service.js` | 10yr token expiry + subscription check |
| `apps/backend-legacy/package.json` | Add `js-yaml` dependency |
| `apps/frontend/src/components/vm/VMSettingsForm.tsx` | Add Playbooks tab |
| `apps/frontend/src/components/vm/settingsForm/index.ts` | Export PlaybookTab |
| `apps/frontend/src/types/vm.ts` | Add `playbookId` + `'provisioning'` status |
| `apps/frontend/src/hooks/vm/queue/types.ts` | Add `playbookId` to overrides |
| `apps/frontend/src/hooks/vm/queue/processor.ts` | Add Phase 3: ISO creation + attachment |
| `apps/frontend/src/services/unattendProfileService.ts` | Add `playbook_id` to request type |
| `apps/frontend/src/pages/vms/VMsPage.tsx` | Playbook selector dropdown in queue |

### No changes needed:
- `agent/src/executors/proxmox.ts` — already handles dynamic file lists

---

## Implementation Order

```
Phase 1 (DB)
  ↓
Phase 2 (Backend: schemas → service → routes → register → ISO update → token)
  ↓
Phase 4.1 (Queue processor: wire ISO creation)  ←  critical new functionality
  ↓
Phase 4.2-4.5 (Frontend: service → tab → registration → selector)
  ↓
Phase 5 (Default playbook content)
```

---

## Verification Plan

1. **DB:** `npx supabase db reset` — verify `playbooks` table + `provisioning_tokens.playbook_id` column
2. **Backend syntax:** `npm run check:backend:syntax` — all new JS files pass `node --check`
3. **Backend smoke:** `npm run check:backend:smoke` — all modules importable
4. **API manual test:** Create/list/update/delete playbooks via curl or frontend
5. **YAML validation:** Submit invalid YAML → expect error; submit valid YAML → expect success with optional warnings
6. **Frontend build:** `npm run check:all` — TypeScript compiles, lint passes, bundle budget OK
7. **Queue flow E2E:** Add VM to queue → observe Phase 3 logs:
   - `generateIsoPayload` called with `playbook_id`
   - `proxmox.create-provision-iso` creates ISO with `playbook.yml` inside
   - `proxmox.attach-cdrom` attaches ISO to VM's ide2
8. **VM boot:** Start VM → Windows installs from autounattend.xml → START.ps1 runs → token validates → bootstrap downloads from S3
