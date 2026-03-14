# QLTB — Color Theme System
> Dành cho GitHub Copilot (claude-sonnet-4-5) | 5 theme | Light + Dark mode

---

## NHIỆM VỤ

Tích hợp hệ thống 5 color theme vào ứng dụng QLTB. Người dùng có thể chọn theme yêu thích và toggle light/dark mode. Tất cả màu sắc phải được quản lý qua CSS custom properties — **không hard-code màu bất kỳ đâu trong component**.

---

## KIẾN TRÚC TỔNG QUAN

```
src/
├── styles/
│   ├── themes.css          ← File chính: tất cả 5 theme × 2 mode = 10 bộ biến
│   ├── tokens.css          ← Semantic aliases (dùng trong component)
│   └── base.css            ← Reset, typography, scrollbar
├── lib/
│   └── theme.ts            ← ThemeStore: lưu theme + mode vào localStorage
└── components/
    └── ThemePicker.svelte  ← UI chọn theme + toggle dark/light
```

---

## FILE 1 — `src/styles/themes.css`

Cấu trúc: mỗi theme dùng selector `[data-theme="X"][data-mode="light"]` và `[data-theme="X"][data-mode="dark"]`.

```css
/* ══════════════════════════════════════════════════
   THEME 1 — SKY PRO
   Xanh trời chuyên nghiệp, gần với bộ màu hiện tại
   ══════════════════════════════════════════════════ */

[data-theme="sky"][data-mode="light"] {
  /* Accent */
  --accent:           #0ea5e9;
  --accent-hover:     #0284c7;
  --accent-active:    #0369a1;
  --accent-subtle:    #e0f2fe;
  --accent-text:      #0369a1;

  /* Backgrounds */
  --bg-base:          #f0f4f8;
  --bg-surface:       #ffffff;
  --bg-subtle:        #f8fafc;
  --bg-muted:         #f1f5f9;
  --bg-elevated:      #ffffff;

  /* Borders */
  --border:           #e2e8f0;
  --border-subtle:    #f1f5f9;
  --border-strong:    #cbd5e1;
  --border-focus:     #0ea5e9;

  /* Text */
  --text-primary:     #0f172a;
  --text-secondary:   #475569;
  --text-muted:       #94a3b8;
  --text-disabled:    #cbd5e1;
  --text-on-accent:   #ffffff;

  /* Sidebar (luôn dark trong light mode) */
  --sidebar-bg:           #1e293b;
  --sidebar-bg-hover:     #273549;
  --sidebar-text:         #cbd5e1;
  --sidebar-text-muted:   #64748b;
  --sidebar-active:       #0ea5e9;
  --sidebar-active-bg:    rgba(14, 165, 233, 0.12);
  --sidebar-border:       #0f172a;
  --sidebar-logo-bg:      #0ea5e9;

  /* Topbar */
  --topbar-bg:        #ffffff;
  --topbar-border:    #e2e8f0;
  --topbar-text:      #0f172a;

  /* Stat Cards */
  --card-total-bg:        #f0f9ff;
  --card-total-border:    #bae6fd;
  --card-total-num:       #0369a1;
  --card-total-label:     #0284c7;
  --card-active-bg:       #f0fdf4;
  --card-active-border:   #bbf7d0;
  --card-active-num:      #15803d;
  --card-active-label:    #16a34a;
  --card-repair-bg:       #fff7ed;
  --card-repair-border:   #fed7aa;
  --card-repair-num:      #c2410c;
  --card-repair-label:    #d97706;
  --card-expired-bg:      #fef2f2;
  --card-expired-border:  #fecaca;
  --card-expired-num:     #b91c1c;
  --card-expired-label:   #dc2626;
  --card-stock-bg:        #f8fafc;
  --card-stock-border:    #e2e8f0;
  --card-stock-num:       #334155;
  --card-stock-label:     #64748b;

  /* Status — Success */
  --status-success-bg:      #dcfce7;
  --status-success-text:    #16a34a;
  --status-success-border:  #bbf7d0;
  --status-success-dot:     #16a34a;

  /* Status — Warning */
  --status-warning-bg:      #fef9c3;
  --status-warning-text:    #ca8a04;
  --status-warning-border:  #fde68a;
  --status-warning-dot:     #d97706;

  /* Status — Danger */
  --status-danger-bg:       #fee2e2;
  --status-danger-text:     #dc2626;
  --status-danger-border:   #fecaca;
  --status-danger-dot:      #dc2626;

  /* Status — Info */
  --status-info-bg:         #dbeafe;
  --status-info-text:       #1d4ed8;
  --status-info-border:     #bfdbfe;
  --status-info-dot:        #3b82f6;

  /* Status — Neutral */
  --status-neutral-bg:      #f1f5f9;
  --status-neutral-text:    #64748b;
  --status-neutral-border:  #e2e8f0;
  --status-neutral-dot:     #94a3b8;

  /* Status — Workflow */
  --status-workflow-bg:     #ede9fe;
  --status-workflow-text:   #7c3aed;
  --status-workflow-border: #ddd6fe;
  --status-workflow-dot:    #7c3aed;

  /* Chart colors */
  --chart-1: #0ea5e9;
  --chart-2: #16a34a;
  --chart-3: #d97706;
  --chart-4: #dc2626;
  --chart-5: #7c3aed;
  --chart-grid: #e2e8f0;
  --chart-tick: #94a3b8;

  /* Shadows */
  --shadow-xs: 0 1px 2px rgba(0,0,0,0.05);
  --shadow-sm: 0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04);
  --shadow-md: 0 4px 16px rgba(0,0,0,0.10), 0 2px 4px rgba(0,0,0,0.06);
  --shadow-lg: 0 10px 40px rgba(0,0,0,0.12), 0 4px 8px rgba(0,0,0,0.08);
}

[data-theme="sky"][data-mode="dark"] {
  --accent:           #38bdf8;
  --accent-hover:     #0ea5e9;
  --accent-active:    #0284c7;
  --accent-subtle:    #0c2a3f;
  --accent-text:      #7dd3fc;

  --bg-base:          #0a0f1e;
  --bg-surface:       #111827;
  --bg-subtle:        #1e293b;
  --bg-muted:         #273549;
  --bg-elevated:      #1e293b;

  --border:           #1e293b;
  --border-subtle:    #0f172a;
  --border-strong:    #334155;
  --border-focus:     #38bdf8;

  --text-primary:     #f1f5f9;
  --text-secondary:   #94a3b8;
  --text-muted:       #475569;
  --text-disabled:    #334155;
  --text-on-accent:   #0f172a;

  --sidebar-bg:           #0f172a;
  --sidebar-bg-hover:     #1e293b;
  --sidebar-text:         #94a3b8;
  --sidebar-text-muted:   #334155;
  --sidebar-active:       #38bdf8;
  --sidebar-active-bg:    rgba(56, 189, 248, 0.10);
  --sidebar-border:       #0a0f1e;
  --sidebar-logo-bg:      #0ea5e9;

  --topbar-bg:        #111827;
  --topbar-border:    #1e293b;
  --topbar-text:      #f1f5f9;

  --card-total-bg:        #0c2a3f;
  --card-total-border:    #0c4a6e;
  --card-total-num:       #7dd3fc;
  --card-total-label:     #38bdf8;
  --card-active-bg:       #052e16;
  --card-active-border:   #14532d;
  --card-active-num:      #86efac;
  --card-active-label:    #4ade80;
  --card-repair-bg:       #431407;
  --card-repair-border:   #7c2d12;
  --card-repair-num:      #fdba74;
  --card-repair-label:    #fb923c;
  --card-expired-bg:      #450a0a;
  --card-expired-border:  #7f1d1d;
  --card-expired-num:     #fca5a5;
  --card-expired-label:   #f87171;
  --card-stock-bg:        #1e293b;
  --card-stock-border:    #334155;
  --card-stock-num:       #cbd5e1;
  --card-stock-label:     #94a3b8;

  --status-success-bg:      #052e16;
  --status-success-text:    #4ade80;
  --status-success-border:  #14532d;
  --status-success-dot:     #22c55e;
  --status-warning-bg:      #431407;
  --status-warning-text:    #fb923c;
  --status-warning-border:  #7c2d12;
  --status-warning-dot:     #f97316;
  --status-danger-bg:       #450a0a;
  --status-danger-text:     #f87171;
  --status-danger-border:   #7f1d1d;
  --status-danger-dot:      #ef4444;
  --status-info-bg:         #0c1a3f;
  --status-info-text:       #60a5fa;
  --status-info-border:     #1e3a8a;
  --status-info-dot:        #3b82f6;
  --status-neutral-bg:      #1e293b;
  --status-neutral-text:    #94a3b8;
  --status-neutral-border:  #334155;
  --status-neutral-dot:     #64748b;
  --status-workflow-bg:     #2e1065;
  --status-workflow-text:   #c4b5fd;
  --status-workflow-border: #4c1d95;
  --status-workflow-dot:    #a78bfa;

  --chart-1: #38bdf8;
  --chart-2: #4ade80;
  --chart-3: #fb923c;
  --chart-4: #f87171;
  --chart-5: #c4b5fd;
  --chart-grid: #1e293b;
  --chart-tick: #475569;

  --shadow-xs: 0 1px 2px rgba(0,0,0,0.20);
  --shadow-sm: 0 1px 3px rgba(0,0,0,0.30);
  --shadow-md: 0 4px 16px rgba(0,0,0,0.40);
  --shadow-lg: 0 10px 40px rgba(0,0,0,0.50);
}


/* ══════════════════════════════════════════════════
   THEME 2 — OCEAN TEAL
   Xanh ngọc, phù hợp môi trường y tế & kỹ thuật
   ══════════════════════════════════════════════════ */

[data-theme="teal"][data-mode="light"] {
  --accent:           #0d9488;
  --accent-hover:     #0f766e;
  --accent-active:    #115e59;
  --accent-subtle:    #ccfbf1;
  --accent-text:      #0f766e;

  --bg-base:          #f0faf9;
  --bg-surface:       #ffffff;
  --bg-subtle:        #f9fffe;
  --bg-muted:         #f0fdfa;
  --bg-elevated:      #ffffff;

  --border:           #99f6e4;
  --border-subtle:    #ccfbf1;
  --border-strong:    #5eead4;
  --border-focus:     #0d9488;

  --text-primary:     #134e4a;
  --text-secondary:   #374151;
  --text-muted:       #9ca3af;
  --text-disabled:    #d1d5db;
  --text-on-accent:   #ffffff;

  --sidebar-bg:           #134e4a;
  --sidebar-bg-hover:     #115e59;
  --sidebar-text:         #99f6e4;
  --sidebar-text-muted:   #2dd4bf;
  --sidebar-active:       #5eead4;
  --sidebar-active-bg:    rgba(13, 148, 136, 0.20);
  --sidebar-border:       #042f2e;
  --sidebar-logo-bg:      #0d9488;

  --topbar-bg:        #ffffff;
  --topbar-border:    #99f6e4;
  --topbar-text:      #134e4a;

  --card-total-bg:        #ccfbf1;
  --card-total-border:    #5eead4;
  --card-total-num:       #0f766e;
  --card-total-label:     #0d9488;
  --card-active-bg:       #d1fae5;
  --card-active-border:   #6ee7b7;
  --card-active-num:      #065f46;
  --card-active-label:    #059669;
  --card-repair-bg:       #fef3c7;
  --card-repair-border:   #fcd34d;
  --card-repair-num:      #92400e;
  --card-repair-label:    #d97706;
  --card-expired-bg:      #fee2e2;
  --card-expired-border:  #fca5a5;
  --card-expired-num:     #991b1b;
  --card-expired-label:   #dc2626;
  --card-stock-bg:        #f9fffe;
  --card-stock-border:    #99f6e4;
  --card-stock-num:       #134e4a;
  --card-stock-label:     #0d9488;

  --status-success-bg:      #d1fae5;
  --status-success-text:    #065f46;
  --status-success-border:  #6ee7b7;
  --status-success-dot:     #059669;
  --status-warning-bg:      #fef3c7;
  --status-warning-text:    #92400e;
  --status-warning-border:  #fcd34d;
  --status-warning-dot:     #d97706;
  --status-danger-bg:       #fee2e2;
  --status-danger-text:     #991b1b;
  --status-danger-border:   #fca5a5;
  --status-danger-dot:      #dc2626;
  --status-info-bg:         #ccfbf1;
  --status-info-text:       #0f766e;
  --status-info-border:     #5eead4;
  --status-info-dot:        #0d9488;
  --status-neutral-bg:      #f3f4f6;
  --status-neutral-text:    #6b7280;
  --status-neutral-border:  #e5e7eb;
  --status-neutral-dot:     #9ca3af;
  --status-workflow-bg:     #ede9fe;
  --status-workflow-text:   #6d28d9;
  --status-workflow-border: #c4b5fd;
  --status-workflow-dot:    #7c3aed;

  --chart-1: #0d9488;
  --chart-2: #059669;
  --chart-3: #d97706;
  --chart-4: #dc2626;
  --chart-5: #7c3aed;
  --chart-grid: #ccfbf1;
  --chart-tick: #9ca3af;

  --shadow-xs: 0 1px 2px rgba(13,148,136,0.06);
  --shadow-sm: 0 1px 3px rgba(13,148,136,0.10), 0 1px 2px rgba(0,0,0,0.04);
  --shadow-md: 0 4px 16px rgba(13,148,136,0.12), 0 2px 4px rgba(0,0,0,0.06);
  --shadow-lg: 0 10px 40px rgba(13,148,136,0.15), 0 4px 8px rgba(0,0,0,0.08);
}

[data-theme="teal"][data-mode="dark"] {
  --accent:           #2dd4bf;
  --accent-hover:     #14b8a6;
  --accent-active:    #0d9488;
  --accent-subtle:    #042f2e;
  --accent-text:      #5eead4;

  --bg-base:          #021716;
  --bg-surface:       #0f1f1e;
  --bg-subtle:        #134e4a;
  --bg-muted:         #115e59;
  --bg-elevated:      #134e4a;

  --border:           #115e59;
  --border-subtle:    #042f2e;
  --border-strong:    #0f766e;
  --border-focus:     #2dd4bf;

  --text-primary:     #ccfbf1;
  --text-secondary:   #5eead4;
  --text-muted:       #2d6a67;
  --text-disabled:    #134e4a;
  --text-on-accent:   #042f2e;

  --sidebar-bg:           #042f2e;
  --sidebar-bg-hover:     #134e4a;
  --sidebar-text:         #5eead4;
  --sidebar-text-muted:   #0f766e;
  --sidebar-active:       #2dd4bf;
  --sidebar-active-bg:    rgba(45, 212, 191, 0.12);
  --sidebar-border:       #021716;
  --sidebar-logo-bg:      #0d9488;

  --topbar-bg:        #0f1f1e;
  --topbar-border:    #134e4a;
  --topbar-text:      #ccfbf1;

  --card-total-bg:        #042f2e;
  --card-total-border:    #0f766e;
  --card-total-num:       #5eead4;
  --card-total-label:     #2dd4bf;
  --card-active-bg:       #022c22;
  --card-active-border:   #14532d;
  --card-active-num:      #6ee7b7;
  --card-active-label:    #34d399;
  --card-repair-bg:       #431407;
  --card-repair-border:   #7c2d12;
  --card-repair-num:      #fdba74;
  --card-repair-label:    #fb923c;
  --card-expired-bg:      #450a0a;
  --card-expired-border:  #7f1d1d;
  --card-expired-num:     #fca5a5;
  --card-expired-label:   #f87171;
  --card-stock-bg:        #115e59;
  --card-stock-border:    #0f766e;
  --card-stock-num:       #ccfbf1;
  --card-stock-label:     #5eead4;

  --status-success-bg:      #022c22;
  --status-success-text:    #34d399;
  --status-success-border:  #065f46;
  --status-success-dot:     #10b981;
  --status-warning-bg:      #431407;
  --status-warning-text:    #fb923c;
  --status-warning-border:  #7c2d12;
  --status-warning-dot:     #f97316;
  --status-danger-bg:       #450a0a;
  --status-danger-text:     #f87171;
  --status-danger-border:   #7f1d1d;
  --status-danger-dot:      #ef4444;
  --status-info-bg:         #042f2e;
  --status-info-text:       #5eead4;
  --status-info-border:     #0f766e;
  --status-info-dot:        #2dd4bf;
  --status-neutral-bg:      #134e4a;
  --status-neutral-text:    #5eead4;
  --status-neutral-border:  #0f766e;
  --status-neutral-dot:     #2d6a67;
  --status-workflow-bg:     #2e1065;
  --status-workflow-text:   #c4b5fd;
  --status-workflow-border: #4c1d95;
  --status-workflow-dot:    #a78bfa;

  --chart-1: #2dd4bf;
  --chart-2: #34d399;
  --chart-3: #fb923c;
  --chart-4: #f87171;
  --chart-5: #c4b5fd;
  --chart-grid: #134e4a;
  --chart-tick: #2d6a67;

  --shadow-sm: 0 1px 3px rgba(0,0,0,0.40);
  --shadow-md: 0 4px 16px rgba(0,0,0,0.50);
  --shadow-lg: 0 10px 40px rgba(0,0,0,0.60);
}


/* ══════════════════════════════════════════════════
   THEME 3 — VIOLET ENTERPRISE
   Tím tinh tế, corporate, sang trọng
   ══════════════════════════════════════════════════ */

[data-theme="violet"][data-mode="light"] {
  --accent:           #7c3aed;
  --accent-hover:     #6d28d9;
  --accent-active:    #5b21b6;
  --accent-subtle:    #ede9fe;
  --accent-text:      #5b21b6;

  --bg-base:          #f7f5ff;
  --bg-surface:       #ffffff;
  --bg-subtle:        #faf8ff;
  --bg-muted:         #f3f0ff;
  --bg-elevated:      #ffffff;

  --border:           #ddd6fe;
  --border-subtle:    #ede9fe;
  --border-strong:    #c4b5fd;
  --border-focus:     #7c3aed;

  --text-primary:     #1e1b4b;
  --text-secondary:   #4c4a6d;
  --text-muted:       #a5a3c0;
  --text-disabled:    #c4c2e0;
  --text-on-accent:   #ffffff;

  --sidebar-bg:           #1e1b4b;
  --sidebar-bg-hover:     #2d2a6e;
  --sidebar-text:         #c4b5fd;
  --sidebar-text-muted:   #7c7aad;
  --sidebar-active:       #a78bfa;
  --sidebar-active-bg:    rgba(124, 58, 237, 0.15);
  --sidebar-border:       #0d0a1e;
  --sidebar-logo-bg:      #7c3aed;

  --topbar-bg:        #ffffff;
  --topbar-border:    #ddd6fe;
  --topbar-text:      #1e1b4b;

  --card-total-bg:        #ede9fe;
  --card-total-border:    #c4b5fd;
  --card-total-num:       #5b21b6;
  --card-total-label:     #7c3aed;
  --card-active-bg:       #dcfce7;
  --card-active-border:   #86efac;
  --card-active-num:      #166534;
  --card-active-label:    #16a34a;
  --card-repair-bg:       #fef3c7;
  --card-repair-border:   #fde68a;
  --card-repair-num:      #854d0e;
  --card-repair-label:    #d97706;
  --card-expired-bg:      #fee2e2;
  --card-expired-border:  #fecaca;
  --card-expired-num:     #991b1b;
  --card-expired-label:   #dc2626;
  --card-stock-bg:        #faf8ff;
  --card-stock-border:    #ddd6fe;
  --card-stock-num:       #4c4a6d;
  --card-stock-label:     #7c3aed;

  --status-success-bg:      #dcfce7;
  --status-success-text:    #166534;
  --status-success-border:  #86efac;
  --status-success-dot:     #16a34a;
  --status-warning-bg:      #fef3c7;
  --status-warning-text:    #854d0e;
  --status-warning-border:  #fde68a;
  --status-warning-dot:     #d97706;
  --status-danger-bg:       #fee2e2;
  --status-danger-text:     #991b1b;
  --status-danger-border:   #fecaca;
  --status-danger-dot:      #dc2626;
  --status-info-bg:         #ede9fe;
  --status-info-text:       #5b21b6;
  --status-info-border:     #c4b5fd;
  --status-info-dot:        #7c3aed;
  --status-neutral-bg:      #f3f0ff;
  --status-neutral-text:    #7c7aad;
  --status-neutral-border:  #ddd6fe;
  --status-neutral-dot:     #a5a3c0;
  --status-workflow-bg:     #ede9fe;
  --status-workflow-text:   #7c3aed;
  --status-workflow-border: #c4b5fd;
  --status-workflow-dot:    #7c3aed;

  --chart-1: #7c3aed;
  --chart-2: #16a34a;
  --chart-3: #d97706;
  --chart-4: #dc2626;
  --chart-5: #0d9488;
  --chart-grid: #ede9fe;
  --chart-tick: #a5a3c0;

  --shadow-xs: 0 1px 2px rgba(124,58,237,0.06);
  --shadow-sm: 0 1px 3px rgba(124,58,237,0.10), 0 1px 2px rgba(0,0,0,0.04);
  --shadow-md: 0 4px 16px rgba(124,58,237,0.12), 0 2px 4px rgba(0,0,0,0.06);
  --shadow-lg: 0 10px 40px rgba(124,58,237,0.14), 0 4px 8px rgba(0,0,0,0.08);
}

[data-theme="violet"][data-mode="dark"] {
  --accent:           #a78bfa;
  --accent-hover:     #8b5cf6;
  --accent-active:    #7c3aed;
  --accent-subtle:    #1e1040;
  --accent-text:      #c4b5fd;

  --bg-base:          #0d0a1e;
  --bg-surface:       #130f28;
  --bg-subtle:        #1e1b4b;
  --bg-muted:         #2d2a6e;
  --bg-elevated:      #1e1b4b;

  --border:           #2d2a6e;
  --border-subtle:    #1e1040;
  --border-strong:    #4c1d95;
  --border-focus:     #a78bfa;

  --text-primary:     #ede9fe;
  --text-secondary:   #a78bfa;
  --text-muted:       #4c4680;
  --text-disabled:    #2d2a6e;
  --text-on-accent:   #ffffff;

  --sidebar-bg:           #0d0a1e;
  --sidebar-bg-hover:     #1e1b4b;
  --sidebar-text:         #c4b5fd;
  --sidebar-text-muted:   #4c4680;
  --sidebar-active:       #a78bfa;
  --sidebar-active-bg:    rgba(167, 139, 250, 0.12);
  --sidebar-border:       #07051a;
  --sidebar-logo-bg:      #7c3aed;

  --topbar-bg:        #130f28;
  --topbar-border:    #2d2a6e;
  --topbar-text:      #ede9fe;

  --card-total-bg:        #1e1040;
  --card-total-border:    #4c1d95;
  --card-total-num:       #c4b5fd;
  --card-total-label:     #a78bfa;
  --card-active-bg:       #052e16;
  --card-active-border:   #14532d;
  --card-active-num:      #86efac;
  --card-active-label:    #4ade80;
  --card-repair-bg:       #431407;
  --card-repair-border:   #7c2d12;
  --card-repair-num:      #fdba74;
  --card-repair-label:    #fb923c;
  --card-expired-bg:      #450a0a;
  --card-expired-border:  #7f1d1d;
  --card-expired-num:     #fca5a5;
  --card-expired-label:   #f87171;
  --card-stock-bg:        #2d2a6e;
  --card-stock-border:    #4c1d95;
  --card-stock-num:       #c4b5fd;
  --card-stock-label:     #a78bfa;

  --status-success-bg:      #052e16;
  --status-success-text:    #4ade80;
  --status-success-border:  #14532d;
  --status-success-dot:     #22c55e;
  --status-warning-bg:      #431407;
  --status-warning-text:    #fb923c;
  --status-warning-border:  #7c2d12;
  --status-warning-dot:     #f97316;
  --status-danger-bg:       #450a0a;
  --status-danger-text:     #f87171;
  --status-danger-border:   #7f1d1d;
  --status-danger-dot:      #ef4444;
  --status-info-bg:         #1e1040;
  --status-info-text:       #c4b5fd;
  --status-info-border:     #4c1d95;
  --status-info-dot:        #a78bfa;
  --status-neutral-bg:      #2d2a6e;
  --status-neutral-text:    #a78bfa;
  --status-neutral-border:  #4c4680;
  --status-neutral-dot:     #7c7aad;
  --status-workflow-bg:     #1e1040;
  --status-workflow-text:   #c4b5fd;
  --status-workflow-border: #4c1d95;
  --status-workflow-dot:    #a78bfa;

  --chart-1: #a78bfa;
  --chart-2: #4ade80;
  --chart-3: #fb923c;
  --chart-4: #f87171;
  --chart-5: #2dd4bf;
  --chart-grid: #2d2a6e;
  --chart-tick: #4c4680;

  --shadow-sm: 0 1px 3px rgba(0,0,0,0.40);
  --shadow-md: 0 4px 16px rgba(0,0,0,0.50);
  --shadow-lg: 0 10px 40px rgba(0,0,0,0.60);
}


/* ══════════════════════════════════════════════════
   THEME 4 — SLATE CLEAN
   Xám xanh trung tính, minimalist, focus vào dữ liệu
   ══════════════════════════════════════════════════ */

[data-theme="slate"][data-mode="light"] {
  --accent:           #3b82f6;
  --accent-hover:     #2563eb;
  --accent-active:    #1d4ed8;
  --accent-subtle:    #eff6ff;
  --accent-text:      #1d4ed8;

  --bg-base:          #f1f5f9;
  --bg-surface:       #ffffff;
  --bg-subtle:        #f8fafc;
  --bg-muted:         #f1f5f9;
  --bg-elevated:      #ffffff;

  --border:           #e2e8f0;
  --border-subtle:    #f1f5f9;
  --border-strong:    #cbd5e1;
  --border-focus:     #3b82f6;

  --text-primary:     #1e293b;
  --text-secondary:   #64748b;
  --text-muted:       #94a3b8;
  --text-disabled:    #cbd5e1;
  --text-on-accent:   #ffffff;

  --sidebar-bg:           #0f172a;
  --sidebar-bg-hover:     #1e293b;
  --sidebar-text:         #94a3b8;
  --sidebar-text-muted:   #475569;
  --sidebar-active:       #60a5fa;
  --sidebar-active-bg:    rgba(59, 130, 246, 0.10);
  --sidebar-border:       #0a0f1e;
  --sidebar-logo-bg:      #3b82f6;

  --topbar-bg:        #ffffff;
  --topbar-border:    #e2e8f0;
  --topbar-text:      #1e293b;

  --card-total-bg:        #eff6ff;
  --card-total-border:    #bfdbfe;
  --card-total-num:       #1d4ed8;
  --card-total-label:     #3b82f6;
  --card-active-bg:       #f0fdf4;
  --card-active-border:   #bbf7d0;
  --card-active-num:      #166534;
  --card-active-label:    #16a34a;
  --card-repair-bg:       #fffbeb;
  --card-repair-border:   #fde68a;
  --card-repair-num:      #92400e;
  --card-repair-label:    #d97706;
  --card-expired-bg:      #fff1f2;
  --card-expired-border:  #fecdd3;
  --card-expired-num:     #9f1239;
  --card-expired-label:   #f43f5e;
  --card-stock-bg:        #f8fafc;
  --card-stock-border:    #e2e8f0;
  --card-stock-num:       #334155;
  --card-stock-label:     #64748b;

  --status-success-bg:      #f0fdf4;
  --status-success-text:    #166534;
  --status-success-border:  #bbf7d0;
  --status-success-dot:     #16a34a;
  --status-warning-bg:      #fffbeb;
  --status-warning-text:    #92400e;
  --status-warning-border:  #fde68a;
  --status-warning-dot:     #d97706;
  --status-danger-bg:       #fff1f2;
  --status-danger-text:     #9f1239;
  --status-danger-border:   #fecdd3;
  --status-danger-dot:      #f43f5e;
  --status-info-bg:         #eff6ff;
  --status-info-text:       #1d4ed8;
  --status-info-border:     #bfdbfe;
  --status-info-dot:        #3b82f6;
  --status-neutral-bg:      #f1f5f9;
  --status-neutral-text:    #64748b;
  --status-neutral-border:  #e2e8f0;
  --status-neutral-dot:     #94a3b8;
  --status-workflow-bg:     #ede9fe;
  --status-workflow-text:   #6d28d9;
  --status-workflow-border: #c4b5fd;
  --status-workflow-dot:    #7c3aed;

  --chart-1: #3b82f6;
  --chart-2: #16a34a;
  --chart-3: #d97706;
  --chart-4: #f43f5e;
  --chart-5: #7c3aed;
  --chart-grid: #e2e8f0;
  --chart-tick: #94a3b8;

  --shadow-xs: 0 1px 2px rgba(0,0,0,0.04);
  --shadow-sm: 0 1px 3px rgba(0,0,0,0.07), 0 1px 2px rgba(0,0,0,0.04);
  --shadow-md: 0 4px 16px rgba(0,0,0,0.09), 0 2px 4px rgba(0,0,0,0.05);
  --shadow-lg: 0 10px 40px rgba(0,0,0,0.11), 0 4px 8px rgba(0,0,0,0.07);
}

[data-theme="slate"][data-mode="dark"] {
  --accent:           #60a5fa;
  --accent-hover:     #3b82f6;
  --accent-active:    #2563eb;
  --accent-subtle:    #172554;
  --accent-text:      #93c5fd;

  --bg-base:          #0f172a;
  --bg-surface:       #1e293b;
  --bg-subtle:        #273549;
  --bg-muted:         #334155;
  --bg-elevated:      #273549;

  --border:           #334155;
  --border-subtle:    #1e293b;
  --border-strong:    #475569;
  --border-focus:     #60a5fa;

  --text-primary:     #f1f5f9;
  --text-secondary:   #94a3b8;
  --text-muted:       #475569;
  --text-disabled:    #334155;
  --text-on-accent:   #0f172a;

  --sidebar-bg:           #0a0f1e;
  --sidebar-bg-hover:     #0f172a;
  --sidebar-text:         #64748b;
  --sidebar-text-muted:   #334155;
  --sidebar-active:       #60a5fa;
  --sidebar-active-bg:    rgba(96, 165, 250, 0.10);
  --sidebar-border:       #07091a;
  --sidebar-logo-bg:      #3b82f6;

  --topbar-bg:        #1e293b;
  --topbar-border:    #334155;
  --topbar-text:      #f1f5f9;

  --card-total-bg:        #172554;
  --card-total-border:    #1e3a8a;
  --card-total-num:       #93c5fd;
  --card-total-label:     #60a5fa;
  --card-active-bg:       #052e16;
  --card-active-border:   #14532d;
  --card-active-num:      #86efac;
  --card-active-label:    #4ade80;
  --card-repair-bg:       #431407;
  --card-repair-border:   #7c2d12;
  --card-repair-num:      #fdba74;
  --card-repair-label:    #fb923c;
  --card-expired-bg:      #450a0a;
  --card-expired-border:  #7f1d1d;
  --card-expired-num:     #fca5a5;
  --card-expired-label:   #f87171;
  --card-stock-bg:        #273549;
  --card-stock-border:    #334155;
  --card-stock-num:       #cbd5e1;
  --card-stock-label:     #94a3b8;

  --status-success-bg:      #052e16;
  --status-success-text:    #4ade80;
  --status-success-border:  #14532d;
  --status-success-dot:     #22c55e;
  --status-warning-bg:      #431407;
  --status-warning-text:    #fb923c;
  --status-warning-border:  #7c2d12;
  --status-warning-dot:     #f97316;
  --status-danger-bg:       #450a0a;
  --status-danger-text:     #f87171;
  --status-danger-border:   #7f1d1d;
  --status-danger-dot:      #ef4444;
  --status-info-bg:         #172554;
  --status-info-text:       #93c5fd;
  --status-info-border:     #1e3a8a;
  --status-info-dot:        #60a5fa;
  --status-neutral-bg:      #273549;
  --status-neutral-text:    #94a3b8;
  --status-neutral-border:  #334155;
  --status-neutral-dot:     #64748b;
  --status-workflow-bg:     #2e1065;
  --status-workflow-text:   #c4b5fd;
  --status-workflow-border: #4c1d95;
  --status-workflow-dot:    #a78bfa;

  --chart-1: #60a5fa;
  --chart-2: #4ade80;
  --chart-3: #fb923c;
  --chart-4: #f87171;
  --chart-5: #c4b5fd;
  --chart-grid: #334155;
  --chart-tick: #475569;

  --shadow-sm: 0 1px 3px rgba(0,0,0,0.30);
  --shadow-md: 0 4px 16px rgba(0,0,0,0.40);
  --shadow-lg: 0 10px 40px rgba(0,0,0,0.50);
}


/* ══════════════════════════════════════════════════
   THEME 5 — AMBER WARM
   Vàng ấm, năng động, phù hợp dashboard & analytics
   ══════════════════════════════════════════════════ */

[data-theme="amber"][data-mode="light"] {
  --accent:           #d97706;
  --accent-hover:     #b45309;
  --accent-active:    #92400e;
  --accent-subtle:    #fef9c3;
  --accent-text:      #92400e;

  --bg-base:          #fffdf5;
  --bg-surface:       #ffffff;
  --bg-subtle:        #fffbf0;
  --bg-muted:         #fef3c7;
  --bg-elevated:      #ffffff;

  --border:           #fde68a;
  --border-subtle:    #fef9c3;
  --border-strong:    #fcd34d;
  --border-focus:     #d97706;

  --text-primary:     #1c1001;
  --text-secondary:   #57400f;
  --text-muted:       #a07830;
  --text-disabled:    #e5cc8a;
  --text-on-accent:   #ffffff;

  --sidebar-bg:           #1c1001;
  --sidebar-bg-hover:     #2d1c02;
  --sidebar-text:         #fcd34d;
  --sidebar-text-muted:   #a07830;
  --sidebar-active:       #fbbf24;
  --sidebar-active-bg:    rgba(217, 119, 6, 0.15);
  --sidebar-border:       #0c0700;
  --sidebar-logo-bg:      #d97706;

  --topbar-bg:        #ffffff;
  --topbar-border:    #fde68a;
  --topbar-text:      #1c1001;

  --card-total-bg:        #fef9c3;
  --card-total-border:    #fde68a;
  --card-total-num:       #854d0e;
  --card-total-label:     #d97706;
  --card-active-bg:       #f0fdf4;
  --card-active-border:   #bbf7d0;
  --card-active-num:      #166534;
  --card-active-label:    #16a34a;
  --card-repair-bg:       #fff7ed;
  --card-repair-border:   #fed7aa;
  --card-repair-num:      #9a3412;
  --card-repair-label:    #ea580c;
  --card-expired-bg:      #fee2e2;
  --card-expired-border:  #fecaca;
  --card-expired-num:     #991b1b;
  --card-expired-label:   #dc2626;
  --card-stock-bg:        #fffbf0;
  --card-stock-border:    #fde68a;
  --card-stock-num:       #57400f;
  --card-stock-label:     #d97706;

  --status-success-bg:      #f0fdf4;
  --status-success-text:    #166534;
  --status-success-border:  #bbf7d0;
  --status-success-dot:     #16a34a;
  --status-warning-bg:      #fef9c3;
  --status-warning-text:    #854d0e;
  --status-warning-border:  #fde68a;
  --status-warning-dot:     #d97706;
  --status-danger-bg:       #fee2e2;
  --status-danger-text:     #991b1b;
  --status-danger-border:   #fecaca;
  --status-danger-dot:      #dc2626;
  --status-info-bg:         #fef9c3;
  --status-info-text:       #854d0e;
  --status-info-border:     #fde68a;
  --status-info-dot:        #d97706;
  --status-neutral-bg:      #f5f0e8;
  --status-neutral-text:    #78501a;
  --status-neutral-border:  #e5cc8a;
  --status-neutral-dot:     #a07830;
  --status-workflow-bg:     #ede9fe;
  --status-workflow-text:   #6d28d9;
  --status-workflow-border: #c4b5fd;
  --status-workflow-dot:    #7c3aed;

  --chart-1: #d97706;
  --chart-2: #16a34a;
  --chart-3: #ea580c;
  --chart-4: #dc2626;
  --chart-5: #7c3aed;
  --chart-grid: #fde68a;
  --chart-tick: #a07830;

  --shadow-xs: 0 1px 2px rgba(217,119,6,0.06);
  --shadow-sm: 0 1px 3px rgba(217,119,6,0.10), 0 1px 2px rgba(0,0,0,0.04);
  --shadow-md: 0 4px 16px rgba(217,119,6,0.12), 0 2px 4px rgba(0,0,0,0.06);
  --shadow-lg: 0 10px 40px rgba(217,119,6,0.14), 0 4px 8px rgba(0,0,0,0.08);
}

[data-theme="amber"][data-mode="dark"] {
  --accent:           #fbbf24;
  --accent-hover:     #f59e0b;
  --accent-active:    #d97706;
  --accent-subtle:    #2d1b00;
  --accent-text:      #fde68a;

  --bg-base:          #140d00;
  --bg-surface:       #1f1300;
  --bg-subtle:        #2d1b00;
  --bg-muted:         #3d2500;
  --bg-elevated:      #2d1b00;

  --border:           #3d2500;
  --border-subtle:    #2d1b00;
  --border-strong:    #78350f;
  --border-focus:     #fbbf24;

  --text-primary:     #fef9c3;
  --text-secondary:   #fcd34d;
  --text-muted:       #78501a;
  --text-disabled:    #3d2500;
  --text-on-accent:   #1c1001;

  --sidebar-bg:           #0c0800;
  --sidebar-bg-hover:     #1c1001;
  --sidebar-text:         #fcd34d;
  --sidebar-text-muted:   #78501a;
  --sidebar-active:       #fbbf24;
  --sidebar-active-bg:    rgba(251, 191, 36, 0.12);
  --sidebar-border:       #070500;
  --sidebar-logo-bg:      #d97706;

  --topbar-bg:        #1f1300;
  --topbar-border:    #3d2500;
  --topbar-text:      #fef9c3;

  --card-total-bg:        #2d1b00;
  --card-total-border:    #78350f;
  --card-total-num:       #fde68a;
  --card-total-label:     #fbbf24;
  --card-active-bg:       #052e16;
  --card-active-border:   #14532d;
  --card-active-num:      #86efac;
  --card-active-label:    #4ade80;
  --card-repair-bg:       #431407;
  --card-repair-border:   #7c2d12;
  --card-repair-num:      #fdba74;
  --card-repair-label:    #fb923c;
  --card-expired-bg:      #450a0a;
  --card-expired-border:  #7f1d1d;
  --card-expired-num:     #fca5a5;
  --card-expired-label:   #f87171;
  --card-stock-bg:        #3d2500;
  --card-stock-border:    #78350f;
  --card-stock-num:       #fde68a;
  --card-stock-label:     #fbbf24;

  --status-success-bg:      #052e16;
  --status-success-text:    #4ade80;
  --status-success-border:  #14532d;
  --status-success-dot:     #22c55e;
  --status-warning-bg:      #2d1b00;
  --status-warning-text:    #fbbf24;
  --status-warning-border:  #78350f;
  --status-warning-dot:     #f59e0b;
  --status-danger-bg:       #450a0a;
  --status-danger-text:     #f87171;
  --status-danger-border:   #7f1d1d;
  --status-danger-dot:      #ef4444;
  --status-info-bg:         #2d1b00;
  --status-info-text:       #fde68a;
  --status-info-border:     #78350f;
  --status-info-dot:        #fbbf24;
  --status-neutral-bg:      #3d2500;
  --status-neutral-text:    #fcd34d;
  --status-neutral-border:  #78350f;
  --status-neutral-dot:     #a07830;
  --status-workflow-bg:     #2e1065;
  --status-workflow-text:   #c4b5fd;
  --status-workflow-border: #4c1d95;
  --status-workflow-dot:    #a78bfa;

  --chart-1: #fbbf24;
  --chart-2: #4ade80;
  --chart-3: #fb923c;
  --chart-4: #f87171;
  --chart-5: #c4b5fd;
  --chart-grid: #3d2500;
  --chart-tick: #78501a;

  --shadow-sm: 0 1px 3px rgba(0,0,0,0.40);
  --shadow-md: 0 4px 16px rgba(0,0,0,0.50);
  --shadow-lg: 0 10px 40px rgba(0,0,0,0.60);
}


/* ══════════════════════════════════════════════════
   SHARED — Spacing, radius, typography, transitions
   (không đổi theo theme)
   ══════════════════════════════════════════════════ */

:root {
  --radius-xs:   4px;
  --radius-sm:   6px;
  --radius-md:   10px;
  --radius-lg:   16px;
  --radius-xl:   24px;
  --radius-full: 9999px;

  --space-1: 4px;   --space-2: 8px;   --space-3: 12px;
  --space-4: 16px;  --space-5: 20px;  --space-6: 24px;
  --space-8: 32px;  --space-10: 40px; --space-12: 48px;

  --font-sans: 'Inter', 'Segoe UI', system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', 'Fira Code', monospace;

  --text-xs:   11px;
  --text-sm:   12px;
  --text-base: 14px;
  --text-md:   15px;
  --text-lg:   18px;
  --text-xl:   22px;
  --text-2xl:  28px;

  --transition-fast: 100ms ease;
  --transition-base: 150ms ease;
  --transition-slow: 250ms ease;

  --z-dropdown: 100;
  --z-modal:    200;
  --z-toast:    300;
  --z-tooltip:  400;
}
```

