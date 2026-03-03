import { DomainError } from '../errors/index.js'

export default class UserId {
    private constructor(public readonly value: string) { }

    static create(value: string): UserId {
        const trimmed = value.trim()
        if (trimmed.length === 0) {
            throw DomainError.validation('UserId cannot be empty', 'userId')
        }
        if (trimmed.length > 255) {
            throw DomainError.validation('UserId too long (max 255)', 'userId')
        }
        return new UserId(trimmed)
    }

    equals(other: UserId): boolean {
        return this.value === other.value
    }

    toString(): string {
        return this.value
    }
}
