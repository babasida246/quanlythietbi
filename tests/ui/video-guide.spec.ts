/**
 * Video hướng dẫn QLTB — luồng đầu cuối (single take).
 *
 * Chạy:
 *   npx playwright test --config playwright.video.config.ts
 *
 * Luồng:
 *   Đăng nhập → Khai báo thiết bị → Nhập kho → Gán tài sản (Cấp phát)
 *   → Luân chuyển → Kiểm kê → Thu hồi
 */
import { expect, test, type Page } from '@playwright/test'

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Dừng n ms — dùng sau mỗi hành động quan trọng để video dễ xem. */
async function pause(page: Page, ms = 900) {
    await page.waitForTimeout(ms)
}

/** Điều hướng + chờ trang ổn định. */
async function nav(page: Page, path: string, waitMs = 1200) {
    await page.goto(path)
    await page.waitForLoadState('domcontentloaded')
    await pause(page, waitMs)
}

/**
 * Hiển thị banner step ở dưới màn hình.
 * Tự động xóa banner cũ trước khi thêm mới.
 */
async function showStep(page: Page, stepLabel: string, title: string, pauseMs = 1800) {
    await page.evaluate(
        ({ stepLabel, title }) => {
            document.getElementById('vg-step')?.remove()

            // Inject animation keyframes once
            if (!document.getElementById('vg-style')) {
                const style = document.createElement('style')
                style.id = 'vg-style'
                style.textContent = `
                  @keyframes vg-in  { from { opacity:0; transform:translateX(-50%) translateY(14px) } to { opacity:1; transform:translateX(-50%) translateY(0) } }
                  @keyframes vg-out { from { opacity:1 } to   { opacity:0 } }
                `
                document.head.appendChild(style)
            }

            const el = document.createElement('div')
            el.id = 'vg-step'
            el.style.cssText = `
              position:fixed; bottom:22px; left:50%; transform:translateX(-50%);
              background:rgba(15,23,42,0.94);
              border:1px solid rgba(99,102,241,0.55);
              border-radius:10px;
              padding:10px 28px;
              font-family:system-ui,-apple-system,sans-serif;
              text-align:center;
              z-index:9999999;
              box-shadow:0 8px 32px rgba(0,0,0,0.55);
              min-width:300px;
              animation:vg-in .25s ease;
            `
            el.innerHTML = `
              <div style="font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#818cf8;margin-bottom:3px">${stepLabel}</div>
              <div style="font-size:16px;font-weight:700;color:#f1f5f9">${title}</div>
            `
            document.body.appendChild(el)
        },
        { stepLabel, title },
    )
    await pause(page, pauseMs)
}

/** Xóa banner step. */
async function hideStep(page: Page) {
    await page.evaluate(() => document.getElementById('vg-step')?.remove())
    await pause(page, 400)
}

/**
 * Chọn option đầu tiên không rỗng của một <select>.
 * Trả về true nếu thành công.
 */
async function selectFirst(page: Page, selector: string): Promise<boolean> {
    const sel = page.locator(selector)
    if (await sel.count() === 0) return false
    // Chờ tối đa 10s cho options load
    try {
        await expect.poll(() => sel.locator('option:not([value=""])').count(), { timeout: 10_000 }).toBeGreaterThan(0)
    } catch {
        return false
    }
    const val = await sel.locator('option:not([value=""])').first().getAttribute('value')
    if (!val) return false
    await sel.selectOption(val)
    return true
}

/** Kiểm tra trang hiện tại có phải màn hình 403 do route guard không. */
async function isRouteDenied(page: Page): Promise<boolean> {
    return (
        (await page.locator('text=You do not have access to this route.').count()) > 0 ||
        (await page.locator('text=403').count()) > 0
    )
}

