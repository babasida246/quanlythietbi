import crypto from 'node:crypto'
import process from 'node:process'
import pg from 'pg'
import { faker } from '@faker-js/faker'

const { Client } = pg

const RNG_SEED = 1212019
const MIN_ROWS_PER_TABLE = Number.parseInt(process.env.SEED_MIN_ROWS ?? '20', 10)
const ANCHOR_TIMESTAMP = Date.parse('2026-02-15T12:00:00.000Z')
const DAY_MS = 24 * 60 * 60 * 1000
const SYSTEM_TABLE_EXCLUSIONS = ['app_meta', 'setup_migration_runs']

if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is required')
    process.exit(1)
}

function quoteIdent(identifier) {
    return `"${String(identifier).replaceAll('"', '""')}"`
}

function parsePgArray(value) {
    if (!value) return []
    if (Array.isArray(value)) return value
    const raw = String(value).trim()
    if (!raw.startsWith('{') || !raw.endsWith('}')) return [raw]
    return raw
        .slice(1, -1)
        .split(',')
        .map((item) => item.replace(/^"(.*)"$/, '$1'))
        .filter(Boolean)
}

function escapeRegExp(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function deterministicUuid(input) {
    const hash = crypto.createHash('sha256').update(input).digest('hex')
    const part1 = hash.slice(0, 8)
    const part2 = hash.slice(8, 12)
    const part3 = `4${hash.slice(13, 16)}`
    const variantNibble = ((Number.parseInt(hash.slice(16, 17), 16) & 0x3) | 0x8).toString(16)
    const part4 = `${variantNibble}${hash.slice(17, 20)}`
    const part5 = hash.slice(20, 32)
    return `${part1}-${part2}-${part3}-${part4}-${part5}`
}

function baseDateFor(tableIndex, rowIndex, variant = 0) {
    const daysAgo = (tableIndex * 17 + rowIndex * 11 + variant * 3) % 90
    const hoursAgo = (tableIndex * 7 + rowIndex * 5 + variant) % 24
    return new Date(ANCHOR_TIMESTAMP - daysAgo * DAY_MS - hoursAgo * 60 * 60 * 1000)
}

function formatDate(date) {
    return date.toISOString().slice(0, 10)
}

function slugFromTable(tableName) {
    return tableName
        .split('_')
        .map((token) => token.slice(0, 3))
        .join('')
        .slice(0, 8)
        .toUpperCase()
}

function clampToLength(value, maxLength) {
    if (!maxLength || typeof value !== 'string') return value
    if (value.length <= maxLength) return value
    return value.slice(0, maxLength)
}

function isVolatileDefault(columnDefault) {
    if (!columnDefault) return false
    return /(now\(\)|current_timestamp|current_date|clock_timestamp|uuid_generate_v4|gen_random_uuid)/i.test(
        columnDefault
    )
}

function isSequenceDefault(columnDefault) {
    if (!columnDefault) return false
    return /nextval\(/i.test(columnDefault)
}

function numberFromCheckLiteral(raw) {
    if (raw == null) return null
    const parsed = Number.parseFloat(String(raw))
    return Number.isFinite(parsed) ? parsed : null
}

function extractAllowedValuesForColumn(checkDefinition, columnName) {
    const column = escapeRegExp(columnName)
    const values = new Set()
    const patterns = [
        new RegExp(
            `${column}(?:::[a-z_\\s]+)?\\s*=\\s*ANY\\s*\\(\\s*ARRAY\\s*\\[([^\\]]+)\\]`,
            'gi'
        ),
        new RegExp(`${column}(?:::[a-z_\\s]+)?\\s+IN\\s*\\(([^)]+)\\)`, 'gi'),
        new RegExp(`${column}(?:::[a-z_\\s]+)?\\s*=\\s*'([^']+)'`, 'gi')
    ]

    for (const pattern of patterns) {
        let match
        while ((match = pattern.exec(checkDefinition)) !== null) {
            if (match.length > 1) {
                if (pattern === patterns[2]) {
                    values.add(match[1])
                    continue
                }
                const segment = match[1]
                for (const valueMatch of segment.matchAll(/'([^']+)'/g)) {
                    values.add(valueMatch[1])
                }
            }
        }
    }

    return Array.from(values)
}

function extractNumericBoundsForColumn(checkDefinition, columnName) {
    const column = escapeRegExp(columnName)
    const bounds = {
        min: null,
        minExclusive: false,
        max: null,
        maxExclusive: false
    }

    const minInclusive = new RegExp(`${column}\\s*>=\\s*\\(?\\s*(-?\\d+(?:\\.\\d+)?)`, 'i')
    const minExclusive = new RegExp(`${column}\\s*>\\s*\\(?\\s*(-?\\d+(?:\\.\\d+)?)`, 'i')
    const maxInclusive = new RegExp(`${column}\\s*<=\\s*\\(?\\s*(-?\\d+(?:\\.\\d+)?)`, 'i')
    const maxExclusive = new RegExp(`${column}\\s*<\\s*\\(?\\s*(-?\\d+(?:\\.\\d+)?)`, 'i')

    const minIncMatch = checkDefinition.match(minInclusive)
    if (minIncMatch) {
        const value = numberFromCheckLiteral(minIncMatch[1])
        if (value != null) {
            bounds.min = value
            bounds.minExclusive = false
        }
    }

    const minExcMatch = checkDefinition.match(minExclusive)
    if (minExcMatch) {
        const value = numberFromCheckLiteral(minExcMatch[1])
        if (value != null) {
            bounds.min = value
            bounds.minExclusive = true
        }
    }

    const maxIncMatch = checkDefinition.match(maxInclusive)
    if (maxIncMatch) {
        const value = numberFromCheckLiteral(maxIncMatch[1])
        if (value != null) {
            bounds.max = value
            bounds.maxExclusive = false
        }
    }

    const maxExcMatch = checkDefinition.match(maxExclusive)
    if (maxExcMatch) {
        const value = numberFromCheckLiteral(maxExcMatch[1])
        if (value != null) {
            bounds.max = value
            bounds.maxExclusive = true
        }
    }

    return bounds
}

async function introspectSchema(client) {
    const excludedTablesSql = SYSTEM_TABLE_EXCLUSIONS.map((value) => `'${value}'`).join(', ')
    const tableResult = await client.query(`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_type = 'BASE TABLE'
          AND table_name NOT IN (${excludedTablesSql})
        ORDER BY table_name
    `)

    const columnResult = await client.query(`
        SELECT table_name,
               column_name,
               ordinal_position,
               data_type,
               udt_name,
               is_nullable,
               column_default,
               character_maximum_length,
               numeric_precision,
               numeric_scale,
               datetime_precision,
               is_generated,
               identity_generation
        FROM information_schema.columns
        WHERE table_schema = 'public'
        ORDER BY table_name, ordinal_position
    `)

    const keyResult = await client.query(`
        SELECT tc.table_name,
               tc.constraint_name,
               tc.constraint_type,
               array_agg(kcu.column_name ORDER BY kcu.ordinal_position) AS columns
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
         AND tc.table_schema = kcu.table_schema
        WHERE tc.table_schema = 'public'
          AND tc.constraint_type IN ('PRIMARY KEY', 'UNIQUE')
        GROUP BY tc.table_name, tc.constraint_name, tc.constraint_type
        ORDER BY tc.table_name, tc.constraint_type, tc.constraint_name
    `)

    const fkResult = await client.query(`
        WITH fk_cols AS (
            SELECT tc.constraint_name,
                   tc.table_name AS child_table,
                   ccu.table_name AS parent_table,
                   kcu.column_name AS child_column,
                   ccu.column_name AS parent_column,
                   kcu.ordinal_position
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu
              ON tc.constraint_name = kcu.constraint_name
             AND tc.table_schema = kcu.table_schema
            JOIN information_schema.constraint_column_usage ccu
              ON ccu.constraint_name = tc.constraint_name
             AND ccu.table_schema = tc.table_schema
            WHERE tc.table_schema = 'public'
              AND tc.constraint_type = 'FOREIGN KEY'
        )
        SELECT f.constraint_name,
               f.child_table,
               f.parent_table,
               bool_and(c.is_nullable = 'NO') AS all_not_null,
               array_agg(f.child_column ORDER BY f.ordinal_position) AS child_columns,
               array_agg(f.parent_column ORDER BY f.ordinal_position) AS parent_columns
        FROM fk_cols f
        JOIN information_schema.columns c
          ON c.table_schema = 'public'
         AND c.table_name = f.child_table
         AND c.column_name = f.child_column
        GROUP BY f.constraint_name, f.child_table, f.parent_table
        ORDER BY f.child_table, f.constraint_name
    `)

    const checkResult = await client.query(`
        SELECT rel.relname AS table_name,
               con.conname AS constraint_name,
               pg_get_constraintdef(con.oid, true) AS definition
        FROM pg_constraint con
        JOIN pg_class rel ON rel.oid = con.conrelid
        JOIN pg_namespace nsp ON nsp.oid = connamespace
        WHERE nsp.nspname = 'public'
          AND con.contype = 'c'
        ORDER BY rel.relname, con.conname
    `)

    const enumResult = await client.query(`
        SELECT t.typname AS enum_name,
               array_agg(e.enumlabel ORDER BY e.enumsortorder) AS labels
        FROM pg_type t
        JOIN pg_enum e ON e.enumtypid = t.oid
        JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE n.nspname = 'public'
        GROUP BY t.typname
        ORDER BY t.typname
    `)

    const tables = tableResult.rows.map((row, index) => ({
        tableName: row.table_name,
        index,
        columns: [],
        columnMap: new Map(),
        primaryKey: [],
        uniqueConstraints: [],
        foreignKeys: [],
        requiredForeignKeys: [],
        checks: [],
        columnRules: new Map(),
        requiredColumns: [],
        uniqueColumns: new Set()
    }))

    const tableMap = new Map(tables.map((table) => [table.tableName, table]))

    for (const row of columnResult.rows) {
        const table = tableMap.get(row.table_name)
        if (!table) continue
        const column = {
            tableName: row.table_name,
            columnName: row.column_name,
            ordinalPosition: row.ordinal_position,
            dataType: row.data_type,
            udtName: row.udt_name,
            isNullable: row.is_nullable === 'YES',
            columnDefault: row.column_default,
            characterMaximumLength: row.character_maximum_length,
            numericPrecision: row.numeric_precision,
            numericScale: row.numeric_scale,
            datetimePrecision: row.datetime_precision,
            isGenerated: row.is_generated,
            identityGeneration: row.identity_generation
        }
        table.columns.push(column)
        table.columnMap.set(column.columnName, column)
    }

    for (const row of keyResult.rows) {
        const table = tableMap.get(row.table_name)
        if (!table) continue
        const columns = parsePgArray(row.columns)
        if (row.constraint_type === 'PRIMARY KEY') {
            table.primaryKey = columns
            columns.forEach((columnName) => table.uniqueColumns.add(columnName))
        }
        if (row.constraint_type === 'UNIQUE') {
            table.uniqueConstraints.push({
                constraintName: row.constraint_name,
                columns
            })
            columns.forEach((columnName) => table.uniqueColumns.add(columnName))
        }
    }

    for (const row of fkResult.rows) {
        const table = tableMap.get(row.child_table)
        if (!table) continue
        const foreignKey = {
            constraintName: row.constraint_name,
            childTable: row.child_table,
            parentTable: row.parent_table,
            childColumns: parsePgArray(row.child_columns),
            parentColumns: parsePgArray(row.parent_columns),
            allNotNull: row.all_not_null === true
        }
        table.foreignKeys.push(foreignKey)
        if (foreignKey.allNotNull && foreignKey.childTable !== foreignKey.parentTable) {
            table.requiredForeignKeys.push(foreignKey)
        }
    }

    for (const row of checkResult.rows) {
        const table = tableMap.get(row.table_name)
        if (!table) continue
        table.checks.push({
            constraintName: row.constraint_name,
            definition: row.definition
        })
    }

    const enumMap = new Map(
        enumResult.rows.map((row) => [row.enum_name, parsePgArray(row.labels)])
    )

    for (const table of tables) {
        table.requiredColumns = table.columns.filter(
            (column) =>
                !column.isNullable &&
                !column.columnDefault &&
                column.isGenerated !== 'ALWAYS'
        )

        for (const column of table.columns) {
            const rules = {
                allowedValues: [],
                numericBounds: {
                    min: null,
                    minExclusive: false,
                    max: null,
                    maxExclusive: false
                }
            }

            if (enumMap.has(column.udtName)) {
                rules.allowedValues = enumMap.get(column.udtName)
            }

            for (const check of table.checks) {
                const allowed = extractAllowedValuesForColumn(check.definition, column.columnName)
                for (const value of allowed) {
                    if (!rules.allowedValues.includes(value)) {
                        rules.allowedValues.push(value)
                    }
                }

                const bounds = extractNumericBoundsForColumn(check.definition, column.columnName)
                if (bounds.min != null) {
                    const shouldSet =
                        rules.numericBounds.min == null ||
                        bounds.min > rules.numericBounds.min ||
                        (bounds.min === rules.numericBounds.min && bounds.minExclusive)
                    if (shouldSet) {
                        rules.numericBounds.min = bounds.min
                        rules.numericBounds.minExclusive = bounds.minExclusive
                    }
                }
                if (bounds.max != null) {
                    const shouldSet =
                        rules.numericBounds.max == null ||
                        bounds.max < rules.numericBounds.max ||
                        (bounds.max === rules.numericBounds.max && bounds.maxExclusive)
                    if (shouldSet) {
                        rules.numericBounds.max = bounds.max
                        rules.numericBounds.maxExclusive = bounds.maxExclusive
                    }
                }
            }

            table.columnRules.set(column.columnName, rules)
        }
    }

    return {
        tables,
        tableMap,
        enumMap
    }
}

function topoSortTablesByRequiredFks(schema) {
    const tableNames = schema.tables.map((table) => table.tableName)
    const dependencies = new Map(tableNames.map((name) => [name, new Set()]))
    const reverse = new Map(tableNames.map((name) => [name, new Set()]))

    for (const table of schema.tables) {
        for (const fk of table.requiredForeignKeys) {
            dependencies.get(table.tableName).add(fk.parentTable)
            reverse.get(fk.parentTable).add(table.tableName)
        }
    }

    const indegree = new Map(
        tableNames.map((name) => [name, dependencies.get(name).size])
    )
    const queue = tableNames.filter((name) => indegree.get(name) === 0).sort()
    const order = []

    while (queue.length > 0) {
        const current = queue.shift()
        order.push(current)
        for (const dependent of reverse.get(current)) {
            indegree.set(dependent, indegree.get(dependent) - 1)
            if (indegree.get(dependent) === 0) {
                queue.push(dependent)
            }
        }
        queue.sort()
    }

    if (order.length !== tableNames.length) {
        const missing = tableNames.filter((name) => !order.includes(name))
        throw new Error(
            `Could not topologically sort all tables by required FKs. Remaining: ${missing.join(', ')}`
        )
    }

    return order
}

function chooseParentRow(rows, rowIndex, variant = 0) {
    if (!rows || rows.length === 0) return null
    const index = (rowIndex + variant) % rows.length
    return rows[index]
}

function pickAllowedValue(table, columnName, rowIndex, variant = 0) {
    const rules = table.columnRules.get(columnName)
    if (!rules || rules.allowedValues.length === 0) return undefined
    return rules.allowedValues[(rowIndex + variant) % rules.allowedValues.length]
}

function applyNumericBounds(table, columnName, numericValue) {
    const rules = table.columnRules.get(columnName)
    if (!rules) return numericValue

    let value = numericValue
    const { min, minExclusive, max, maxExclusive } = rules.numericBounds

    if (min != null && value < min) {
        value = minExclusive ? min + 1 : min
    } else if (min != null && minExclusive && value <= min) {
        value = min + 1
    }

    if (max != null && value > max) {
        value = maxExclusive ? max - 1 : max
    } else if (max != null && maxExclusive && value >= max) {
        value = max - 1
    }

    return value
}

function generateStringValue(table, column, rowIndex, variant = 0) {
    const columnName = column.columnName.toLowerCase()
    const prefix = slugFromTable(table.tableName)
    const padded = String(rowIndex + 1).padStart(4, '0')
    const allowed = pickAllowedValue(table, column.columnName, rowIndex, variant)
    if (allowed !== undefined) {
        return clampToLength(String(allowed), column.characterMaximumLength)
    }

    let value
    if (columnName.includes('email')) {
        value = `user${padded}.${prefix.toLowerCase()}@seed.local`
    } else if (columnName.includes('username')) {
        value = `${prefix.toLowerCase()}_user_${padded}`
    } else if (columnName.includes('password')) {
        value = `$2b$10$${crypto
            .createHash('sha256')
            .update(`${table.tableName}:${column.columnName}:${rowIndex}`)
            .digest('hex')
            .slice(0, 53)}`
    } else if (columnName.includes('refresh_token')) {
        value = `rt_${crypto
            .createHash('sha1')
            .update(`${table.tableName}:${column.columnName}:${rowIndex}:${variant}`)
            .digest('hex')}`
    } else if (columnName.includes('token')) {
        value = `tk_${crypto
            .createHash('sha1')
            .update(`${table.tableName}:${column.columnName}:${rowIndex}:${variant}`)
            .digest('hex')}`
    } else if (columnName.includes('phone')) {
        value = `+1202555${String(1000 + rowIndex).slice(-4)}`
    } else if (columnName.includes('mime_type')) {
        value = 'application/pdf'
    } else if (columnName.includes('storage_key')) {
        value = `seed/${table.tableName}/${padded}/${column.columnName}.bin`
    } else if (columnName.includes('file_path')) {
        value = `/seed/${table.tableName}/${padded}/${column.columnName}.dat`
    } else if (columnName.includes('file_name')) {
        value = `${table.tableName}-${padded}.dat`
    } else if (columnName.includes('endpoint') || columnName.includes('url')) {
        value = `https://seed.local/${table.tableName}/${padded}`
    } else if (columnName.includes('code')) {
        value = `${prefix}-${padded}`
    } else if (columnName === 'role') {
        value = ['admin', 'manager', 'user', 'viewer'][(rowIndex + variant) % 4]
    } else if (columnName.includes('name')) {
        value = `${faker.commerce.department()} ${rowIndex + 1}`
    } else if (columnName.includes('title')) {
        value = `Seed ${table.tableName} ${rowIndex + 1}`
    } else if (
        columnName.includes('message') ||
        columnName.includes('comment') ||
        columnName.includes('note') ||
        columnName.includes('description') ||
        columnName.includes('justification')
    ) {
        value = faker.lorem.sentence({ min: 10, max: 18 })
    } else if (columnName.includes('currency')) {
        value = 'USD'
    } else if (columnName.includes('path')) {
        value = `/seed/${table.tableName}/${padded}`
    } else {
        value = `${table.tableName}_${column.columnName}_${padded}`
    }

    return clampToLength(value, column.characterMaximumLength)
}

function generateIntegerValue(table, column, rowIndex, variant = 0) {
    const columnName = column.columnName.toLowerCase()
    let value = rowIndex + 1 + variant

    if (columnName.includes('year')) {
        value = 2024 + ((rowIndex + variant) % 3)
    } else if (columnName.includes('month')) {
        value = ((rowIndex + variant) % 12) + 1
    } else if (columnName.includes('quantity_before')) {
        value = 40 + rowIndex
    } else if (columnName.includes('quantity_after')) {
        value = 45 + rowIndex
    } else if (columnName.includes('quantity_change')) {
        value = 5 + (rowIndex % 3)
    } else if (columnName.includes('quantity') || columnName.includes('qty')) {
        value = 1 + (rowIndex % 5)
    } else if (columnName.includes('line_no') || columnName.includes('step_order') || columnName.includes('step_no')) {
        value = rowIndex + 1
    } else if (columnName.includes('cooldown')) {
        value = 24
    } else if (columnName.includes('copies')) {
        value = 1 + (rowIndex % 3)
    } else if (columnName.includes('seat_count')) {
        value = 1
    } else if (columnName.includes('life_years')) {
        value = 3 + (rowIndex % 5)
    } else if (columnName.includes('period_month')) {
        value = ((rowIndex + variant) % 12) + 1
    }

    value = applyNumericBounds(table, column.columnName, value)
    return Math.trunc(value)
}

function generateNumericValue(table, column, rowIndex, variant = 0) {
    const columnName = column.columnName.toLowerCase()
    let value = Number((rowIndex + 1) * 10.5 + variant)

    if (columnName.includes('unit_price') || columnName.includes('price')) {
        value = Number((80 + rowIndex * 3.25).toFixed(2))
    } else if (columnName.includes('original_cost')) {
        value = Number((1000 + rowIndex * 45).toFixed(2))
    } else if (columnName.includes('book_value')) {
        value = Number((900 + rowIndex * 20).toFixed(2))
    } else if (columnName.includes('monthly_depreciation')) {
        value = Number((12 + rowIndex * 0.75).toFixed(2))
    } else if (columnName.includes('depreciation_amount')) {
        value = Number((10 + rowIndex * 0.5).toFixed(2))
    } else if (columnName.includes('accumulated')) {
        value = Number((50 + rowIndex * 4).toFixed(2))
    } else if (columnName.includes('score')) {
        value = Number((70 + (rowIndex % 30)).toFixed(2))
    }

    value = applyNumericBounds(table, column.columnName, value)
    return value
}

function generateJsonValue(table, column, rowIndex) {
    const columnName = column.columnName.toLowerCase()
    const id = `${table.tableName}-${rowIndex + 1}`

    if (columnName.includes('steps')) {
        return [
            { step: 1, role: 'manager', action: 'review' },
            { step: 2, role: 'admin', action: 'approve' }
        ]
    }

    if (columnName.includes('recipients')) {
        return [`notify.${id}@seed.local`]
    }

    if (columnName.includes('condition_value')) {
        return { threshold: rowIndex + 1 }
    }

    if (columnName.includes('approval_chain')) {
        return [
            { step: 1, approverRole: 'manager' },
            { step: 2, approverRole: 'admin' }
        ]
    }

    if (columnName.includes('spec')) {
        return {
            cpu: 'Intel i7',
            ramGb: 16 + (rowIndex % 3) * 8,
            storageGb: 256 + (rowIndex % 4) * 256
        }
    }

    if (columnName.includes('payload') || columnName.includes('metadata')) {
        return {
            seed: true,
            table: table.tableName,
            row: rowIndex + 1
        }
    }

    return {
        seed: true,
        table: table.tableName,
        column: column.columnName,
        row: rowIndex + 1
    }
}

function generateInet(tableIndex, rowIndex, variant = 0) {
    const second = (tableIndex % 200) + 1
    const third = ((rowIndex + variant) % 200) + 1
    const fourth = ((rowIndex * 13 + variant) % 250) + 1
    return `10.${second}.${third}.${fourth}`
}

function generateMacAddress(tableIndex, rowIndex, variant = 0) {
    const raw = crypto
        .createHash('md5')
        .update(`${tableIndex}:${rowIndex}:${variant}`)
        .digest('hex')
        .slice(0, 12)
    const pairs = raw.match(/.{1,2}/g) ?? []
    return pairs.join(':')
}

function shouldPopulateColumn(table, column) {
    if (column.isGenerated === 'ALWAYS') return false
    if (table.primaryKey.includes(column.columnName)) {
        if (!column.columnDefault) return true
        if (isSequenceDefault(column.columnDefault)) return false
        if (/(uuid_generate_v4|gen_random_uuid)/i.test(column.columnDefault)) return true
        return false
    }
    if (table.uniqueColumns.has(column.columnName)) return true
    if (!column.isNullable && !column.columnDefault) return true
    if (isVolatileDefault(column.columnDefault)) return true
    const name = column.columnName.toLowerCase()
    if (name === 'created_at' || name === 'updated_at') return true
    return false
}

function assignForeignKeys(table, row, rowIndex, variant, seededRowsByTable, requireAll = false) {
    const foreignKeys = requireAll ? table.foreignKeys : table.requiredForeignKeys
    for (const fk of foreignKeys) {
        const parentRows = seededRowsByTable.get(fk.parentTable) ?? []
        if (parentRows.length === 0) {
            continue
        }
        const parent = chooseParentRow(parentRows, rowIndex, variant)
        if (!parent) continue
        fk.childColumns.forEach((childColumn, idx) => {
            const parentColumn = fk.parentColumns[idx]
            if (row[childColumn] === undefined) {
                row[childColumn] = parent[parentColumn]
            }
        })
    }
}

function generateColumnValue(table, column, rowIndex, variant, seededRowsByTable) {
    const lowerName = column.columnName.toLowerCase()
    const allowed = pickAllowedValue(table, column.columnName, rowIndex, variant)

    if (allowed !== undefined) {
        if (
            column.dataType === 'integer' ||
            column.dataType === 'bigint' ||
            column.udtName === 'int4' ||
            column.udtName === 'int8'
        ) {
            return Math.trunc(Number(allowed))
        }
        if (
            column.dataType === 'numeric' ||
            column.dataType === 'double precision' ||
            column.dataType === 'real'
        ) {
            return Number(allowed)
        }
        return allowed
    }

    if (column.udtName === 'uuid') {
        const users = seededRowsByTable.get('users') ?? []
        const organizations = seededRowsByTable.get('organizations') ?? []
        const assets = seededRowsByTable.get('assets') ?? []
        const locations = seededRowsByTable.get('locations') ?? []

        if ((lowerName.endsWith('_user_id') || lowerName.includes('user_id')) && users.length > 0) {
            return chooseParentRow(users, rowIndex, variant).id
        }
        if (lowerName.endsWith('_by') && users.length > 0) {
            return chooseParentRow(users, rowIndex, variant).id
        }
        if (lowerName.includes('organization_id') && organizations.length > 0) {
            return chooseParentRow(organizations, rowIndex, variant).id
        }
        if (lowerName.includes('asset_id') && assets.length > 0) {
            return chooseParentRow(assets, rowIndex, variant).id
        }
        if (lowerName.includes('location_id') && locations.length > 0) {
            return chooseParentRow(locations, rowIndex, variant).id
        }

        return deterministicUuid(`${table.tableName}:${column.columnName}:${rowIndex}:${variant}`)
    }

    if (column.dataType === 'character varying' || column.dataType === 'text' || column.dataType === 'character') {
        return generateStringValue(table, column, rowIndex, variant)
    }

    if (column.udtName === 'int2' || column.udtName === 'int4' || column.udtName === 'int8') {
        return generateIntegerValue(table, column, rowIndex, variant)
    }

    if (
        column.dataType === 'numeric' ||
        column.dataType === 'double precision' ||
        column.dataType === 'real'
    ) {
        return generateNumericValue(table, column, rowIndex, variant)
    }

    if (column.dataType === 'boolean') {
        return (rowIndex + variant) % 2 === 0
    }

    if (column.dataType === 'date') {
        const date = baseDateFor(table.index, rowIndex, variant)
        return formatDate(date)
    }

    if (column.dataType === 'timestamp with time zone' || column.dataType === 'timestamp without time zone') {
        const date = baseDateFor(table.index, rowIndex, variant)
        return date.toISOString()
    }

    if (column.dataType === 'jsonb' || column.dataType === 'json') {
        return generateJsonValue(table, column, rowIndex)
    }

    if (column.udtName === 'inet') {
        return generateInet(table.index, rowIndex, variant)
    }

    if (column.udtName === 'cidr') {
        return `${generateInet(table.index, rowIndex, variant).replace(/\d+$/, '0')}/24`
    }

    if (column.udtName === 'macaddr') {
        return generateMacAddress(table.index, rowIndex, variant)
    }

    if (column.udtName === '_text') {
        return [`${table.tableName}_${column.columnName}_${rowIndex + 1}`]
    }

    if (column.udtName === '_uuid') {
        return [deterministicUuid(`${table.tableName}:${column.columnName}:${rowIndex}:${variant}`)]
    }

    return null
}

function applySpecialRules(table, row, rowIndex, variant, seededRowsByTable) {
    const users = seededRowsByTable.get('users') ?? []
    const assets = seededRowsByTable.get('assets') ?? []
    const locations = seededRowsByTable.get('locations') ?? []
    const licenses = seededRowsByTable.get('licenses') ?? []
    const checkouts = seededRowsByTable.get('asset_checkouts') ?? []
    const ciRows = seededRowsByTable.get('cmdb_cis') ?? []
    const relTypeRows = seededRowsByTable.get('cmdb_relationship_types') ?? []
    const depreciationSchedules = seededRowsByTable.get('depreciation_schedules') ?? []

    if (table.tableName === 'users') {
        const roles = ['manager', 'user', 'viewer', 'operator']
        row.role = roles[rowIndex % roles.length]
        row.email = `user${String(rowIndex + 1).padStart(4, '0')}@seed.local`
        row.username = `user_${String(rowIndex + 1).padStart(4, '0')}`
        row.name = `Seed User ${rowIndex + 1}`
    }

    if (table.tableName === 'accessory_checkouts') {
        row.assignment_type = 'user'
        row.assigned_user_id =
            users.length > 0
                ? chooseParentRow(users, rowIndex, variant).id
                : deterministicUuid(`accessory_checkouts:assigned_user_id:${rowIndex}:${variant}`)
        row.checked_out_by =
            users.length > 0
                ? chooseParentRow(users, rowIndex + 1, variant).id
                : deterministicUuid(`accessory_checkouts:checked_out_by:${rowIndex}:${variant}`)
        row.quantity = Math.max(1, row.quantity ?? 1)
        row.quantity_returned = 0
        row.status = 'checked_out'
    }

    if (table.tableName === 'asset_checkouts') {
        row.checkout_type = 'user'
        row.target_user_id =
            users.length > 0
                ? chooseParentRow(users, rowIndex, variant).id
                : deterministicUuid(`asset_checkouts:target_user_id:${rowIndex}:${variant}`)
        row.checked_out_by =
            users.length > 0
                ? chooseParentRow(users, rowIndex + 1, variant).id
                : deterministicUuid(`asset_checkouts:checked_out_by:${rowIndex}:${variant}`)
        row.status = 'checked_out'
    }

    if (table.tableName === 'asset_requests') {
        row.request_type = 'new'
        row.justification = `Deterministic seed request ${rowIndex + 1} for workflow validation coverage.`
        if (users.length > 0) {
            row.requester_id = chooseParentRow(users, rowIndex, variant).id
        }
    }

    if (table.tableName === 'license_seats') {
        row.assignment_type = 'user'
        row.assigned_user_id =
            users.length > 0
                ? chooseParentRow(users, rowIndex, variant).id
                : deterministicUuid(`license_seats:assigned_user_id:${rowIndex}:${variant}`)
        if (licenses.length > 0) {
            row.license_id = chooseParentRow(licenses, rowIndex, 0).id
        }
        row.assigned_by = `seed-user-${String((rowIndex % 20) + 1).padStart(4, '0')}`
    }

    if (table.tableName === 'licenses') {
        row.status = 'active'
        row.license_type = 'per_seat'
        row.seat_count = 25
        const purchaseDate = baseDateFor(table.index, rowIndex, variant)
        const expiryDate = new Date(purchaseDate.getTime() + 365 * DAY_MS)
        row.purchase_date = formatDate(purchaseDate)
        row.expiry_date = formatDate(expiryDate)
    }

    if (table.tableName === 'checkout_transfers') {
        if (checkouts.length > 1) {
            const original = chooseParentRow(checkouts, rowIndex, variant)
            const next = chooseParentRow(checkouts, rowIndex + 1, variant)
            row.original_checkout_id = original.id
            row.new_checkout_id = next.id
        }
        if (users.length > 0) {
            row.from_user_id = chooseParentRow(users, rowIndex, variant).id
            row.to_user_id = chooseParentRow(users, rowIndex + 1, variant).id
            row.transferred_by = chooseParentRow(users, rowIndex + 2, variant).id
        }
    }

    if (table.tableName === 'cmdb_relationships') {
        if (relTypeRows.length > 0) {
            row.type_id = chooseParentRow(relTypeRows, rowIndex, variant).id
        }
        if (ciRows.length > 1) {
            const fromCi = chooseParentRow(ciRows, rowIndex, variant)
            let toCi = chooseParentRow(ciRows, rowIndex + 1, variant)
            if (fromCi.id === toCi.id) {
                toCi = chooseParentRow(ciRows, rowIndex + 2, variant)
            }
            row.from_ci_id = fromCi.id
            row.to_ci_id = toCi.id
        }
    }

    if (table.tableName === 'depreciation_schedules') {
        const originalCost = Number((1200 + rowIndex * 50).toFixed(2))
        const usefulLifeYears = 3 + (rowIndex % 5)
        const startDate = baseDateFor(table.index, rowIndex, variant)
        const endDate = new Date(startDate.getTime() + usefulLifeYears * 365 * DAY_MS)
        const monthlyDep = Number((originalCost / (usefulLifeYears * 12)).toFixed(2))

        row.original_cost = originalCost
        row.useful_life_years = usefulLifeYears
        row.start_date = formatDate(startDate)
        row.end_date = formatDate(endDate)
        row.monthly_depreciation = monthlyDep
        row.book_value = originalCost
    }

    if (table.tableName === 'depreciation_entries') {
        if (depreciationSchedules.length > 0) {
            const schedule = chooseParentRow(depreciationSchedules, rowIndex, 0)
            row.schedule_id = schedule.id
            row.asset_id = schedule.asset_id
        }
        row.period_year = 2025 + Math.floor(rowIndex / 12)
        row.period_month = (rowIndex % 12) + 1
        const periodStart = new Date(Date.UTC(row.period_year, row.period_month - 1, 1))
        const periodEnd = new Date(Date.UTC(row.period_year, row.period_month, 0))
        row.period_start = formatDate(periodStart)
        row.period_end = formatDate(periodEnd)
        row.depreciation_amount = Number((20 + rowIndex).toFixed(2))
        row.accumulated_after = Number((100 + rowIndex * 5).toFixed(2))
        row.book_value_after = Number((1000 - rowIndex * 10).toFixed(2))
    }

    if (table.tableName === 'inventory_sessions' && locations.length > 0) {
        row.location_id = chooseParentRow(locations, rowIndex, variant).id
    }

    if (table.tableName === 'asset_increase_lines' && assets.length > 0) {
        row.asset_id = chooseParentRow(assets, rowIndex, variant).id
    }
}

function coerceRowForInsert(table, row) {
    const output = {}
    for (const column of table.columns) {
        const value = row[column.columnName]
        if (value === undefined) continue
        if (column.isGenerated === 'ALWAYS') continue
        if ((column.dataType === 'json' || column.dataType === 'jsonb') && value !== null) {
            output[column.columnName] = JSON.stringify(value)
            continue
        }
        output[column.columnName] = value
    }
    return output
}

function ensureRequiredColumns(table, row, rowIndex, variant, seededRowsByTable) {
    for (const column of table.requiredColumns) {
        if (row[column.columnName] === undefined) {
            row[column.columnName] = generateColumnValue(
                table,
                column,
                rowIndex,
                variant,
                seededRowsByTable
            )
        }
    }
}

function buildRow(table, rowIndex, variant, seededRowsByTable) {
    faker.seed(RNG_SEED + table.index * 10000 + rowIndex * 79 + variant * 997)
    const row = {}

    assignForeignKeys(table, row, rowIndex, variant, seededRowsByTable, false)
    assignForeignKeys(table, row, rowIndex, variant, seededRowsByTable, true)

    for (const columnName of table.primaryKey) {
        const column = table.columnMap.get(columnName)
        if (!column) continue
        if (row[columnName] !== undefined) continue

        if (!column.columnDefault) {
            row[columnName] = generateColumnValue(table, column, rowIndex, variant, seededRowsByTable)
            continue
        }

        if (isSequenceDefault(column.columnDefault)) {
            continue
        }

        if (/(uuid_generate_v4|gen_random_uuid)/i.test(column.columnDefault)) {
            row[columnName] = generateColumnValue(table, column, rowIndex, variant, seededRowsByTable)
        }
    }

    for (const uniqueConstraint of table.uniqueConstraints) {
        if (uniqueConstraint.columns.length !== 1) continue
        const uniqueColumnName = uniqueConstraint.columns[0]
        if (row[uniqueColumnName] !== undefined) continue
        const column = table.columnMap.get(uniqueColumnName)
        if (!column) continue
        row[uniqueColumnName] = generateColumnValue(table, column, rowIndex, variant, seededRowsByTable)
    }

    for (const column of table.columns) {
        if (row[column.columnName] !== undefined) continue
        const columnFk = table.foreignKeys.find((fk) =>
            fk.childColumns.includes(column.columnName)
        )
        if (columnFk && !columnFk.allNotNull) continue
        if (!shouldPopulateColumn(table, column)) continue
        row[column.columnName] = generateColumnValue(table, column, rowIndex, variant, seededRowsByTable)
    }

    applySpecialRules(table, row, rowIndex, variant, seededRowsByTable)
    ensureRequiredColumns(table, row, rowIndex, variant, seededRowsByTable)

    for (const column of table.columns) {
        const value = row[column.columnName]
        if (typeof value === 'string' && column.characterMaximumLength) {
            row[column.columnName] = clampToLength(value, column.characterMaximumLength)
        }
    }

    return coerceRowForInsert(table, row)
}

async function insertRow(client, table, row) {
    const entries = Object.entries(row).filter(([, value]) => value !== undefined)
    if (entries.length === 0) {
        const sql = `INSERT INTO public.${quoteIdent(table.tableName)} DEFAULT VALUES RETURNING *`
        const result = await client.query(sql)
        return result.rows[0]
    }

    const columns = entries.map(([columnName]) => quoteIdent(columnName))
    const values = entries.map(([, value]) => value)
    const placeholders = entries.map((_, idx) => `$${idx + 1}`)

    const sql = `INSERT INTO public.${quoteIdent(table.tableName)} (${columns.join(
        ', '
    )}) VALUES (${placeholders.join(', ')}) RETURNING *`

    const result = await client.query(sql, values)
    return result.rows[0]
}

async function truncateAllTables(client, tableNames) {
    if (tableNames.length === 0) {
        return
    }
    const quoted = tableNames.map((tableName) => `public.${quoteIdent(tableName)}`).join(', ')
    await client.query(`TRUNCATE TABLE ${quoted} RESTART IDENTITY CASCADE`)
}

function sanitizeExistingRowForInsert(table, row) {
    const output = {}
    for (const column of table.columns) {
        if (column.isGenerated === 'ALWAYS') continue
        if (!Object.prototype.hasOwnProperty.call(row, column.columnName)) continue
        output[column.columnName] = row[column.columnName]
    }
    return output
}

async function capturePreservedAdmins(client, schema) {
    const usersTable = schema.tableMap.get('users')
    if (!usersTable) return []

    const result = await client.query(`
        SELECT *
        FROM public.users
        WHERE lower(role) = 'admin'
          AND COALESCE(is_active, true) = true
          AND COALESCE(status, 'active') = 'active'
          AND COALESCE(password_hash, '') ~ '^\\$2[aby]\\$'
    `)

    return result.rows
        .map((row) => sanitizeExistingRowForInsert(usersTable, row))
        .filter((row) => row.email || row.username)
}

async function restorePreservedAdmins(client, schema, rows) {
    const usersTable = schema.tableMap.get('users')
    if (!usersTable || rows.length === 0) {
        return { restored: 0, skipped: 0 }
    }

    let restored = 0
    let skipped = 0

    for (const row of rows) {
        try {
            await client.query('SAVEPOINT seed_restore_admin')
            await insertRow(client, usersTable, row)
            await client.query('RELEASE SAVEPOINT seed_restore_admin')
            restored += 1
        } catch (error) {
            await client.query('ROLLBACK TO SAVEPOINT seed_restore_admin')
            const updated = await upsertExistingUserRow(client, row)
            if (updated) {
                restored += 1
                continue
            }

            skipped += 1
            const identifier = row.email ?? row.username ?? row.id ?? 'unknown'
            const message = error instanceof Error ? error.message : String(error)
            console.warn(`WARN: skip preserved admin ${identifier}: ${message}`)
        }
    }

    return { restored, skipped }
}

function buildUserUpdatePayload(row) {
    return Object.entries(row).filter(([key, value]) => key !== 'id' && value !== undefined)
}

async function updateUserByCondition(client, row, conditionSql, conditionValue) {
    const entries = buildUserUpdatePayload(row)
    if (entries.length === 0) return false

    const setClauses = entries.map(([columnName], idx) => `${quoteIdent(columnName)} = $${idx + 1}`)
    const values = entries.map(([, value]) => value)
    values.push(conditionValue)

    const sql = `
        UPDATE public.users
        SET ${setClauses.join(', ')}
        WHERE ${conditionSql}
    `
    const result = await client.query(sql, values)
    return result.rowCount > 0
}

async function upsertExistingUserRow(client, row) {
    if (row.id) {
        const updatedById = await updateUserByCondition(
            client,
            row,
            `id = $${buildUserUpdatePayload(row).length + 1}`,
            row.id
        )
        if (updatedById) return true
    }

    if (row.email) {
        const updatedByEmail = await updateUserByCondition(
            client,
            row,
            `lower(email) = lower($${buildUserUpdatePayload(row).length + 1})`,
            row.email
        )
        if (updatedByEmail) return true
    }

    if (row.username) {
        const updatedByUsername = await updateUserByCondition(
            client,
            row,
            `lower(username) = lower($${buildUserUpdatePayload(row).length + 1})`,
            row.username
        )
        if (updatedByUsername) return true
    }

    return false
}

async function countRows(client, tableNames) {
    const counts = []
    for (const tableName of tableNames) {
        const result = await client.query(
            `SELECT count(*)::int AS count FROM public.${quoteIdent(tableName)}`
        )
        counts.push({
            tableName,
            count: result.rows[0].count
        })
    }
    return counts
}

async function verifyForeignKeys(client, schema) {
    const checks = []
    for (const table of schema.tables) {
        for (const fk of table.foreignKeys) {
            const childColumns = fk.childColumns.map((columnName) => `c.${quoteIdent(columnName)}`)
            const parentColumns = fk.parentColumns.map((columnName) => `p.${quoteIdent(columnName)}`)
            const joinConditions = fk.childColumns
                .map(
                    (columnName, idx) =>
                        `c.${quoteIdent(columnName)} = p.${quoteIdent(fk.parentColumns[idx])}`
                )
                .join(' AND ')
            const notNullConditions = childColumns
                .map((columnName) => `${columnName} IS NOT NULL`)
                .join(' AND ')
            const parentNullCondition = parentColumns
                .map((columnName) => `${columnName} IS NULL`)
                .join(' AND ')

            const sql = `
                SELECT count(*)::int AS invalid_count
                FROM public.${quoteIdent(fk.childTable)} c
                LEFT JOIN public.${quoteIdent(fk.parentTable)} p
                  ON ${joinConditions}
                WHERE ${notNullConditions}
                  AND (${parentNullCondition})
            `
            const result = await client.query(sql)
            checks.push({
                constraintName: fk.constraintName,
                childTable: fk.childTable,
                parentTable: fk.parentTable,
                invalidCount: result.rows[0].invalid_count
            })
        }
    }
    return checks
}

function printInventorySummary(schema) {
    console.log('Schema inventory:')
    console.log(`- Base tables: ${schema.tables.length}`)
    const totalColumns = schema.tables.reduce((sum, table) => sum + table.columns.length, 0)
    const totalFks = schema.tables.reduce((sum, table) => sum + table.foreignKeys.length, 0)
    const totalChecks = schema.tables.reduce((sum, table) => sum + table.checks.length, 0)
    console.log(`- Columns: ${totalColumns}`)
    console.log(`- Foreign keys: ${totalFks}`)
    console.log(`- Check constraints: ${totalChecks}`)
}

function printCountsTable(counts) {
    console.log('\nSeed summary (table_name | row_count):')
    for (const entry of counts) {
        console.log(`${entry.tableName} | ${entry.count}`)
    }
}

async function run() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL
    })

    await client.connect()
    try {
        await client.query('BEGIN')
        await client.query(`SET TIME ZONE 'UTC'`)

        const schema = await introspectSchema(client)
        printInventorySummary(schema)

        const tableNames = schema.tables.map((table) => table.tableName)
        if (tableNames.length === 0) {
            throw new Error('No base tables found in public schema. Run migration first.')
        }

        const insertOrder = topoSortTablesByRequiredFks(schema)
        const preservedAdmins = await capturePreservedAdmins(client, schema)

        if (preservedAdmins.length > 0) {
            console.log(`Preserved admin accounts before reseed: ${preservedAdmins.length}`)
        }

        await truncateAllTables(client, tableNames)

        const seededRowsByTable = new Map()
        for (const tableName of insertOrder) {
            const table = schema.tableMap.get(tableName)
            const rows = []
            for (let rowIndex = 0; rowIndex < MIN_ROWS_PER_TABLE; rowIndex += 1) {
                let inserted = null
                let lastError = null
                for (let variant = 0; variant < 10; variant += 1) {
                    const row = buildRow(table, rowIndex, variant, seededRowsByTable)
                    try {
                        await client.query('SAVEPOINT seed_row')
                        inserted = await insertRow(client, table, row)
                        await client.query('RELEASE SAVEPOINT seed_row')
                        break
                    } catch (error) {
                        lastError = error
                        await client.query('ROLLBACK TO SAVEPOINT seed_row')
                    }
                }
                if (!inserted) {
                    throw new Error(
                        `Failed to insert row ${rowIndex + 1} into ${tableName}: ${lastError?.message}`
                    )
                }
                rows.push(inserted)
            }
            seededRowsByTable.set(tableName, rows)
        }

        const restoredAdmins = await restorePreservedAdmins(client, schema, preservedAdmins)
        if (restoredAdmins.restored > 0 || restoredAdmins.skipped > 0) {
            console.log(
                `Preserved admin restore summary: restored=${restoredAdmins.restored}, skipped=${restoredAdmins.skipped}`
            )
        }

        const counts = await countRows(client, tableNames)
        const tooSmall = counts.filter((entry) => entry.count < MIN_ROWS_PER_TABLE)
        if (tooSmall.length > 0) {
            throw new Error(
                `Some tables have fewer than ${MIN_ROWS_PER_TABLE} rows: ${tooSmall
                    .map((entry) => `${entry.tableName}=${entry.count}`)
                    .join(', ')}`
            )
        }

        const fkChecks = await verifyForeignKeys(client, schema)
        const invalidFks = fkChecks.filter((check) => check.invalidCount > 0)
        if (invalidFks.length > 0) {
            throw new Error(
                `Foreign key integrity violations detected: ${invalidFks
                    .slice(0, 10)
                    .map(
                        (check) =>
                            `${check.constraintName} (${check.childTable} -> ${check.parentTable}) invalid=${check.invalidCount}`
                    )
                    .join('; ')}`
            )
        }

        await client.query('COMMIT')

        printCountsTable(counts)
        console.log(
            `\nSeed completed successfully. All ${counts.length} base tables have >= ${MIN_ROWS_PER_TABLE} rows.`
        )
    } catch (error) {
        await client.query('ROLLBACK')
        console.error('Seed failed:', error.message)
        process.exit(1)
    } finally {
        await client.end()
    }
}

run().catch((error) => {
    console.error('Unhandled seed failure:', error)
    process.exit(1)
})