---

## FILE 2 — `src/lib/theme.ts`

```typescript
export type ThemeId = 'sky' | 'teal' | 'violet' | 'slate' | 'amber';
export type ThemeMode = 'light' | 'dark';

export interface ThemeMeta {
  id: ThemeId;
  name: string;
  description: string;
  recommended?: boolean;
  swatches: string[];  // preview chip colors
}

export const THEMES: ThemeMeta[] = [
  {
    id: 'sky',
    name: 'Sky Pro',
    description: 'Xanh trời chuyên nghiệp — gần với bộ màu hiện tại',
    swatches: ['#1e293b', '#0ea5e9', '#ffffff', '#16a34a', '#d97706', '#dc2626'],
  },
  {
    id: 'teal',
    name: 'Ocean Teal',
    description: 'Xanh ngọc — thanh lịch, phù hợp môi trường y tế',
    recommended: true,
    swatches: ['#134e4a', '#0d9488', '#ffffff', '#059669', '#d97706', '#dc2626'],
  },
  {
    id: 'violet',
    name: 'Violet Enterprise',
    description: 'Tím tinh tế — corporate, sang trọng',
    swatches: ['#1e1b4b', '#7c3aed', '#ffffff', '#16a34a', '#d97706', '#dc2626'],
  },
  {
    id: 'slate',
    name: 'Slate Clean',
    description: 'Xám xanh tối giản — focus vào dữ liệu',
    swatches: ['#0f172a', '#3b82f6', '#ffffff', '#16a34a', '#d97706', '#f43f5e'],
  },
  {
    id: 'amber',
    name: 'Amber Warm',
    description: 'Vàng ấm — năng động, phù hợp dashboard',
    swatches: ['#1c1001', '#d97706', '#ffffff', '#16a34a', '#ea580c', '#dc2626'],
  },
];

const STORAGE_KEY_THEME = 'qltb_theme';
const STORAGE_KEY_MODE  = 'qltb_mode';
const DEFAULT_THEME: ThemeId   = 'sky';
const DEFAULT_MODE: ThemeMode  = 'light';

function getSystemMode(): ThemeMode {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function applyTheme(theme: ThemeId, mode: ThemeMode): void {
  const root = document.documentElement;
  root.setAttribute('data-theme', theme);
  root.setAttribute('data-mode', mode);
}

export function loadTheme(): { theme: ThemeId; mode: ThemeMode } {
  const theme = (localStorage.getItem(STORAGE_KEY_THEME) as ThemeId) ?? DEFAULT_THEME;
  const stored = localStorage.getItem(STORAGE_KEY_MODE) as ThemeMode | null;
  const mode   = stored ?? getSystemMode();
  return { theme, mode };
}

export function saveTheme(theme: ThemeId, mode: ThemeMode): void {
  localStorage.setItem(STORAGE_KEY_THEME, theme);
  localStorage.setItem(STORAGE_KEY_MODE, mode);
  applyTheme(theme, mode);
}

export function toggleMode(currentMode: ThemeMode): ThemeMode {
  return currentMode === 'light' ? 'dark' : 'light';
}
```

