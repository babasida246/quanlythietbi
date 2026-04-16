export const equipmentGroupIdParamSchema = {
    type: 'object',
    required: ['id'],
    properties: { id: { type: 'string', format: 'uuid' } },
} as const

export const equipmentGroupFieldIdParamSchema = {
    type: 'object',
    required: ['fieldId'],
    properties: { fieldId: { type: 'string', format: 'uuid' } },
} as const

export const equipmentGroupCreateSchema = {
    type: 'object',
    required: ['name'],
    properties: {
        code:                 { type: 'string', maxLength: 50 },
        name:                 { type: 'string', minLength: 1, maxLength: 255 },
        description:          { type: 'string' },
        parentId:             { type: 'string', format: 'uuid' },
        inheritParentFields:  { type: 'boolean' },
        isActive:             { type: 'boolean' },
        sortOrder:            { type: 'integer' },
    },
} as const

export const equipmentGroupUpdateSchema = {
    type: 'object',
    properties: {
        code:                 { type: ['string', 'null'], maxLength: 50 },
        name:                 { type: 'string', minLength: 1, maxLength: 255 },
        description:          { type: ['string', 'null'] },
        parentId:             { type: ['string', 'null'] },
        inheritParentFields:  { type: 'boolean' },
        isActive:             { type: 'boolean' },
        sortOrder:            { type: 'integer' },
    },
} as const

export const FIELD_TYPES = ['string', 'number', 'boolean', 'enum', 'date'] as const

export const equipmentGroupFieldCreateSchema = {
    type: 'object',
    required: ['key', 'label', 'fieldType'],
    properties: {
        key:          { type: 'string', minLength: 1, maxLength: 100 },
        label:        { type: 'string', minLength: 1, maxLength: 255 },
        fieldType:    { type: 'string', enum: FIELD_TYPES },
        required:     { type: 'boolean' },
        enumValues:   { type: 'array', items: { type: 'string' } },
        defaultValue: { type: ['string', 'null'] },
        helpText:     { type: ['string', 'null'] },
        sortOrder:    { type: 'integer' },
    },
} as const

export const equipmentGroupFieldUpdateSchema = {
    type: 'object',
    properties: {
        label:        { type: 'string', minLength: 1, maxLength: 255 },
        fieldType:    { type: 'string', enum: FIELD_TYPES },
        required:     { type: 'boolean' },
        enumValues:   { type: ['array', 'null'], items: { type: 'string' } },
        defaultValue: { type: ['string', 'null'] },
        helpText:     { type: ['string', 'null'] },
        sortOrder:    { type: 'integer' },
    },
} as const
