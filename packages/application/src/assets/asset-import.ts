import { AssetStatusValues, assertAssetCode, assertModelId, assertVlanId } from '@qltb/domain'
import type { AssetBulkUpsertInput, AssetImportPreviewResult, AssetImportRow } from '@qltb/contracts'

export function buildImportPreview(rows: AssetImportRow[]): AssetImportPreviewResult {
    const seen = new Set<string>()
    const items = rows.map(row => {
        const errors: string[] = []
        if (seen.has(row.assetCode)) {
            errors.push('Duplicate asset code in import')
        } else {
            seen.add(row.assetCode)
        }
        errors.push(...validateImportRow(row))
        return { row, valid: errors.length === 0, errors }
    })
    const validCount = items.filter(item => item.valid).length
    return {
        items,
        total: items.length,
        validCount,
        invalidCount: items.length - validCount
    }
}

export function getValidImportRows(preview: AssetImportPreviewResult): AssetBulkUpsertInput[] {
    return preview.items.filter(item => item.valid).map(item => ({
        ...item.row,
        status: item.row.status ?? 'in_stock'
    }))
}

function validateImportRow(row: AssetImportRow): string[] {
    const errors: string[] = []
    try {
        assertAssetCode(row.assetCode)
    } catch (error) {
        if (error instanceof Error) errors.push(error.message)
    }
    try {
        assertModelId(row.modelId)
    } catch (error) {
        if (error instanceof Error) errors.push(error.message)
    }
    try {
        assertVlanId(row.vlanId ?? null)
    } catch (error) {
        if (error instanceof Error) errors.push(error.message)
    }
    if (row.status && !AssetStatusValues.includes(row.status)) {
        errors.push('Invalid status value')
    }
    return errors
}
