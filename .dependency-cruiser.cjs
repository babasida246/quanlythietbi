/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'no-circular',
      severity: 'error',
      comment: 'Phat hien vong phu thuoc giua cac module.',
      from: {},
      to: { circular: true }
    },
    {
      name: 'no-test-imports-into-runtime',
      severity: 'error',
      comment: 'Code runtime khong duoc import tu file test/spec.',
      from: {
        pathNot: [
          '(^|/)tests?/',
          '[.](?:spec|test)[.](?:[cm]?[jt]sx?)$'
        ]
      },
      to: {
        path: '[.](?:spec|test)[.](?:[cm]?[jt]sx?)$'
      }
    },
    {
      name: 'domain-should-not-depend-on-upper-layers',
      severity: 'error',
      comment: 'packages/domain phai doc lap voi application, infra va apps.',
      from: { path: '^packages/domain/src/' },
      to: { path: '^(packages/application|packages/infra-postgres|apps)/' }
    },
    {
      name: 'contracts-should-not-depend-on-app-or-infra',
      severity: 'error',
      comment: 'packages/contracts chi dinh nghia contracts, khong phu thuoc app/infra.',
      from: { path: '^packages/contracts/src/' },
      to: { path: '^(packages/application|packages/infra-postgres|apps)/' }
    },
    {
      name: 'application-should-not-depend-on-apps',
      severity: 'error',
      comment: 'packages/application khong nen import truc tiep tu apps/.',
      from: { path: '^packages/application/src/' },
      to: { path: '^apps/' }
    },
    {
      name: 'api-routes-should-not-import-infra-directly',
      severity: 'error',
      comment: 'Route nen di qua application service thay vi import infra truc tiep.',
      from: { path: '^apps/api/src/routes/' },
      to: { path: '^packages/infra-postgres/src/' }
    },
    {
      name: 'web-ui-should-not-import-api-source',
      severity: 'error',
      comment: 'apps/web-ui khong duoc import truc tiep source code tu apps/api.',
      from: { path: '^apps/web-ui/src/' },
      to: { path: '^apps/api/src/' }
    },
    {
      name: 'not-to-unresolvable',
      severity: 'error',
      comment: 'Import khong resolve duoc.',
      from: {},
      to: { couldNotResolve: true }
    }
  ],
  options: {
    doNotFollow: {
      path: ['(^|/)node_modules/']
    },
    includeOnly: ['^(apps|packages)/'],
    exclude: {
      path: [
        '(^|/)dist/',
        '(^|/)build/',
        '(^|/)coverage/',
        '(^|/)tests?/',
        '[.](?:spec|test)[.](?:[cm]?[jt]sx?)$',
        '[.]svelte$',
        '(^|/)playwright-report/',
        '(^|/)test-results/',
        '(^|/)artifacts/'
      ]
    },
    tsPreCompilationDeps: true,
    tsConfig: {
      fileName: 'tsconfig.base.json'
    },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default', 'types'],
      extensions: ['.ts', '.tsx', '.mts', '.cts', '.js', '.mjs', '.cjs', '.svelte', '.d.ts'],
      mainFields: ['module', 'main', 'types', 'typings']
    },
    reporterOptions: {
      text: {
        highlightFocused: true
      },
      dot: {
        collapsePattern: '^(apps|packages)/[^/]+'
      }
    }
  }
};
