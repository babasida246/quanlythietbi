/**
 * Components Module - API Routes
 * Fastify routes for component management
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { ComponentService } from './component.service.js';
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
} from './component.schemas.js';
import { AuthService } from '../auth/auth.service.js';

// ==================== Route Handler ====================

export async function componentRoutes(
    fastify: FastifyInstance,
    componentService: ComponentService,
    authService: AuthService
): Promise<void> {
    // ==================== Components Routes ====================

    // List components
    fastify.get('/components', {
        schema: {
            tags: ['Components'],
            summary: 'List all components',
            description: 'Get paginated list of components with optional filters',
        }
    }, async (request: FastifyRequest, reply: FastifyReply) => {
        const query = componentListQuerySchema.parse(request.query);

        // Normalize array parameters
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
    fastify.get('/components/:id', {
        schema: {
            tags: ['Components'],
            summary: 'Get component by ID',
            description: 'Get detailed information about a specific component',
        }
    }, async (request: FastifyRequest, reply: FastifyReply) => {
        const { id } = idParamSchema.parse(request.params);
        const component = await componentService.getComponentWithDetails(id);

        if (!component) {
            return reply.status(404).send({ error: 'Component not found' });
        }

        return reply.send(component);
    });

    // Create component
    fastify.post('/components', {
        schema: {
            tags: ['Components'],
            summary: 'Create a new component',
            description: 'Create a new component in the system'
        }
    }, async (request: FastifyRequest, reply: FastifyReply) => {
        const data = createComponentSchema.parse(request.body);
        const userId = (request as unknown as { userId?: string }).userId ?? '00000000-0000-0000-0000-000000000000';

        try {
            const component = await componentService.createComponent({
                ...data,
                createdBy: userId
            });
            return reply.status(201).send(component);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to create component';
            return reply.status(400).send({ error: message });
        }
    });

    // Update component
    fastify.put('/components/:id', {
        schema: {
            tags: ['Components'],
            summary: 'Update a component',
            description: 'Update an existing component'
        }
    }, async (request: FastifyRequest, reply: FastifyReply) => {
        const { id } = idParamSchema.parse(request.params);
        const data = updateComponentSchema.parse(request.body);
        const userId = (request as unknown as { userId?: string }).userId ?? '00000000-0000-0000-0000-000000000000';

        try {
            const component = await componentService.updateComponent(id, {
                ...data,
                updatedBy: userId
            });
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
    fastify.delete('/components/:id', {
        schema: {
            tags: ['Components'],
            summary: 'Delete a component',
            description: 'Delete a component (only if no assignment history)'
        }
    }, async (request: FastifyRequest, reply: FastifyReply) => {
        const { id } = idParamSchema.parse(request.params);
        const userId = (request as unknown as { userId?: string }).userId ?? '00000000-0000-0000-0000-000000000000';

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
    fastify.post('/components/:id/install', {
        schema: {
            tags: ['Components'],
            summary: 'Install component into an asset',
            description: 'Install a component into an asset (decreases available quantity)'
        }
    }, async (request: FastifyRequest, reply: FastifyReply) => {
        const { id } = idParamSchema.parse(request.params);
        const body = request.body as Record<string, unknown>;
        const data = installComponentSchema.parse({ ...body, componentId: id });
        const userId = (request as unknown as { userId?: string }).userId ?? '00000000-0000-0000-0000-000000000000';

        try {
            const assignment = await componentService.installComponent({
                ...data,
                installedBy: userId
            });
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
    fastify.post('/components/assignments/:assignmentId/remove', {
        schema: {
            tags: ['Components'],
            summary: 'Remove component from an asset',
            description: 'Remove a component from an asset (restock or dispose)'
        }
    }, async (request: FastifyRequest, reply: FastifyReply) => {
        const params = request.params as { assignmentId: string };
        const body = request.body as Record<string, unknown>;
        const data = removeComponentSchema.parse({ ...body, assignmentId: params.assignmentId });
        const userId = (request as unknown as { userId?: string }).userId ?? '00000000-0000-0000-0000-000000000000';

        try {
            const assignment = await componentService.removeComponent({
                ...data,
                removedBy: userId
            });
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
    fastify.get('/components/assignments', {
        schema: {
            tags: ['Components'],
            summary: 'List component assignments',
            description: 'Get paginated list of component assignments (installations)'
        }
    }, async (request: FastifyRequest, reply: FastifyReply) => {
        const query = assignmentListQuerySchema.parse(request.query);

        // Normalize array parameters
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
    fastify.get('/components/assets/:assetId/components', {
        schema: {
            tags: ['Components'],
            summary: 'Get components installed in an asset',
            description: 'List all components currently installed in a specific asset'
        }
    }, async (request: FastifyRequest, reply: FastifyReply) => {
        const params = request.params as { assetId: string };
        const result = await componentService.getAssetComponents(params.assetId);
        return reply.send(result);
    });

    // ==================== Receipt Routes ====================

    // Receive component (add to inventory)
    fastify.post('/components/:id/receive', {
        schema: {
            tags: ['Components'],
            summary: 'Receive component stock',
            description: 'Add stock to a component (purchase, restock, etc.)'
        }
    }, async (request: FastifyRequest, reply: FastifyReply) => {
        const { id } = idParamSchema.parse(request.params);
        const body = request.body as Record<string, unknown>;
        const data = receiveComponentSchema.parse({ ...body, componentId: id });
        const userId = (request as unknown as { userId?: string }).userId ?? '00000000-0000-0000-0000-000000000000';

        try {
            const receipt = await componentService.receiveComponent({
                ...data,
                receivedBy: userId
            });
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
    fastify.get('/components/receipts', {
        schema: {
            tags: ['Components'],
            summary: 'List component receipts',
            description: 'Get paginated list of component receipts'
        }
    }, async (request: FastifyRequest, reply: FastifyReply) => {
        const query = receiptListQuerySchema.parse(request.query);

        // Normalize array parameters
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

    // Get low stock items
    fastify.get('/components/alerts/low-stock', {
        schema: {
            tags: ['Components'],
            summary: 'Get low stock components',
            description: 'List components with stock below minimum threshold'
        }
    }, async (_request: FastifyRequest, reply: FastifyReply) => {
        const alerts = await componentService.getLowStockItems();
        return reply.send(alerts);
    });

    // Get out of stock items
    fastify.get('/components/alerts/out-of-stock', {
        schema: {
            tags: ['Components'],
            summary: 'Get out of stock components',
            description: 'List components with zero available stock'
        }
    }, async (_request: FastifyRequest, reply: FastifyReply) => {
        const alerts = await componentService.getOutOfStockItems();
        return reply.send(alerts);
    });

    // Get stock summary
    fastify.get('/components/summary/stock', {
        schema: {
            tags: ['Components'],
            summary: 'Get stock summary',
            description: 'Get overview of component stock status'
        }
    }, async (_request: FastifyRequest, reply: FastifyReply) => {
        const summary = await componentService.getStockSummary();
        return reply.send(summary);
    });

    // ==================== Category Routes ====================

    // List categories
    fastify.get('/component-categories', {
        schema: {
            tags: ['Component Categories'],
            summary: 'List component categories',
            description: 'Get paginated list of component categories'
        }
    }, async (request: FastifyRequest, reply: FastifyReply) => {
        const query = categoryListQuerySchema.parse(request.query);
        const result = await componentService.listCategories(query);
        return reply.send(result);
    });

    // Get category by ID
    fastify.get('/component-categories/:id', {
        schema: {
            tags: ['Component Categories'],
            summary: 'Get category by ID'
        }
    }, async (request: FastifyRequest, reply: FastifyReply) => {
        const { id } = idParamSchema.parse(request.params);
        const category = await componentService.getCategory(id);

        if (!category) {
            return reply.status(404).send({ error: 'Category not found' });
        }

        return reply.send(category);
    });

    // Create category
    fastify.post('/component-categories', {
        schema: {
            tags: ['Component Categories'],
            summary: 'Create a component category'
        }
    }, async (request: FastifyRequest, reply: FastifyReply) => {
        const data = createCategorySchema.parse(request.body);
        const userId = (request as unknown as { userId?: string }).userId ?? '00000000-0000-0000-0000-000000000000';

        try {
            const category = await componentService.createCategory({
                ...data,
                createdBy: userId
            });
            return reply.status(201).send(category);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to create category';
            return reply.status(400).send({ error: message });
        }
    });

    // Update category
    fastify.put('/component-categories/:id', {
        schema: {
            tags: ['Component Categories'],
            summary: 'Update a component category'
        }
    }, async (request: FastifyRequest, reply: FastifyReply) => {
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

    // Delete category
    fastify.delete('/component-categories/:id', {
        schema: {
            tags: ['Component Categories'],
            summary: 'Delete a component category'
        }
    }, async (request: FastifyRequest, reply: FastifyReply) => {
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

    // List manufacturers
    fastify.get('/component-manufacturers', {
        schema: {
            tags: ['Component Manufacturers'],
            summary: 'List component manufacturers',
            description: 'Get paginated list of component manufacturers'
        }
    }, async (request: FastifyRequest, reply: FastifyReply) => {
        const query = manufacturerListQuerySchema.parse(request.query);
        const result = await componentService.listManufacturers(query);
        return reply.send(result);
    });

    // Get manufacturer by ID
    fastify.get('/component-manufacturers/:id', {
        schema: {
            tags: ['Component Manufacturers'],
            summary: 'Get manufacturer by ID'
        }
    }, async (request: FastifyRequest, reply: FastifyReply) => {
        const { id } = idParamSchema.parse(request.params);
        const manufacturer = await componentService.getManufacturer(id);

        if (!manufacturer) {
            return reply.status(404).send({ error: 'Manufacturer not found' });
        }

        return reply.send(manufacturer);
    });

    // Create manufacturer
    fastify.post('/component-manufacturers', {
        schema: {
            tags: ['Component Manufacturers'],
            summary: 'Create a component manufacturer'
        }
    }, async (request: FastifyRequest, reply: FastifyReply) => {
        const data = createManufacturerSchema.parse(request.body);
        const userId = (request as unknown as { userId?: string }).userId ?? '00000000-0000-0000-0000-000000000000';

        try {
            const manufacturer = await componentService.createManufacturer({
                ...data,
                createdBy: userId
            });
            return reply.status(201).send(manufacturer);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to create manufacturer';
            return reply.status(400).send({ error: message });
        }
    });

    // Update manufacturer
    fastify.put('/component-manufacturers/:id', {
        schema: {
            tags: ['Component Manufacturers'],
            summary: 'Update a component manufacturer'
        }
    }, async (request: FastifyRequest, reply: FastifyReply) => {
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

    // Delete manufacturer
    fastify.delete('/component-manufacturers/:id', {
        schema: {
            tags: ['Component Manufacturers'],
            summary: 'Delete a component manufacturer'
        }
    }, async (request: FastifyRequest, reply: FastifyReply) => {
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
