# BP Change & Extend — Pure BTP CAP App

A **governance / request layer** for SAP S/4HANA Business Partner **change & extend**,
built as a **pure SAP BTP application** with **SAP CAP (Node.js)** — no ABAP system,
no Steampunk. This is the **CAP variant** of the redesign described in
`02_BP_Change_Extend_RAP_Design_and_Build_Plan.md` (see §0 and §10 of that doc).

Master data stays in S/4. This app reads the current BP (the *old value*),
captures edits as a draft (the *new value*), routes approval, and writes back to
S/4 via the **released Business Partner API** — the single write path.

## Why CAP instead of RAP

RAP runs only in the SAP BTP **ABAP Environment (Steampunk)**, which requires an
ABAP system/entitlement. The requirement here is a *pure BTP app*, so the design
doc's lower-friction BTP-native alternative was chosen: **CAP** delivering the same
governance flow — CAP drafts for old/new diff, Fiori Elements UI, and S/4 BP API
consumption over a destination.

## Architecture

```
Fiori Elements (List Report + Object Page)   app/bp
        │  OData V4
SAP BTP — CAP service (draft-enabled)         srv/bp-service.cds + .js
        │  Service Consumption (destination SHD250SYSTEM, sap-client 250)
S/4HANA — released Business Partner API       srv/external/API_BUSINESS_PARTNER
```

| Layer | Path | Notes |
|---|---|---|
| Domain model | `db/schema.cds` | `ChangeRequest` root + children (Address, Email, Relationship, Identification, TaxCategory, CompanyCode, PurchasingOrg, BankChain, Attachment); `FieldRule` + `Config`. |
| Service | `srv/bp-service.cds` | `@odata.draft.enabled` projection; actions `extend`, `selectCompanyCode`, `check`, `submit`, `approve`, `rejectRequest`, `postToS4`. |
| Handlers | `srv/bp-service.js` | Snapshot determination on draft create, validations, status lifecycle, single S/4 write path. |
| S/4 connector | `srv/lib/s4-bp.js` | Reads/writes via the released BP API over the destination; falls back to a deterministic **mock** when no destination is bound (local dev). |
| External model | `srv/external/API_BUSINESS_PARTNER.cds` | **Placeholder** — replace with the real Service Consumption Model (`cds import API_BUSINESS_PARTNER.edmx`). |
| UI | `app/bp/` | Annotation-driven Fiori Elements LR/OP (`annotations.cds` + `webapp/`). No custom controllers — dialogs are CAP actions (design doc §4). |

### Old/new value model
The **active** instance holds the current BP snapshot (old value); the **draft**
holds the edits (new value). Fiori Elements renders both natively in edit mode —
no custom two-column diff. The snapshot is loaded by a determination
(`before NEW` / `before UPDATE`) that reads S/4 when a BP number is entered.

## Prerequisites

- Node.js 22, `@sap/cds-dk` (`npm i -g @sap/cds-dk`)
- Cloud Foundry CLI v8 + MultiApps plugin, and `mbt` (`npm i -g mbt`) for packaging
- A BTP subaccount with **HANA Cloud**, **XSUAA**, and **Destination** entitlements
- A destination named **`SHD250SYSTEM`** (configurable) reaching the S/4 BP API
  (Cloud Connector if S/4 is private). `sap-client 250`.

## Develop locally

```bash
npm install
cds watch          # SQLite in-memory; S/4 calls are mocked (see s4-bp.js)
npm test           # mocha + cds.test functional suite (test/bp.test.js)
```

Open the Fiori preview that `cds watch` prints for service `bp`.

## Build & deploy to Cloud Foundry

```bash
cds build --production              # → gen/  (HANA artifacts + srv build)
mbt build -t ./mta_archives \
  --mtar fs2-bp-ext-app.mtar        # → mta_archives/fs2-bp-ext-app.mtar

cf login -a https://api.cf.ap11.hana.ondemand.com --sso
cf deploy mta_archives/fs2-bp-ext-app.mtar
```

The MTA (`mta.yaml`) provisions: CAP srv module, HANA HDI db-deployer, managed
approuter, XSUAA (`xs-security.json`), and a destination service instance.

## S/4 connectivity — finish the wiring (Phase 0)

1. Download the BP API metadata: `…/API_BUSINESS_PARTNER/$metadata`.
2. `cds import API_BUSINESS_PARTNER.edmx --as cds` to replace the placeholder
   `srv/external/API_BUSINESS_PARTNER.cds` with the real consumption model.
3. Create/verify the `SHD250SYSTEM` destination in the subaccount.
4. The remote service is already wired in `package.json#cds.requires.API_BUSINESS_PARTNER`
   (destination `SHD250SYSTEM`, path `/sap/opu/odata/sap/API_BUSINESS_PARTNER`,
   `sap-client=250`).

## Build-plan status (vs design doc §9)

| Phase | Scope | Status |
|---|---|---|
| 0 | Foundation, destination, BP consumption model | remote service wired; **EDMX import** + destination pending |
| 1 | Core BO (model, draft, snapshot determination, LR/OP) | done (this commit) |
| 2 | Actions & rules (`extend`/`selectCompanyCode`/`check`/`submit`, validations) | baseline done; dynamic feature-control via `FieldRule` pending |
| 3 | Workflow & standard services (Flexible Workflow / SBPA, attachments, app log) | `submit`/`approve`/`reject` stubbed; workflow trigger TODO |
| 4 | Posting via released BP API, read-back, duplicate check | write path + status lifecycle done; duplicate fuzzy-check pending |
| 5 | Excel upload app | not started |
| 6 | Harden + cutover (auth/DCL, regression) | pending |

## Notes

- `srv/lib/s4-bp.js` deliberately **does not swallow** S/4 errors — failures set
  `Status = Failed` and surface the parsed message (design doc §7).
- The "mandatory-by-context" matrix lives in the `FieldRule` config entity
  (seed: `db/data/nus.bp-FieldRule.csv`), read by feature-control logic so policy
  changes need no code change (design doc §5).
- A local CLI quirk in some sandboxed environments can prevent `cds serve` from
  hot-loading edited handler files; use `cds watch` or `npm test` (cds.test)
  for local runs. This does not affect `cds build`/`mbt build` or BTP runtime.
