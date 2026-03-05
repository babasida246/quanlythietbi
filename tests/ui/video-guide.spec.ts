/**
 * KỊCH BẢN HƯỚNG DẪN SỬ DỤNG — VIDEO GUIDE
 * =========================================================
 * Chạy với: npx playwright test tests/ui/video-guide.spec.ts --project=video-guide
 *
 * Modules được demo:
 *  0. Trang chủ / Đăng nhập
 *  1. Danh mục tài sản (Asset Catalog: Categories, Models, Vendors, Warehouses)
 *  2. Tài sản (Assets: CRUD, trạng thái, chi tiết)
 *  3. Kho hàng – Chứng từ (Stock Documents: Nhập kho, Xuất kho)
 *  4. Kho hàng – Linh kiện & Tồn kho
 *  5. Kế hoạch mua sắm & Tăng tài sản (Purchase Plan, Asset Increase)
 *  6. Bảo trì / Work Order (Maintenance Tickets, Repair Orders)
 *  7. CMDB (CI Types, CIs, Services)
 *  8. Workflow / Yêu cầu (Requests, Approval)
 *  9. Analytics & Báo cáo
 * 10. Quản trị (Users, Automation, Integrations, Security)
 */

import { expect, test, type Page } from '@playwright/test'
import { applyUiAuth } from '../fixtures/auth'

// ---------------------------------------------------------------------------
// Timing constants (ms) — điều chỉnh để video chạy đủ chậm cho người xem
// ---------------------------------------------------------------------------
const PAUSE_SHORT = 1_200   // giữa các thao tác nhỏ
const PAUSE_MED = 2_500   // sau khi trang load / hiển thị kết quả
const PAUSE_LONG = 4_000   // khi giới thiệu trang mới
const PAUSE_FORM = 1_500   // sau khi điền form
const PAUSE_TOAST = 3_000   // chờ toast thành công hiển thị

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
async function step(page: Page, message: string, ms = PAUSE_MED) {
    // Highlight bằng console (sẽ appear trong trace)
    await page.evaluate((msg) => console.info(`▶ ${msg}`), message)
    await page.waitForTimeout(ms)
}

async function go(page: Page, path: string) {
    await page.goto(path)
    await page.waitForLoadState('domcontentloaded')
    await page.waitForTimeout(PAUSE_LONG)
}

async function slowFill(page: Page, locator: ReturnType<Page['locator']>, text: string) {
    await locator.click()
    await locator.clear()
    // Fill từng ký tự để video nhìn rõ đang nhập
    for (const ch of text) {
        await locator.type(ch, { delay: 60 })
    }
    await page.waitForTimeout(PAUSE_SHORT)
}

async function pickFirst(select: ReturnType<Page['locator']>) {
    const options = select.locator('option:not([value=""])')
    const count = await options.count()
    if (count === 0) return
    const val = await options.first().getAttribute('value')
    if (val) await select.selectOption(val)
}

async function scrollAndPause(page: Page, amount = 400) {
    await page.mouse.wheel(0, amount)
    await page.waitForTimeout(PAUSE_SHORT)
}

async function hoverRow(page: Page, rowLocator: ReturnType<Page['locator']>) {
    if ((await rowLocator.count()) > 0) {
        await rowLocator.first().hover()
        await page.waitForTimeout(PAUSE_SHORT)
    }
}

