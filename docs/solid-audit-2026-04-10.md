# SOLID Audit Report - QuanLyThietBi

Date: 2026-04-10
Scope: Monorepo backend-focused audit (apps/api, packages/application, packages/contracts, packages/domain, packages/infra-postgres)

## 1) Executive Summary

Overall assessment: PARTIALLY COMPLIANT

- Architecture direction is good (layered, clean boundaries, strong interface usage in many modules).
- Main risks are concentrated in very large route/service modules and several broad interfaces.
- Highest-impact concerns are SRP drift in route/service hotspots and ISP drift in some repository contracts.

SOLID scorecard (repo-level):

- S (Single Responsibility): 2.5 / 5
- O (Open/Closed): 3.0 / 5
- L (Liskov Substitution): 3.5 / 5
- I (Interface Segregation): 2.5 / 5
- D (Dependency Inversion): 4.0 / 5

Total weighted score: 3.1 / 5

## 2) Audit Method

Checklist used for each principle:

- S: file/class size, method count, mixed concerns in same module, direct infra logic in routes.
- O: extension points via strategy/registry vs branch explosion (switch/case, key lists).
- L: interface substitutability in tests/mocks; behavioral expectations kept across implementations.
- I: interface size and fake/mock burden (unused methods, Not implemented stubs).
- D: dependency direction (domain <- contracts <- application <- infra wiring), concrete construction location.

Measured repository size (TS only, excluding node_modules):

- Total TS files (packages + api): 691
- Application files: 105
- Domain files: 53
- Contracts files: 75
- Infra repository files: 95
- API route files: 88

## 3) Key Evidence

### S - Single Responsibility

Strong positive signals:

- Clear layer separation exists in many modules (routes -> services -> repos).

Risk signals:

- Very large modules with multiple responsibilities:
  - apps/api/src/routes/v1/reports/report-aggregation.routes.ts (1001 lines)
  - apps/api/src/routes/v1/admin/permission-center.routes.ts (803 lines)
  - packages/application/src/audit/AuditService.ts (699 lines)
  - packages/application/src/assets/WorkflowService.ts (620 lines)
  - packages/application/src/labels/LabelsService.ts (537 lines)
- High method density in core services:
  - packages/application/src/audit/AuditService.ts: 26 async methods
  - packages/application/src/labels/LabelsService.ts: 35 async methods
- Routes mixing HTTP concern + SQL orchestration + transaction logic:
  - apps/api/src/routes/v1/admin/permission-center.routes.ts includes many pgClient.query calls and BEGIN/COMMIT/ROLLBACK flow.

Assessment: SRP is currently the biggest architectural debt.

### O - Open/Closed

Positive signals:

- Many services consume interfaces, allowing infra replacement without editing business logic.

Risk signals:

- New report type requires touching multiple hardcoded sites:
  - VALID_KEYS list and switch dispatcher in report aggregation route.
- Large branch-driven modules indicate change amplification:
  - report aggregation key switch
  - several route-level branching flows

Assessment: OCP is moderate; extension points exist but not consistently applied in high-change modules.

### L - Liskov Substitution

Positive signals:

- Application services are unit tested with fake implementations, confirming substitutability in common paths.
  - Example: AssetService tests use FakeAssetRepo, FakeAssignmentRepo, FakeEventRepo, FakeMaintenanceRepo.

Risk signals:

- Some fake repos in tests need Not implemented methods due broad contracts, indicating potential behavioral mismatch if re-used broadly.

Assessment: LSP is acceptable but indirectly pressured by ISP issues.

### I - Interface Segregation

Positive signals:

- Many focused interfaces exist and are easy to mock.

Risk signals:

- Broad interfaces with high method count:
  - packages/contracts/src/assets/catalogs.ts -> ICatalogRepo (19 methods)
  - packages/contracts/src/equipmentGroups/index.ts -> IEquipmentGroupRepo (11 methods)
- Fake implementation burden:
  - packages/application/src/assets/CatalogService.test.helpers.ts has multiple Not implemented members to satisfy ICatalogRepo.
- Repository interfaces defined inside application services (10 files) can fragment contracts and reduce cohesion of abstraction boundaries:
  - examples in accessories, audit, checkout, components, consumables, depreciation, fieldKit, labels, licenses, wf services.

Assessment: ISP is below target in catalog-like and multi-domain service areas.

### D - Dependency Inversion

Positive signals:

- No reverse import evidence found for:
  - application importing infra package directly
  - domain importing application package
- Core services consume abstractions, not concrete repos, in multiple modules.
- Infra repo constructors often accept Queryable abstraction.

Risk signals:

- Some route modules still instantiate concrete repositories/services directly and embed data access.
  - This is acceptable in composition-root files, but less ideal when mixed with route handlers and SQL execution.

Assessment: DIP is strong overall, but composition-root discipline is not yet uniform.

## 4) Priority Findings (Impact-first)

### P0 - High Impact / Medium-High Effort

