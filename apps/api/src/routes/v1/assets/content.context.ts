import type { FastifyInstance } from 'fastify'
import type { PgClient } from '@qltb/infra-postgres'
import { DocumentRepo, FieldKitRepo, LabelsRepository, OrganizationRepo } from '@qltb/infra-postgres'
import { DocumentService, DocxRenderService, FieldKitService, LabelsService, OrganizationService, PrintService } from '@qltb/application'
import { documentsRoute } from '../documents/documents.route.js'
import { fieldKitRoute } from '../field-kit/field-kit.route.js'
import { labelsRoute } from '../labels/labels.route.js'
import { organizationsRoute } from '../organizations/organizations.route.js'
import { userRoute } from '../user/user.routes.js'
import { printRoute } from '../print/print.route.js'

export async function registerContentContext(
    fastify: FastifyInstance,
    pgClient: PgClient
): Promise<void> {
    const documentRepo = new DocumentRepo(pgClient)
    const fieldKitRepo = new FieldKitRepo(pgClient)
    const labelsRepo = new LabelsRepository(pgClient)
    const organizationRepo = new OrganizationRepo(pgClient)

    const documentService = new DocumentService(documentRepo)
    const fieldKitService = new FieldKitService(fieldKitRepo)
    const labelsService = new LabelsService(labelsRepo)
    const organizationService = new OrganizationService(organizationRepo)
    const printService = new PrintService()
    const docxRenderService = new DocxRenderService()

    await fastify.register(documentsRoute, { prefix: '/api/v1', documentService, pgClient })
    await fastify.register(fieldKitRoute, { prefix: '/api/v1', fieldKitService })
    await fastify.register(labelsRoute, { prefix: '/api/v1', labelsService, labelsRepo })
    await fastify.register(organizationsRoute, { prefix: '/api/v1', organizationService })
    await fastify.register(userRoute, { prefix: '/api/v1', pgClient })
    await fastify.register(printRoute, { prefix: '/api/v1', printService, docxRenderService, labelsRepo })
}
