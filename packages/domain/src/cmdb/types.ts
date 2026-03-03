import { DomainError } from '../core/errors/index.js'

export const CiStatusValues = ['active', 'planned', 'maintenance', 'retired'] as const
export type CiStatus = typeof CiStatusValues[number]

export const EnvironmentValues = ['prod', 'uat', 'dev'] as const
export type Environment = typeof EnvironmentValues[number]

export const CmdbFieldTypeValues = [
    'string',
    'number',
    'boolean',
    'enum',
    'date',
    'ip',
    'mac',
    'cidr',
    'hostname',
    'port',
    'regex',
    'json',
    'multi_enum'
] as const
export type CmdbFieldType = typeof CmdbFieldTypeValues[number]

export const SpecVersionStatusValues = ['draft', 'active', 'retired'] as const
export type SpecVersionStatus = typeof SpecVersionStatusValues[number]

export const RelationshipStatusValues = ['active', 'retired'] as const
export type RelationshipStatus = typeof RelationshipStatusValues[number]

export type RelationshipDirection = 'upstream' | 'downstream' | 'both'

export const CmdbChangeStatusValues = ['draft', 'submitted', 'approved', 'implemented', 'closed', 'canceled'] as const
export type CmdbChangeStatus = typeof CmdbChangeStatusValues[number]

export const CmdbChangeRiskValues = ['low', 'medium', 'high', 'critical'] as const
export type CmdbChangeRisk = typeof CmdbChangeRiskValues[number]

export function assertStatus(value: string): CiStatus {
    if (!CiStatusValues.includes(value as CiStatus)) {
        throw DomainError.validation('Invalid CI status', 'status')
    }
    return value as CiStatus
}

export function assertEnvironment(value: string): Environment {
    if (!EnvironmentValues.includes(value as Environment)) {
        throw DomainError.validation('Invalid environment', 'environment')
    }
    return value as Environment
}
