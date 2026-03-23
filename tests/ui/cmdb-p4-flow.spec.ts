import { expect, test, type Page } from '@playwright/test'
import jwt from 'jsonwebtoken'
import pg from 'pg'

type TestIdentity = {
    userId: string
    email: string
    role: string
}

type DbUserRow = {
    id: string
    email: string
    role: string
}

function signAccessToken(identity: TestIdentity): string {
    return jwt.sign(
        {
            userId: identity.userId,
            email: identity.email,
            role: identity.role
        },
        process.env.JWT_ACCESS_SECRET || 'dev-access-secret-key',
        { expiresIn: '15m' }
    )
}

async function installJwtSession(page: Page, identity: TestIdentity): Promise<void> {
    const token = signAccessToken(identity)
    await page.addInitScript(
        (payload: { token: string; identity: TestIdentity }) => {
            localStorage.setItem('authToken', payload.token)
            localStorage.setItem('refreshToken', 'playwright-no-refresh')
            localStorage.setItem('userId', payload.identity.userId)
            localStorage.setItem('userEmail', payload.identity.email)
            localStorage.setItem('userRole', payload.identity.role)
            localStorage.setItem('userName', payload.identity.email)
        },
        { token, identity }
    )
}

async function selectFirstNonEmptyOption(select: import('@playwright/test').Locator): Promise<string> {
    await expect.poll(async () => select.locator('option').count()).toBeGreaterThan(1)
    const value = await select.locator('option:not([value=""])').first().getAttribute('value')
    expect(value).toBeTruthy()
    return value!
}

async function clickChangeAction(page: Page, action: 'submit' | 'approve' | 'implement' | 'close'): Promise<void> {
    const responsePromise = page.waitForResponse(
        (response) =>
            response.request().method() === 'POST' &&
            response.url().includes('/api/v1/cmdb/changes/') &&
            response.url().endsWith(`/${action}`)
    )

    await page.getByTestId('cmdb-change-detail').getByRole('button', { name: new RegExp(`^${action}$`, 'i') }).click()
    const response = await responsePromise
    const status = response.status()
    const bodyText = await response.text()
    expect(status, `${action} response: ${bodyText}`).toBe(200)
}

async function loadPrivilegedUsers(limit = 2): Promise<TestIdentity[]> {
    const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/qltb'
    const client = new pg.Client({ connectionString })
    await client.connect()
    try {
        const result = await client.query<DbUserRow>(
            `
            SELECT id::text, email, role
            FROM users
            WHERE COALESCE(is_active, true) = true
              AND COALESCE(status, 'active') = 'active'
              AND role IN ('admin', 'super_admin', 'it_asset_manager', 'manager')
            ORDER BY CASE
                WHEN role IN ('super_admin', 'admin') THEN 0
                WHEN role IN ('it_asset_manager', 'manager') THEN 1
                ELSE 9
            END, created_at ASC
            LIMIT $1
            `,
            [limit]
        )

        return result.rows.map((row) => ({
            userId: row.id,
            email: row.email,
            role: row.role
        }))
    } finally {
        await client.end().catch(() => undefined)
    }
}

