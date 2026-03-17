import type { FastifyInstance } from 'fastify'
import type { PgClient } from '@qltb/infra-postgres'
import {
    AccessoryRepo,
    AuditRepo,
    CheckoutRepo,
    ComponentRepo,
    ConsumableRepo,
    DepreciationRepo,
    LicenseRepo,
    WfRepo,
    WfApproverResolverRepo
} from '@qltb/infra-postgres'
import {
    AccessoryService,
    AuditService,
    CheckoutService,
    ComponentService,
    ConsumableService,
    DepreciationService,
    LicenseService,
    WfService
} from '@qltb/application'
import { accessoriesRoute } from '../accessories/accessories.route.js'
import { auditRoute } from '../audit/audit.route.js'
import { checkoutRoute } from '../checkout/checkout.route.js'
import { componentsRoute } from '../components/components.route.js'
import { consumablesRoute } from '../consumables/consumables.route.js'
import { depreciationRoute } from '../depreciation/depreciation.route.js'
import { licensesRoute } from '../licenses/licenses.route.js'
import { wfRoute } from '../wf/wf.route.js'

export async function registerInventoryContext(
    fastify: FastifyInstance,
    pgClient: PgClient
): Promise<void> {
    const accessoryRepo = new AccessoryRepo(pgClient)
    const auditRepo = new AuditRepo(pgClient)
    const checkoutRepo = new CheckoutRepo(pgClient)
    const componentRepo = new ComponentRepo(pgClient)
    const consumableRepo = new ConsumableRepo(pgClient)
    const depreciationRepo = new DepreciationRepo(pgClient)
    const licenseRepo = new LicenseRepo(pgClient)
    const wfRepo = new WfRepo(pgClient)
    const wfApproverResolverRepo = new WfApproverResolverRepo(pgClient)

    const accessoryService = new AccessoryService(accessoryRepo)
    const auditService = new AuditService(auditRepo)
    const checkoutService = new CheckoutService(checkoutRepo)
    const componentService = new ComponentService(componentRepo)
    const consumableService = new ConsumableService(consumableRepo)
    const depreciationService = new DepreciationService(depreciationRepo)
    const licenseService = new LicenseService(licenseRepo)
    const wfService = new WfService(wfRepo, wfApproverResolverRepo)

    await fastify.register(accessoriesRoute, { prefix: '/api/v1', accessoryService })
    await fastify.register(auditRoute, { prefix: '/api/v1', auditService })
    await fastify.register(checkoutRoute, { prefix: '/api/v1', checkoutService })
    await fastify.register(componentsRoute, { prefix: '/api/v1', componentService })
    await fastify.register(consumablesRoute, { prefix: '/api/v1', consumableService })
    await fastify.register(depreciationRoute, { prefix: '/api/v1', depreciationService })
    await fastify.register(licensesRoute, { prefix: '/api/v1', licenseService })
    await fastify.register(wfRoute, { prefix: '/api/v1', wfService })
}
