import type { CategorySpecDefInput } from '@qltb/contracts'

type Template = {
    matches: string[]
    defs: CategorySpecDefInput[]
}

const templates: Template[] = [
    {
        matches: ['ram', 'memory'],
        defs: [
            {
                key: 'memoryType',
                label: 'Memory Type',
                fieldType: 'enum',
                enumValues: ['DDR3', 'DDR4', 'DDR5'],
                sortOrder: 1,
                isReadonly: true,
                computedExpr: 'modelName.ddr',
                isFilterable: true
            },
            {
                key: 'memorySizeGb',
                label: 'Memory Size',
                fieldType: 'number',
                unit: 'GB',
                required: true,
                sortOrder: 2,
                isReadonly: true,
                computedExpr: 'modelName.capacityGb',
                isFilterable: true
            },
            {
                key: 'busMhz',
                label: 'Bus Speed',
                fieldType: 'number',
                unit: 'MHz',
                sortOrder: 3,
                isReadonly: true,
                computedExpr: 'modelName.busMhz'
            },
            { key: 'formFactor', label: 'Form Factor', fieldType: 'enum', enumValues: ['DIMM', 'SODIMM'], sortOrder: 4 },
            { key: 'ecc', label: 'ECC', fieldType: 'boolean', sortOrder: 5 }
        ]
    },
    {
        matches: ['storage', 'disk', 'drive'],
        defs: [
            {
                key: 'storageType',
                label: 'Storage Type',
                fieldType: 'enum',
                enumValues: ['SSD', 'HDD', 'NVMe'],
                sortOrder: 1,
                isReadonly: true,
                computedExpr: 'modelName.storageType',
                isFilterable: true
            },
            {
                key: 'capacityGb',
                label: 'Capacity',
                fieldType: 'number',
                unit: 'GB',
                required: true,
                sortOrder: 2,
                isReadonly: true,
                computedExpr: 'modelName.capacityGb',
                isFilterable: true
            },
            {
                key: 'interface',
                label: 'Interface',
                fieldType: 'enum',
                enumValues: ['SATA', 'SAS', 'PCIe'],
                sortOrder: 3,
                isReadonly: true,
                computedExpr: 'modelName.interface',
                isFilterable: true
            },
            { key: 'formFactor', label: 'Form Factor', fieldType: 'enum', enumValues: ['2.5', '3.5', 'M.2'], sortOrder: 4 },
            { key: 'readMbps', label: 'Read Speed', fieldType: 'number', unit: 'MB/s', sortOrder: 5 },
            { key: 'writeMbps', label: 'Write Speed', fieldType: 'number', unit: 'MB/s', sortOrder: 6 }
        ]
    },
    {
        matches: ['switch'],
        defs: [
            { key: 'ports', label: 'Ports', fieldType: 'number', required: true, sortOrder: 1, isFilterable: true },
            { key: 'poe', label: 'PoE', fieldType: 'boolean', sortOrder: 2 },
            { key: 'uplinkPorts', label: 'Uplink Ports', fieldType: 'number', sortOrder: 3 },
            { key: 'speed', label: 'Speed', fieldType: 'enum', enumValues: ['1G', '2.5G', '10G'], sortOrder: 4, isFilterable: true },
            { key: 'layer', label: 'Layer', fieldType: 'enum', enumValues: ['L2', 'L3'], sortOrder: 5 },
            { key: 'managed', label: 'Managed', fieldType: 'boolean', sortOrder: 6 }
        ]
    },
    {
        matches: ['printer'],
        defs: [
            { key: 'printType', label: 'Print Type', fieldType: 'enum', enumValues: ['thermal', 'laser', 'ink'], sortOrder: 1 },
            { key: 'dpi', label: 'Resolution', fieldType: 'number', sortOrder: 2 },
            { key: 'speedPpm', label: 'Speed (PPM)', fieldType: 'number', sortOrder: 3 },
            { key: 'connection', label: 'Connection', fieldType: 'enum', enumValues: ['USB', 'LAN', 'WiFi'], sortOrder: 4 },
            { key: 'duplex', label: 'Duplex', fieldType: 'boolean', sortOrder: 5 }
        ]
    },
    {
        matches: ['ups'],
        defs: [
            { key: 'capacityVa', label: 'Capacity', fieldType: 'number', unit: 'VA', sortOrder: 1 },
            { key: 'capacityW', label: 'Capacity', fieldType: 'number', unit: 'W', sortOrder: 2 },
            { key: 'batteryType', label: 'Battery Type', fieldType: 'enum', enumValues: ['AGM', 'LiFePO4'], sortOrder: 3 },
            { key: 'outlets', label: 'Outlets', fieldType: 'number', sortOrder: 4 },
            { key: 'rackMount', label: 'Rack Mount', fieldType: 'boolean', sortOrder: 5 }
        ]
    }
]

function normalize(input: string): string {
    return input.trim().toLowerCase()
}

export function matchCategoryTemplate(categoryName: string): CategorySpecDefInput[] | null {
    const normalized = normalize(categoryName)
    if (!normalized) return null
    const match = templates.find((template) =>
        template.matches.some((keyword) => normalized.includes(keyword))
    )
    return match ? match.defs : null
}
