/**
 * Consumables Module - API Routes
 */
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { ConsumableService } from './consumable.service.js';
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
} from './consumable.schemas.js';
import type { AuthService } from '../auth/index.js';

export async function consumableRoutes(
    fastify: FastifyInstance,
    service: ConsumableService,
    authService: AuthService
): Promise<void> {

    // Auth middleware
    const authenticate = async (request: FastifyRequest, reply: FastifyReply) => {
        const authHeader = request.headers.authorization;
        if (!authHeader?.startsWith('Bearer ')) {
            reply.code(401).send({ error: { code: 'UNAUTHORIZED', message: 'Missing authorization' } });
            return;
        }
        const token = authHeader.substring(7);
        const payload = await authService.verifyAccessToken(token);
        if (!payload) {
            reply.code(401).send({ error: { code: 'UNAUTHORIZED', message: 'Invalid token' } });
            return;
        }
        (request as any).user = payload;
    };

    // ==================== Consumables CRUD ====================

    await fastify.register(async (consumableApp) => {
        consumableApp.addHook('preHandler', authenticate);

        // List consumables
        consumableApp.get('/', {
            schema: {
                tags: ['Consumables'],
                summary: 'List consumables',
                description: 'Get paginated list of consumables with optional filters',
                querystring: zodToJsonSchema(consumableListQuerySchema),
                response: {
                    200: {
                        type: 'object',
                        properties: {
                            data: { type: 'array' },
                            pagination: {
                                type: 'object',
                                properties: {
                                    page: { type: 'number' },
                                    limit: { type: 'number' },
                                    total: { type: 'number' },
                                    totalPages: { type: 'number' }
                                }
                            }
                        }
                    }
                }
            }
        }, async (request: FastifyRequest<{ Querystring: ConsumableListQueryInput }>, reply) => {
            const parsed = consumableListQuerySchema.parse(request.query);
            // Normalize status to always be an array
            const query = {
                ...parsed,
                status: parsed.status
                    ? (Array.isArray(parsed.status) ? parsed.status : [parsed.status])
                    : undefined
            };
            const result = await service.listConsumables(query);
            return result;
        });

        // Get consumable by ID
        consumableApp.get('/:id', {
            schema: {
                tags: ['Consumables'],
                summary: 'Get consumable by ID',
                params: zodToJsonSchema(idParamSchema)
            }
        }, async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
            const { id } = idParamSchema.parse(request.params);
            const consumable = await service.getConsumable(id);
            if (!consumable) {
                return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Consumable not found' } });
            }
            return consumable;
        });

        // Create consumable
        consumableApp.post('/', {
            schema: {
                tags: ['Consumables'],
                summary: 'Create new consumable',
                body: zodToJsonSchema(createConsumableSchema)
            }
        }, async (request: FastifyRequest<{ Body: CreateConsumableInput }>, reply) => {
            const data = createConsumableSchema.parse(request.body);
            const userId = (request as any).user?.sub || 'system';
            const consumable = await service.createConsumable(data, userId);
            return reply.code(201).send(consumable);
        });

        // Update consumable
        consumableApp.patch('/:id', {
            schema: {
                tags: ['Consumables'],
                summary: 'Update consumable',
                params: zodToJsonSchema(idParamSchema),
                body: zodToJsonSchema(updateConsumableSchema)
            }
        }, async (request: FastifyRequest<{ Params: { id: string }, Body: UpdateConsumableInput }>, reply) => {
            const { id } = idParamSchema.parse(request.params);
            const data = updateConsumableSchema.parse(request.body);
            const userId = (request as any).user?.sub || 'system';

            try {
                const consumable = await service.updateConsumable(id, data, userId);
                if (!consumable) {
                    return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Consumable not found' } });
                }
                return consumable;
            } catch (error: any) {
                return reply.code(400).send({ error: { code: 'BAD_REQUEST', message: error.message } });
            }
        });

        // Delete consumable
        consumableApp.delete('/:id', {
            schema: {
                tags: ['Consumables'],
                summary: 'Delete consumable',
                params: zodToJsonSchema(idParamSchema)
            }
        }, async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
            const { id } = idParamSchema.parse(request.params);
            const userId = (request as any).user?.sub || 'system';

            try {
                await service.deleteConsumable(id, userId);
                return reply.code(204).send();
            } catch (error: any) {
                if (error.message.includes('not found')) {
                    return reply.code(404).send({ error: { code: 'NOT_FOUND', message: error.message } });
                }
                return reply.code(400).send({ error: { code: 'BAD_REQUEST', message: error.message } });
            }
        });

        // ==================== Issue Operations ====================

        // Issue consumable
        consumableApp.post('/:id/issue', {
            schema: {
                tags: ['Consumables'],
                summary: 'Issue consumable from stock',
                description: 'Issue consumable to user, department, asset, or general use',
                params: zodToJsonSchema(idParamSchema),
                body: zodToJsonSchema(issueConsumableSchema)
            }
        }, async (request: FastifyRequest<{ Params: { id: string }, Body: IssueConsumableInput }>, reply) => {
            const { id } = idParamSchema.parse(request.params);
            const data = issueConsumableSchema.parse(request.body);
            const userId = (request as any).user?.sub || 'system';

            try {
                const issue = await service.issueConsumable(id, data, userId);
                return reply.code(201).send(issue);
            } catch (error: any) {
                return reply.code(400).send({ error: { code: 'BAD_REQUEST', message: error.message } });
            }
        });

        // Get issues for a consumable
        consumableApp.get('/:id/issues', {
            schema: {
                tags: ['Consumables'],
                summary: 'Get issue history for consumable',
                params: zodToJsonSchema(idParamSchema),
                querystring: zodToJsonSchema(issueListQuerySchema)
            }
        }, async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
            const { id } = idParamSchema.parse(request.params);
            const query = issueListQuerySchema.parse(request.query);

            const consumable = await service.getConsumable(id);
            if (!consumable) {
                return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Consumable not found' } });
            }

            // Normalize issueType to array
            const normalizedQuery = {
                ...query,
                issueType: query.issueType
                    ? (Array.isArray(query.issueType) ? query.issueType : [query.issueType])
                    : undefined
            };
            const result = await service.getConsumableIssues(id, normalizedQuery);
            return result;
        });

        // ==================== Receipt Operations ====================

        // Receive consumable
        consumableApp.post('/:id/receive', {
            schema: {
                tags: ['Consumables'],
                summary: 'Receive consumable into stock',
                description: 'Add consumable items to inventory',
                params: zodToJsonSchema(idParamSchema),
                body: zodToJsonSchema(receiveConsumableSchema)
            }
        }, async (request: FastifyRequest<{ Params: { id: string }, Body: ReceiveConsumableInput }>, reply) => {
            const { id } = idParamSchema.parse(request.params);
            const data = receiveConsumableSchema.parse(request.body);
            const userId = (request as any).user?.sub || 'system';

            try {
                const receipt = await service.receiveConsumable(id, data, userId);
                return reply.code(201).send(receipt);
            } catch (error: any) {
                return reply.code(400).send({ error: { code: 'BAD_REQUEST', message: error.message } });
            }
        });

        // Get receipts for a consumable
        consumableApp.get('/:id/receipts', {
            schema: {
                tags: ['Consumables'],
                summary: 'Get receipt history for consumable',
                params: zodToJsonSchema(idParamSchema),
                querystring: zodToJsonSchema(receiptListQuerySchema)
            }
        }, async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
            const { id } = idParamSchema.parse(request.params);
            const query = receiptListQuerySchema.parse(request.query);

            const consumable = await service.getConsumable(id);
            if (!consumable) {
                return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Consumable not found' } });
            }

            // Normalize receiptType to array
            const normalizedQuery = {
                ...query,
                receiptType: query.receiptType
                    ? (Array.isArray(query.receiptType) ? query.receiptType : [query.receiptType])
                    : undefined
            };
            const result = await service.getConsumableReceipts(id, normalizedQuery);
            return result;
        });

        // ==================== Stock Alerts ====================

        // Get low stock items
        consumableApp.get('/alerts/low-stock', {
            schema: {
                tags: ['Consumables'],
                summary: 'Get low stock consumables',
                description: 'Items where quantity is at or below reorder point'
            }
        }, async (request, reply) => {
            const items = await service.getLowStockItems();
            return { data: items, count: items.length };
        });

        // Get out of stock items
        consumableApp.get('/alerts/out-of-stock', {
            schema: {
                tags: ['Consumables'],
                summary: 'Get out of stock consumables',
                description: 'Items with zero quantity'
            }
        }, async (request, reply) => {
            const items = await service.getOutOfStockItems();
            return { data: items, count: items.length };
        });

        // Get stock summary
        consumableApp.get('/summary/stock', {
            schema: {
                tags: ['Consumables'],
                summary: 'Get stock summary',
                description: 'Overview of consumable stock levels'
            }
        }, async (request, reply) => {
            const summary = await service.getStockSummary();
            return summary;
        });

    }, { prefix: '/consumables' });

    // ==================== Categories ====================

    await fastify.register(async (categoryApp) => {
        categoryApp.addHook('preHandler', authenticate);

        // List categories
        categoryApp.get('/', {
            schema: {
                tags: ['Consumable Categories'],
                summary: 'List consumable categories'
            }
        }, async (request: FastifyRequest<{ Querystring: { includeInactive?: string } }>, reply) => {
            const includeInactive = request.query.includeInactive === 'true';
            const categories = await service.getCategories(!includeInactive);
            return { data: categories };
        });

        // Get category by ID
        categoryApp.get('/:id', {
            schema: {
                tags: ['Consumable Categories'],
                summary: 'Get category by ID',
                params: zodToJsonSchema(idParamSchema)
            }
        }, async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
            const { id } = idParamSchema.parse(request.params);
            const category = await service.getCategory(id);
            if (!category) {
                return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Category not found' } });
            }
            return category;
        });

        // Create category
        categoryApp.post('/', {
            schema: {
                tags: ['Consumable Categories'],
                summary: 'Create new category',
                body: zodToJsonSchema(createCategorySchema)
            }
        }, async (request: FastifyRequest, reply) => {
            const data = createCategorySchema.parse(request.body);
            const userId = (request as any).user?.sub || 'system';
            const category = await service.createCategory(data, userId);
            return reply.code(201).send(category);
        });

        // Update category
        categoryApp.patch('/:id', {
            schema: {
                tags: ['Consumable Categories'],
                summary: 'Update category',
                params: zodToJsonSchema(idParamSchema),
                body: zodToJsonSchema(updateCategorySchema)
            }
        }, async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
            const { id } = idParamSchema.parse(request.params);
            const data = updateCategorySchema.parse(request.body);
            const userId = (request as any).user?.sub || 'system';

            const category = await service.updateCategory(id, data, userId);
            if (!category) {
                return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Category not found' } });
            }
            return category;
        });

        // Delete category
        categoryApp.delete('/:id', {
            schema: {
                tags: ['Consumable Categories'],
                summary: 'Delete category',
                params: zodToJsonSchema(idParamSchema)
            }
        }, async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
            const { id } = idParamSchema.parse(request.params);
            const userId = (request as any).user?.sub || 'system';

            try {
                await service.deleteCategory(id, userId);
                return reply.code(204).send();
            } catch (error: any) {
                if (error.message.includes('not found')) {
                    return reply.code(404).send({ error: { code: 'NOT_FOUND', message: error.message } });
                }
                return reply.code(400).send({ error: { code: 'BAD_REQUEST', message: error.message } });
            }
        });

    }, { prefix: '/consumable-categories' });

    // ==================== Manufacturers ====================

    await fastify.register(async (manufacturerApp) => {
        manufacturerApp.addHook('preHandler', authenticate);

        // List manufacturers
        manufacturerApp.get('/', {
            schema: {
                tags: ['Consumable Manufacturers'],
                summary: 'List consumable manufacturers'
            }
        }, async (request: FastifyRequest<{ Querystring: { includeInactive?: string } }>, reply) => {
            const includeInactive = request.query.includeInactive === 'true';
            const manufacturers = await service.getManufacturers(!includeInactive);
            return { data: manufacturers };
        });

        // Get manufacturer by ID
        manufacturerApp.get('/:id', {
            schema: {
                tags: ['Consumable Manufacturers'],
                summary: 'Get manufacturer by ID',
                params: zodToJsonSchema(idParamSchema)
            }
        }, async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
            const { id } = idParamSchema.parse(request.params);
            const manufacturer = await service.getManufacturer(id);
            if (!manufacturer) {
                return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Manufacturer not found' } });
            }
            return manufacturer;
        });

        // Create manufacturer
        manufacturerApp.post('/', {
            schema: {
                tags: ['Consumable Manufacturers'],
                summary: 'Create new manufacturer',
                body: zodToJsonSchema(createManufacturerSchema)
            }
        }, async (request: FastifyRequest, reply) => {
            const data = createManufacturerSchema.parse(request.body);
            const userId = (request as any).user?.sub || 'system';
            const manufacturer = await service.createManufacturer(data, userId);
            return reply.code(201).send(manufacturer);
        });

        // Update manufacturer
        manufacturerApp.patch('/:id', {
            schema: {
                tags: ['Consumable Manufacturers'],
                summary: 'Update manufacturer',
                params: zodToJsonSchema(idParamSchema),
                body: zodToJsonSchema(updateManufacturerSchema)
            }
        }, async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
            const { id } = idParamSchema.parse(request.params);
            const data = updateManufacturerSchema.parse(request.body);
            const userId = (request as any).user?.sub || 'system';

            const manufacturer = await service.updateManufacturer(id, data, userId);
            if (!manufacturer) {
                return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Manufacturer not found' } });
            }
            return manufacturer;
        });

        // Delete manufacturer
        manufacturerApp.delete('/:id', {
            schema: {
                tags: ['Consumable Manufacturers'],
                summary: 'Delete manufacturer',
                params: zodToJsonSchema(idParamSchema)
            }
        }, async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
            const { id } = idParamSchema.parse(request.params);
            const userId = (request as any).user?.sub || 'system';

            try {
                await service.deleteManufacturer(id, userId);
                return reply.code(204).send();
            } catch (error: any) {
                if (error.message.includes('not found')) {
                    return reply.code(404).send({ error: { code: 'NOT_FOUND', message: error.message } });
                }
                return reply.code(400).send({ error: { code: 'BAD_REQUEST', message: error.message } });
            }
        });

    }, { prefix: '/consumable-manufacturers' });
}
