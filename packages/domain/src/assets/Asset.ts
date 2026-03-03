import type { AssetStatus } from './types.js'
import { assertAssetCode, assertModelId, assertStatusTransition, assertVlanId } from './types.js'
export * from './types.js'
export * from './Assignment.js'
export * from './Maintenance.js'
export * from './Event.js'
export * from './Attachment.js'
export * from './Inventory.js'
export * from './Workflow.js'

export interface AssetProps {
    id: string
    assetCode: string
    modelId: string
    serialNo?: string | null
    macAddress?: string | null
    mgmtIp?: string | null
    hostname?: string | null
    vlanId?: number | null
    switchName?: string | null
    switchPort?: string | null
    locationId?: string | null
    status?: AssetStatus
    purchaseDate?: Date | null
    warrantyEnd?: Date | null
    vendorId?: string | null
    notes?: string | null
    createdAt?: Date
    updatedAt?: Date
}

export class Asset {
    public id: string
    public assetCode: string
    public modelId?: string | null
    public serialNo?: string | null
    public macAddress?: string | null
    public mgmtIp?: string | null
    public hostname?: string | null
    public vlanId?: number | null
    public switchName?: string | null
    public switchPort?: string | null
    public locationId?: string | null
    public status: AssetStatus
    public purchaseDate?: Date | null
    public warrantyEnd?: Date | null
    public vendorId?: string | null
    public notes?: string | null
    public createdAt: Date
    public updatedAt: Date

    constructor(props: AssetProps) {
        assertAssetCode(props.assetCode)
        assertModelId(props.modelId)
        assertVlanId(props.vlanId)

        this.id = props.id
        this.assetCode = props.assetCode.trim()
        this.modelId = props.modelId
        this.serialNo = props.serialNo ?? null
        this.macAddress = props.macAddress ?? null
        this.mgmtIp = props.mgmtIp ?? null
        this.hostname = props.hostname ?? null
        this.vlanId = props.vlanId ?? null
        this.switchName = props.switchName ?? null
        this.switchPort = props.switchPort ?? null
        this.locationId = props.locationId ?? null
        this.status = props.status ?? 'in_stock'
        this.purchaseDate = props.purchaseDate ?? null
        this.warrantyEnd = props.warrantyEnd ?? null
        this.vendorId = props.vendorId ?? null
        this.notes = props.notes ?? null
        this.createdAt = props.createdAt ?? new Date()
        this.updatedAt = props.updatedAt ?? new Date()
    }

    changeStatus(next: AssetStatus): void {
        assertStatusTransition(this.status, next)
        this.status = next
        this.updatedAt = new Date()
    }
}
