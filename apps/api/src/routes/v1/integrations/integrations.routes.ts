/**
 * Integration Hub Routes
 * Connectors, sync rules, webhooks
 */
import type { FastifyInstance } from 'fastify'
import type { IntegrationService } from '@qltb/application'
import { z } from 'zod'
import { getUserContext, requirePermission } from '../assets/assets.helpers.js'

interface IntegrationRoutesOptions {
    integrationService: IntegrationService
}

export async function integrationRoutes(
    fastify: FastifyInstance,
    opts: IntegrationRoutesOptions
): Promise<void> {
    const svc = opts.integrationService

    // --- Connectors ---
    fastify.post('/integrations/connectors', async (request, reply) => {
        const ctx = requirePermission(request, 'integrations:manage')
        const body = z.object({
            name: z.string().min(1),
            provider: z.enum(['servicenow', 'jira', 'slack', 'teams', 'aws', 'azure', 'email', 'webhook', 'csv_import', 'api_generic', 'zabbix']),
            config: z.record(z.unknown()).optional().default({}),
            credentialsRef: z.string().optional(),
            isActive: z.boolean().optional().default(false)
        }).parse(request.body)
        const connector = await svc.createConnector({ ...body, credentialsRef: body.credentialsRef ?? null, createdBy: ctx.userId })
        return reply.status(201).send({ data: connector })
    })

    fastify.get('/integrations/connectors', async (request, reply) => {
        requirePermission(request, 'integrations:read')
        const connectors = await svc.listConnectors()
        return reply.send({ data: connectors })
    })

    fastify.get('/integrations/connectors/:id', async (request, reply) => {
        requirePermission(request, 'integrations:read')
        const { id } = request.params as { id: string }
        const connector = await svc.getConnector(id)
        if (!connector) return reply.status(404).send({ error: 'Connector not found' })
        return reply.send({ data: connector })
    })

    fastify.put('/integrations/connectors/:id', async (request, reply) => {
        requirePermission(request, 'integrations:manage')
        const { id } = request.params as { id: string }
        const body = z.object({
            name: z.string().optional(),
            config: z.record(z.unknown()).optional(),
            isActive: z.boolean().optional()
        }).parse(request.body)
        const connector = await svc.updateConnector(id, body)
        if (!connector) return reply.status(404).send({ error: 'Connector not found' })
        return reply.send({ data: connector })
    })

    fastify.delete('/integrations/connectors/:id', async (request, reply) => {
        requirePermission(request, 'integrations:manage')
        const { id } = request.params as { id: string }
        await svc.deleteConnector(id)
        return reply.status(204).send()
    })

    fastify.post('/integrations/connectors/:id/test', async (request, reply) => {
        requirePermission(request, 'integrations:manage')
        const { id } = request.params as { id: string }
        const result = await svc.testConnection(id)
        return reply.send({ data: result })
    })

    // --- Sync Rules ---
    fastify.post('/integrations/connectors/:connectorId/sync-rules', async (request, reply) => {
        requirePermission(request, 'integrations:manage')
        const { connectorId } = request.params as { connectorId: string }
        const body = z.object({
            name: z.string().min(1),
            direction: z.enum(['inbound', 'outbound', 'bidirectional']).default('inbound'),
            entityType: z.string().min(1),
            fieldMappings: z.array(z.unknown()).optional().default([]),
            filterConditions: z.record(z.unknown()).optional().default({}),
            scheduleCron: z.string().optional(),
            isActive: z.boolean().optional().default(true)
        }).parse(request.body)
        const rule = await svc.createSyncRule({ ...body, connectorId, scheduleCron: body.scheduleCron ?? null })
        return reply.status(201).send({ data: rule })
    })

    fastify.get('/integrations/connectors/:connectorId/sync-rules', async (request, reply) => {
        requirePermission(request, 'integrations:read')
        const { connectorId } = request.params as { connectorId: string }
        const rules = await svc.listSyncRules(connectorId)
        return reply.send({ data: rules })
    })

    fastify.delete('/integrations/sync-rules/:id', async (request, reply) => {
        requirePermission(request, 'integrations:manage')
        const { id } = request.params as { id: string }
        await svc.deleteSyncRule(id)
        return reply.status(204).send()
    })

    // --- Webhooks ---
    fastify.post('/integrations/webhooks', async (request, reply) => {
        requirePermission(request, 'integrations:manage')
        const body = z.object({
            connectorId: z.string().uuid().optional(),
            name: z.string().min(1),
            url: z.string().url(),
            secret: z.string().optional(),
            events: z.array(z.string()).default([]),
            isActive: z.boolean().optional().default(true)
        }).parse(request.body)
        const webhook = await svc.createWebhook({
            name: body.name,
            url: body.url,
            eventTypes: body.events,
            secret: body.secret ?? null,
            isActive: body.isActive
        })
        return reply.status(201).send({ data: webhook })
    })

    fastify.get('/integrations/webhooks', async (request, reply) => {
        requirePermission(request, 'integrations:read')
        const webhooks = await svc.listWebhooks()
        return reply.send({ data: webhooks })
    })

    fastify.delete('/integrations/webhooks/:id', async (request, reply) => {
        requirePermission(request, 'integrations:manage')
        const { id } = request.params as { id: string }
        await svc.deleteWebhook(id)
        return reply.status(204).send()
    })

    // --- Provider Types (reference) ---
    fastify.get('/integrations/providers', async (request, reply) => {
        getUserContext(request)
        const providers = await svc.getProviderTypes()
        return reply.send({ data: providers })
    })

    // --- Manual Sync Trigger ---
    fastify.post('/integrations/connectors/:id/sync', async (request, reply) => {
        requirePermission(request, 'integrations:manage')
        const { id } = request.params as { id: string }
        const body = z.object({ syncRuleId: z.string().uuid().optional() }).parse(request.body ?? {})
        const result = await svc.triggerSync(id, body.syncRuleId)
        return reply.send({ data: result })
    })

    // --- Sync Logs ---
    fastify.get('/integrations/sync-rules/:id/logs', async (request, reply) => {
        requirePermission(request, 'integrations:read')
        const { id } = request.params as { id: string }
        const logs = await svc.getSyncLogs(id)
        return reply.send({ data: logs })
    })

    // --- Inbound Webhook (called by Zabbix, no JWT) ---
    fastify.post('/integrations/inbound/:connectorId', async (request, reply) => {
        const { connectorId } = request.params as { connectorId: string }

        const connector = await svc.getConnector(connectorId)
        if (!connector || !connector.isActive) {
            return reply.status(404).send({ error: 'Connector not found or inactive' })
        }

        // Verify HMAC-SHA256 if webhookSecret is configured
        const secret = (connector.config as Record<string, unknown>).webhookSecret as string | undefined
        if (secret) {
            const { createHmac } = await import('node:crypto')
            const sig = request.headers['x-zabbix-signature'] as string | undefined
            if (!sig) {
                return reply.status(401).send({ error: 'Missing X-Zabbix-Signature header' })
            }
            const expected = 'sha256=' + createHmac('sha256', secret)
                .update(JSON.stringify(request.body))
                .digest('hex')
            if (sig !== expected) {
                return reply.status(401).send({ error: 'Invalid signature' })
            }
        }

        const payload = z.object({
            event_id: z.string().optional(),
            trigger_id: z.string().optional(),
            trigger_name: z.string().optional(),
            trigger_severity: z.string().optional(),
            host_name: z.string().optional(),
            host_ip: z.string().optional(),
            problem_name: z.string(),
            event_recovery: z.string().optional().default('0'),
        }).parse(request.body)

        // Skip recovery events (problem resolved)
        if (payload.event_recovery === '1') {
            return reply.send({ data: { accepted: true, action: 'recovery_ignored' } })
        }

        const result = await svc.handleInboundAlert({
            connectorId,
            problemName: payload.problem_name,
            triggerName: payload.trigger_name ?? payload.problem_name,
            severity: payload.trigger_severity ?? '2',
            hostname: payload.host_name,
            hostIp: payload.host_ip,
        })
        return reply.send({ data: result })
    })
}
