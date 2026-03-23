import type { FastifyInstance } from 'fastify'
import type { PgClient } from '@qltb/infra-postgres'
import { DocumentRepo, LabelsRepository, OrganizationRepo } from '@qltb/infra-postgres'
import { DocumentService, LabelsService, OrganizationService } from '@qltb/application'
import { documentsRoute } from '../documents/documents.route.js'
import { labelsRoute } from '../labels/labels.route.js'
import { organizationsRoute } from '../organizations/organizations.route.js'

export async function registerContentContext(
    fastify: FastifyInstance,
    pgClient: PgClient
): Promise<void> {
    const documentRepo = new DocumentRepo(pgClient)
    const labelsRepo = new LabelsRepository(pgClient)
    const organizationRepo = new OrganizationRepo(pgClient)

    const documentService = new DocumentService(documentRepo)
    const labelsService = new LabelsService(labelsRepo)
    const organizationService = new OrganizationService(organizationRepo)

    await fastify.register(documentsRoute, { prefix: '/api/v1', documentService, pgClient })
    await fastify.register(labelsRoute, { prefix: '/api/v1', labelsService })
    await fastify.register(organizationsRoute, { prefix: '/api/v1', organizationService })
}
