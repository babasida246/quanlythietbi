/**
 * Consumables Module - API Routes (Clean Architecture)
 */
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { ConsumableService } from '@qltb/application';
import {
    createConsumableSchema,
    updateConsumableSchema,
    issueConsumableSchema,
    receiveConsumableSchema,
    consumableListQuerySchema,
    issueListQuerySchema,
    receiptListQuerySchema,
    idParamSchema,
    createCategorySchema,
    updateCategorySchema,
    createManufacturerSchema,
    updateManufacturerSchema,
    type CreateConsumableInput,
    type UpdateConsumableInput,
    type IssueConsumableInput,
    type ReceiveConsumableInput,
    type ConsumableListQueryInput
} from './consumables.schema.js';

export async function consumablesRoute(
    fastify: FastifyInstance,
    opts: { consumableService: ConsumableService }
): Promise<void> {
    const { consumableService } = opts;

    // ==================== Consumables CRUD ====================

    await fastify.register(async (consumableApp) => {

        // List consumables
        consumableApp.get('/', async (request: FastifyRequest<{ Querystring: ConsumableListQueryInput }>, reply) => {
            const parsed = consumableListQuerySchema.parse(request.query);
            const query = {
                ...parsed,
                status: parsed.status
                    ? (Array.isArray(parsed.status) ? parsed.status : [parsed.status])
                    : undefined
            };
            const result = await consumableService.listConsumables(query);
            return result;
        });

        // Get consumable by ID
        consumableApp.get('/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
            const { id } = idParamSchema.parse(request.params);
            const consumable = await consumableService.getConsumable(id);
            if (!consumable) {
                return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Consumable not found' } });
            }
            return consumable;
        });

        // Create consumable
        consumableApp.post('/', async (request: FastifyRequest<{ Body: CreateConsumableInput }>, reply) => {
            const data = createConsumableSchema.parse(request.body);
            const userId = request.user?.id ?? 'system';
            const consumable = await consumableService.createConsumable(data, userId);
            return reply.code(201).send(consumable);
        });

        // Update consumable
        consumableApp.patch('/:id', async (request: FastifyRequest<{ Params: { id: string }, Body: UpdateConsumableInput }>, reply) => {
            const { id } = idParamSchema.parse(request.params);
            const data = updateConsumableSchema.parse(request.body);
            const userId = request.user?.id ?? 'system';

            try {
                const consumable = await consumableService.updateConsumable(id, data, userId);
                if (!consumable) {
                    return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Consumable not found' } });
                }
                return consumable;
            } catch (error: unknown) {
                const message = error instanceof Error ? error.message : 'Unknown error';
                return reply.code(400).send({ error: { code: 'BAD_REQUEST', message } });
            }
        });

        // Delete consumable
        consumableApp.delete('/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
            const { id } = idParamSchema.parse(request.params);
            const userId = request.user?.id ?? 'system';

            try {
                await consumableService.deleteConsumable(id, userId);
                return reply.code(204).send();
            } catch (error: unknown) {
                const message = error instanceof Error ? error.message : 'Unknown error';
                if (message.includes('not found')) {
                    return reply.code(404).send({ error: { code: 'NOT_FOUND', message } });
                }
                return reply.code(400).send({ error: { code: 'BAD_REQUEST', message } });
            }
        });

        // Issue consumable
        consumableApp.post('/:id/issue', async (request: FastifyRequest<{ Params: { id: string }, Body: IssueConsumableInput }>, reply) => {
            const { id } = idParamSchema.parse(request.params);
            const data = issueConsumableSchema.parse(request.body);
            const userId = request.user?.id ?? 'system';

            try {
                const issue = await consumableService.issueConsumable(id, data, userId);
                return reply.code(201).send(issue);
            } catch (error: unknown) {
                const message = error instanceof Error ? error.message : 'Unknown error';
                return reply.code(400).send({ error: { code: 'BAD_REQUEST', message } });
            }
        });

        // Get issues for a consumable
        consumableApp.get('/:id/issues', async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
            const { id } = idParamSchema.parse(request.params);
            const query = issueListQuerySchema.parse(request.query);

            const consumable = await consumableService.getConsumable(id);
            if (!consumable) {
                return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Consumable not found' } });
            }

            const normalizedQuery = {
                ...query,
                issueType: query.issueType
                    ? (Array.isArray(query.issueType) ? query.issueType : [query.issueType])
                    : undefined
            };
            const result = await consumableService.getConsumableIssues(id, normalizedQuery);
            return result;
        });

        // Receive consumable
        consumableApp.post('/:id/receive', async (request: FastifyRequest<{ Params: { id: string }, Body: ReceiveConsumableInput }>, reply) => {
            const { id } = idParamSchema.parse(request.params);
            const data = receiveConsumableSchema.parse(request.body);
            const userId = request.user?.id ?? 'system';

            try {
                const receipt = await consumableService.receiveConsumable(id, data, userId);
                return reply.code(201).send(receipt);
            } catch (error: unknown) {
                const message = error instanceof Error ? error.message : 'Unknown error';
                return reply.code(400).send({ error: { code: 'BAD_REQUEST', message } });
            }
        });

        // Get receipts for a consumable
        consumableApp.get('/:id/receipts', async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
            const { id } = idParamSchema.parse(request.params);
            const query = receiptListQuerySchema.parse(request.query);

            const consumable = await consumableService.getConsumable(id);
            if (!consumable) {
                return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Consumable not found' } });
            }

            const normalizedQuery = {
                ...query,
                receiptType: query.receiptType
                    ? (Array.isArray(query.receiptType) ? query.receiptType : [query.receiptType])
                    : undefined
            };
            const result = await consumableService.getConsumableReceipts(id, normalizedQuery);
            return result;
        });

        // Stock alerts
        consumableApp.get('/alerts/low-stock', async (request, reply) => {
            const items = await consumableService.getLowStockItems();
            return { data: items, count: items.length };
        });

        consumableApp.get('/alerts/out-of-stock', async (request, reply) => {
            const items = await consumableService.getOutOfStockItems();
            return { data: items, count: items.length };
        });

        consumableApp.get('/summary/stock', async (request, reply) => {
            const summary = await consumableService.getStockSummary();
            return summary;
        });

    }, { prefix: '/consumables' });

    // ==================== Categories ====================

    await fastify.register(async (categoryApp) => {

        categoryApp.get('/', async (request: FastifyRequest<{ Querystring: { includeInactive?: string } }>, reply) => {
            const includeInactive = request.query.includeInactive === 'true';
            const categories = await consumableService.getCategories(!includeInactive);
            return { data: categories };
        });

        categoryApp.get('/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
            const { id } = idParamSchema.parse(request.params);
            const category = await consumableService.getCategory(id);
            if (!category) {
                return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Category not found' } });
            }
            return category;
        });

        categoryApp.post('/', async (request: FastifyRequest, reply) => {
            const data = createCategorySchema.parse(request.body);
            const userId = request.user?.id ?? 'system';
            const category = await consumableService.createCategory(data, userId);
            return reply.code(201).send(category);
        });

        categoryApp.patch('/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
            const { id } = idParamSchema.parse(request.params);
            const data = updateCategorySchema.parse(request.body);
            const userId = request.user?.id ?? 'system';

            const category = await consumableService.updateCategory(id, data, userId);
            if (!category) {
                return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Category not found' } });
            }
            return category;
        });

        categoryApp.delete('/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
            const { id } = idParamSchema.parse(request.params);
            const userId = request.user?.id ?? 'system';

            try {
                await consumableService.deleteCategory(id, userId);
                return reply.code(204).send();
            } catch (error: unknown) {
                const message = error instanceof Error ? error.message : 'Unknown error';
                if (message.includes('not found')) {
                    return reply.code(404).send({ error: { code: 'NOT_FOUND', message } });
                }
                return reply.code(400).send({ error: { code: 'BAD_REQUEST', message } });
            }
        });

    }, { prefix: '/consumable-categories' });

    // ==================== Manufacturers ====================

    await fastify.register(async (manufacturerApp) => {

        manufacturerApp.get('/', async (request: FastifyRequest<{ Querystring: { includeInactive?: string } }>, reply) => {
            const includeInactive = request.query.includeInactive === 'true';
            const manufacturers = await consumableService.getManufacturers(!includeInactive);
            return { data: manufacturers };
        });

        manufacturerApp.get('/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
            const { id } = idParamSchema.parse(request.params);
            const manufacturer = await consumableService.getManufacturer(id);
            if (!manufacturer) {
                return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Manufacturer not found' } });
            }
            return manufacturer;
        });

        manufacturerApp.post('/', async (request: FastifyRequest, reply) => {
            const data = createManufacturerSchema.parse(request.body);
            const userId = request.user?.id ?? 'system';
            const manufacturer = await consumableService.createManufacturer(data, userId);
            return reply.code(201).send(manufacturer);
        });

        manufacturerApp.patch('/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
            const { id } = idParamSchema.parse(request.params);
            const data = updateManufacturerSchema.parse(request.body);
            const userId = request.user?.id ?? 'system';

            const manufacturer = await consumableService.updateManufacturer(id, data, userId);
            if (!manufacturer) {
                return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Manufacturer not found' } });
            }
            return manufacturer;
        });

        manufacturerApp.delete('/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
            const { id } = idParamSchema.parse(request.params);
            const userId = request.user?.id ?? 'system';

            try {
                await consumableService.deleteManufacturer(id, userId);
                return reply.code(204).send();
            } catch (error: unknown) {
                const message = error instanceof Error ? error.message : 'Unknown error';
                if (message.includes('not found')) {
                    return reply.code(404).send({ error: { code: 'NOT_FOUND', message } });
                }
                return reply.code(400).send({ error: { code: 'BAD_REQUEST', message } });
            }
        });

    }, { prefix: '/consumable-manufacturers' });
}
