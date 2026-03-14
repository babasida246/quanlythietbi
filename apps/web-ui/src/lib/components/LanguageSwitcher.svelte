<script lang="ts">
    import { locale } from '$lib/i18n'

    const languages = [
        { code: 'en', name: 'English', flag: '🇬🇧' },
        { code: 'vi', name: 'Tiếng Việt', flag: '🇻🇳' }
    ]

    let currentLocale = $state('en')
    locale.subscribe((value) => {
        if (value) currentLocale = value
    })

    function changeLanguage(lang: string) {
        locale.set(lang)
        // Save to localStorage
        if (typeof window !== 'undefined') {
            localStorage.setItem('locale', lang)
        }
    }
</script>

<div class="language-switcher">
    <select 
        bind:value={currentLocale} 
        onchange={() => changeLanguage(currentLocale)}
        aria-label="Select language"
        class="language-switcher-select text-sm"
    >
        {#each languages as lang}
            <option value={lang.code}>
                {lang.flag} {lang.name}
            </option>
        {/each}
    </select>
</div>

<style>
    .language-switcher {
        display: inline-block;
    }

    .language-switcher-select {
        cursor: pointer;
        transition: all 0.2s;
        height: 2.125rem;
        border-radius: 0.5rem;
        border: 1px solid rgba(148, 163, 184, 0.4);
        background: rgba(15, 23, 42, 0.9);
        color: rgba(241, 245, 249, 0.95);
        padding: 0.375rem 2.1rem 0.375rem 0.75rem;
        appearance: none;
        -webkit-appearance: none;
        -moz-appearance: none;
        line-height: 1.1;
        background-image: linear-gradient(45deg, transparent 50%, #94a3b8 50%), linear-gradient(135deg, #94a3b8 50%, transparent 50%);
        background-position: calc(100% - 15px) 50%, calc(100% - 10px) 50%;
        background-size: 5px 5px, 5px 5px;
        background-repeat: no-repeat;
    }

    .language-switcher-select:hover {
        border-color: rgba(96, 165, 250, 0.75);
    }

    .language-switcher-select:focus {
        outline: none;
        box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.35);
        border-color: rgba(96, 165, 250, 0.9);
    }

    .language-switcher-select option {
        background: #0f172a;
        color: #e2e8f0;
    }
</style>
