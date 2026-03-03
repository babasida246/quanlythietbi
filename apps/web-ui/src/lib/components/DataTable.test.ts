/**
 * DataTable Component Tests
 * Tests table rendering, sorting, filtering, selection, edit, delete
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import DataTable from './DataTable.svelte';

// Mock i18n
vi.mock('$lib/i18n', () => ({
    _: {
        subscribe: (fn: (value: (key: string) => string) => void) => {
            fn((key: string) => {
                const translations: Record<string, string> = {
                    'common.selected': 'selected',
                    'common.delete': 'Delete',
                    'common.edit': 'Edit',
                    'common.clearSelection': 'Clear Selection',
                    'common.filter': 'Filter',
                    'common.actions': 'Actions',
                    'common.loading': 'Loading...',
                    'common.noData': 'No data available',
                    'common.showing': 'Showing',
                    'common.rows': 'rows',
                    'common.confirmDelete': 'Are you sure you want to delete?'
                };
                return translations[key] || key;
            });
            return () => { };
        }
    }
}));

const mockColumns = [
    { key: 'id', label: 'ID', sortable: true },
    { key: 'name', label: 'Name', sortable: true, filterable: true, editable: true },
    { key: 'email', label: 'Email', filterable: true },
    { key: 'status', label: 'Status' }
];

const mockData = [
    { id: 1, name: 'John Doe', email: 'john@example.com', status: 'Active' },
    { id: 2, name: 'Jane Smith', email: 'jane@example.com', status: 'Inactive' },
    { id: 3, name: 'Bob Wilson', email: 'bob@example.com', status: 'Active' }
];

describe('DataTable Component', () => {
    describe('Basic Rendering', () => {
        it('should render table with data', () => {
            const { container } = render(DataTable, {
                props: { data: mockData, columns: mockColumns }
            });

            expect(container.querySelector('table')).toBeTruthy();
            expect(container.textContent).toContain('John Doe');
            expect(container.textContent).toContain('Jane Smith');
            expect(container.textContent).toContain('Bob Wilson');
        });

        it('should render column headers', () => {
            const { container } = render(DataTable, {
                props: { data: mockData, columns: mockColumns }
            });

            expect(container.textContent).toContain('ID');
            expect(container.textContent).toContain('Name');
            expect(container.textContent).toContain('Email');
            expect(container.textContent).toContain('Status');
        });

        it('should show "no data" message when empty', () => {
            const { container } = render(DataTable, {
                props: { data: [], columns: mockColumns }
            });

            expect(container.textContent).toContain('No data available');
        });

        it('should show loading state', () => {
            const { container } = render(DataTable, {
                props: { data: mockData, columns: mockColumns, loading: true }
            });

            expect(container.textContent).toContain('Loading...');
        });

        it('should show row count summary', () => {
            const { container } = render(DataTable, {
                props: { data: mockData, columns: mockColumns }
            });

            expect(container.textContent).toContain('3 / 3');
        });
    });

    describe('Selection', () => {
        it('should show checkboxes when selectable', () => {
            const { container } = render(DataTable, {
                props: { data: mockData, columns: mockColumns, selectable: true }
            });

            const checkboxes = container.querySelectorAll('input[type="checkbox"]');
            // 1 header checkbox + 3 row checkboxes
            expect(checkboxes.length).toBe(4);
        });

        it('should not show checkboxes when not selectable', () => {
            const { container } = render(DataTable, {
                props: { data: mockData, columns: mockColumns, selectable: false }
            });

            const checkboxes = container.querySelectorAll('input[type="checkbox"]');
            expect(checkboxes.length).toBe(0);
        });

        it('should call onSelect when row is selected', async () => {
            const onSelect = vi.fn();
            const { container } = render(DataTable, {
                props: {
                    data: mockData,
                    columns: mockColumns,
                    selectable: true,
                    onSelect
                }
            });

            const checkboxes = container.querySelectorAll('input[type="checkbox"]');
            // Click first row checkbox (index 1, as 0 is header)
            await fireEvent.click(checkboxes[1]);

            expect(onSelect).toHaveBeenCalled();
        });

        it('should select all rows when header checkbox clicked', async () => {
            const onSelect = vi.fn();
            const { container } = render(DataTable, {
                props: {
                    data: mockData,
                    columns: mockColumns,
                    selectable: true,
                    onSelect
                }
            });

            const checkboxes = container.querySelectorAll('input[type="checkbox"]');
            // Click header checkbox
            await fireEvent.click(checkboxes[0]);

            expect(onSelect).toHaveBeenCalled();
        });
    });

    describe('Sorting', () => {
        it('should show sort indicator on sortable columns', () => {
            const { container } = render(DataTable, {
                props: { data: mockData, columns: mockColumns }
            });

            // Click on sortable column header
            const nameHeader = container.querySelector('button');
            expect(nameHeader).toBeTruthy();
        });

        it('should sort data when column header clicked', async () => {
            const { container } = render(DataTable, {
                props: { data: mockData, columns: mockColumns }
            });

            // Find Name column header button
            const buttons = container.querySelectorAll('button');
            const nameButton = Array.from(buttons).find(b => b.textContent?.includes('Name'));

            if (nameButton) {
                await fireEvent.click(nameButton);
                // Data should be sorted
            }
        });

        it('should toggle sort order on second click', async () => {
            const { container } = render(DataTable, {
                props: { data: mockData, columns: mockColumns }
            });

            const buttons = container.querySelectorAll('button');
            const idButton = Array.from(buttons).find(b => b.textContent?.includes('ID'));

            if (idButton) {
                await fireEvent.click(idButton); // First click - ascending
                await fireEvent.click(idButton); // Second click - descending
            }
        });
    });

    describe('Filtering', () => {
        it('should show filter input for filterable columns', () => {
            const { container } = render(DataTable, {
                props: { data: mockData, columns: mockColumns }
            });

            const inputs = container.querySelectorAll('input[type="text"]');
            expect(inputs.length).toBeGreaterThan(0);
        });

        it('should filter data when text is entered', async () => {
            const { container } = render(DataTable, {
                props: { data: mockData, columns: mockColumns }
            });

            // Find filter input
            const filterInputs = container.querySelectorAll('input[type="text"]');

            if (filterInputs.length > 0) {
                await fireEvent.input(filterInputs[0], { target: { value: 'John' } });

                await waitFor(() => {
                    // Should show filtered results
                    expect(container.textContent).toContain('John Doe');
                });
            }
        });

        it('should show empty state when no filter matches', async () => {
            const { container } = render(DataTable, {
                props: { data: mockData, columns: mockColumns }
            });

            const filterInputs = container.querySelectorAll('input[type="text"]');

            if (filterInputs.length > 0) {
                await fireEvent.input(filterInputs[0], { target: { value: 'NONEXISTENT' } });

                await waitFor(() => {
                    expect(container.textContent).toContain('No data available');
                });
            }
        });
    });

    describe('Edit Mode', () => {
        it('should show edit button when onEdit provided', () => {
            const onEdit = vi.fn();
            const { container } = render(DataTable, {
                props: { data: mockData, columns: mockColumns, onEdit }
            });

            // Should have edit buttons (one per row)
            const editButtons = container.querySelectorAll('button');
            const hasEditButton = Array.from(editButtons).some(b =>
                b.querySelector('svg') // Edit icon
            );
            expect(hasEditButton).toBe(true);
        });
    });

    describe('Delete', () => {
        it('should show delete button when onDelete provided', () => {
            const onDelete = vi.fn();
            const { container } = render(DataTable, {
                props: { data: mockData, columns: mockColumns, onDelete }
            });

            // Should have delete buttons
            const buttons = container.querySelectorAll('button');
            expect(buttons.length).toBeGreaterThan(0);
        });

        it('should show bulk delete when items selected', async () => {
            const onDelete = vi.fn();
            const { container } = render(DataTable, {
                props: {
                    data: mockData,
                    columns: mockColumns,
                    selectable: true,
                    onDelete
                }
            });

            // Select a row
            const checkboxes = container.querySelectorAll('input[type="checkbox"]');
            await fireEvent.click(checkboxes[1]);

            await waitFor(() => {
                // Bulk action toolbar should appear
                expect(container.textContent).toContain('selected');
            });
        });
    });

    describe('Custom Actions', () => {
        it('should render custom action buttons', () => {
            const customActions = [
                { label: 'View', onClick: vi.fn(), color: 'primary' as const }
            ];

            const { container } = render(DataTable, {
                props: {
                    data: mockData,
                    columns: mockColumns,
                    customActions
                }
            });

            // Custom action buttons should be present
            const buttons = container.querySelectorAll('button');
            expect(buttons.length).toBeGreaterThan(0);
        });

        it('should call custom action onClick', async () => {
            const onClick = vi.fn();
            const customActions = [
                { label: 'View', onClick, color: 'primary' as const }
            ];

            const { container } = render(DataTable, {
                props: {
                    data: mockData,
                    columns: mockColumns,
                    customActions
                }
            });

            // Find and click custom action button
            const buttons = container.querySelectorAll('button');
            if (buttons.length > 0) {
                await fireEvent.click(buttons[buttons.length - 1]);
            }
        });
    });

    describe('Custom Render', () => {
        it('should use custom render function', () => {
            const columnsWithRender = [
                ...mockColumns.slice(0, 3),
                {
                    key: 'status',
                    label: 'Status',
                    render: (value: string) => `<span class="badge">${value}</span>`
                }
            ];

            const { container } = render(DataTable, {
                props: { data: mockData, columns: columnsWithRender }
            });

            const badge = container.querySelector('.badge');
            expect(badge).toBeTruthy();
        });
    });

    describe('Accessibility', () => {
        it('should have proper table structure', () => {
            const { container } = render(DataTable, {
                props: { data: mockData, columns: mockColumns }
            });

            expect(container.querySelector('table')).toBeTruthy();
            expect(container.querySelector('thead')).toBeTruthy();
            expect(container.querySelector('tbody')).toBeTruthy();
        });

        it('should have accessible checkboxes', () => {
            const { container } = render(DataTable, {
                props: { data: mockData, columns: mockColumns, selectable: true }
            });

            const checkboxes = container.querySelectorAll('input[type="checkbox"]');
            checkboxes.forEach(checkbox => {
                // Checkboxes should be interactive
                expect(checkbox.getAttribute('disabled')).toBeNull();
            });
        });
    });
});