test.describe('CMDB P4 UI Flows', () => {
    test.describe.configure({ mode: 'serial' })

    test('create cmdb change -> submit -> approve -> implement -> close', async ({ page, browser }) => {
        test.slow()
        const privilegedUsers = await loadPrivilegedUsers(2)
        expect(privilegedUsers.length).toBeGreaterThan(1)
        const requester = privilegedUsers[0]
        const approver = privilegedUsers[1]
        await installJwtSession(page, requester)

        const uniqueTitle = `E2E CMDB Change ${Date.now()}`

        await page.goto('/cmdb/changes')
        // Heading text varies by locale: "Change History" (EN), "Configuration Changes" (fallback)
        await expect(page.getByRole('heading').first()).toBeVisible({ timeout: 30_000 })

        await page.getByTestId('cmdb-changes-new').click()
        const createModal = page.getByTestId('modal-create')
        await expect(createModal).toBeVisible()

        await page.locator('#cmdb-change-title').fill(uniqueTitle)
        await page.locator('#cmdb-change-desc').fill('Playwright UI P4 lifecycle flow')
        await page.locator('#cmdb-change-impl').fill('Implement during maintenance window')
        await page.locator('#cmdb-change-rollback').fill('Rollback config if needed')

        const primaryCiSelect = page.locator('#cmdb-change-primary-ci')
        const primaryCiValue = await selectFirstNonEmptyOption(primaryCiSelect)
        await primaryCiSelect.selectOption(primaryCiValue)

        await page.getByTestId('btn-submit').click()
        await expect(page.getByTestId('cmdb-change-detail')).toBeVisible({ timeout: 15_000 })
        await expect(page.getByTestId('cmdb-change-detail')).toContainText(uniqueTitle)
        // Status badge text is locale-dependent ("Draft" or "Bản nháp") — use case-insensitive check
        await expect(page.getByTestId('cmdb-change-detail')).toContainText(/draft/i)

        await clickChangeAction(page, 'submit')
        await expect(page.getByTestId('cmdb-change-detail')).toContainText(/submitted/i)
        // "Impact (Snapshot)" in EN or "Ảnh hưởng (Chụp nhanh)" in VI
        await expect(page.locator('text=/Impact.*Snapshot|Ảnh hưởng/i').first()).toBeVisible()

        const baseOrigin = new URL(page.url()).origin
        const approverContext = await browser.newContext()
        const approverPage = await approverContext.newPage()
        try {
            await installJwtSession(approverPage, approver)
            await approverPage.goto(`${baseOrigin}/cmdb/changes`)
            await expect(approverPage.getByRole('heading').first()).toBeVisible({ timeout: 30_000 })
            await approverPage.locator('#cmdb-changes-q').fill(uniqueTitle)
            await approverPage.getByRole('button', { name: /^Apply$/i }).click()
            await approverPage.locator('tr', { hasText: uniqueTitle }).click()
            await expect(approverPage.getByTestId('cmdb-change-detail')).toContainText(/submitted/i)
            await clickChangeAction(approverPage, 'approve')
            await expect(approverPage.getByTestId('cmdb-change-detail')).toContainText(/approved/i)
        } finally {
            await approverContext.close()
        }

        await page.getByTestId('cmdb-change-detail').getByRole('button', { name: /^Reload$/i }).click()
        await expect(page.getByTestId('cmdb-change-detail')).toContainText(/approved/i)
        await clickChangeAction(page, 'implement')
        await expect(page.getByTestId('cmdb-change-detail')).toContainText(/implemented/i)
        await clickChangeAction(page, 'close')
        await expect(page.getByTestId('cmdb-change-detail')).toContainText(/closed/i)
        await expect(page.getByTestId('cmdb-change-detail')).toContainText(/Impact.*Snapshot|Ảnh hưởng/i)
    })

    test('relationship import dry-run shows result panel', async ({ page }) => {
        test.slow()
        const privilegedUsers = await loadPrivilegedUsers(1)
        expect(privilegedUsers.length).toBeGreaterThan(0)
        const requester = privilegedUsers[0]
        await installJwtSession(page, requester)

        await page.goto('/cmdb/relationships/import')
        // Heading: "Configuration Item Relationship Import" (EN) or equivalent
        await expect(page.getByRole('heading').first()).toBeVisible({ timeout: 30_000 })

        const firstRow = page.locator('tbody tr').first()
        const rowSelects = firstRow.locator('select')
        const relTypeSelect = rowSelects.nth(0)
        const fromCiSelect = rowSelects.nth(1)
        const toCiSelect = rowSelects.nth(2)

        const relTypeValue = await selectFirstNonEmptyOption(relTypeSelect)
        const fromCiValue = await selectFirstNonEmptyOption(fromCiSelect)
        await relTypeSelect.selectOption(relTypeValue)
        await fromCiSelect.selectOption(fromCiValue)

        await expect.poll(async () => toCiSelect.locator('option').count()).toBeGreaterThan(2)
        const toOptions = toCiSelect.locator('option:not([value=""])')
        const toCount = await toOptions.count()
        let chosenTo = ''
        for (let i = 0; i < toCount; i += 1) {
            const value = await toOptions.nth(i).getAttribute('value')
            if (value && value !== fromCiValue) {
                chosenTo = value
                break
            }
        }
        expect(chosenTo).toBeTruthy()
        await toCiSelect.selectOption(chosenTo)

        await firstRow.locator('input[type="text"]').fill('playwright-ui-p4-dry-run')
        await page.getByRole('button', { name: /^Dry run$/i }).click()

        await expect(page.getByText('Import Result')).toBeVisible({ timeout: 15_000 })
        await expect(page.getByText(/dry-run/i).first()).toBeVisible()
        await expect(page.getByText(/Mode/)).toBeVisible()
    })
})
