<script lang="ts">
    import { _, isLoading as i18nLoading } from '$lib/i18n';

    type SeedProgress = {
        current: number
        total: number
        step: string
        details: string[]
    }

    let { onNext, onBack, setupData } = $props<{
        onNext: () => Promise<void>
        onBack: () => void
        setupData: Record<string, unknown>
    }>();
    
    let loading = $state(false)
    let error = $state('')
    let skipping = $state(false)
    let seedProgress = $state<SeedProgress>({
        current: 0,
        total: 0,
        step: '',
        details: []
    })
    
    const seedDataInfo = $derived([
        {
            icon: '👥',
            title: $_('setup.seed.usersRoles'),
            description: $_('setup.seed.usersRolesDesc'),
            count: $_('setup.seed.usersRolesCount')
        },
        {
            icon: '🏢',
            title: $_('setup.seed.locations'),
            description: $_('setup.seed.locationsDesc'),
            count: $_('setup.seed.locationsCount')
        },
        {
            icon: '💻',
            title: $_('setup.seed.assets'),
            description: $_('setup.seed.assetsDesc'),
            count: $_('setup.seed.assetsCount')
        },
        {
            icon: '📋',
            title: $_('setup.seed.cmdb'),
            description: $_('setup.seed.cmdbDesc'),
            count: $_('setup.seed.cmdbCount')
        },
        {
            icon: '🔧',
            title: $_('setup.seed.spares'),
            description: $_('setup.seed.sparesDesc'),
            count: $_('setup.seed.sparesCount')
        },
        {
            icon: '🤖',
            title: $_('setup.seed.aiModels'),
            description: $_('setup.seed.aiModelsDesc'),
            count: $_('setup.seed.aiModelsCount')
        }
    ])
    
    async function loadSeedData() {
        try {
            loading = true
            error = ''
            seedProgress = { current: 0, total: 6, step: $_('setup.seed.preparing'), details: [] }
            
            const response = await fetch('/api/v1/setup/seed-data', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            })
            
            if (!response.ok) {
                const errorData = await response.json()
                throw new Error(errorData.message || $_('setup.seed.loadFailed'))
            }
            
            // Simulate progress updates
            const steps = [
                $_('setup.seed.progressUsers'),
                $_('setup.seed.progressLocations'),
                $_('setup.seed.progressAssets'),
                $_('setup.seed.progressCmdb'),
                $_('setup.seed.progressSpares'),
                $_('setup.seed.progressFinalizing')
            ]
            
            for (let i = 0; i < steps.length; i++) {
                seedProgress = {
                    current: i + 1,
                    total: steps.length,
                    step: steps[i],
                    details: [...seedProgress.details, `✅ ${steps[i]}`]
                }
                await new Promise(resolve => setTimeout(resolve, 500))
            }
            
            const result = await response.json()
            
            if (!result.success) {
                throw new Error(result.message || $_('setup.seed.loadFailed'))
            }
            
            // Update setup data
            setupData.seedData = result.data
            
            // Auto proceed to next step after a brief delay
            setTimeout(async () => {
                await onNext()
            }, 1000)
            
        } catch (err) {
            error = err instanceof Error ? err.message : $_('setup.seed.loadFailed')
            seedProgress = { current: 0, total: 0, step: '', details: [] }
        } finally {
            loading = false
        }
    }
    
    async function skipSeedData() {
        try {
            skipping = true
            error = ''

            const response = await fetch('/api/v1/setup/seed-data', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ skipped: true })
            })

            const result = await response.json()

            if (!response.ok || !result.success) {
                throw new Error(result.message || $_('setup.seed.markCompleteFailed'))
            }

            // Update setup data to indicate seed data was skipped
            setupData.seedData = { ...(result.data || {}), skipped: true }
            await onNext()
        } catch (err) {
            error = err instanceof Error ? err.message : $_('setup.seed.skipFailed')
        } finally {
            skipping = false
        }
    }
    
    const isLoading = $derived(loading || seedProgress.current > 0)
</script>