---

## FILE 3 — Khởi động theme (trong root layout)

```svelte
<!-- src/routes/+layout.svelte -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { loadTheme, applyTheme } from '$lib/theme';
  import '../styles/themes.css';

  onMount(() => {
    const { theme, mode } = loadTheme();
    applyTheme(theme, mode);
  });
</script>

<slot />
```

**QUAN TRỌNG**: Thêm đoạn này vào `<head>` của `app.html` để tránh flash khi load:

```html
<!-- src/app.html -->
<script>
  (function() {
    var t = localStorage.getItem('qltb_theme') || 'sky';
    var m = localStorage.getItem('qltb_mode') || 
            (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme', t);
    document.documentElement.setAttribute('data-mode', m);
  })();
</script>
```

---

## FILE 4 — `ThemePicker.svelte`

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import { THEMES, loadTheme, saveTheme, toggleMode } from '$lib/theme';
  import type { ThemeId, ThemeMode } from '$lib/theme';

  let theme: ThemeId   = 'sky';
  let mode: ThemeMode  = 'light';

  onMount(() => {
    ({ theme, mode } = loadTheme());
  });

  function selectTheme(id: ThemeId) {
    theme = id;
    saveTheme(theme, mode);
  }

  function handleToggleMode() {
    mode = toggleMode(mode);
    saveTheme(theme, mode);
  }