// ─────────────────────────────────────────────────────────────────────────────
// Test
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Video hướng dẫn QLTB', () => {
    test('Luồng đầu cuối: khai báo → nhập kho → cấp phát → luân chuyển → kiểm kê → thu hồi', async ({ page }) => {
        test.setTimeout(25 * 60 * 1000)

        // Tự động chấp nhận dialog (alert/confirm) nếu có
        page.on('dialog', dialog => dialog.accept())

        const stamp = Date.now().toString().slice(-6)
        const hostname = `Laptop-Demo-${stamp}`
        let assetId = ''
        let canOperateAssetLifecycle = true

        // ── 0. ĐĂNG NHẬP ─────────────────────────────────────────────────────
        await showStep(page, 'Bước 0', 'Đăng nhập hệ thống', 1200)

        await nav(page, '/login')
        await page.locator('#login-email').fill('admin@example.com')
        await pause(page, 400)
        await page.locator('#login-password').fill('Benhvien@121')
        await pause(page, 600)
        await page.locator('button[type="submit"]').click()

        // Chờ thoát khỏi trang login (có thể chuyển đến /admin hoặc route trước đó)
        await expect
            .poll(() => new URL(page.url()).pathname, { timeout: 20_000 })
            .not.toBe('/login')

        // Chuẩn hóa điểm bắt đầu để các bước sau luôn ổn định
        await nav(page, '/assets', 1000)
        await pause(page, 1500)
        await hideStep(page)

        // ── 1. TỔNG QUAN DANH SÁCH TÀI SẢN ──────────────────────────────────
        await showStep(page, 'Tổng quan', 'Danh sách tài sản hiện có', 1000)
        await nav(page, '/assets', 1500)
        // Scroll nhẹ để thể hiện có dữ liệu
        await page.evaluate(() => window.scrollBy({ top: 200, behavior: 'smooth' }))
        await pause(page, 1200)
        await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }))
        await pause(page, 800)
        await hideStep(page)

        // ── 2. KHAI BÁO THÔNG TIN THIẾT BỊ ──────────────────────────────────
        await showStep(page, 'Bước 1', 'Khai báo thông tin thiết bị mới', 1500)

        await nav(page, '/assets/new', 1200)

        const deniedCreatePage =
            (await page.locator('text=You do not have access to this route.').count()) > 0 ||
            (await page.locator('text=403').count()) > 0

        if (deniedCreatePage) {
            // Một số môi trường RBAC chặn route /assets/new: fallback sang tài sản có sẵn
            await nav(page, '/assets', 1200)
            const editBtn = page.locator('[data-testid^="row-edit-"], [data-testid^="row-view-"]').first()
            if (await editBtn.count() > 0) {
                const tid = await editBtn.getAttribute('data-testid')
                assetId = (tid ?? '').replace('row-edit-', '').replace('row-view-', '')
            }
            await pause(page, 800)
        } else {
            // Chờ form load xong
            await page.waitForSelector('#new-name', { state: 'visible', timeout: 30_000 })

            // Tên thiết bị — gõ từng ký tự để trông tự nhiên
            await page.locator('#new-name').click()
            await page.locator('#new-name').pressSequentially(hostname, { delay: 70 })
            await pause(page, 500)

            // Mã tài sản
            await page.locator('#new-code').fill(`AST-${stamp}`)
            await pause(page, 400)

            // Số serial
            await page.locator('#new-serial').fill(`SN-VID-${stamp}`)
            await pause(page, 400)

            // Ngày mua
            await page.locator('#new-purchase').fill('2026-01-15')
            await pause(page, 300)

            // Hết hạn bảo hành
            await page.locator('#new-warranty').fill('2029-01-15')
            await pause(page, 300)

            // Ghi chú
            await page.locator('#new-notes').fill('Thiết bị dùng cho video hướng dẫn')
            await pause(page, 400)

            // Scroll sang phần phân loại
            await page.evaluate(() => {
                const el = document.querySelector('#new-category')?.closest('.card')
                el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
            })
            await pause(page, 700)

            // Danh mục
            await selectFirst(page, '#new-category')
            await pause(page, 500)

            // Model (bắt buộc — scroll vào view rồi chọn)
            await selectFirst(page, '#new-model')
            await pause(page, 700)

            // Nhà cung cấp
            await selectFirst(page, '#new-vendor')
            await pause(page, 400)

            // Vị trí
            await selectFirst(page, '#new-location')
            await pause(page, 400)

            // Scroll lên nút Lưu
            await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }))
            await pause(page, 600)

            // Lưu
            await page.locator('button:has-text("Create Asset"), button:has-text("Tạo tài sản")').first().click()
            await pause(page, 2000)

            // Trang thành công — lấy asset code nếu có
            const codeEl = page.locator('code.code-inline').first()
            if (await codeEl.count() > 0) {
                const code = await codeEl.textContent() ?? ''
                await pause(page, 1500)
                // Nút "Back to list"
                await page.locator('button:has-text("Back to list"), button:has-text("Danh sách")').first().click()
                await page.waitForLoadState('domcontentloaded')
                await pause(page, 1200)

                // Tìm asset vừa tạo để lấy id
                const searchInput = page.locator('input[id="asset-search"], input[placeholder*="code"]').first()
                if (await searchInput.count() > 0) {
                    await searchInput.fill(code.trim())
                    await pause(page, 1000)
                }
                const editBtn = page.locator('[data-testid^="row-edit-"]').first()
                if (await editBtn.count() > 0) {
                    const tid = await editBtn.getAttribute('data-testid')
                    assetId = tid?.replace('row-edit-', '') ?? ''
                }
            } else {
                // Không có trang thành công — thử lấy id qua danh sách
                await nav(page, '/assets', 1000)
                const editBtn = page.locator('[data-testid^="row-edit-"]').first()
                if (await editBtn.count() > 0) {
                    const tid = await editBtn.getAttribute('data-testid')
                    assetId = tid?.replace('row-edit-', '') ?? ''
                }
            }
        }

        await hideStep(page)

        // ── 3. NHẬP KHO ──────────────────────────────────────────────────────
        await showStep(page, 'Bước 2', 'Tạo phiếu nhập kho', 1500)

        await nav(page, '/warehouse/documents/new', 1200)
        const deniedWarehouseDocPage =
            (await page.locator('text=You do not have access to this route.').count()) > 0 ||
            (await page.locator('text=403').count()) > 0

        if (deniedWarehouseDocPage) {
            // RBAC chặn tạo phiếu kho: fallback sang màn hình kho để vẫn có cảnh minh họa
            await nav(page, '/warehouse/stock', 1400)
            await page.evaluate(() => window.scrollBy({ top: 220, behavior: 'smooth' }))
            await pause(page, 1000)
            await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }))
            await pause(page, 800)
        } else {
            await page.waitForSelector('#new-doc-type', { state: 'visible', timeout: 30_000 })

            // Loại phiếu = receipt (mặc định đã là receipt)
            await page.locator('#new-doc-type').selectOption('receipt')
            await pause(page, 500)

            // Ngày lập
            await page.locator('#new-doc-date').fill('2026-04-08')
            await pause(page, 300)

            // Kho nhận
            await selectFirst(page, '#new-doc-warehouse')
            await pause(page, 500)

            // Nhà cung cấp
            await selectFirst(page, '#new-doc-supplier').catch(() => false)
            await pause(page, 400)

            // Người nhập
            await page.locator('#new-doc-submitter').fill('Nguyễn Văn A')
            await pause(page, 400)

            // Ghi chú
            await page.locator('#new-doc-note').fill(`Phiếu nhập theo video hướng dẫn #${stamp}`)
            await pause(page, 500)

            // Scroll xuống phần dòng hàng
            await page.evaluate(() => window.scrollBy({ top: 300, behavior: 'smooth' }))
            await pause(page, 700)

            // Thêm dòng tài sản (asset line) → minh họa nhập thiết bị vào kho
            const addAssetLineBtn = page.locator('button:has-text("+ Add Asset Line"), button:has-text("Thêm dòng thiết bị")')
            if (await addAssetLineBtn.count() > 0) {
                await addAssetLineBtn.first().click()
                await pause(page, 800)

                // Chọn model thiết bị ở dòng 1
                const modelSel = page.locator('[aria-label="Model thiet bi dong 1"]')
                if (await modelSel.count() > 0) {
                    await selectFirst(page, '[aria-label="Model thiet bi dong 1"]')
                    await pause(page, 400)
                }

                // Tên thiết bị
                const namePart = page.locator('[aria-label="Ten tai san dong 1"]')
                if (await namePart.count() > 0) {
                    await namePart.fill(hostname)
                    await pause(page, 300)
                }

                // Giá nhập
                const costInput = page.locator('[aria-label="Don gia dong 1"]')
                if (await costInput.count() > 0) {
                    await costInput.fill('15000000')
                    await pause(page, 300)
                }
            } else {
                // Nếu không có nút asset line, thêm dòng spare part
                const addPartBtn = page.locator('button:has-text("+ Add Part Line"), button:has-text("Thêm dòng vật tư")')
                if (await addPartBtn.count() > 0) {
                    await addPartBtn.first().click()
                    await pause(page, 800)

                    // Chọn vật tư dòng 1
                    await selectFirst(page, '[aria-label="Hang hoa vat tu dong 1"]').catch(() => false)
                    await pause(page, 400)

                    // Số lượng
                    const qtyInput = page.locator('[aria-label="So luong dong 1"]')
                    if (await qtyInput.count() > 0) {
                        await qtyInput.fill('2')
                        await pause(page, 300)
                    }

                    // Đơn giá
                    const costInput = page.locator('[aria-label="Don gia dong 1"]')
                    if (await costInput.count() > 0) {
                        await costInput.fill('500000')
                        await pause(page, 300)
                    }
                }
            }

            await pause(page, 600)

            // Scroll lên nút Lưu
            await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }))
            await pause(page, 700)

            // Lưu phiếu
            await page.locator('button:has-text("Save Document"), button:has-text("Lưu phiếu"), button:has-text("Lưu")').first().click()
            await pause(page, 2500)

            // Đợi chuyển về trang chi tiết phiếu
            await page.waitForLoadState('domcontentloaded')
            await pause(page, 1500)
        }
        await hideStep(page)

        // ── 4. CẤP PHÁT (GÁN TÀI SẢN) ───────────────────────────────────────
        await showStep(page, 'Bước 3', 'Cấp phát tài sản cho người dùng', 1500)

        // Điều hướng tới trang chi tiết tài sản
        if (assetId) {
            await nav(page, `/assets/${assetId}`, 1200)
        } else {
            await nav(page, '/assets', 1000)
            // Mở tài sản đầu tiên trong danh sách
            const viewBtn = page.locator('[data-testid^="row-view-"]').first()
            if (await viewBtn.count() > 0) {
                await viewBtn.click()
                await page.waitForLoadState('domcontentloaded')
                // Lấy assetId từ URL
                assetId = page.url().split('/').pop() ?? ''
                await pause(page, 1200)
            }
        }

        if (await isRouteDenied(page)) {
            canOperateAssetLifecycle = false
        }

        const assignOpenBtn = page.locator('button:has-text("Assign"), button:has-text("Gán")').first()
        if (canOperateAssetLifecycle && (await assignOpenBtn.count()) > 0) {
            await pause(page, 800)

            // Click nút "Assign"
            await assignOpenBtn.click()
            await pause(page, 1000)

            // Điền modal Gán tài sản
            await page.locator('#assign-type').selectOption('person')
            await pause(page, 400)

            await page.locator('#assign-name').fill('Trần Thị Bình')
            await pause(page, 400)

            await page.locator('#assign-id').fill(`EMP-${stamp}`)
            await pause(page, 400)

            await selectFirst(page, '#assign-location').catch(() => false)
            await pause(page, 400)

            await page.locator('#assign-note').fill('Cấp phát cho nhân viên phòng IT')
            await pause(page, 500)

            // Xác nhận gán
            await page.locator('button:has-text("Assign"):not([variant="secondary"]), button:has-text("Gán"):not([variant="secondary"])').last().click()
            await pause(page, 2000)

            // Chờ modal đóng
            await page.waitForSelector('#assign-name', { state: 'hidden', timeout: 10_000 }).catch(() => null)
            await pause(page, 1200)
        } else {
            canOperateAssetLifecycle = false
            await pause(page, 1200)
        }
        await hideStep(page)

        // ── 5. LUÂN CHUYỂN (GÁN LẠI CHO NGƯỜI KHÁC) ─────────────────────────
        await showStep(page, 'Bước 4', 'Luân chuyển tài sản sang người dùng khác', 1500)

        if (canOperateAssetLifecycle) {
            const transferAssignBtn = page.locator('button:has-text("Assign"), button:has-text("Gán")').first()
            if ((await transferAssignBtn.count()) > 0) {
                // Vẫn trên trang chi tiết asset, gán lại
                await transferAssignBtn.click()
                await pause(page, 1000)

                await page.locator('#assign-type').selectOption('department')
                await pause(page, 400)

                await page.locator('#assign-name').fill('Phòng Kỹ thuật')
                await pause(page, 400)

                await page.locator('#assign-id').fill(`DEPT-KT`)
                await pause(page, 400)

                await page.locator('#assign-note').fill('Luân chuyển từ nhân viên sang phòng ban')
                await pause(page, 500)

                await page.locator('button:has-text("Assign"):not([variant="secondary"]), button:has-text("Gán"):not([variant="secondary"])').last().click()
                await pause(page, 2000)

                await page.waitForSelector('#assign-name', { state: 'hidden', timeout: 10_000 }).catch(() => null)
                await pause(page, 1200)
            } else {
                canOperateAssetLifecycle = false
                await pause(page, 1200)
            }
        } else {
            await pause(page, 1200)
        }
        await hideStep(page)

        // ── 6. KIỂM KÊ ───────────────────────────────────────────────────────
        await showStep(page, 'Bước 5', 'Tạo phiên kiểm kê tài sản', 1500)

        await nav(page, '/inventory', 1200)

        if (await isRouteDenied(page)) {
            await pause(page, 1400)
        } else {
            // Mở form tạo phiên kiểm kê
            const createBtn = page.locator('button:has-text("Tạo phiên kiểm kê"), button:has-text("Tạo phiên đầu tiên")')
            await expect(createBtn.first()).toBeVisible({ timeout: 10_000 })
            await createBtn.first().click()
            await pause(page, 800)

            // Điền tên phiên
            const nameInput = page.locator('#newName')
            await expect(nameInput).toBeVisible({ timeout: 8_000 })
            await nameInput.fill(`Kiểm kê Q2-2026 — Video #${stamp}`)
            await pause(page, 500)

            // Scroll form vào view nếu cần
            await nameInput.scrollIntoViewIfNeeded()
            await pause(page, 400)

            // Xác nhận tạo phiên
            await page.locator('button[type="submit"]:has-text("Tạo phiên kiểm kê"), button:has-text("Tạo phiên kiểm kê")').last().click()
            await pause(page, 2500)

            await page.waitForLoadState('domcontentloaded')
            await pause(page, 1500)
        }
        await hideStep(page)

        // ── 7. THU HỒI ───────────────────────────────────────────────────────
        await showStep(page, 'Bước 6', 'Thu hồi tài sản từ người dùng', 1500)

        // Quay lại trang chi tiết tài sản
        if (canOperateAssetLifecycle) {
            if (assetId) {
                await nav(page, `/assets/${assetId}`, 1200)
            } else {
                await nav(page, '/assets', 1000)
                const viewBtn = page.locator('[data-testid^="row-view-"]').first()
                if (await viewBtn.count() > 0) {
                    await viewBtn.click()
                    await page.waitForLoadState('domcontentloaded')
                    await pause(page, 1200)
                }
            }

            if (await isRouteDenied(page)) {
                canOperateAssetLifecycle = false
                await pause(page, 1200)
            } else {
                const returnBtn = page.locator('button:has-text("Return"), button:has-text("Trả")').first()
                if ((await returnBtn.count()) > 0) {
                    // Click "Return / Trả"
                    await returnBtn.click()
                    await pause(page, 1000)

                    // Điền ghi chú thu hồi
                    const returnNote = page.locator('#return-note')
                    await expect(returnNote).toBeVisible({ timeout: 8_000 })
                    await returnNote.fill('Đã kiểm tra và thu hồi sau kiểm kê định kỳ')
                    await pause(page, 600)

                    // Xác nhận
                    await page.locator('button:has-text("Return"):not([variant="secondary"]), button:has-text("Trả"):not([variant="secondary"])').last().click()
                    await pause(page, 2500)

                    await page.waitForSelector('#return-note', { state: 'hidden', timeout: 10_000 }).catch(() => null)
                    await pause(page, 1500)
                } else {
                    canOperateAssetLifecycle = false
                    await pause(page, 1200)
                }
            }
        } else {
            await pause(page, 1200)
        }
        await hideStep(page)

        // ── KẾT THÚC ─────────────────────────────────────────────────────────
        await showStep(page, 'Hoàn thành', 'Luồng vòng đời tài sản đã được minh họa', 2500)

        // Quay về trang có quyền truy cập để kết thúc video
        await nav(page, canOperateAssetLifecycle ? '/assets' : '/admin', 1200)

        // Đảm bảo trang hiển thị bình thường
        await expect(page.locator('body')).toBeVisible()
        await pause(page, 3000)

        await hideStep(page)
        await pause(page, 1000)
    })
})
