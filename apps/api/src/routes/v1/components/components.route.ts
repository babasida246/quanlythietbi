/**
 * Components Module - API Routes (Clean Architecture)
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { ComponentService } from '@qltb/application';
import {
    createComponentSchema,
    updateComponentSchema,
    installComponentSchema,
    removeComponentSchema,
    receiveComponentSchema,
    createCategorySchema,
    updateCategorySchema,
    createManufacturerSchema,
    updateManufacturerSchema,
    componentListQuerySchema,
    assignmentListQuerySchema,
    receiptListQuerySchema,
    categoryListQuerySchema,
    manufacturerListQuerySchema,
    idParamSchema
} from './components.schema.js';

export async function componentsRoute(
    fastify: FastifyInstance,
    opts: { componentService: ComponentService }
): Promise<void> {
    const { componentService } = opts;

    // ==================== Components Routes ====================

    // List components
    fastify.get('/components', async (request: FastifyRequest, reply: FastifyReply) => {
        const query = componentListQuerySchema.parse(request.query);

        const normalizedQuery = {
            ...query,
            componentType: query.componentType
                ? (Array.isArray(query.componentType) ? query.componentType : [query.componentType])
                : undefined,
            status: query.status
                ? (Array.isArray(query.status) ? query.status : [query.status])
                : undefined,
            stockStatus: query.stockStatus
                ? (Array.isArray(query.stockStatus) ? query.stockStatus : [query.stockStatus])
                : undefined
        };

        const result = await componentService.listComponents(normalizedQuery);
        return reply.send(result);
    });

    // Get component by ID
    fastify.get('/components/:id', async (request: FastifyRequest, reply: FastifyReply) => {
        const { id } = idParamSchema.parse(request.params);
        const component = await componentService.getComponentWithDetails(id);

        if (!component) {
            return reply.status(404).send({ error: 'Component not found' });
        }

        return reply.send(component);
    });

    // Create component
    fastify.post('/components', async (request: FastifyRequest, reply: FastifyReply) => {
        const data = createComponentSchema.parse(request.body);
        const userId = request.user?.id ?? 'system';

        try {
            const component = await componentService.createComponent({ ...data, createdBy: userId });
            return reply.status(201).send(component);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to create component';
            return reply.status(400).send({ error: message });
        }
    });

    // Update component
    fastify.put('/components/:id', async (request: FastifyRequest, reply: FastifyReply) => {
        const { id } = idParamSchema.parse(request.params);
        const data = updateComponentSchema.parse(request.body);
        const userId = request.user?.id ?? 'system';

        try {
            const component = await componentService.updateComponent(id, { ...data, updatedBy: userId });
            return reply.send(component);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to update component';
            if (message === 'Component not found') {
                return reply.status(404).send({ error: message });
            }
            return reply.status(400).send({ error: message });
        }
    });

    // Delete component
    fastify.delete('/components/:id', async (request: FastifyRequest, reply: FastifyReply) => {
        const { id } = idParamSchema.parse(request.params);
        const userId = request.user?.id ?? 'system';

        try {
            await componentService.deleteComponent(id, userId);
            return reply.status(204).send();
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to delete component';
            if (message === 'Component not found') {
                return reply.status(404).send({ error: message });
            }
            return reply.status(400).send({ error: message });
        }
    });

    // ==================== Install/Remove Routes ====================

    // Install component into asset
    fastify.post('/components/:id/install', async (request: FastifyRequest, reply: FastifyReply) => {
        const { id } = idParamSchema.parse(request.params);
        const body = request.body as Record<string, unknown>;
        const data = installComponentSchema.parse({ ...body, componentId: id });
        const userId = request.user?.id ?? 'system';

        try {
            const assignment = await componentService.installComponent({ ...data, installedBy: userId });
            return reply.status(201).send(assignment);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to install component';
            if (message === 'Component not found') {
                return reply.status(404).send({ error: message });
            }
            return reply.status(400).send({ error: message });
        }
    });

    // Remove component from asset
    fastify.post('/components/assignments/:assignmentId/remove', async (request: FastifyRequest, reply: FastifyReply) => {
        const params = request.params as { assignmentId: string };
        const body = request.body as Record<string, unknown>;
        const data = removeComponentSchema.parse({ ...body, assignmentId: params.assignmentId });
        const userId = request.user?.id ?? 'system';

        try {
            const assignment = await componentService.removeComponent({ ...data, removedBy: userId });
            return reply.send(assignment);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to remove component';
            if (message === 'Assignment not found') {
                return reply.status(404).send({ error: message });
            }
            return reply.status(400).send({ error: message });
        }
    });

    // List assignments
    fastify.get('/components/assignments', async (request: FastifyRequest, reply: FastifyReply) => {
        const query = assignmentListQuerySchema.parse(request.query);

        const normalizedQuery = {
            ...query,
            status: query.status
                ? (Array.isArray(query.status) ? query.status : [query.status])
                : undefined,
            removalReason: query.removalReason
                ? (Array.isArray(query.removalReason) ? query.removalReason : [query.removalReason])
                : undefined
        };

        const result = await componentService.listAssignments(normalizedQuery);
        return reply.send(result);
    });

    // Get asset components
    fastify.get('/components/assets/:assetId/components', async (request: FastifyRequest, reply: FastifyReply) => {
        const params = request.params as { assetId: string };
        const result = await componentService.getAssetComponents(params.assetId);
        return reply.send(result);
    });

    // ==================== Receipt Routes ====================

    // Receive component
    fastify.post('/components/:id/receive', async (request: FastifyRequest, reply: FastifyReply) => {
        const { id } = idParamSchema.parse(request.params);
        const body = request.body as Record<string, unknown>;
        const data = receiveComponentSchema.parse({ ...body, componentId: id });
        const userId = request.user?.id ?? 'system';

        try {
            const receipt = await componentService.receiveComponent({ ...data, receivedBy: userId });
            return reply.status(201).send(receipt);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to receive component';
            if (message === 'Component not found') {
                return reply.status(404).send({ error: message });
            }
            return reply.status(400).send({ error: message });
        }
    });

    // List receipts
    fastify.get('/components/receipts', async (request: FastifyRequest, reply: FastifyReply) => {
        const query = receiptListQuerySchema.parse(request.query);

        const normalizedQuery = {
            ...query,
            receiptType: query.receiptType
                ? (Array.isArray(query.receiptType) ? query.receiptType : [query.receiptType])
                : undefined
        };

        const result = await componentService.listReceipts(normalizedQuery);
        return reply.send(result);
    });

    // ==================== Stock Alert Routes ====================

    fastify.get('/components/alerts/low-stock', async (_request: FastifyRequest, reply: FastifyReply) => {
        const alerts = await componentService.getLowStockItems();
        return reply.send(alerts);
    });

    fastify.get('/components/alerts/out-of-stock', async (_request: FastifyRequest, reply: FastifyReply) => {
        const alerts = await componentService.getOutOfStockItems();
        return reply.send(alerts);
    });

    fastify.get('/components/summary/stock', async (_request: FastifyRequest, reply: FastifyReply) => {
        const summary = await componentService.getStockSummary();
        return reply.send(summary);
    });

    // ==================== Category Routes ====================

    fastify.get('/component-categories', async (request: FastifyRequest, reply: FastifyReply) => {
        const query = categoryListQuerySchema.parse(request.query);
        const result = await componentService.listCategories(query);
        return reply.send(result);
    });

    fastify.get('/component-categories/:id', async (request: FastifyRequest, reply: FastifyReply) => {
        const { id } = idParamSchema.parse(request.params);
        const category = await componentService.getCategory(id);

        if (!category) {
            return reply.status(404).send({ error: 'Category not found' });
        }

        return reply.send(category);
    });

    fastify.post('/component-categories', async (request: FastifyRequest, reply: FastifyReply) => {
        const data = createCategorySchema.parse(request.body);
        const userId = request.user?.id ?? 'system';

        try {
            const category = await componentService.createCategory({ ...data, createdBy: userId });
            return reply.status(201).send(category);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to create category';
            return reply.status(400).send({ error: message });
        }
    });

    fastify.put('/component-categories/:id', async (request: FastifyRequest, reply: FastifyReply) => {
        const { id } = idParamSchema.parse(request.params);
        const data = updateCategorySchema.parse(request.body);

        try {
            const category = await componentService.updateCategory(id, data);
            return reply.send(category);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to update category';
            if (message === 'Category not found') {
                return reply.status(404).send({ error: message });
            }
            return reply.status(400).send({ error: message });
        }
    });

    fastify.delete('/component-categories/:id', async (request: FastifyRequest, reply: FastifyReply) => {
        const { id } = idParamSchema.parse(request.params);

        try {
            await componentService.deleteCategory(id);
            return reply.status(204).send();
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to delete category';
            if (message === 'Category not found') {
                return reply.status(404).send({ error: message });
            }
            return reply.status(400).send({ error: message });
        }
    });

    // ==================== Manufacturer Routes ====================

    fastify.get('/component-manufacturers', async (request: FastifyRequest, reply: FastifyReply) => {
        const query = manufacturerListQuerySchema.parse(request.query);
        const result = await componentService.listManufacturers(query);
        return reply.send(result);
    });

    fastify.get('/component-manufacturers/:id', async (request: FastifyRequest, reply: FastifyReply) => {
        const { id } = idParamSchema.parse(request.params);
        const manufacturer = await componentService.getManufacturer(id);

        if (!manufacturer) {
            return reply.status(404).send({ error: 'Manufacturer not found' });
        }

        return reply.send(manufacturer);
    });

    fastify.post('/component-manufacturers', async (request: FastifyRequest, reply: FastifyReply) => {
        const data = createManufacturerSchema.parse(request.body);
        const userId = request.user?.id ?? 'system';

        try {
            const manufacturer = await componentService.createManufacturer({ ...data, createdBy: userId });
            return reply.status(201).send(manufacturer);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to create manufacturer';
            return reply.status(400).send({ error: message });
        }
    });

    fastify.put('/component-manufacturers/:id', async (request: FastifyRequest, reply: FastifyReply) => {
        const { id } = idParamSchema.parse(request.params);
        const data = updateManufacturerSchema.parse(request.body);

        try {
            const manufacturer = await componentService.updateManufacturer(id, data);
            return reply.send(manufacturer);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to update manufacturer';
            if (message === 'Manufacturer not found') {
                return reply.status(404).send({ error: message });
            }
            return reply.status(400).send({ error: message });
        }
    });

    fastify.delete('/component-manufacturers/:id', async (request: FastifyRequest, reply: FastifyReply) => {
        const { id } = idParamSchema.parse(request.params);

        try {
            await componentService.deleteManufacturer(id);
            return reply.status(204).send();
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to delete manufacturer';
            if (message === 'Manufacturer not found') {
                return reply.status(404).send({ error: message });
            }
            return reply.status(400).send({ error: message });
        }
    });
}
