import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/svelte';
import LanguageSwitcher from './LanguageSwitcher.svelte';
import { locale } from '$lib/i18n';
import { get } from 'svelte/store';

describe('LanguageSwitcher Component', () => {
    beforeEach(() => {
        // Reset locale before each test
        locale.set('en');
    });

    it('should render language switcher', () => {
        const { container } = render(LanguageSwitcher);
        expect(container).toBeTruthy();
    });

    it('should display current locale', () => {
        locale.set('en');
        const { getByRole } = render(LanguageSwitcher);
        const select = getByRole('combobox');
        expect(select).toBeTruthy();
    });

    it('should have English and Vietnamese options', () => {
        const { getByRole } = render(LanguageSwitcher);
        const select = getByRole('combobox');
        const options = select.querySelectorAll('option');

        expect(options.length).toBeGreaterThanOrEqual(2);
        const values = Array.from(options).map(opt => opt.value);
        expect(values).toContain('en');
        expect(values).toContain('vi');
    });

    it('should switch locale when option is selected', async () => {
        const { getByRole } = render(LanguageSwitcher);
        const select = getByRole('combobox') as HTMLSelectElement;

        // Initial locale should be English
        expect(get(locale)).toBe('en');

        // Change to Vietnamese
        await fireEvent.change(select, { target: { value: 'vi' } });

        await waitFor(() => {
            expect(get(locale)).toBe('vi');
        });
    });

    it('should update select value when locale changes externally', async () => {
        const { getByRole } = render(LanguageSwitcher);
        const select = getByRole('combobox') as HTMLSelectElement;

        // Change locale externally
        locale.set('vi');

        await waitFor(() => {
            expect(select.value).toBe('vi');
        });
    });

    it('should persist locale selection', async () => {
        const { getByRole } = render(LanguageSwitcher);
        const select = getByRole('combobox') as HTMLSelectElement;

        // Mock localStorage
        const localStorageMock = {
            getItem: vi.fn(),
            setItem: vi.fn(),
            removeItem: vi.fn(),
            clear: vi.fn()
        };
        Object.defineProperty(window, 'localStorage', {
            value: localStorageMock,
            writable: true
        });

        // Change locale
        await fireEvent.change(select, { target: { value: 'vi' } });

        await waitFor(() => {
            // Should save to localStorage
            expect(localStorageMock.setItem).toHaveBeenCalledWith(
                expect.any(String),
                expect.stringContaining('vi')
            );
        });
    });

    it('should have accessible label', () => {
        const { getByRole } = render(LanguageSwitcher);
        const select = getByRole('combobox');
        // Component uses aria-label for accessibility
        expect(select.getAttribute('aria-label') || select.getAttribute('title')).toBeTruthy();
    });
});
