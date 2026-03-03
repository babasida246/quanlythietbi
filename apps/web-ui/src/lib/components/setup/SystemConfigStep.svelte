<script lang="ts">
    import { _, isLoading } from '$lib/i18n'
    
    let { onNext, onBack, setupData } = $props<{
        onNext: () => Promise<void>;
        onBack: () => void;
        setupData: Record<string, unknown>;
    }>();
    
    let loading = $state(false)
    let error = $state('')
    let formData = $state({
        companyName: '',
        companyAddress: '',
        companyPhone: '',
        companyEmail: '',
        timezone: 'Asia/Ho_Chi_Minh',
        language: 'vi',
        currency: 'VND',
        smtpHost: '',
        smtpPort: 587,
        smtpUser: '',
        smtpPassword: '',
        smtpSecure: true
    })
    
    // Pre-fill with TechCorp data if empty
    $effect(() => {
        if (!formData.companyName) {
            formData.companyName = 'TechCorp Vietnam'
            formData.companyAddress = '123 Nguyen Hue, District 1, Ho Chi Minh City'
            formData.companyPhone = '+84 28 1234 5678'
            formData.companyEmail = 'info@techcorp.vn'
        }
    })
    
    const timezones = [
        { value: 'Asia/Ho_Chi_Minh', label: 'Vietnam (UTC+7)' },
        { value: 'Asia/Singapore', label: 'Singapore (UTC+8)' },
        { value: 'Asia/Bangkok', label: 'Bangkok (UTC+7)' },
        { value: 'UTC', label: 'UTC' }
    ]
    
    const languages = [
        { value: 'vi', label: 'Tiếng Việt' },
        { value: 'en', label: 'English' }
    ]
    
    const currencies = [
        { value: 'VND', label: 'Vietnamese Dong (VND)' },
        { value: 'USD', label: 'US Dollar (USD)' },
        { value: 'EUR', label: 'Euro (EUR)' }
    ]
    
    async function handleNext() {
        try {
            loading = true
            error = ''
            
            // Validate required fields
            if (!formData.companyName.trim()) {
                throw new Error($isLoading ? 'Company name is required' : $_('setup.systemConfig.companyNameRequired'))
            }
            
            if (formData.companyEmail && !isValidEmail(formData.companyEmail)) {
                throw new Error($isLoading ? 'Please enter a valid email address' : $_('setup.systemConfig.invalidEmail'))
            }
            
            // Test SMTP if configured
            if (formData.smtpHost) {
                await testSMTPConnection()
            }
            
            const response = await fetch('/api/v1/setup/system', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            })
            
            const result = await response.json()
            
            if (!result.success) {
                throw new Error(result.message || ($isLoading ? 'Failed to save system configuration' : $_('setup.systemConfig.failedToSave')))
            }
            
            // Update setup data
            setupData.systemConfig = result.data
            
            // Proceed to next step
            await onNext()
            
        } catch (err: unknown) {
            error = err instanceof Error ? err.message : ($isLoading ? 'Unknown error occurred' : $_('setup.systemConfig.unknownError'))
        } finally {
            loading = false
        }
    }
    
    async function testSMTPConnection() {
        if (!formData.smtpHost || !formData.smtpUser || !formData.smtpPassword) {
            return // Skip if not all SMTP fields are filled
        }
        
        try {
            const response = await fetch('/api/v1/setup/test-smtp', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    host: formData.smtpHost,
                    port: formData.smtpPort,
                    user: formData.smtpUser,
                    password: formData.smtpPassword,
                    secure: formData.smtpSecure
                })
            })
            
            const result = await response.json()
            
            if (!result.success) {
                throw new Error(`${$isLoading ? 'SMTP connection failed' : $_('setup.systemConfig.smtpConnectionFailed')}: ${result.message}`)
            }
        } catch (err: unknown) {
            throw new Error(`${$isLoading ? 'SMTP test failed' : $_('setup.systemConfig.smtpTestFailed')}: ${err instanceof Error ? err.message : 'Unknown error'}`)
        }
    }
    
    function isValidEmail(email: string): boolean {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        return emailRegex.test(email)
    }
</script>

