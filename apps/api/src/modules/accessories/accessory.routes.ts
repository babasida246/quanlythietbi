/**
 * Accessories Module - API Routes
 */
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { AccessoryService } from './accessory.service.js';
import {
    createAccessorySchema,
    updateAccessorySchema,
    checkoutAccessorySchema,
    checkinAccessorySchema,
    adjustStockSchema,
    accessoryListQuerySchema,
    idParamSchema,
    checkoutIdParamSchema,
    createCategorySchema,
    createManufacturerSchema,
    type CreateAccessoryInput,
    type UpdateAccessoryInput,
    type CheckoutAccessoryInput,
    type CheckinAccessoryInput,
    type AdjustStockInput,
    type AccessoryListQueryInput
} from './accessory.schemas.js';
import type { AuthService } from '../auth/index.js';

export async function accessoryRoutes(
    fastify: FastifyInstance,
    service: AccessoryService,
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

    // ==================== Accessories CRUD ====================

    await fastify.register(async (accessoryApp) => {
        accessoryApp.addHook('preHandler', authenticate);

        // List accessories
        accessoryApp.get('/', {
            schema: {
                tags: ['Accessories'],
                summary: 'List accessories',
                description: 'Get paginated list of accessories with optional filters',
                querystring: zodToJsonSchema(accessoryListQuerySchema),
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
        }, async (request: FastifyRequest<{ Querystring: AccessoryListQueryInput }>, reply) => {
            const parsed = accessoryListQuerySchema.parse(request.query);
            // Normalize status to always be an array
            const query = {
                ...parsed,
                status: parsed.status
                    ? (Array.isArray(parsed.status) ? parsed.status : [parsed.status])
                    : undefined
            };
            const result = await service.listAccessories(query);
            return result;
        });

        // Get accessory by ID
        accessoryApp.get('/:id', {
            schema: {
                tags: ['Accessories'],
                summary: 'Get accessory by ID',
                params: zodToJsonSchema(idParamSchema)
            }
        }, async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
            const { id } = idParamSchema.parse(request.params);
            const accessory = await service.getAccessory(id);
            if (!accessory) {
                return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Accessory not found' } });
            }
            return accessory;
        });

        // Create accessory
        accessoryApp.post('/', {
            schema: {
                tags: ['Accessories'],
                summary: 'Create new accessory',
                body: zodToJsonSchema(createAccessorySchema)
            }
        }, async (request: FastifyRequest<{ Body: CreateAccessoryInput }>, reply) => {
            const data = createAccessorySchema.parse(request.body);
            const userId = (request as any).user?.sub || 'system';
            const accessory = await service.createAccessory(data, userId);
            return reply.code(201).send(accessory);
        });

        // Update accessory
        accessoryApp.patch('/:id', {
            schema: {
                tags: ['Accessories'],
                summary: 'Update accessory',
                params: zodToJsonSchema(idParamSchema),
                body: zodToJsonSchema(updateAccessorySchema)
            }
        }, async (request: FastifyRequest<{ Params: { id: string }, Body: UpdateAccessoryInput }>, reply) => {
            const { id } = idParamSchema.parse(request.params);
            const data = updateAccessorySchema.parse(request.body);
            const userId = (request as any).user?.sub || 'system';

            try {
                const accessory = await service.updateAccessory(id, data, userId);
                if (!accessory) {
                    return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Accessory not found' } });
                }
                return accessory;
            } catch (error: any) {
                return reply.code(400).send({ error: { code: 'BAD_REQUEST', message: error.message } });
            }
        });

        // Delete accessory
        accessoryApp.delete('/:id', {
            schema: {
                tags: ['Accessories'],
                summary: 'Delete accessory',
                params: zodToJsonSchema(idParamSchema)
            }
        }, async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
            const { id } = idParamSchema.parse(request.params);
            const userId = (request as any).user?.sub || 'system';

            try {
                const deleted = await service.deleteAccessory(id, userId);
                if (!deleted) {
                    return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Accessory not found' } });
                }
                return reply.code(204).send();
            } catch (error: any) {
                return reply.code(400).send({ error: { code: 'BAD_REQUEST', message: error.message } });
            }
        });

        // ==================== Checkout Operations ====================

        // Checkout accessory
        accessoryApp.post('/:id/checkout', {
            schema: {
                tags: ['Accessories'],
                summary: 'Checkout accessory to user or asset',
                params: zodToJsonSchema(idParamSchema),
                body: zodToJsonSchema(checkoutAccessorySchema)
            }
        }, async (request: FastifyRequest<{ Params: { id: string }, Body: CheckoutAccessoryInput }>, reply) => {
            const { id } = idParamSchema.parse(request.params);
            const data = checkoutAccessorySchema.parse(request.body);
            const userId = (request as any).user?.sub || 'system';

            try {
                const checkout = await service.checkoutAccessory({
                    ...data,
                    accessoryId: id
                }, userId);
                return reply.code(201).send(checkout);
            } catch (error: any) {
                return reply.code(400).send({ error: { code: 'BAD_REQUEST', message: error.message } });
            }
        });

        // Get checkouts for accessory
        accessoryApp.get('/:id/checkouts', {
            schema: {
                tags: ['Accessories'],
                summary: 'Get checkouts for an accessory',
                params: zodToJsonSchema(idParamSchema)
            }
        }, async (request: FastifyRequest<{ Params: { id: string }, Querystring: { active?: string } }>, reply) => {
            const { id } = idParamSchema.parse(request.params);
            const activeOnly = request.query.active === 'true';
            const checkouts = await service.getCheckouts(id, activeOnly);
            return { data: checkouts, total: checkouts.length };
        });

        // Checkin accessory
        accessoryApp.post('/:id/checkouts/:checkoutId/checkin', {
            schema: {
                tags: ['Accessories'],
                summary: 'Checkin (return) checked out accessory',
                params: zodToJsonSchema(checkoutIdParamSchema),
                body: zodToJsonSchema(checkinAccessorySchema)
            }
        }, async (request: FastifyRequest<{ Params: { id: string, checkoutId: string }, Body: CheckinAccessoryInput }>, reply) => {
            const { checkoutId } = checkoutIdParamSchema.parse(request.params);
            const data = checkinAccessorySchema.parse(request.body);
            const userId = (request as any).user?.sub || 'system';

            try {
                const checkout = await service.checkinAccessory(
                    checkoutId,
                    data.quantityReturned,
                    data.notes || null,
                    userId
                );
                return checkout;
            } catch (error: any) {
                return reply.code(400).send({ error: { code: 'BAD_REQUEST', message: error.message } });
            }
        });

        // ==================== Stock Adjustments ====================

        // Adjust stock
        accessoryApp.post('/:id/adjust-stock', {
            schema: {
                tags: ['Accessories'],
                summary: 'Adjust accessory stock (purchase, lost, damaged, etc.)',
                params: zodToJsonSchema(idParamSchema),
                body: zodToJsonSchema(adjustStockSchema)
            }
        }, async (request: FastifyRequest<{ Params: { id: string }, Body: AdjustStockInput }>, reply) => {
            const { id } = idParamSchema.parse(request.params);
            const data = adjustStockSchema.parse(request.body);
            const userId = (request as any).user?.sub || 'system';

            try {
                const adjustment = await service.adjustStock({
                    ...data,
                    accessoryId: id
                }, userId);
                return reply.code(201).send(adjustment);
            } catch (error: any) {
                return reply.code(400).send({ error: { code: 'BAD_REQUEST', message: error.message } });
            }
        });

        // Get stock adjustments
        accessoryApp.get('/:id/adjustments', {
            schema: {
                tags: ['Accessories'],
                summary: 'Get stock adjustment history',
                params: zodToJsonSchema(idParamSchema)
            }
        }, async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
            const { id } = idParamSchema.parse(request.params);
            const adjustments = await service.getStockAdjustments(id);
            return { data: adjustments, total: adjustments.length };
        });

        // ==================== Audit Logs ====================

        accessoryApp.get('/:id/audit', {
            schema: {
                tags: ['Accessories'],
                summary: 'Get audit logs for an accessory',
                params: zodToJsonSchema(idParamSchema)
            }
        }, async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
            const { id } = idParamSchema.parse(request.params);
            const logs = await service.getAuditLogs(id);
            return { data: logs, total: logs.length };
        });

        // ==================== Alerts & Summary ====================

        accessoryApp.get('/alerts/low-stock', {
            schema: {
                tags: ['Accessories'],
                summary: 'Get accessories with low stock'
            }
        }, async (request, reply) => {
            const items = await service.getLowStockItems();
            return { data: items, total: items.length };
        });

        accessoryApp.get('/alerts/out-of-stock', {
            schema: {
                tags: ['Accessories'],
                summary: 'Get out of stock accessories'
            }
        }, async (request, reply) => {
            const items = await service.getOutOfStockItems();
            return { data: items, total: items.length };
        });

        accessoryApp.get('/alerts/overdue', {
            schema: {
                tags: ['Accessories'],
                summary: 'Get overdue checkouts'
            }
        }, async (request, reply) => {
            const checkouts = await service.getOverdueCheckouts();
            return { data: checkouts, total: checkouts.length };
        });

        accessoryApp.get('/summary/stock', {
            schema: {
                tags: ['Accessories'],
                summary: 'Get stock summary'
            }
        }, async (request, reply) => {
            const summary = await service.getStockSummary();
            return summary;
        });

    }, { prefix: '/accessories' });

    // ==================== Categories ====================

    await fastify.register(async (categoryApp) => {
        categoryApp.addHook('preHandler', authenticate);

        categoryApp.get('/', {
            schema: {
                tags: ['Accessory Categories'],
                summary: 'List all accessory categories'
            }
        }, async (request, reply) => {
            const categories = await service.getCategories();
            return { data: categories, total: categories.length };
        });

        categoryApp.get('/:id', {
            schema: {
                tags: ['Accessory Categories'],
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

        categoryApp.post('/', {
            schema: {
                tags: ['Accessory Categories'],
                summary: 'Create new category',
                body: zodToJsonSchema(createCategorySchema)
            }
        }, async (request: FastifyRequest<{ Body: any }>, reply) => {
            const data = createCategorySchema.parse(request.body);
            const userId = (request as any).user?.sub || 'system';
            const category = await service.createCategory(data, userId);
            return reply.code(201).send(category);
        });

    }, { prefix: '/accessory-categories' });

    // ==================== Manufacturers ====================

    await fastify.register(async (manufacturerApp) => {
        manufacturerApp.addHook('preHandler', authenticate);

        manufacturerApp.get('/', {
            schema: {
                tags: ['Accessory Manufacturers'],
                summary: 'List all accessory manufacturers'
            }
        }, async (request, reply) => {
            const manufacturers = await service.getManufacturers();
            return { data: manufacturers, total: manufacturers.length };
        });

        manufacturerApp.get('/:id', {
            schema: {
                tags: ['Accessory Manufacturers'],
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

        manufacturerApp.post('/', {
            schema: {
                tags: ['Accessory Manufacturers'],
                summary: 'Create new manufacturer',
                body: zodToJsonSchema(createManufacturerSchema)
            }
        }, async (request: FastifyRequest<{ Body: any }>, reply) => {
            const data = createManufacturerSchema.parse(request.body);
            const userId = (request as any).user?.sub || 'system';
            const manufacturer = await service.createManufacturer(data, userId);
            return reply.code(201).send(manufacturer);
        });

    }, { prefix: '/accessory-manufacturers' });

    fastify.log.info('Accessory routes registered: /accessories, /accessory-categories, /accessory-manufacturers');
}