1. Split report aggregation mega-route into strategy registry + per-report handlers

- Problem:
  - 1001-line route couples key registry, SQL, mapping, pagination, drilldown, and endpoint concerns.
- Why high impact:
  - Reporting is cross-module and likely high churn.
  - Any new report currently increases blast radius and regression risk.
- Target:
  - Keep endpoint shell thin.
  - Move each report implementation into dedicated handler files.
  - Use ReportHandler interface + registry map.

2. Split permission center route into cohesive bounded route modules + service-level orchestration

- Problem:
  - Heavy SQL + transaction management inside route handlers.
- Why high impact:
  - Security/admin changes are sensitive; route-level SQL makes testing and review harder.
- Target:
  - Move query/transaction workflows to application service + repo methods.
  - Keep routes focused on authz, validation, response mapping.

### P1 - High Impact / Medium Effort

3. Decompose AuditService and LabelsService into use-case services

- Problem:
  - Large service classes with many operations and reasons to change.
- Why high impact:
  - Frequent feature updates in audit/labels can cause broad regressions.
- Target split examples:
  - AuditSessionService, AuditExecutionService, AuditDiscrepancyService, AuditReportingService.
  - LabelTemplateService, PrintJobService, LabelSettingsService, DocumentTemplateService.

4. Segregate ICatalogRepo (and other broad contracts) by use-case

- Problem:
  - Large interface forces fake implementations to carry unrelated methods.
- Why high impact:
  - Test maintainability and substitution quality decline over time.
- Target:
  - Read interfaces vs command interfaces.
  - Domain-specific sub-interfaces (VendorCatalogRepo, ModelCatalogRepo, LocationCatalogRepo).

### P2 - Medium Impact / Low-Medium Effort

5. Normalize contract ownership of repository interfaces

- Problem:
  - Multiple repository interfaces are declared in application services rather than contracts package.
- Why medium impact:
  - Abstraction consistency and discoverability are reduced.
- Target:
  - Move shared repository abstractions into packages/contracts.
  - Keep service-local private types only when truly module-private.

6. Introduce complexity guardrails in CI

- Suggested thresholds:
  - Route file <= 350 lines
  - Service file <= 400 lines
  - Interface <= 12 methods
  - Block PR if threshold exceeded without explicit architecture note

## 5) Recommended Refactor Backlog

## Phase 1 (1-2 weeks) - Quick wins

- Extract SQL helpers from permission-center route into repo methods.
- Introduce report handler registry and migrate 2-3 report keys first.
- Split ICatalogRepo into read/write facets without behavior change.
- Add architectural lint/check scripts for size/method thresholds.

Expected outcome:

- Immediate reduction in route complexity and merge conflict frequency.

## Phase 2 (2-4 weeks) - Structural cleanup

- Full migration of report aggregation into handler modules.
- Decompose AuditService into use-case services.
- Decompose LabelsService into template/print/settings/document sub-services.
- Move in-service repository interfaces to contracts where shared.

Expected outcome:

- Better SRP and OCP with lower regression risk.

## Phase 3 (4-8 weeks) - Hardening

- Add architecture tests for dependency direction.
- Expand unit test matrix around new service boundaries.
- Replace broad interface mocks with focused fake implementations.

Expected outcome:

- Stronger LSP/ISP and higher confidence in future extension work.

## 6) Suggested SOLID Targets for Next Audit

Target after refactor waves:

- S >= 3.8 / 5
- O >= 3.8 / 5
- L >= 4.0 / 5
- I >= 3.8 / 5
- D >= 4.3 / 5

Expected total target: >= 3.9 / 5

## 7) File-Level Evidence Index

- apps/api/src/routes/v1/reports/report-aggregation.routes.ts:22 (VALID_KEYS list)
- apps/api/src/routes/v1/reports/report-aggregation.routes.ts:81 (route entry)
- apps/api/src/routes/v1/reports/report-aggregation.routes.ts:162 (switch dispatcher)
- apps/api/src/routes/v1/reports/report-aggregation.routes.ts:179 (new key branch sample)
- apps/api/src/routes/v1/admin/permission-center.routes.ts:50 (route plugin start)
- apps/api/src/routes/v1/admin/permission-center.routes.ts:77 (service wiring + mixed concerns)
- apps/api/src/routes/v1/admin/permission-center.routes.ts:40,56,70,313+ (direct SQL/transaction flow)
- packages/application/src/audit/AuditService.ts:53 (local repository interface)
- packages/application/src/audit/AuditService.ts:119 (large service class)
- packages/application/src/labels/LabelsService.ts:34 (local repository interface)
- packages/application/src/labels/LabelsService.ts:70 (large service class)
- packages/contracts/src/assets/catalogs.ts:86 (ICatalogRepo - 19 methods)
- packages/application/src/assets/CatalogService.test.helpers.ts:19,35,36,37,46,47,69,87 (Not implemented burden)

---

If needed, the next step is to convert this audit into an implementation plan by module owner with concrete PR slices and acceptance criteria.
