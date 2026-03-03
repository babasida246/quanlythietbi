import type { CategorySpecDefRecord } from '@qltb/contracts'

type ExtractedSpec = Record<string, unknown>

const RAM_KEYS = new Set(['memoryType', 'memorySizeGb', 'busMhz'])
const STORAGE_KEYS = new Set(['storageType', 'capacityGb', 'interface'])

export function applyComputedSpec(modelName: string, defs: CategorySpecDefRecord[], spec: Record<string, unknown>): Record<string, unknown> {
    if (!modelName.trim() || defs.length === 0) return spec
    const computed = extractFromModelName(modelName, defs)
    if (Object.keys(computed).length === 0) return spec

    const next = { ...spec }
    for (const def of defs) {
        if (!def.isReadonly && !def.computedExpr) continue
        const existing = next[def.key]
        if (existing !== undefined && existing !== null && existing !== '') continue
        const value = computed[def.key]
        if (value !== undefined && value !== null && value !== '') {
            next[def.key] = value
        }
    }
    return next
}

function extractFromModelName(modelName: string, defs: CategorySpecDefRecord[]): ExtractedSpec {
    const keys = new Set(defs.map((def) => def.key))
    const extracted: ExtractedSpec = {}
    if (keysHasAny(keys, RAM_KEYS)) {
        const ram = extractRam(modelName)
        Object.assign(extracted, ram)
    }
    if (keysHasAny(keys, STORAGE_KEYS)) {
        const storage = extractStorage(modelName)
        Object.assign(extracted, storage)
    }
    return extracted
}

function keysHasAny(keys: Set<string>, target: Set<string>): boolean {
    for (const key of target) {
        if (keys.has(key)) return true
    }
    return false
}

function extractRam(modelName: string): ExtractedSpec {
    const result: ExtractedSpec = {}
    const text = modelName.toUpperCase()

    const ddrMatch = text.match(/DDR\s?(3|4|5)/)
    if (ddrMatch) {
        result.memoryType = `DDR${ddrMatch[1]}`
    }

    const sizeMatch = text.match(/(\d+(?:\.\d+)?)\s?GB/)
    if (sizeMatch) {
        result.memorySizeGb = Number(sizeMatch[1])
    }

    const mhzMatch = text.match(/(\d{3,5})\s?MHZ/)
    if (mhzMatch) {
        result.busMhz = Number(mhzMatch[1])
    }
    return result
}

function extractStorage(modelName: string): ExtractedSpec {
    const result: ExtractedSpec = {}
    const text = modelName.toUpperCase()

    if (text.includes('NVME')) {
        result.storageType = 'NVMe'
        result.interface = 'PCIe'
    } else if (text.includes('SSD')) {
        result.storageType = 'SSD'
    } else if (text.includes('HDD')) {
        result.storageType = 'HDD'
    }

    if (text.includes('SATA')) {
        result.interface = 'SATA'
    } else if (text.includes('SAS')) {
        result.interface = 'SAS'
    } else if (text.includes('PCIE')) {
        result.interface = 'PCIe'
    }

    const capacityMatch = text.match(/(\d+(?:\.\d+)?)\s?(TB|GB)/)
    if (capacityMatch) {
        const value = Number(capacityMatch[1])
        const unit = capacityMatch[2]
        result.capacityGb = unit === 'TB' ? Math.round(value * 1024) : value
    }

    return result
}