// ---------------------------------------------------------------------------
// Test: SERIAL — toàn bộ kịch bản là 1 luồng
// ---------------------------------------------------------------------------
test.describe.serial('🎬 Hướng dẫn sử dụng — Quản lý Thiết bị', () => {
    test.beforeEach(async ({ page }) => {
        // Inject auth admin vào mỗi test
        await applyUiAuth(page, 'admin')
    })

    // ═══════════════════════════════════════════════════════════════════════
    // 0. TRANG CHỦ & ĐĂNG NHẬP
    // ═══════════════════════════════════════════════════════════════════════
    test('00 — Trang đăng nhập & Dashboard', async ({ page }) => {
        await step(page, 'Mở trang đăng nhập', 0)
        await page.goto('/login')
        await page.waitForLoadState('domcontentloaded')
        await page.waitForTimeout(PAUSE_LONG)

        // Demo trang login (không điền — đã inject JWT)
        const emailInput = page.locator('input[type="email"], input[name="email"]').first()
        if ((await emailInput.count()) > 0) {
            await slowFill(page, emailInput, 'admin@example.com')
            const passInput = page.locator('input[type="password"]').first()
            if ((await passInput.count()) > 0) {
                await slowFill(page, passInput, '••••••••')
                await passInput.clear()
            }
        }
        await step(page, 'Hệ thống hỗ trợ đăng nhập bằng tài khoản email')

        // Chuyển sang dashboard (JWT đã inject)
        await go(page, '/')
        await step(page, 'Đây là trang Dashboard chính của hệ thống')

        // Scroll nhẹ
        await scrollAndPause(page, 300)
        await step(page, 'Dashboard hiển thị tổng quan tài sản, kho hàng, bảo trì', PAUSE_LONG)
    })

    // ═══════════════════════════════════════════════════════════════════════
    // 1. DANH MỤC TÀI SẢN
    // ═══════════════════════════════════════════════════════════════════════
    test('01 — Danh mục: Asset Categories & Models', async ({ page }) => {
        await go(page, '/assets/catalogs')
        await step(page, 'Module Danh mục — quản lý tất cả danh mục và model thiết bị', PAUSE_LONG)

        // Scroll để xem danh sách categories
        await scrollAndPause(page, 300)
        await step(page, 'Hệ thống có sẵn 20 danh mục thiết bị (Máy tính, Laptop, Máy in, ...)')

        // Hover vào một dòng
        const categoryRow = page.locator('tr, [class*="row"], [class*="item"]').nth(2)
        await hoverRow(page, categoryRow)
        await step(page, 'Mỗi danh mục có thể cấu hình trường thông số kỹ thuật (Spec)')

        // Scroll xuống để xem models
        await scrollAndPause(page, 500)
        await step(page, 'Danh sách model thiết bị được liên kết với danh mục và nhà cung cấp')

        // Scroll xem spec definitions
        await scrollAndPause(page, 400)
        await step(page, 'Mỗi model chứa thông số kỹ thuật dạng JSON (CPU, RAM, Disk, ...)', PAUSE_LONG)
    })

    test('01b — Danh mục: Vendors (Nhà cung cấp)', async ({ page }) => {
        // Catalogs page — vendor section
        await go(page, '/assets/catalogs')
        await step(page, 'Danh mục nhà cung cấp — Dell, HP, Lenovo, Cisco, ...', PAUSE_MED)
        await scrollAndPause(page, 800)
        await step(page, 'Mỗi nhà cung cấp được liên kết với tài sản và chứng từ kho hàng', PAUSE_LONG)
    })

    test('01c — Danh mục: Warehouses (Kho)', async ({ page }) => {
        await go(page, '/warehouse/warehouses')
        await step(page, 'Quản lý kho hàng — mỗi kho gắn với địa điểm cụ thể', PAUSE_LONG)

        await scrollAndPause(page, 300)
        const warehouseRow = page.locator('tr').nth(1)
        await hoverRow(page, warehouseRow)
        await step(page, 'Hệ thống có 5 kho: Kho chính, Kho Data Center, Kho Chi nhánh, ...', PAUSE_LONG)

        // Demo tạo kho mới
        const createBtn = page.getByTestId('btn-create')
            .or(page.getByRole('button', { name: /tạo|thêm|create|new/i }))
        if ((await createBtn.count()) > 0) {
            await step(page, 'Demo: Tạo kho mới')
            await createBtn.first().click()
            await page.waitForTimeout(PAUSE_MED)

            const nameInput = page.locator('#warehouse-name-create, input[name="name"], input[placeholder*="tên" i]').first()
            if ((await nameInput.count()) > 0) {
                await slowFill(page, nameInput, 'Kho Demo Video')
            }
            await step(page, 'Nhập tên kho và chọn địa điểm')

            // Đóng modal (không lưu thật) — scope inside modal to avoid sidebar btn
            const modal = page.getByTestId('modal-create')
            const modalFound = (await modal.count()) > 0
            if (modalFound) {
                const cancelBtn = modal.getByTestId('btn-cancel')
                    .or(modal.getByRole('button', { name: /hủy|cancel/i }))
                if ((await cancelBtn.count()) > 0) {
                    await cancelBtn.first().click()
                    await page.waitForTimeout(PAUSE_MED)
                } else {
                    await page.keyboard.press('Escape')
                    await page.waitForTimeout(PAUSE_MED)
                }
            } else {
                await page.keyboard.press('Escape')
                await page.waitForTimeout(PAUSE_MED)
            }
            await step(page, 'Giao diện tạo kho đơn giản và trực quan', PAUSE_MED)
        }
    })

    // ═══════════════════════════════════════════════════════════════════════
    // 2. TÀI SẢN
    // ═══════════════════════════════════════════════════════════════════════
    test('02 — Tài sản: Danh sách & CRUD', async ({ page }) => {
        await go(page, '/assets')
        await step(page, 'Module Tài sản — trung tâm quản lý toàn bộ thiết bị', PAUSE_LONG)

        // Filters
        const filterCategory = page.locator('#filter-category, select[name="category"], [data-testid*="filter-category"]').first()
        if ((await filterCategory.count()) > 0) {
            await step(page, 'Có thể lọc tài sản theo danh mục, trạng thái, địa điểm, nhà cung cấp')
            await pickFirst(filterCategory)
            await page.waitForTimeout(PAUSE_MED)
            // Reset lọc
            if ((await filterCategory.locator('option[value=""]').count()) > 0) {
                await filterCategory.selectOption('')
                await page.waitForTimeout(PAUSE_SHORT)
            }
        }

        await scrollAndPause(page, 400)
        await step(page, 'Bảng tài sản hiển thị mã, tên, danh mục, trạng thái, địa điểm')

        // Hover row
        const assetRow = page.locator('tbody tr').first()
        await hoverRow(page, assetRow)
        await step(page, 'Mỗi dòng có nút chỉnh sửa và xóa tài sản')

        // Demo mở create modal
        const createBtn = page.getByTestId('btn-create')
        if ((await createBtn.count()) > 0) {
            await step(page, 'Demo: Tạo tài sản mới')
            await createBtn.click()
            await page.waitForTimeout(PAUSE_MED)

            const modal = page.getByTestId('modal-create')
            if ((await modal.count()) > 0) {
                await expect(modal).toBeVisible({ timeout: 8_000 })
                await step(page, 'Form tạo tài sản: Tên, Mã, Danh mục, Model, Nhà cung cấp, Địa điểm, Serial, ...')

                const nameInput = page.locator('#asset-name-create')
                if ((await nameInput.count()) > 0) {
                    await slowFill(page, nameInput, 'Laptop Dell Demo')
                }

                const categorySelect = page.locator('#asset-category-create')
                if ((await categorySelect.count()) > 0) {
                    await page.waitForTimeout(PAUSE_MED)
                    if ((await categorySelect.locator('option').count()) > 1) {
                        await categorySelect.selectOption({ index: 2 })
                        await page.waitForTimeout(PAUSE_SHORT)
                    }
                }

                const modelSelect = page.locator('#asset-model-create')
                if ((await modelSelect.count()) > 0) {
                    await page.waitForTimeout(PAUSE_SHORT)
                    if ((await modelSelect.locator('option').count()) > 1) {
                        await pickFirst(modelSelect)
                        await page.waitForTimeout(PAUSE_SHORT)
                    }
                }

                await step(page, 'Model được lọc theo danh mục đã chọn — tiện lợi và chính xác', PAUSE_MED)

                const serialInput = page.locator('#asset-serial-create')
                if ((await serialInput.count()) > 0) {
                    await slowFill(page, serialInput, 'SN-VIDEO-DEMO-001')
                }

                await step(page, 'Sau khi điền đầy đủ thông tin, nhấn Lưu để tạo tài sản')

                // Đóng modal — không lưu
                const cancelModal = page.getByTestId('modal-create')
                if ((await cancelModal.count()) > 0) {
                    const cancelBtn = cancelModal.getByTestId('btn-cancel')
                        .or(cancelModal.getByRole('button', { name: /hủy|cancel/i }))
                    if ((await cancelBtn.count()) > 0) {
                        await cancelBtn.first().click()
                        await page.waitForTimeout(PAUSE_MED)
                    } else {
                        await page.keyboard.press('Escape')
                        await page.waitForTimeout(PAUSE_MED)
                    }
                } else {
                    await page.keyboard.press('Escape')
                    await page.waitForTimeout(PAUSE_MED)
                }
            }
        }
        await step(page, 'Hệ thống hỗ trợ import/export CSV để nhập liệu hàng loạt', PAUSE_MED)

        // Show import/export buttons
        const exportBtn = page.getByTestId('btn-export')
        if ((await exportBtn.count()) > 0) {
            await exportBtn.hover()
            await page.waitForTimeout(PAUSE_SHORT)
        }
    })

    test('02b — Tài sản: Chi tiết & Lịch sử', async ({ page }) => {
        await go(page, '/assets')

        // Click vào asset đầu tiên (nếu có link)
        const assetLink = page.locator('tbody tr a, tbody tr [href*="/assets/"]').first()
        if ((await assetLink.count()) > 0) {
            await step(page, 'Xem chi tiết tài sản', PAUSE_SHORT)
            await assetLink.click()
            await page.waitForLoadState('domcontentloaded')
            await page.waitForTimeout(PAUSE_LONG)

            await step(page, 'Trang chi tiết tài sản: thông số kỹ thuật, lịch sử, phân công sử dụng')
            await scrollAndPause(page, 500)
            await step(page, 'Lịch sử tài sản ghi nhận đầy đủ các sự kiện: nhập kho, gán, bảo trì, ...', PAUSE_LONG)
        } else {
            await step(page, 'Trang chi tiết tài sản cho phép xem lịch sử đầy đủ', PAUSE_MED)
        }
    })

    // ═══════════════════════════════════════════════════════════════════════
    // 3. KHO HÀNG — CHỨNG TỪ
    // ═══════════════════════════════════════════════════════════════════════
    test('03 — Kho hàng: Danh sách chứng từ', async ({ page }) => {
        await go(page, '/warehouse/documents')
        await step(page, 'Module Kho hàng — Chứng từ nhập/xuất kho, điều chuyển, điều chỉnh', PAUSE_LONG)

        await scrollAndPause(page, 300)
        await step(page, 'Các loại chứng từ: Phiếu nhập (Receipt), Phiếu xuất (Issue), Điều chuyển (Transfer), Điều chỉnh (Adjust)')

        // Filter by type
        const typeFilter = page.locator('select[data-testid*="filter"], select').first()
        if ((await typeFilter.count()) > 0 && (await typeFilter.locator('option').count()) > 1) {
            await typeFilter.selectOption({ index: 1 })
            await page.waitForTimeout(PAUSE_MED)
            await step(page, 'Lọc chứng từ theo loại, trạng thái, kho, ngày tháng')
            await typeFilter.selectOption({ index: 0 })
            await page.waitForTimeout(PAUSE_SHORT)
        }
    })

    test('03b — Kho hàng: Tạo phiếu nhập kho', async ({ page }) => {
        await go(page, '/warehouse/documents/new')
        await step(page, 'Form tạo chứng từ kho hàng — Phiếu nhập kho', PAUSE_LONG)

        // Chọn loại Nhập kho
        const docTypeSelect = page.locator('#new-doc-type')
        if ((await docTypeSelect.count()) > 0) {
            const receiptOption = docTypeSelect.locator('option[value="receipt"]')
            if ((await receiptOption.count()) > 0) {
                await docTypeSelect.selectOption('receipt')
                await page.waitForTimeout(PAUSE_SHORT)
            }
            await step(page, 'Loại chứng từ: Nhập kho (Receipt)')
        }

        // Ngày
        const dateInput = page.locator('#new-doc-date')
        if ((await dateInput.count()) > 0) {
            const today = new Date().toISOString().split('T')[0]
            await dateInput.fill(today)
            await page.waitForTimeout(PAUSE_SHORT)
        }

        // Chọn kho
        const warehouseSelect = page.locator('#new-doc-warehouse')
        if ((await warehouseSelect.count()) > 0) {
            await page.waitForTimeout(PAUSE_MED)
            if ((await warehouseSelect.locator('option').count()) > 1) {
                await pickFirst(warehouseSelect)
                await page.waitForTimeout(PAUSE_SHORT)
            }
            await step(page, 'Chọn kho nhập hàng — danh sách kho từ hệ thống quản lý kho')
        }

        // Nhà cung cấp (dropdown)
        const supplierSelect = page.locator('#new-doc-supplier')
        if ((await supplierSelect.count()) > 0) {
            await page.waitForTimeout(PAUSE_MED)
            if ((await supplierSelect.locator('option').count()) > 1) {
                await pickFirst(supplierSelect)
                await page.waitForTimeout(PAUSE_SHORT)
            }
            await step(page, 'Chọn nhà cung cấp — lấy từ danh mục Vendor đã cấu hình', PAUSE_MED)
        }

        // Ghi chú
        const noteInput = page.locator('#new-doc-note')
        if ((await noteInput.count()) > 0) {
            await slowFill(page, noteInput, 'Nhập linh kiện quý 1/2026')
        }

        await step(page, 'Thêm chi tiết linh kiện vào phiếu nhập')

        // Component stock lines (StockDocumentLines)
        const addLineBtn = page.locator('[data-testid="btn-add-line"], button:has-text("Thêm"), button:has-text("Add")').first()
        if ((await addLineBtn.count()) > 0) {
            await addLineBtn.click()
            await page.waitForTimeout(PAUSE_MED)
            await step(page, 'Thêm dòng linh kiện: chọn loại linh kiện, số lượng, đơn giá, danh mục')

            // Part select
            const linePartSelect = page.locator('select[name="partId"], select[data-testid*="part"]').first()
                .or(page.locator('tbody select, .line-item select').first())
            if ((await linePartSelect.count()) > 0) {
                await page.waitForTimeout(PAUSE_MED)
                if ((await linePartSelect.locator('option').count()) > 1) {
                    await pickFirst(linePartSelect)
                    await page.waitForTimeout(PAUSE_SHORT)
                }
            }

            const qtyInput = page.locator('input[name="qty"], [data-testid*="qty"], tbody input[type="number"]').first()
            if ((await qtyInput.count()) > 0) {
                await slowFill(page, qtyInput, '10')
            }

            const costInput = page.locator('input[name="unitCost"], [data-testid*="cost"]').first()
                .or(page.locator('tbody input[type="number"]').nth(1))
            if ((await costInput.count()) > 0) {
                await slowFill(page, costInput, '150000')
            }

            await step(page, 'Có thể thêm nhiều dòng linh kiện trong cùng một chứng từ', PAUSE_MED)
        }

        await step(page, 'Chứng từ sẽ đi qua quy trình: Nháp → Nộp → Duyệt → Ghi sổ', PAUSE_LONG)

        // Scroll để xem nút submit
        await scrollAndPause(page, 500)
        const saveBtn = page.locator('button:has-text("Lưu"), button:has-text("Save")').or(page.getByTestId('btn-submit')).first()
        if ((await saveBtn.count()) > 0) {
            await saveBtn.hover()
            await page.waitForTimeout(PAUSE_MED)
        }
        await step(page, 'Nhấn Lưu để tạo chứng từ ở trạng thái Nháp (Draft)', PAUSE_MED)
    })

    test('03c — Kho hàng: Tồn kho & Sổ cái', async ({ page }) => {
        await go(page, '/warehouse/stock')
        await step(page, 'Trang Tồn kho — xem số lượng hiện tại của từng loại linh kiện theo kho', PAUSE_LONG)
        await scrollAndPause(page, 400)
        await step(page, 'Theo dõi số lượng tối thiểu, số lượng hiện tại, số lượng tiêu thụ trung bình')

        await go(page, '/warehouse/ledger')
        await step(page, 'Sổ cái kho — lịch sử mọi giao dịch nhập/xuất/điều chuyển', PAUSE_LONG)
        await scrollAndPause(page, 400)
        await step(page, 'Có thể lọc theo kho, linh kiện, ngày tháng để tra cứu', PAUSE_LONG)
    })

    // ═══════════════════════════════════════════════════════════════════════
    // 4. LINH KIỆN (SPARE PARTS)
    // ═══════════════════════════════════════════════════════════════════════
    test('04 — Kho hàng: Linh kiện & Đối soát', async ({ page }) => {
        await go(page, '/warehouse/parts')
        await step(page, 'Danh mục linh kiện — quản lý toàn bộ spare parts trong hệ thống', PAUSE_LONG)
        await scrollAndPause(page, 400)
        await step(page, '35 loại linh kiện: RAM, SSD, HDD, Nguồn, Bàn phím, Chuột, Cáp, Mực in, ...')
        await scrollAndPause(page, 400)
        await step(page, 'Mỗi linh kiện có mã, danh mục, đơn vị, nhà sản xuất, mức tồn tối thiểu', PAUSE_LONG)

        await go(page, '/warehouse/reconciliation')
        await step(page, 'Đối soát kho — so sánh số liệu hệ thống với kiểm kê thực tế', PAUSE_LONG)
        await scrollAndPause(page, 300)
        await step(page, 'Tính năng đối soát giúp phát hiện chênh lệch và xử lý điều chỉnh', PAUSE_LONG)
    })

    // ═══════════════════════════════════════════════════════════════════════
    // 5. KẾ HOẠCH MUA SẮM & TĂNG TÀI SẢN
    // ═══════════════════════════════════════════════════════════════════════
    test('05 — Kế hoạch mua sắm & Đề xuất tăng tài sản', async ({ page }) => {
        await go(page, '/assets/purchase-plans')
        await step(page, 'Kế hoạch mua sắm — lập kế hoạch và trình duyệt mua thiết bị mới', PAUSE_LONG)
        await scrollAndPause(page, 400)
        await step(page, 'Mỗi kế hoạch gồm danh sách model cần mua, số lượng, ngân sách dự kiến')

        await go(page, '/assets/purchase-plans/new')
        await step(page, 'Form lập kế hoạch mua sắm mới', PAUSE_LONG)

        // Fill plan name
        const nameInput = page.locator('input[type="text"]').first()
        if ((await nameInput.count()) > 0) {
            await slowFill(page, nameInput, 'Kế hoạch mua Laptop Q2/2026')
        }

        await step(page, 'Thêm các model thiết bị cần mua vào kế hoạch')
        await scrollAndPause(page, 400)
        await step(page, 'Sau khi hoàn thành, kế hoạch được trình duyệt qua Workflow', PAUSE_LONG)

        // Asset Increase
        await go(page, '/assets/asset-increases/new')
        await step(page, 'Phiếu tăng tài sản — ghi nhận thiết bị mới nhận vào', PAUSE_LONG)
        await scrollAndPause(page, 300)
        await step(page, 'Mỗi phiếu tăng liên kết với kế hoạch mua sắm và nhà cung cấp', PAUSE_LONG)
    })

    // ═══════════════════════════════════════════════════════════════════════
    // 6. BẢO TRÌ / MAINTENANCE & REPAIR ORDERS
    // ═══════════════════════════════════════════════════════════════════════
    test('06 — Bảo trì: Tickets & Work Orders', async ({ page }) => {
        await go(page, '/maintenance')
        await step(page, 'Module Bảo trì — quản lý phiếu sự cố và đơn sửa chữa', PAUSE_LONG)
        await scrollAndPause(page, 400)
        await step(page, 'Maintenance Tickets: ghi nhận sự cố thiết bị cần xử lý')
        await scrollAndPause(page, 300)
        await step(page, 'Xem thống kê: Tổng phiếu, Đang xử lý, Đã đóng', PAUSE_LONG)

        await go(page, '/maintenance/repairs')
        await step(page, 'Work Orders (Đơn sửa chữa) — chi tiết kỹ thuật viên, chi phí, thời gian', PAUSE_LONG)

        // Stats cards
        const statTotal = page.getByTestId('repair-summary-total')
        const statActive = page.getByTestId('repair-summary-active')
        const statClosed = page.getByTestId('repair-summary-closed')
        if ((await statTotal.count()) > 0) {
            await statTotal.hover()
            await page.waitForTimeout(PAUSE_SHORT)
            await step(page, 'Tổng đơn sửa chữa trong hệ thống')
        }
        if ((await statActive.count()) > 0) {
            await statActive.hover()
            await page.waitForTimeout(PAUSE_SHORT)
            await step(page, 'Đơn đang xử lý: Mở + Đang chẩn đoán + Chờ linh kiện')
        }
        if ((await statClosed.count()) > 0) {
            await statClosed.hover()
            await page.waitForTimeout(PAUSE_SHORT)
            await step(page, 'Đơn đã đóng — hoàn thành quy trình sửa chữa')
        }

        // Demo tạo repair order
        const createToggle = page.getByTestId('repairs-create-toggle')
        if ((await createToggle.count()) > 0) {
            await step(page, 'Demo: Tạo đơn sửa chữa mới')
            await createToggle.click()
            await page.waitForTimeout(PAUSE_MED)

            const createForm = page.getByTestId('repairs-create-form')
            if ((await createForm.count()) > 0) {
                await step(page, 'Form tạo đơn sửa chữa: Tài sản, Tiêu đề, Mức độ, Loại sửa chữa, Kỹ thuật viên')

                const assetSelect = page.getByTestId('repair-create-asset')
                if ((await assetSelect.count()) > 0) {
                    // Wait for options to load but don't fail if only placeholder is present
                    await page.waitForTimeout(PAUSE_MED)
                    const optCount = await assetSelect.locator('option').count()
                    if (optCount > 1) {
                        await pickFirst(assetSelect)
                        await page.waitForTimeout(PAUSE_SHORT)
                    }
                }

                const titleInput = page.getByTestId('repair-create-title')
                if ((await titleInput.count()) > 0) {
                    await slowFill(page, titleInput, 'Màn hình không lên - cần thay backlight')
                }

                const severitySelect = page.getByTestId('repair-create-severity')
                if ((await severitySelect.count()) > 0) {
                    await severitySelect.selectOption('high')
                    await page.waitForTimeout(PAUSE_SHORT)
                    await step(page, 'Mức độ sự cố: Low, Medium, High, Critical')
                }

                const techInput = page.getByTestId('repair-create-technician')
                if ((await techInput.count()) > 0) {
                    await slowFill(page, techInput, 'Nguyễn Văn Kỹ Thuật')
                }

                const descInput = page.getByTestId('repair-create-description')
                if ((await descInput.count()) > 0) {
                    await slowFill(page, descInput, 'Màn hình bị đen, đã kiểm tra cáp HDMI và nguồn — cần thay inverter/backlight')
                }

                await step(page, 'Điền thông tin kỹ thuật và nhấn Tạo đơn sửa chữa', PAUSE_MED)
            }

            // Đóng form
            await createToggle.click()
            await page.waitForTimeout(PAUSE_MED)
        }
        await step(page, 'Work Order có thể thêm linh kiện sử dụng, ghi chẩn đoán, giải pháp', PAUSE_MED)
    })

    test('06b — Bảo trì: Work Order Detail & Đóng', async ({ page }) => {
        await go(page, '/maintenance/repairs')
        await step(page, 'Xem chi tiết Work Order và cập nhật trạng thái', PAUSE_MED)

        const repairLink = page.locator('tbody tr a, tbody tr [href*="/maintenance/repairs/"]').first()
        if ((await repairLink.count()) > 0) {
            await repairLink.click()
            await page.waitForLoadState('domcontentloaded')
            await page.waitForTimeout(PAUSE_LONG)

            await step(page, 'Chi tiết Work Order: thông tin tài sản, kỹ thuật viên, chi phí, thời gian ngừng máy')
            await scrollAndPause(page, 400)

            // Status section
            const statusSelect = page.getByTestId('repair-status-select')
            if ((await statusSelect.count()) > 0) {
                await statusSelect.hover()
                await page.waitForTimeout(PAUSE_SHORT)
                await step(page, 'Các trạng thái: Mở → Chẩn đoán → Chờ linh kiện → Đã sửa → Đã đóng')
                await statusSelect.selectOption('repaired')
                await page.waitForTimeout(PAUSE_SHORT)
                await step(page, 'Đổi trạng thái sang "Đã sửa xong" sau khi hoàn thành')

                const diagInput = page.getByTestId('repair-diagnosis-input')
                if ((await diagInput.count()) > 0) {
                    await slowFill(page, diagInput, 'Đã xác định nguyên nhân: backlight hỏng do quá nhiệt')
                }

                const resInput = page.getByTestId('repair-resolution-input')
                if ((await resInput.count()) > 0) {
                    await slowFill(page, resInput, 'Thay mới backlight LED, kiểm tra hệ thống tản nhiệt và vệ sinh quạt')
                }

                await step(page, 'Ghi nhận chẩn đoán và giải pháp sửa chữa', PAUSE_MED)
            }

            await scrollAndPause(page, 400)
            await step(page, 'Phần linh kiện: có thể thêm linh kiện đã sử dụng từ kho', PAUSE_LONG)
        } else {
            await step(page, 'Chi tiết Work Order cho phép ghi nhận toàn bộ quá trình sửa chữa', PAUSE_MED)
        }
    })

    // ═══════════════════════════════════════════════════════════════════════
    // 7. CMDB
    // ═══════════════════════════════════════════════════════════════════════
    test('07 — CMDB: Configuration Items & Services', async ({ page }) => {
        await go(page, '/cmdb')
        await step(page, 'CMDB (Configuration Management Database) — theo dõi mối quan hệ giữa các IT asset', PAUSE_LONG)
        await scrollAndPause(page, 300)

        await go(page, '/cmdb/types')
        await step(page, 'CI Types — các loại Configuration Item (Server, Network, Application, ...)', PAUSE_LONG)
        await scrollAndPause(page, 400)

        await go(page, '/cmdb/cis')
        await step(page, 'Configuration Items — danh sách các CI và quan hệ phụ thuộc', PAUSE_LONG)
        await scrollAndPause(page, 400)
        await step(page, 'Mỗi CI có thể liên kết với nhiều CI khác (upstream/downstream dependencies)')

        await go(page, '/cmdb/services')
        await step(page, 'Service Catalog — danh sách dịch vụ CNTT và các CI cấu thành', PAUSE_LONG)
        await scrollAndPause(page, 300)
        await step(page, 'Theo dõi được impact khi một thiết bị hỏng ảnh hưởng dịch vụ nào', PAUSE_LONG)

        await go(page, '/cmdb/reports')
        await step(page, 'CMDB Reports — báo cáo sức khỏe hạ tầng, dependency map', PAUSE_LONG)
    })

    // ═══════════════════════════════════════════════════════════════════════
    // 8. WORKFLOW / YÊU CẦU
    // ═══════════════════════════════════════════════════════════════════════
    test('08 — Workflow: Yêu cầu & Phê duyệt', async ({ page }) => {
        await go(page, '/me/requests')
        await step(page, 'Yêu cầu của tôi — người dùng tự gửi yêu cầu tài sản, sửa chữa, thanh lý', PAUSE_LONG)
        await scrollAndPause(page, 300)

        await go(page, '/me/requests/new')
        await step(page, 'Form tạo yêu cầu mới', PAUSE_LONG)

        // Request type
        const reqTypeSelect = page.locator('select[name="requestType"], select[id*="type"]').first()
        if ((await reqTypeSelect.count()) > 0) {
            await reqTypeSelect.selectOption('asset_request')
            await page.waitForTimeout(PAUSE_SHORT)
            await step(page, 'Loại yêu cầu: Yêu cầu tài sản, Sửa chữa, Thanh lý, Mua sắm')
        }

        const titleInput = page.locator('input[name="title"], textarea[name="title"], input[type="text"]').first()
        if ((await titleInput.count()) > 0) {
            await slowFill(page, titleInput, 'Yêu cầu cấp laptop mới cho nhân viên onboard')
        }

        await step(page, 'Điền tiêu đề, mô tả, ngày cần thiết và gửi yêu cầu', PAUSE_MED)
        await scrollAndPause(page, 300)

        await go(page, '/requests')
        await step(page, 'Hàng đợi phê duyệt — Admin/Manager xem và phê duyệt các yêu cầu', PAUSE_LONG)
        await scrollAndPause(page, 400)
        await step(page, 'Yêu cầu được phân loại theo loại, trạng thái và mức độ ưu tiên', PAUSE_LONG)
    })

    // ═══════════════════════════════════════════════════════════════════════
    // 9. ANALYTICS & BÁO CÁO
    // ═══════════════════════════════════════════════════════════════════════
    test('09 — Analytics & Báo cáo', async ({ page }) => {
        await go(page, '/analytics')
        await step(page, 'Analytics — thống kê và phân tích toàn hệ thống', PAUSE_LONG)
        await scrollAndPause(page, 400)
        await step(page, 'Biểu đồ xu hướng: tổng tài sản, tình trạng, chi phí bảo trì theo thời gian')
        await scrollAndPause(page, 600)
        await step(page, 'Phân bổ tài sản theo danh mục, địa điểm, trạng thái', PAUSE_LONG)

        await go(page, '/reports')
        await step(page, 'Module Báo cáo — xuất các báo cáo nghiệp vụ định kỳ', PAUSE_LONG)
        await scrollAndPause(page, 300)

        await go(page, '/reports/assets')
        await step(page, 'Báo cáo tài sản: tổng hợp, chi tiết, khấu hao, bảo hành', PAUSE_LONG)
        await scrollAndPause(page, 500)
        await step(page, 'Có thể lọc và xuất báo cáo ra file CSV', PAUSE_LONG)

        await go(page, '/warehouse/reports')
        await step(page, 'Báo cáo kho hàng: tồn kho, nhập xuất, đề xuất mua linh kiện', PAUSE_LONG)
        await scrollAndPause(page, 400)
        await step(page, 'Hệ thống tự động tính toán mức tiêu thụ trung bình và đề xuất mua bổ sung', PAUSE_LONG)

        await go(page, '/inventory')
        await step(page, 'Kiểm kê kho — lập phiên kiểm kê định kỳ để đối soát thực tế', PAUSE_LONG)
        await scrollAndPause(page, 300)
        await step(page, 'Phiên kiểm kê cho phép ghi nhận số lượng thực tế và tạo chứng từ điều chỉnh tự động', PAUSE_LONG)
    })

    // ═══════════════════════════════════════════════════════════════════════
    // 10. QUẢN TRỊ
    // ═══════════════════════════════════════════════════════════════════════
    test('10 — Quản trị: Users, Automation, Security', async ({ page }) => {
        await go(page, '/admin')
        await step(page, 'Trang Quản trị — dành riêng cho Admin quản lý hệ thống', PAUSE_LONG)
        await scrollAndPause(page, 400)
        await step(page, 'Quản lý người dùng: tạo tài khoản, phân quyền (Admin, Manager, User, Viewer)')

        await go(page, '/automation')
        await step(page, 'Automation — cấu hình quy tắc tự động hóa', PAUSE_LONG)
        await scrollAndPause(page, 300)
        await step(page, 'Ví dụ: Tự động tạo work order khi tài sản hết bảo hành, tự động cảnh báo khi tồn kho thấp', PAUSE_LONG)

        await go(page, '/integrations')
        await step(page, 'Tích hợp — kết nối với hệ thống bên ngoài qua webhook/API', PAUSE_LONG)
        await scrollAndPause(page, 300)
        await step(page, 'Hỗ trợ tích hợp với Slack, Teams, Email để gửi thông báo tự động', PAUSE_LONG)

        await go(page, '/security')
        await step(page, 'Bảo mật — audit log, phiên đăng nhập, compliance', PAUSE_LONG)
        await scrollAndPause(page, 400)
        await step(page, 'Ghi nhận toàn bộ thao tác của người dùng để đáp ứng yêu cầu kiểm toán', PAUSE_LONG)
    })

    // ═══════════════════════════════════════════════════════════════════════
    // 11. PHÂN QUYỀN (ROLE-BASED ACCESS)
    // ═══════════════════════════════════════════════════════════════════════
    test('11 — Phân quyền & Inbox thông báo', async ({ page }) => {
        // Trang của user thường
        await go(page, '/me/assets')
        await step(page, 'Góc nhìn người dùng (User) — chỉ thấy tài sản được gán cho mình', PAUSE_LONG)
        await scrollAndPause(page, 300)
        await step(page, 'Người dùng có thể xem lịch sử, gửi yêu cầu, không thể chỉnh sửa catalog')

        await go(page, '/inbox')
        await step(page, 'Inbox thông báo — nhận thông báo về phê duyệt, hết bảo hành, tồn kho thấp, ...', PAUSE_LONG)
        await scrollAndPause(page, 300)
        await step(page, 'Thông báo realtime giúp người dùng không bỏ lỡ các sự kiện quan trọng', PAUSE_LONG)

        // Quay về dashboard
        await go(page, '/')
        await step(page, '✅ Hệ thống Quản lý Thiết bị — đầy đủ tính năng cho mọi quy mô tổ chức', PAUSE_LONG)
        await scrollAndPause(page, 300)
        await step(page, 'Liên hệ đội IT để được hỗ trợ triển khai và hướng dẫn sử dụng chi tiết', PAUSE_LONG)
    })
})