<div class="system-config">
    <div class="step-header">
        <h2>🏢 {$isLoading ? 'System Configuration' : $_('setup.systemConfig.title')}</h2>
        <p>{$isLoading ? 'Set up company information and SMTP configuration (optional)' : $_('setup.systemConfig.subtitle')}</p>
    </div>

    {#if error}
        <div class="alert alert-error">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
            {error}
        </div>
    {/if}

    <form onsubmit={async (e) => { e.preventDefault(); await handleNext(); }}>
        <!-- Company Information -->
        <div class="form-section">
            <h3>🏢 {$isLoading ? 'Company Information' : $_('setup.systemConfig.companyInfo')}</h3>
            
            <div class="form-group">
                <label for="companyName">{$isLoading ? 'Company Name *' : $_('setup.systemConfig.companyName')}</label>
                <input 
                    id="companyName"
                    type="text" 
                    bind:value={formData.companyName}
                    placeholder="TechCorp Vietnam"
                    required 
                />
            </div>
            
            <div class="form-group">
                <label for="companyAddress">{$isLoading ? 'Address' : $_('setup.systemConfig.companyAddress')}</label>
                <textarea 
                    id="companyAddress"
                    bind:value={formData.companyAddress}
                    placeholder="123 Nguyen Hue, District 1, Ho Chi Minh City"
                    rows="3"
                ></textarea>
            </div>
            
            <div class="form-row">
                <div class="form-group">
                    <label for="companyPhone">{$isLoading ? 'Phone number' : $_('setup.systemConfig.companyPhone')}</label>
                    <input 
                        id="companyPhone"
                        type="tel" 
                        bind:value={formData.companyPhone}
                        placeholder="+84 28 1234 5678"
                    />
                </div>
                
                <div class="form-group">
                    <label for="companyEmail">Email</label>
                    <input 
                        id="companyEmail"
                        type="email" 
                        bind:value={formData.companyEmail}
                        placeholder="info@techcorp.vn"
                    />
                </div>
            </div>
        </div>

        <!-- Regional Settings -->
        <div class="form-section">
            <h3>🌍 {$isLoading ? 'Regional Settings' : $_('setup.systemConfig.regionalSettings')}</h3>
            
            <div class="form-row">
                <div class="form-group">
                    <label for="timezone">{$isLoading ? 'Timezone' : $_('setup.systemConfig.timezone')}</label>
                    <select id="timezone" bind:value={formData.timezone}>
                        {#each timezones as tz}
                            <option value={tz.value}>{tz.label}</option>
                        {/each}
                    </select>
                </div>
                
                <div class="form-group">
                    <label for="language">{$isLoading ? 'Language' : $_('setup.systemConfig.language')}</label>
                    <select id="language" bind:value={formData.language}>
                        {#each languages as lang}
                            <option value={lang.value}>{lang.label}</option>
                        {/each}
                    </select>
                </div>
                
                <div class="form-group">
                    <label for="currency">{$isLoading ? 'Currency' : $_('setup.systemConfig.currency')}</label>
                    <select id="currency" bind:value={formData.currency}>
                        {#each currencies as curr}
                            <option value={curr.value}>{curr.label}</option>
                        {/each}
                    </select>
                </div>
            </div>
        </div>

        <!-- SMTP Configuration -->
        <div class="form-section">
            <h3>📧 {$isLoading ? 'Email SMTP Configuration (Optional)' : $_('setup.systemConfig.smtpTitle')}</h3>
            <p class="section-description">{$isLoading ? 'Configure email server for notifications and password reset' : $_('setup.systemConfig.smtpDescription')}</p>
            
            <div class="form-row">
                <div class="form-group">
                    <label for="smtpHost">SMTP Host</label>
                    <input 
                        id="smtpHost"
                        type="text" 
                        bind:value={formData.smtpHost}
                        placeholder="smtp.gmail.com"
                    />
                </div>
                
                <div class="form-group">
                    <label for="smtpPort">SMTP Port</label>
                    <input 
                        id="smtpPort"
                        type="number" 
                        bind:value={formData.smtpPort}
                        placeholder="587"
                        min="25"
                        max="65535"
                    />
                </div>
            </div>
            
            <div class="form-row">
                <div class="form-group">
                    <label for="smtpUser">SMTP Username</label>
                    <input 
                        id="smtpUser"
                        type="email" 
                        bind:value={formData.smtpUser}
                        placeholder="noreply@techcorp.vn"
                    />
                </div>
                
                <div class="form-group">
                    <label for="smtpPassword">SMTP Password</label>
                    <input 
                        id="smtpPassword"
                        type="password" 
                        bind:value={formData.smtpPassword}
                        placeholder="••••••••"
                    />
                </div>
            </div>
            
            <div class="form-group">
                <label class="checkbox-label">
                    <input 
                        type="checkbox" 
                        bind:checked={formData.smtpSecure}
                    />
                    <span>{$isLoading ? 'Use secure connection (TLS/SSL)' : $_('setup.systemConfig.smtpSecure')}</span>
                </label>
            </div>
        </div>

        <!-- Action Buttons -->
        <div class="form-actions">
            <button type="button" class="btn btn-secondary" onclick={onBack} disabled={loading}>
                ⬅️ {$isLoading ? 'Back' : $_('setup.systemConfig.back')}
            </button>
            
            <button type="submit" class="btn btn-primary" disabled={loading}>
                {#if loading}
                    <div class="spinner"></div>
                    {$isLoading ? 'Saving...' : $_('setup.systemConfig.saving')}
                {:else}
                    {$isLoading ? 'Continue' : $_('setup.systemConfig.continue')} ➡️
                {/if}
            </button>
        </div>
    </form>
</div>

<style>
    .system-config {
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

    .form-section {
        margin-bottom: 2rem;
        padding: 1.5rem;
        border: 1px solid #e5e7eb;
        border-radius: 0.5rem;
        background: #f9fafb;
    }

    .form-section h3 {
        color: #374151;
        margin-bottom: 1rem;
        font-size: 1.1rem;
    }

    .section-description {
        color: #6b7280;
        font-size: 0.875rem;
        margin-bottom: 1rem;
    }

    .form-group {
        margin-bottom: 1rem;
    }

    .form-row {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 1rem;
        margin-bottom: 1rem;
    }

    label {
        display: block;
        margin-bottom: 0.25rem;
        font-weight: 500;
        color: #374151;
    }

    input, select, textarea {
        width: 100%;
        padding: 0.5rem;
        border: 1px solid #d1d5db;
        border-radius: 0.375rem;
        font-size: 0.875rem;
    }

    input:focus, select:focus, textarea:focus {
        outline: none;
        border-color: #3b82f6;
        box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
    }

    .checkbox-label {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        cursor: pointer;
    }

    .checkbox-label input[type="checkbox"] {
        width: auto;
        margin: 0;
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

    .spinner {
        width: 1rem;
        height: 1rem;
        border: 2px solid transparent;
        border-top: 2px solid currentColor;
        border-radius: 50%;
        animation: spin 1s linear infinite;
    }

    @keyframes spin {
        to {
            transform: rotate(360deg);
        }
    }
</style>