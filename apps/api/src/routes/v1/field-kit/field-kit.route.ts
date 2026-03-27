import type { FastifyInstance } from 'fastify'
import type { FieldKitService } from '@qltb/application'
import {
    connectivitySchema,
    createApprovalSchema,
    createAuditEventSchema,
    createNoteSchema,
    createSnapshotSchema,
    deviceParamSchema,
    generatePlaybookSchema,
    runQuickCheckSchema,
    snippetsQuerySchema,
} from './field-kit.schema.js'

interface FieldKitRouteOptions {
    fieldKitService: FieldKitService
}

export async function fieldKitRoute(
    fastify: FastifyInstance,
    options: FieldKitRouteOptions
): Promise<void> {
    const { fieldKitService } = options

    fastify.post('/field-kit/quick-check', async (request, reply) => {
        const body = runQuickCheckSchema.parse(request.body)
        const data = await fieldKitService.runQuickCheck(body)
        return reply.send({ success: true, data })
    })

    fastify.get('/field-kit/:deviceId/quick-checks', async (request, reply) => {
        const { deviceId } = deviceParamSchema.parse(request.params)
        const data = await fieldKitService.listQuickChecks(deviceId)
        return reply.send({ success: true, data })
    })

    fastify.post('/field-kit/playbooks/generate', async (request, reply) => {
        const body = generatePlaybookSchema.parse(request.body)
        const data = await fieldKitService.generatePlaybook(body)
        return reply.send({ success: true, data })
    })

    fastify.get('/field-kit/:deviceId/playbooks', async (request, reply) => {
        const { deviceId } = deviceParamSchema.parse(request.params)
        const data = await fieldKitService.listPlaybooks(deviceId)
        return reply.send({ success: true, data })
    })

    fastify.get('/field-kit/snippets', async (request, reply) => {
        const { vendor } = snippetsQuerySchema.parse(request.query)
        const data = await fieldKitService.listSnippets(vendor)
        return reply.send({ success: true, data })
    })

    fastify.get('/field-kit/:deviceId/visualizer', async (request, reply) => {
        const { deviceId } = deviceParamSchema.parse(request.params)
        const data = await fieldKitService.getVisualizer(deviceId)
        return reply.send({ success: true, data })
    })

    fastify.post('/field-kit/snapshots', async (request, reply) => {
        const body = createSnapshotSchema.parse(request.body)
        const data = await fieldKitService.createSnapshot(body)
        return reply.send({ success: true, data })
    })

    fastify.get('/field-kit/:deviceId/snapshots', async (request, reply) => {
        const { deviceId } = deviceParamSchema.parse(request.params)
        const data = await fieldKitService.listSnapshots(deviceId)
        return reply.send({ success: true, data })
    })

    fastify.post('/field-kit/connectivity-plan', async (request, reply) => {
        const body = connectivitySchema.parse(request.body)
        const data = await fieldKitService.generateConnectivityPlan(body)
        return reply.send({ success: true, data })
    })

    fastify.post('/field-kit/notes', async (request, reply) => {
        const body = createNoteSchema.parse(request.body)
        const data = await fieldKitService.addNote(body)
        return reply.send({ success: true, data })
    })

    fastify.get('/field-kit/:deviceId/notes', async (request, reply) => {
        const { deviceId } = deviceParamSchema.parse(request.params)
        const data = await fieldKitService.listNotes(deviceId)
        return reply.send({ success: true, data })
    })

    fastify.post('/field-kit/approvals', async (request, reply) => {
        const body = createApprovalSchema.parse(request.body)
        const data = await fieldKitService.requestApproval(body)
        return reply.send({ success: true, data })
    })

    fastify.get('/field-kit/:deviceId/approvals', async (request, reply) => {
        const { deviceId } = deviceParamSchema.parse(request.params)
        const data = await fieldKitService.listApprovals(deviceId)
        return reply.send({ success: true, data })
    })

    fastify.post('/field-kit/audit-events', async (request, reply) => {
        const body = createAuditEventSchema.parse(request.body)
        const data = await fieldKitService.recordAudit(body)
        return reply.send({ success: true, data })
    })
}
