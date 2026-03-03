/**
 * Documentation plugins configuration  
 */
import type { FastifyInstance } from 'fastify'
import swagger from '@fastify/swagger'
import swaggerUi from '@fastify/swagger-ui'

export interface DocsConfig {
    title: string
    description: string
    version: string
    servers: Array<{ url: string; description: string }>
}

export async function registerDocs(
    fastify: FastifyInstance,
    config: DocsConfig
): Promise<void> {
    // Swagger/OpenAPI
    await fastify.register(swagger, {
        refResolver: {
            buildLocalReference(json, _baseUri, _fragment, i) {
                // Avoid duplicate $id collisions when using zod/json-schema converters
                return `def-${i}`
            }
        },
        openapi: {
            info: {
                title: config.title,
                description: config.description,
                version: config.version
            },
            servers: config.servers,
            components: {
                schemas: {
                    ApiResponse: {
                        type: 'object',
                        properties: {
                            success: { type: 'boolean' },
                            data: { type: 'object' },
                            meta: {
                                type: 'object',
                                properties: {
                                    timestamp: { type: 'string', format: 'date-time' },
                                    requestId: { type: 'string', format: 'uuid' },
                                    pagination: {
                                        type: 'object',
                                        properties: {
                                            page: { type: 'integer' },
                                            limit: { type: 'integer' },
                                            total: { type: 'integer' },
                                            totalPages: { type: 'integer' },
                                            hasNext: { type: 'boolean' },
                                            hasPrev: { type: 'boolean' }
                                        }
                                    }
                                }
                            }
                        },
                        required: ['success', 'data', 'meta']
                    },
                    ApiErrorResponse: {
                        type: 'object',
                        properties: {
                            success: { type: 'boolean', enum: [false] },
                            error: {
                                type: 'object',
                                properties: {
                                    code: { type: 'string' },
                                    message: { type: 'string' },
                                    details: { type: 'object' },
                                    field: { type: 'string' }
                                },
                                required: ['code', 'message']
                            },
                            meta: {
                                type: 'object',
                                properties: {
                                    timestamp: { type: 'string', format: 'date-time' },
                                    requestId: { type: 'string', format: 'uuid' }
                                },
                                required: ['timestamp', 'requestId']
                            }
                        },
                        required: ['success', 'error', 'meta']
                    }
                },
                securitySchemes: {
                    bearerAuth: {
                        type: 'http',
                        scheme: 'bearer',
                        bearerFormat: 'JWT'
                    }
                }
            },
            tags: [
                { name: 'Auth', description: 'Authentication and authorization' },
                { name: 'Assets', description: 'Asset management operations' },
                { name: 'CMDB', description: 'Configuration management database' },
                { name: 'Inventory', description: 'Inventory and stock management' },
                { name: 'Maintenance', description: 'Maintenance and repair operations' },
                { name: 'Reports', description: 'Reporting and analytics' }
            ]
        }
    })

    // Swagger UI
    await fastify.register(swaggerUi, {
        routePrefix: '/docs',
        uiConfig: {
            docExpansion: 'list',
            deepLinking: false,
            defaultModelsExpandDepth: 1,
            defaultModelExpandDepth: 1,
            displayRequestDuration: true,
            filter: true,
            showExtensions: true,
            showCommonExtensions: true,
            tryItOutEnabled: true
        },
        staticCSP: true,
        transformStaticCSP: (header) => header,
        theme: {
            title: config.title
        }
    })
}