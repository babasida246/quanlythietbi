import { AppError } from '@qltb/domain'
import type {
    EquipmentGroupRecord,
    EquipmentGroupFieldRecord,
    EquipmentGroupTreeNode,
    EquipmentGroupCreateInput,
    EquipmentGroupUpdateInput,
    EquipmentGroupFieldCreateInput,
    EquipmentGroupFieldUpdateInput,
    IEquipmentGroupRepo,
} from '@qltb/contracts'

export class EquipmentGroupService {
    constructor(private repo: IEquipmentGroupRepo) {}

    // ── Groups ───────────────────────────────────────────────

    async list(filters?: { isActive?: boolean }): Promise<EquipmentGroupRecord[]> {
        return this.repo.list(filters)
    }

    async getTree(): Promise<EquipmentGroupTreeNode[]> {
        return this.repo.getTree()
    }

    async getById(id: string): Promise<EquipmentGroupRecord> {
        const group = await this.repo.getById(id)
        if (!group) throw new AppError('NOT_FOUND', `Equipment group not found: ${id}`)
        return group
    }

    async create(input: EquipmentGroupCreateInput): Promise<EquipmentGroupRecord> {
        if (!input.name?.trim()) {
            throw new AppError('VALIDATION_ERROR', 'Tên nhóm vật tư là bắt buộc')
        }
        if (input.parentId) {
            const parent = await this.repo.getById(input.parentId)
            if (!parent) throw new AppError('VALIDATION_ERROR', 'Nhóm cha không tồn tại')
            // Không cho phép tạo vòng lặp (parent = chính nó)
            if (input.parentId === input.parentId) {
                throw new AppError('VALIDATION_ERROR', 'Nhóm không thể là cha của chính nó')
            }
        }
        return this.repo.create({ ...input, name: input.name.trim() })
    }

    async update(id: string, input: EquipmentGroupUpdateInput): Promise<EquipmentGroupRecord> {
        await this.getById(id)
        if (input.parentId !== undefined && input.parentId !== null) {
            // Ngăn circular reference
            if (input.parentId === id) {
                throw new AppError('VALIDATION_ERROR', 'Nhóm không thể là cha của chính nó')
            }
            const parent = await this.repo.getById(input.parentId)
            if (!parent) throw new AppError('VALIDATION_ERROR', 'Nhóm cha không tồn tại')
        }
        if (input.name !== undefined && !input.name?.trim()) {
            throw new AppError('VALIDATION_ERROR', 'Tên nhóm vật tư không được để trống')
        }
        if (input.name) input = { ...input, name: input.name.trim() }
        return this.repo.update(id, input)
    }

    async delete(id: string): Promise<void> {
        await this.getById(id)
        const all = await this.repo.list()
        const hasChildren = all.some(g => g.parentId === id)
        if (hasChildren) {
            throw new AppError('CONFLICT', 'Không thể xóa nhóm còn có nhóm con. Xóa nhóm con trước.')
        }
        const ok = await this.repo.delete(id)
        if (!ok) throw new AppError('NOT_FOUND', `Equipment group not found: ${id}`)
    }

    // ── Fields ───────────────────────────────────────────────

    async listFields(groupId: string): Promise<EquipmentGroupFieldRecord[]> {
        await this.getById(groupId)
        return this.repo.listFields(groupId)
    }

    async getEffectiveFields(groupId: string): Promise<EquipmentGroupFieldRecord[]> {
        await this.getById(groupId)
        return this.repo.getEffectiveFields(groupId)
    }

    async createField(groupId: string, input: EquipmentGroupFieldCreateInput): Promise<EquipmentGroupFieldRecord> {
        await this.getById(groupId)
        if (!input.key?.trim()) throw new AppError('VALIDATION_ERROR', 'Key trường thông tin là bắt buộc')
        if (!input.label?.trim()) throw new AppError('VALIDATION_ERROR', 'Nhãn trường thông tin là bắt buộc')
        if (input.fieldType === 'enum' && (!input.enumValues || input.enumValues.length === 0)) {
            throw new AppError('VALIDATION_ERROR', 'Trường kiểu enum phải có ít nhất một giá trị')
        }
        // Normalize key: lowercase, replace spaces/dashes with underscore
        const key = input.key.trim().toLowerCase().replace(/[\s-]+/g, '_')
        return this.repo.createField(groupId, { ...input, key, label: input.label.trim() })
    }

    async updateField(fieldId: string, input: EquipmentGroupFieldUpdateInput): Promise<EquipmentGroupFieldRecord> {
        if (input.fieldType === 'enum' && input.enumValues != null && input.enumValues.length === 0) {
            throw new AppError('VALIDATION_ERROR', 'Trường kiểu enum phải có ít nhất một giá trị')
        }
        if (input.label !== undefined && !input.label?.trim()) {
            throw new AppError('VALIDATION_ERROR', 'Nhãn trường thông tin không được để trống')
        }
        if (input.label) input = { ...input, label: input.label.trim() }
        return this.repo.updateField(fieldId, input)
    }

    async deleteField(fieldId: string): Promise<void> {
        const ok = await this.repo.deleteField(fieldId)
        if (!ok) throw new AppError('NOT_FOUND', `Equipment group field not found: ${fieldId}`)
    }
}