<div class="seed-data">
    <div class="step-header">
        <h2>🌱 {$i18nLoading ? 'Load Sample Data' : $_('setup.seed.title')}</h2>
        <p>{$i18nLoading ? 'Load demo data to explore the system quickly.' : $_('setup.seed.subtitle')}</p>
    </div>

    {#if error}
        <div class="alert alert-error">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
            {error}
        </div>
    {/if}

    {#if !isLoading && !error}
        <!-- Seed Data Preview -->
        <div class="seed-preview">
            <div class="preview-header">
                <h3>📦 {$i18nLoading ? 'Demo data includes:' : $_('setup.seed.demoIncludes')}</h3>
                <p>{$i18nLoading ? 'Realistic TechCorp Vietnam data for testing and demo' : $_('setup.seed.demoRealistic')}</p>
            </div>
            
            <div class="seed-items">
                {#each seedDataInfo as item}
                    <div class="seed-item">
                        <div class="item-icon">{item.icon}</div>
                        <div class="item-content">
                            <h4>{item.title}</h4>
                            <p>{item.description}</p>
                            <span class="item-count">{item.count}</span>
                        </div>
                    </div>
                {/each}
            </div>
            
            <div class="seed-benefits">
                <h4>✨ {$i18nLoading ? 'Benefits:' : $_('setup.seed.benefitsTitle')}</h4>
                <ul>
                    <li>🚀 <strong>{$i18nLoading ? 'Quick start:' : $_('setup.seed.quickStart')}</strong> {$i18nLoading ? 'Experience features immediately without manual setup' : $_('setup.seed.quickStartDesc')}</li>
                    <li>🎯 <strong>{$i18nLoading ? 'Understand workflow:' : $_('setup.seed.understandWorkflow')}</strong> {$i18nLoading ? 'See how the system works with real data' : $_('setup.seed.understandWorkflowDesc')}</li>
                    <li>🔍 <strong>{$i18nLoading ? 'Full testing:' : $_('setup.seed.fullTest')}</strong> {$i18nLoading ? 'Test reports, analytics and all modules' : $_('setup.seed.fullTestDesc')}</li>
                    <li>📚 <strong>{$i18nLoading ? 'Learn usage:' : $_('setup.seed.learnUsage')}</strong> {$i18nLoading ? 'Ready-made data for practice' : $_('setup.seed.learnUsageDesc')}</li>
                </ul>
            </div>
            
            <div class="seed-note">
                <div class="note-icon">⚠️</div>
                <div>
                    <strong>{$i18nLoading ? 'Note:' : $_('setup.seed.note')}</strong> 
                    {$i18nLoading ? 'Sample data will be added to the current database. You can delete or edit it later in the admin panel. This data is completely safe and does not affect the system.' : $_('setup.seed.noteText')}
                </div>
            </div>

            <div class="action-options">
                <button class="btn btn-primary btn-large" onclick={loadSeedData} disabled={loading || skipping}>
                    🌱 {$i18nLoading ? 'Load' : $_('setup.seed.loadBtn')}
                </button>
                
                <button class="btn btn-secondary btn-large" onclick={skipSeedData} disabled={loading || skipping}>
                    ⏭️ {$i18nLoading ? 'Skip' : $_('setup.seed.skip')}
                </button>
            </div>
        </div>
    {/if}

    {#if isLoading}
        <!-- Loading Progress -->
        <div class="loading-container">
            <div class="progress-header">
                <h3>📥 {$i18nLoading ? 'Loading...' : $_('setup.seed.loading')}</h3>
                <p>{$i18nLoading ? 'Please wait a moment' : $_('setup.firstTime.pleaseWait')}</p>
            </div>
            
            <div class="progress-bar">
                <div class="progress-fill" style="width: {(seedProgress.current / seedProgress.total) * 100}%"></div>
            </div>
            
            <div class="progress-info">
                <span class="progress-text">{seedProgress.step}</span>
                <span class="progress-count">{seedProgress.current}/{seedProgress.total}</span>
            </div>
            
            {#if seedProgress.details.length > 0}
                <div class="progress-details">
                    {#each seedProgress.details as detail}
                        <div class="detail-item">{detail}</div>
                    {/each}
                </div>
            {/if}
        </div>
    {/if}

    {#if !isLoading}
        <!-- Action Buttons -->
        <div class="form-actions">
            <button type="button" class="btn btn-secondary" onclick={onBack} disabled={isLoading}>
                ⬅️ {$i18nLoading ? 'Back' : $_('setup.seed.back')}
            </button>
            
            <!-- Only show manual next if seed data loading is complete or skipped -->
            {#if setupData.seedData && !isLoading}
                <button type="button" class="btn btn-primary" onclick={onNext}>
                    {$i18nLoading ? 'Continue' : $_('setup.seed.continue')} ➡️
                </button>
            {/if}
        </div>
    {/if}
</div>

<style>
    .seed-data {
        max-width: 800px;
        margin: 0 auto;
        padding: 2rem;
    }

    .step-header {
        text-align: center;
        margin-bottom: 2rem;
    }

    .step-header h2 {
        color: #1f2937;
        margin-bottom: 0.5rem;
    }

    .step-header p {
        color: #6b7280;
    }

    .seed-preview {
        background: white;
        border-radius: 0.75rem;
        padding: 2rem;
        border: 1px solid #e5e7eb;
    }

    .preview-header {
        text-align: center;
        margin-bottom: 2rem;
    }

    .preview-header h3 {
        color: #1f2937;
        margin-bottom: 0.5rem;
    }

    .preview-header p {
        color: #6b7280;
    }

    .seed-items {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
        gap: 1rem;
        margin-bottom: 2rem;
    }

    .seed-item {
        display: flex;
        align-items: center;
        gap: 1rem;
        padding: 1rem;
        border: 1px solid #e5e7eb;
        border-radius: 0.5rem;
        background: #f9fafb;
    }

    .item-icon {
        font-size: 2rem;
        flex-shrink: 0;
    }

    .item-content h4 {
        margin: 0 0 0.25rem 0;
        color: #1f2937;
        font-size: 0.9rem;
        font-weight: 600;
    }

    .item-content p {
        margin: 0 0 0.25rem 0;
        color: #6b7280;
        font-size: 0.8rem;
        line-height: 1.4;
    }

    .item-count {
        background: #dbeafe;
        color: #1e40af;
        padding: 0.125rem 0.5rem;
        border-radius: 0.25rem;
        font-size: 0.75rem;
        font-weight: 500;
    }

    .seed-benefits {
        margin-bottom: 2rem;
        padding: 1.5rem;
        background: #f0f9ff;
        border: 1px solid #bae6fd;
        border-radius: 0.5rem;
    }

    .seed-benefits h4 {
        color: #0369a1;
        margin-bottom: 1rem;
    }

    .seed-benefits ul {
        margin: 0;
        padding-left: 0;
        list-style: none;
    }

    .seed-benefits li {
        margin-bottom: 0.75rem;
        color: #374151;
        line-height: 1.5;
    }

    .seed-note {
        background-color: #fffbeb;
        border: 1px solid #fed7aa;
        border-radius: 0.5rem;
        padding: 1rem;
        margin-bottom: 2rem;
        display: flex;
        gap: 0.75rem;
    }

    .note-icon {
        font-size: 1.25rem;
        flex-shrink: 0;
    }

    .seed-note div {
        color: #92400e;
        font-size: 0.875rem;
        line-height: 1.4;
    }

    .action-options {
        display: flex;
        flex-direction: column;
        gap: 1rem;
        align-items: center;
    }

    .loading-container {
        text-align: center;
        padding: 3rem 2rem;
    }

    .progress-header h3 {
        color: #1f2937;
        margin-bottom: 0.5rem;
    }

    .progress-header p {
        color: #6b7280;
        margin-bottom: 2rem;
    }

    .progress-bar {
        width: 100%;
        height: 8px;
        background-color: #e5e7eb;
        border-radius: 4px;
        margin-bottom: 1rem;
        overflow: hidden;
    }

    .progress-fill {
        height: 100%;
        background: linear-gradient(90deg, #3b82f6, #1d4ed8);
        border-radius: 4px;
        transition: width 0.3s ease;
    }

    .progress-info {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 1.5rem;
    }

    .progress-text {
        color: #374151;
        font-weight: 500;
    }

    .progress-count {
        background: #dbeafe;
        color: #1e40af;
        padding: 0.25rem 0.75rem;
        border-radius: 1rem;
        font-size: 0.875rem;
        font-weight: 500;
    }

    .progress-details {
        background: #f9fafb;
        border: 1px solid #e5e7eb;
        border-radius: 0.5rem;
        padding: 1rem;
        text-align: left;
        max-height: 200px;
        overflow-y: auto;
    }

    .detail-item {
        color: #374151;
        margin-bottom: 0.5rem;
        font-size: 0.875rem;
        line-height: 1.4;
    }

    .alert {
        padding: 1rem;
        border-radius: 0.375rem;
        margin-bottom: 1rem;
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }

    .alert-error {
        background-color: #fee2e2;
        border: 1px solid #fecaca;
        color: #b91c1c;
    }

    .form-actions {
        display: flex;
        justify-content: space-between;
        margin-top: 2rem;
        padding-top: 1rem;
        border-top: 1px solid #e5e7eb;
    }

    .btn {
        padding: 0.75rem 1.5rem;
        border: none;
        border-radius: 0.375rem;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s;
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }

    .btn-large {
        padding: 1rem 2rem;
        font-size: 1rem;
        min-width: 200px;
        justify-content: center;
    }

    .btn:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }

    .btn-primary {
        background-color: #3b82f6;
        color: white;
    }

    .btn-primary:hover:not(:disabled) {
        background-color: #2563eb;
    }

    .btn-secondary {
        background-color: #f3f4f6;
        color: #374151;
        border: 1px solid #d1d5db;
    }

    .btn-secondary:hover:not(:disabled) {
        background-color: #e5e7eb;
    }
</style>
