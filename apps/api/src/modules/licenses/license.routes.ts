/**
 * License Module - API Routes
 */
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { zodToJsonSchema } from 'zod-to-json-schema';
import type { Pool } from 'pg';
import { LicenseService } from './license.service.js';
import {
    createLicenseSchema,
    updateLicenseSchema,
    assignSeatSchema,
    revokeSeatSchema,
    licenseListQuerySchema,
    idParamSchema,
    seatIdParamSchema,
    createSupplierSchema,
    type CreateLicenseInput,
    type UpdateLicenseInput,
    type AssignSeatInput,
    type RevokeSeatInput,
    type LicenseListQueryInput
} from './license.schemas.js';
import type { AuthService } from '../auth/index.js';
import type { EntitlementService } from '../entitlements/entitlement.service.js';
import { createFeatureGate } from '../../shared/middleware/feature-gate.js';

export async function licenseRoutes(
    fastify: FastifyInstance,
    service: LicenseService,
    authService: AuthService,
    entitlementService: EntitlementService
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

    // Register prefix
    await fastify.register(async (licenseApp) => {
        // Apply auth to all routes
        licenseApp.addHook('preHandler', authenticate);
        licenseApp.addHook('preHandler', createFeatureGate(entitlementService, 'sam.catalog'));

        // ==================== Licenses CRUD ====================

        // List licenses
        licenseApp.get('/', {
            schema: {
                tags: ['Licenses'],
                summary: 'List licenses',
                description: 'Get paginated list of licenses with optional filters',
                querystring: zodToJsonSchema(licenseListQuerySchema),
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
        }, async (request: FastifyRequest<{ Querystring: LicenseListQueryInput }>, reply) => {
            const query = licenseListQuerySchema.parse(request.query);
            const result = await service.listLicenses(query);
            return result;
        });

        // Get license by ID
        licenseApp.get('/:id', {
            schema: {
                tags: ['Licenses'],
                summary: 'Get license by ID',
                params: zodToJsonSchema(idParamSchema)
            }
        }, async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
            const { id } = idParamSchema.parse(request.params);
            const license = await service.getLicense(id);
            if (!license) {
                return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'License not found' } });
            }
            return license;
        });

        // Create license
        licenseApp.post('/', {
            schema: {
                tags: ['Licenses'],
                summary: 'Create new license',
                body: zodToJsonSchema(createLicenseSchema)
            }
        }, async (request: FastifyRequest<{ Body: CreateLicenseInput }>, reply) => {
            const data = createLicenseSchema.parse(request.body);
            const userId = (request as any).user?.sub || 'system';
            const license = await service.createLicense({
                ...data,
                expiryDate: data.expiryDate || undefined
            }, userId);
            return reply.code(201).send(license);
        });

        // Update license
        licenseApp.patch('/:id', {
            schema: {
                tags: ['Licenses'],
                summary: 'Update license',
                params: zodToJsonSchema(idParamSchema),
                body: zodToJsonSchema(updateLicenseSchema)
            }
        }, async (request: FastifyRequest<{ Params: { id: string }, Body: UpdateLicenseInput }>, reply) => {
            const { id } = idParamSchema.parse(request.params);
            const data = updateLicenseSchema.parse(request.body);
            const userId = (request as any).user?.sub || 'system';

            try {
                const license = await service.updateLicense(id, {
                    ...data,
                    supplierId: data.supplierId || undefined,
                    categoryId: data.categoryId || undefined,
                    productKey: data.productKey || undefined,
                    purchaseDate: data.purchaseDate || undefined,
                    expiryDate: data.expiryDate || undefined,
                    warrantyDate: data.warrantyDate || undefined,
                    invoiceNumber: data.invoiceNumber || undefined,
                    notes: data.notes || undefined
                }, userId);
                if (!license) {
                    return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'License not found' } });
                }
                return license;
            } catch (error: any) {
                return reply.code(400).send({ error: { code: 'BAD_REQUEST', message: error.message } });
            }
        });

        // Delete license
        licenseApp.delete('/:id', {
            schema: {
                tags: ['Licenses'],
                summary: 'Delete draft license',
                params: zodToJsonSchema(idParamSchema)
            }
        }, async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
            const { id } = idParamSchema.parse(request.params);
            const userId = (request as any).user?.sub || 'system';

            try {
                const deleted = await service.deleteLicense(id, userId);
                if (!deleted) {
                    return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'License not found' } });
                }
                return reply.code(204).send();
            } catch (error: any) {
                return reply.code(400).send({ error: { code: 'BAD_REQUEST', message: error.message } });
            }
        });

        // Activate license
        licenseApp.post('/:id/activate', {
            schema: {
                tags: ['Licenses'],
                summary: 'Activate a draft license',
                params: zodToJsonSchema(idParamSchema)
            }
        }, async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
            const { id } = idParamSchema.parse(request.params);
            const userId = (request as any).user?.sub || 'system';

            try {
                const license = await service.activateLicense(id, userId);
                if (!license) {
                    return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'License not found' } });
                }
                return license;
            } catch (error: any) {
                return reply.code(400).send({ error: { code: 'BAD_REQUEST', message: error.message } });
            }
        });

        // Retire license
        licenseApp.post('/:id/retire', {
            schema: {
                tags: ['Licenses'],
                summary: 'Retire a license',
                params: zodToJsonSchema(idParamSchema)
            }
        }, async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
            const { id } = idParamSchema.parse(request.params);
            const userId = (request as any).user?.sub || 'system';

            try {
                const license = await service.retireLicense(id, userId);
                if (!license) {
                    return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'License not found' } });
                }
                return license;
            } catch (error: any) {
                return reply.code(400).send({ error: { code: 'BAD_REQUEST', message: error.message } });
            }
        });

        // ==================== Seats ====================

        // Get license seats
        licenseApp.get('/:id/seats', {
            schema: {
                tags: ['Licenses'],
                summary: 'Get all seats for a license',
                params: zodToJsonSchema(idParamSchema)
            }
        }, async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
            const { id } = idParamSchema.parse(request.params);
            const seats = await service.getSeats(id);
            return { data: seats, total: seats.length };
        });

        // Assign seat
        licenseApp.post('/:id/seats', {
            schema: {
                tags: ['Licenses'],
                summary: 'Assign a seat to user or asset',
                params: zodToJsonSchema(idParamSchema),
                body: zodToJsonSchema(assignSeatSchema)
            }
        }, async (request: FastifyRequest<{ Params: { id: string }, Body: AssignSeatInput }>, reply) => {
            const { id } = idParamSchema.parse(request.params);
            const data = assignSeatSchema.parse(request.body);
            const userId = (request as any).user?.sub || 'system';

            try {
                const seat = await service.assignSeat(id, data, userId);
                return reply.code(201).send(seat);
            } catch (error: any) {
                return reply.code(400).send({ error: { code: 'BAD_REQUEST', message: error.message } });
            }
        });

        // Revoke seat
        licenseApp.delete('/:id/seats/:seatId', {
            schema: {
                tags: ['Licenses'],
                summary: 'Revoke a seat',
                params: zodToJsonSchema(seatIdParamSchema)
            }
        }, async (request: FastifyRequest<{ Params: { id: string, seatId: string }, Body: RevokeSeatInput }>, reply) => {
            const { id, seatId } = seatIdParamSchema.parse(request.params);
            const { reason } = revokeSeatSchema.parse(request.body || {});
            const userId = (request as any).user?.sub || 'system';

            try {
                const revoked = await service.revokeSeat(id, seatId, userId, reason);
                if (!revoked) {
                    return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Seat not found' } });
                }
                return reply.code(204).send();
            } catch (error: any) {
                return reply.code(400).send({ error: { code: 'BAD_REQUEST', message: error.message } });
            }
        });

        // ==================== Audit Logs ====================

        // Get audit logs
        licenseApp.get('/:id/audit', {
            schema: {
                tags: ['Licenses'],
                summary: 'Get audit logs for a license',
                params: zodToJsonSchema(idParamSchema)
            }
        }, async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
            const { id } = idParamSchema.parse(request.params);
            const logs = await service.getAuditLogs(id);
            return { data: logs, total: logs.length };
        });

        // ==================== Compliance & Alerts ====================

        // Get expiring licenses
        licenseApp.get('/alerts/expiring', {
            schema: {
                tags: ['Licenses'],
                summary: 'Get licenses expiring soon',
                querystring: {
                    type: 'object',
                    properties: {
                        days: { type: 'number', default: 30 }
                    }
                }
            }
        }, async (request: FastifyRequest<{ Querystring: { days?: number } }>, reply) => {
            const days = request.query.days || 30;
            const licenses = await service.getExpiringLicenses(days);
            return { data: licenses, total: licenses.length };
        });

        // Get over-licensed
        licenseApp.get('/alerts/over-licensed', {
            schema: {
                tags: ['Licenses'],
                summary: 'Get over-licensed software'
            }
        }, async (request, reply) => {
            const licenses = await service.getOverLicensed();
            return { data: licenses, total: licenses.length };
        });

        // Compliance summary
        licenseApp.get('/compliance/summary', {
            schema: {
                tags: ['Licenses'],
                summary: 'Get license compliance summary'
            }
        }, async (request, reply) => {
            const summary = await service.getComplianceSummary();
            return summary;
        });

    }, { prefix: '/licenses' });

    // ==================== Suppliers ====================

    await fastify.register(async (supplierApp) => {
        supplierApp.addHook('preHandler', authenticate);

        // List suppliers
        supplierApp.get('/', {
            schema: {
                tags: ['Suppliers'],
                summary: 'List all suppliers'
            }
        }, async (request, reply) => {
            const suppliers = await service.getSuppliers();
            return { data: suppliers, total: suppliers.length };
        });

        // Get supplier
        supplierApp.get('/:id', {
            schema: {
                tags: ['Suppliers'],
                summary: 'Get supplier by ID',
                params: zodToJsonSchema(idParamSchema)
            }
        }, async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
            const { id } = idParamSchema.parse(request.params);
            const supplier = await service.getSupplier(id);
            if (!supplier) {
                return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Supplier not found' } });
            }
            return supplier;
        });

        // Create supplier
        supplierApp.post('/', {
            schema: {
                tags: ['Suppliers'],
                summary: 'Create new supplier',
                body: zodToJsonSchema(createSupplierSchema)
            }
        }, async (request: FastifyRequest<{ Body: any }>, reply) => {
            const data = createSupplierSchema.parse(request.body);
            const supplier = await service.createSupplier(data);
            return reply.code(201).send(supplier);
        });

    }, { prefix: '/suppliers' });

    // ==================== Categories ====================

    await fastify.register(async (categoryApp) => {
        categoryApp.addHook('preHandler', authenticate);

        // List categories
        categoryApp.get('/', {
            schema: {
                tags: ['License Categories'],
                summary: 'List all license categories'
            }
        }, async (request, reply) => {
            const categories = await service.getCategories();
            return { data: categories, total: categories.length };
        });

    }, { prefix: '/license-categories' });

    fastify.log.info('License routes registered: /licenses, /suppliers, /license-categories');
}
