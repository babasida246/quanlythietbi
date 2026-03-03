import type { FullConfig } from '@playwright/test'
import { cleanupAll } from './seed/seed'

export default async function globalTeardown(_config: FullConfig): Promise<void> {
    await cleanupAll()
}
