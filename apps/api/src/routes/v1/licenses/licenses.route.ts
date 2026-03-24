/**
 * License Module - API Routes (Clean Architecture)
 */
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { LicenseService } from '@qltb/application';
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
} from './licenses.schema.js';

export async function licensesRoute(
    fastify: FastifyInstance,
    opts: { licenseService: LicenseService }
): Promise<void> {
    const { licenseService } = opts;

    // ==================== Licenses CRUD ====================

    await fastify.register(async (licenseApp) => {

        // Get licenses assigned to a specific asset
        licenseApp.get('/asset/:assetId', async (request: FastifyRequest<{ Params: { assetId: string } }>, reply) => {
            const { assetId } = request.params;
            const licenses = await licenseService.getLicensesByAsset(assetId);
            return { data: licenses };
        });

        // List licenses
        licenseApp.get('/', async (request: FastifyRequest<{ Querystring: LicenseListQueryInput }>, reply) => {
            const query = licenseListQuerySchema.parse(request.query);
            const result = await licenseService.listLicenses(query);
            return result;
        });

        // Get license by ID
        licenseApp.get('/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
            const { id } = idParamSchema.parse(request.params);
            const license = await licenseService.getLicense(id);
            if (!license) {
                return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'License not found' } });
            }
            return license;
        });

        // Create license
        licenseApp.post('/', async (request: FastifyRequest<{ Body: CreateLicenseInput }>, reply) => {
            const data = createLicenseSchema.parse(request.body);
            const userId = request.user?.id ?? 'system';
            const license = await licenseService.createLicense({
                ...data,
                expiryDate: data.expiryDate || undefined
            }, userId);
            return reply.code(201).send(license);
        });

        // Update license
        licenseApp.patch('/:id', async (request: FastifyRequest<{ Params: { id: string }, Body: UpdateLicenseInput }>, reply) => {
            const { id } = idParamSchema.parse(request.params);
            const data = updateLicenseSchema.parse(request.body);
            const userId = request.user?.id ?? 'system';

            try {
                const license = await licenseService.updateLicense(id, {
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
            } catch (error: unknown) {
                const message = error instanceof Error ? error.message : 'Unknown error';
                return reply.code(400).send({ error: { code: 'BAD_REQUEST', message } });
            }
        });

        // Delete license
        licenseApp.delete('/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
            const { id } = idParamSchema.parse(request.params);
            const userId = request.user?.id ?? 'system';

            try {
                const deleted = await licenseService.deleteLicense(id, userId);
                if (!deleted) {
                    return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'License not found' } });
                }
                return reply.code(204).send();
            } catch (error: unknown) {
                const message = error instanceof Error ? error.message : 'Unknown error';
                return reply.code(400).send({ error: { code: 'BAD_REQUEST', message } });
            }
        });

        // Activate license
        licenseApp.post('/:id/activate', async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
            const { id } = idParamSchema.parse(request.params);
            const userId = request.user?.id ?? 'system';

            try {
                const license = await licenseService.activateLicense(id, userId);
                if (!license) {
                    return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'License not found' } });
                }
                return license;
            } catch (error: unknown) {
                const message = error instanceof Error ? error.message : 'Unknown error';
                return reply.code(400).send({ error: { code: 'BAD_REQUEST', message } });
            }
        });

        // Retire license
        licenseApp.post('/:id/retire', async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
            const { id } = idParamSchema.parse(request.params);
            const userId = request.user?.id ?? 'system';

            try {
                const license = await licenseService.retireLicense(id, userId);
                if (!license) {
                    return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'License not found' } });
                }
                return license;
            } catch (error: unknown) {
                const message = error instanceof Error ? error.message : 'Unknown error';
                return reply.code(400).send({ error: { code: 'BAD_REQUEST', message } });
            }
        });

        // ==================== Seats ====================

        // Get license seats
        licenseApp.get('/:id/seats', async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
            const { id } = idParamSchema.parse(request.params);
            const seats = await licenseService.getSeats(id);
            return { data: seats, total: seats.length };
        });

        // Assign seat
        licenseApp.post('/:id/seats', async (request: FastifyRequest<{ Params: { id: string }, Body: AssignSeatInput }>, reply) => {
            const { id } = idParamSchema.parse(request.params);
            const data = assignSeatSchema.parse(request.body);
            const userId = request.user?.id ?? 'system';

            try {
                const seat = await licenseService.assignSeat(id, data, userId);
                return reply.code(201).send(seat);
            } catch (error: unknown) {
                const message = error instanceof Error ? error.message : 'Unknown error';
                return reply.code(400).send({ error: { code: 'BAD_REQUEST', message } });
            }
        });

        // Revoke seat
        licenseApp.delete('/:id/seats/:seatId', async (request: FastifyRequest<{ Params: { id: string, seatId: string }, Body: RevokeSeatInput }>, reply) => {
            const { id, seatId } = seatIdParamSchema.parse(request.params);
            const { reason } = revokeSeatSchema.parse(request.body || {});
            const userId = request.user?.id ?? 'system';

            try {
                const revoked = await licenseService.revokeSeat(id, seatId, userId, reason);
                if (!revoked) {
                    return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Seat not found' } });
                }
                return reply.code(204).send();
            } catch (error: unknown) {
                const message = error instanceof Error ? error.message : 'Unknown error';
                return reply.code(400).send({ error: { code: 'BAD_REQUEST', message } });
            }
        });

        // Get audit logs
        licenseApp.get('/:id/audit', async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
            const { id } = idParamSchema.parse(request.params);
            const logs = await licenseService.getAuditLogs(id);
            return { data: logs, total: logs.length };
        });

        // Get expiring licenses
        licenseApp.get('/alerts/expiring', async (request: FastifyRequest<{ Querystring: { days?: number } }>, reply) => {
            const days = request.query.days || 30;
            const licenses = await licenseService.getExpiringLicenses(days);
            return { data: licenses, total: licenses.length };
        });

        // Get over-licensed
        licenseApp.get('/alerts/over-licensed', async (request, reply) => {
            const licenses = await licenseService.getOverLicensed();
            return { data: licenses, total: licenses.length };
        });

        // Compliance summary
        licenseApp.get('/compliance/summary', async (request, reply) => {
            const summary = await licenseService.getComplianceSummary();
            return summary;
        });

    }, { prefix: '/licenses' });

    // ==================== Suppliers ====================

    await fastify.register(async (supplierApp) => {

        supplierApp.get('/', async (request, reply) => {
            const suppliers = await licenseService.getSuppliers();
            return { data: suppliers, total: suppliers.length };
        });

        supplierApp.get('/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
            const { id } = idParamSchema.parse(request.params);
            const supplier = await licenseService.getSupplier(id);
            if (!supplier) {
                return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Supplier not found' } });
            }
            return supplier;
        });

        supplierApp.post('/', async (request: FastifyRequest<{ Body: unknown }>, reply) => {
            const data = createSupplierSchema.parse(request.body);
            const supplier = await licenseService.createSupplier(data);
            return reply.code(201).send(supplier);
        });

    }, { prefix: '/suppliers' });

    // ==================== Categories ====================

    await fastify.register(async (categoryApp) => {

        categoryApp.get('/', async (request, reply) => {
            const categories = await licenseService.getCategories();
            return { data: categories, total: categories.length };
        });

    }, { prefix: '/license-categories' });
}