</script>

<div class="theme-picker">
  <!-- Mode toggle -->
  <div class="mode-toggle">
    <button
      class="toggle-btn {mode === 'light' ? 'active' : ''}"
      on:click={() => { mode = 'light'; saveTheme(theme, mode); }}
    >
      ☀ Light
    </button>
    <button
      class="toggle-btn {mode === 'dark' ? 'active' : ''}"
      on:click={() => { mode = 'dark'; saveTheme(theme, mode); }}
    >
      ☾ Dark
    </button>
  </div>

  <!-- Theme options -->
  <div class="theme-list">
    {#each THEMES as t}
      <button
        class="theme-option {theme === t.id ? 'selected' : ''}"
        on:click={() => selectTheme(t.id)}
      >
        <div class="swatches">
          {#each t.swatches as color}
            <span class="swatch" style="background: {color}"></span>
          {/each}
        </div>
        <div class="meta">
          <span class="theme-name">{t.name}</span>
          {#if t.recommended}
            <span class="recommended-badge">Gợi ý</span>
          {/if}
          <span class="theme-desc">{t.description}</span>
        </div>
        {#if theme === t.id}
          <span class="check-icon">✓</span>
        {/if}
      </button>
    {/each}
  </div>
</div>

<style>
  .theme-picker {
    padding: 16px;
    background: var(--bg-surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-md);
    width: 320px;
  }
  .mode-toggle {
    display: flex;
    gap: 4px;
    margin-bottom: 16px;
    background: var(--bg-subtle);
    padding: 3px;
    border-radius: var(--radius-sm);
  }
  .toggle-btn {
    flex: 1;
    padding: 6px;
    border: none;
    border-radius: calc(var(--radius-sm) - 2px);
    background: transparent;
    color: var(--text-muted);
    font-size: var(--text-sm);
    cursor: pointer;
    transition: all var(--transition-base);
  }
  .toggle-btn.active {
    background: var(--bg-surface);
    color: var(--text-primary);
    box-shadow: var(--shadow-xs);
  }
  .theme-list { display: flex; flex-direction: column; gap: 6px; }
  .theme-option {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    border: 1.5px solid var(--border);
    border-radius: var(--radius-md);
    background: var(--bg-subtle);
    cursor: pointer;
    text-align: left;
    transition: all var(--transition-base);
  }
  .theme-option:hover { border-color: var(--accent); background: var(--accent-subtle); }
  .theme-option.selected { border-color: var(--accent); background: var(--accent-subtle); }
  .swatches { display: flex; gap: 3px; flex-shrink: 0; }
  .swatch {
    width: 14px; height: 14px;
    border-radius: 3px;
    border: 0.5px solid rgba(0,0,0,0.10);
  }
  .meta { flex: 1; }
  .theme-name {
    display: block;
    font-size: var(--text-sm);
    font-weight: 600;
    color: var(--text-primary);
  }
  .theme-desc {
    display: block;
    font-size: var(--text-xs);
    color: var(--text-muted);
    margin-top: 1px;
  }
  .recommended-badge {
    display: inline-block;
    font-size: 10px;
    padding: 1px 6px;
    border-radius: var(--radius-full);
    background: var(--status-success-bg);
    color: var(--status-success-text);
    margin-left: 6px;
    font-weight: 600;
  }
  .check-icon {
    color: var(--accent);
    font-size: 14px;
    font-weight: 700;
    flex-shrink: 0;
  }
</style>
```

---

## CÁCH DÙNG TRONG COMPONENT

### Rule tuyệt đối

**KHÔNG BAO GIỜ** viết màu cứng trong component. Chỉ dùng CSS variables.

```svelte
<!-- ❌ SAI — hard-code màu -->
<div style="background: #0ea5e9; color: white;">

<!-- ✅ ĐÚNG — dùng CSS variable -->
<div style="background: var(--accent); color: var(--text-on-accent);">
```

### Bảng mapping nhanh

| Tình huống | CSS Variable |
|---|---|
| Nền trang | `var(--bg-base)` |
| Card / Modal / Panel | `var(--bg-surface)` |
| Sidebar | `var(--sidebar-bg)` |
| Header / Topbar | `var(--topbar-bg)` |
| Input background | `var(--bg-subtle)` |
| Hover state | `var(--bg-muted)` |
| Tiêu đề | `var(--text-primary)` |
| Nội dung | `var(--text-secondary)` |
| Placeholder | `var(--text-muted)` |
| Đường viền mặc định | `var(--border)` |
| Đường viền nhẹ (row divider) | `var(--border-subtle)` |
| Button primary | `var(--accent)` |
| Button primary hover | `var(--accent-hover)` |
| Button primary text | `var(--text-on-accent)` |
| Link / Active indicator | `var(--accent)` |
| Selected row / badge bg | `var(--accent-subtle)` |
| Stat card — Tổng | `var(--card-total-bg/border/num/label)` |
| Stat card — Đang dùng | `var(--card-active-bg/border/num/label)` |
| Stat card — Sửa chữa | `var(--card-repair-bg/border/num/label)` |
| Stat card — Hết BH | `var(--card-expired-bg/border/num/label)` |
| Stat card — Trong kho | `var(--card-stock-bg/border/num/label)` |
| Badge: in_use, approved, healthy | `var(--status-success-*)` |
| Badge: repair, pending, warning | `var(--status-warning-*)` |
| Badge: expired, critical, danger | `var(--status-danger-*)` |
| Badge: submitted, info, in_stock | `var(--status-info-*)` |
| Badge: disposed, inactive, neutral | `var(--status-neutral-*)` |
| Badge: workflow, automation | `var(--status-workflow-*)` |
| Chart màu 1–5 | `var(--chart-1)` … `var(--chart-5)` |
| Chart grid line | `var(--chart-grid)` |
| Chart axis label | `var(--chart-tick)` |
| Shadow card | `var(--shadow-sm)` |
| Shadow modal | `var(--shadow-md)` |

---

## CHECKLIST HOÀN THÀNH

```
□ themes.css được import trong root layout
□ Inline script chống flash trong app.html <head>
□ ThemePicker đặt trong Settings hoặc user menu header
□ Tất cả component đã replace hard-coded màu bằng CSS variables
□ Sidebar luôn dùng --sidebar-* variables
□ StatusBadge dùng --status-{variant}-* variables
□ StatCard dùng --card-{type}-* variables  
□ Chart.js dùng var() không được — lấy giá trị bằng getComputedStyle():
    const accent = getComputedStyle(document.documentElement).getPropertyValue('--chart-1').trim();
□ Test cả 5 theme × 2 mode = 10 kịch bản
□ Test WCAG contrast AA: mỗi text color trên bg tương ứng ≥ 4.5:1
```

---

## GHI CHÚ CHO COPILOT

1. **Không tạo file CSS mới** cho từng theme — tất cả nằm trong `themes.css`
2. **Không dùng JavaScript** để thay màu — chỉ dùng `setAttribute` để đổi `data-theme` và `data-mode`
3. **Chart.js** không đọc được CSS variables trực tiếp, phải dùng `getComputedStyle()` để lấy giá trị khi vẽ chart
4. **ThemePicker** đặt trong dropdown từ icon cài đặt trên topbar — không phải trang riêng
5. Khi thêm component mới, **kiểm tra ngay** bằng cách đổi theme để đảm bảo không có màu bị lạc

---

*QLTB Color System v1.0 — 5 Themes × Light/Dark — Cho GitHub Copilot (claude-sonnet-4-5)*
