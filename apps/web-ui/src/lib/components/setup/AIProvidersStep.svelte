<script lang="ts">
    import { _, isLoading } from '$lib/i18n'
    
    let { onNext, onBack, setupData } = $props<{
        onNext: () => Promise<void>;
        onBack: () => void;
        setupData: Record<string, unknown>;
    }>();
    
    type ProviderKey = 'openai' | 'anthropic' | 'google' | 'azure'
    
    interface ProviderStatus {
        testing?: boolean
        success?: boolean
        error?: boolean
        message?: string
    }
    
    type ProviderInfo = {
        name: string
        description: string
        icon: string
        website: string
        docs: string
    }

    type ProviderConfigBase = {
        enabled: boolean
        apiKey: string
        models: string[]
    }

    type ProviderConfigs = {
        openai: ProviderConfigBase & { organization: string }
        anthropic: ProviderConfigBase
        google: ProviderConfigBase
        azure: ProviderConfigBase & { endpoint: string }
    }
    
    let loading = $state(false)
    let error = $state('')
    let testingProvider = $state<ProviderKey | ''>('')
    let providerStatus = $state<Record<ProviderKey, ProviderStatus | undefined>>({
        openai: undefined,
        anthropic: undefined,
        google: undefined,
        azure: undefined
    })
    
    let formData = $state<ProviderConfigs>({
        openai: {
            enabled: false,
            apiKey: '',
            organization: '',
            models: ['gpt-4', 'gpt-3.5-turbo', 'gpt-4-turbo']
        },
        anthropic: {
            enabled: false,
            apiKey: '',
            models: ['claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku']
        },
        google: {
            enabled: false,
            apiKey: '',
            models: ['gemini-pro', 'gemini-pro-vision']
        },
        azure: {
            enabled: false,
            apiKey: '',
            endpoint: '',
            models: ['gpt-4', 'gpt-35-turbo']
        }
    })
    
    const providerInfo = $derived({
        openai: {
            name: 'OpenAI',
            description: $isLoading ? 'GPT-4, ChatGPT and advanced AI models' : $_('setup.aiProviders.openaiDesc'),
            icon: '🤖',
            website: 'https://platform.openai.com',
            docs: 'https://platform.openai.com/docs'
        },
        anthropic: {
            name: 'Anthropic',
            description: $isLoading ? 'Claude - intelligent and safe AI assistant' : $_('setup.aiProviders.anthropicDesc'),
            icon: '🧠',
            website: 'https://console.anthropic.com',
            docs: 'https://docs.anthropic.com'
        },
        google: {
            name: 'Google AI',
            description: $isLoading ? 'Gemini - Google multimodal AI model' : $_('setup.aiProviders.googleDesc'),
            icon: '🌟',
            website: 'https://ai.google.dev',
            docs: 'https://ai.google.dev/docs'
        },
        azure: {
            name: 'Azure OpenAI',
            description: $isLoading ? 'OpenAI models via Microsoft Azure' : $_('setup.aiProviders.azureDesc'),
            icon: '☁️',
            website: 'https://azure.microsoft.com/en-us/products/ai-services/openai-service',
            docs: 'https://docs.microsoft.com/azure/cognitive-services/openai/'
        }
    } satisfies Record<ProviderKey, ProviderInfo>)

    const providerKeys: ProviderKey[] = ['openai', 'anthropic', 'google', 'azure']
    
    async function testProvider(provider: ProviderKey) {
        if (!formData[provider].enabled || !formData[provider].apiKey) {
            return
        }
        
        try {
            testingProvider = provider
            providerStatus[provider] = { testing: true }
            
            const providerData = formData[provider]
            const testData = {
                provider,
                apiKey: providerData.apiKey,
                ...(provider === 'openai' && formData.openai.organization && {
                    organization: formData.openai.organization
                }),
                ...(provider === 'azure' && {
                    endpoint: formData.azure.endpoint
                })
            }
            
            const response = await fetch('/api/v1/setup/test-ai-provider', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(testData)
            })
            
            const result = await response.json()
            
            providerStatus[provider] = {
                success: result.success,
                message: result.message || (result.success ? ($isLoading ? 'Connection successful' : $_('setup.aiProviders.connectionSuccess')) : ($isLoading ? 'Connection failed' : $_('setup.aiProviders.connectionFailed')))
            }
            
        } catch (err: unknown) {
            providerStatus[provider] = {
                success: false,
                error: true,
                message: err instanceof Error ? err.message : 'Unknown error'
            }
        } finally {
            testingProvider = ''
        }
    }
    
    async function handleNext() {
        try {
            loading = true
            error = ''
            
            // Get enabled providers
            type ProviderConfig = { apiKey: string; models: string[]; organization?: string; endpoint?: string }
            const enabledProviders: Partial<Record<ProviderKey, ProviderConfig>> = {}
            
            for (const provider of providerKeys) {
                const config = formData[provider]
                if (config.enabled && config.apiKey) {
                    const providerConfig: ProviderConfig = {
                        apiKey: config.apiKey,
                        models: config.models
                    }
                    if (provider === 'openai' && formData.openai.organization) {
                        providerConfig.organization = formData.openai.organization
                    }
                    if (provider === 'azure') {
                        providerConfig.endpoint = formData.azure.endpoint
                    }
                    enabledProviders[provider] = providerConfig
                }
            }
            
            // Save AI providers configuration
            const response = await fetch('/api/v1/setup/ai-providers', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(enabledProviders)
            })
            
            const result = await response.json()
            
            if (!result.success) {
                throw new Error(result.message || ($isLoading ? 'Failed to save AI providers configuration' : $_('setup.aiProviders.failedToSave')))
            }
            
            // Update setup data
            setupData.aiProviders = result.data
            
            // Proceed to next step
            await onNext()
            
        } catch (err: unknown) {
            error = err instanceof Error ? err.message : 'Unknown error'
        } finally {
            loading = false
        }
    }
    
    function toggleProvider(provider: ProviderKey) {
        formData[provider].enabled = !formData[provider].enabled
        if (!formData[provider].enabled) {
            // Clear status when disabled
            providerStatus[provider] = undefined
        }
    }
    
    function addCustomModel(provider: ProviderKey) {
        const modelName = prompt($isLoading ? 'Enter model name:' : $_('setup.aiProviders.enterModelName'))
        if (modelName && !formData[provider].models.includes(modelName)) {
            formData[provider].models = [...formData[provider].models, modelName]
        }
    }
    
    function removeModel(provider: ProviderKey, model: string) {
        formData[provider].models = formData[provider].models.filter((m: string) => m !== model)
    }
</script>

<div class="ai-providers">
    <div class="step-header">
        <h2>🤖 {$isLoading ? 'Configure AI Providers' : $_('setup.aiProviders.title')}</h2>
        <p>{$isLoading ? 'Set up AI providers to use chatbot and assistant (optional)' : $_('setup.aiProviders.subtitle')}</p>
    </div>

    {#if error}
        <div class="alert alert-error">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
            {error}
        </div>
    {/if}

    <div class="providers-grid">
        {#each providerKeys as provider}
            {@const info = providerInfo[provider]}
            <div class="provider-card {formData[provider].enabled ? 'enabled' : ''}">
                <div class="provider-header">
                    <div class="provider-info">
                        <span class="provider-icon">{info.icon}</span>
                        <div>
                            <h3>{info.name}</h3>
                            <p>{info.description}</p>
                        </div>
                    </div>
                    
                    <label class="toggle-switch">
                        <input 
                            type="checkbox" 
                            checked={formData[provider].enabled}
                            onchange={() => toggleProvider(provider)}
                        />
                        <span class="slider"></span>
                    </label>
                </div>

                {#if formData[provider].enabled}
                    <div class="provider-config">
                        <!-- API Key -->
                        <div class="form-group">
                            <label for={`apikey-${provider}`}>API Key *</label>
                            <div class="input-with-button">
                                <input 
                                    id={`apikey-${provider}`}
                                    type="password" 
                                    bind:value={formData[provider].apiKey}
                                    placeholder="sk-..."
                                    required
                                />
                                <button 
                                    type="button" 
                                    class="test-btn"
                                    onclick={() => testProvider(provider)}
                                    disabled={!formData[provider].apiKey || testingProvider === provider}
                                >
                                    {#if testingProvider === provider}
                                        <div class="spinner"></div>
                                        Test
                                    {:else}
                                        🔍 Test
                                    {/if}
                                </button>
                            </div>
                        </div>

                        <!-- Provider-specific fields -->
                        {#if provider === 'openai'}
                            <div class="form-group">
                                <label for={`org-${provider}`}>{$isLoading ? 'Organization (optional)' : $_('setup.aiProviders.organizationOptional')}</label>
                                <input
                                    id={`org-${provider}`}
                                    type="text"
                                    bind:value={formData[provider].organization}
                                    placeholder="org-..."
                                />
                            </div>
                        {/if}

                        {#if provider === 'azure'}
                            <div class="form-group">
                                <label for={`endpoint-${provider}`}>Azure Endpoint *</label>
                                <input
                                    id={`endpoint-${provider}`}
                                    type="url"
                                    bind:value={formData[provider].endpoint}
                                    placeholder="https://your-resource.openai.azure.com"
                                    required
                                />
                            </div>
                        {/if}

                        <!-- Test Status -->
                        {#if providerStatus[provider]}
                            <div class="test-status {providerStatus[provider].success ? 'success' : 'error'}">
                                <span class="status-icon">
                                    {providerStatus[provider].success ? '✅' : '❌'}
                                </span>
                                {providerStatus[provider].message}
                            </div>
                        {/if}

                        <!-- Models -->
                        <div class="form-group">
                            <label for={`models-${provider}`}>Models</label>
                            <div class="models-list">
                                {#each formData[provider].models as model}
                                    <div class="model-tag">
                                        {model}
                                        <button 
                                            type="button" 
                                            class="remove-model"
                                            onclick={() => removeModel(provider, model)}
                                            title="{$isLoading ? 'Remove model' : $_('setup.aiProviders.removeModel')}"
                                        >
                                            ×
                                        </button>
                                    </div>
                                {/each}
                                <button 
                                    type="button" 
                                    class="add-model-btn"
                                    onclick={() => addCustomModel(provider)}
                                >
                                    + {$isLoading ? 'Add model' : $_('setup.aiProviders.addModel')}
                                </button>
                            </div>
                        </div>

                        <!-- Links -->
                        <div class="provider-links">
                            <a href={info.website} target="_blank" rel="noopener">
                                🌐 Website
                            </a>
                            <a href={info.docs} target="_blank" rel="noopener">
                                📖 Docs
                            </a>
                        </div>
                    </div>
                {/if}
            </div>
        {/each}
    </div>

    <div class="setup-note">
        <div class="note-icon">💡</div>
        <div>
            <strong>{$isLoading ? 'Note:' : $_('setup.aiProviders.noteLabel')}</strong> {$isLoading ? 'You can skip this step and configure AI providers later in system settings. Chatbot and AI assistant features will only be available after configuring at least one provider.' : $_('setup.aiProviders.noteText')}
        </div>
    </div>

    <!-- Action Buttons -->
    <div class="form-actions">
        <button type="button" class="btn btn-secondary" onclick={onBack} disabled={loading}>
            ⬅️ {$isLoading ? 'Back' : $_('setup.aiProviders.back')}
        </button>
        
        <button type="button" class="btn btn-primary" onclick={handleNext} disabled={loading}>
            {#if loading}
                <div class="spinner"></div>
                {$isLoading ? 'Saving...' : $_('setup.aiProviders.saving')}
            {:else}
                {$isLoading ? 'Continue' : $_('setup.aiProviders.continue')} ➡️
            {/if}
        </button>
    </div>
</div>

<style>
    .ai-providers {
        max-width: 1000px;
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

    .providers-grid {
        display: grid;
        gap: 1.5rem;
        margin-bottom: 2rem;
    }

    .provider-card {
        border: 2px solid #e5e7eb;
        border-radius: 0.75rem;
        padding: 1.5rem;
        background: white;
        transition: all 0.2s;
    }

    .provider-card.enabled {
        border-color: #3b82f6;
        background: #f8faff;
    }

    .provider-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 1rem;
    }

    .provider-info {
        display: flex;
        align-items: center;
        gap: 1rem;
    }

    .provider-icon {
        font-size: 2rem;
    }

    .provider-info h3 {
        margin: 0;
        color: #1f2937;
    }

    .provider-info p {
        margin: 0.25rem 0 0 0;
        color: #6b7280;
        font-size: 0.875rem;
    }

    .toggle-switch {
        position: relative;
        display: inline-block;
        width: 60px;
        height: 34px;
    }

    .toggle-switch input {
        opacity: 0;
        width: 0;
        height: 0;
    }

    .slider {
        position: absolute;
        cursor: pointer;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background-color: #ccc;
        transition: .4s;
        border-radius: 34px;
    }

    .slider:before {
        position: absolute;
        content: "";
        height: 26px;
        width: 26px;
        left: 4px;
        bottom: 4px;
        background-color: white;
        transition: .4s;
        border-radius: 50%;
    }

    input:checked + .slider {
        background-color: #3b82f6;
    }

    input:checked + .slider:before {
        transform: translateX(26px);
    }

    .provider-config {
        border-top: 1px solid #e5e7eb;
        padding-top: 1rem;
        animation: slideDown 0.3s ease-out;
    }

    @keyframes slideDown {
        from {
            opacity: 0;
            transform: translateY(-10px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }

    .form-group {
        margin-bottom: 1rem;
    }

    .form-group label {
        display: block;
        margin-bottom: 0.25rem;
        font-weight: 500;
        color: #374151;
    }

    .input-with-button {
        display: flex;
        gap: 0.5rem;
    }

    .input-with-button input {
        flex: 1;
    }

    input {
        padding: 0.5rem;
        border: 1px solid #d1d5db;
        border-radius: 0.375rem;
        font-size: 0.875rem;
        width: 100%;
    }

    input:focus {
        outline: none;
        border-color: #3b82f6;
        box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
    }

    .test-btn {
        padding: 0.5rem 1rem;
        background-color: #f3f4f6;
        border: 1px solid #d1d5db;
        border-radius: 0.375rem;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 0.25rem;
        font-size: 0.875rem;
        white-space: nowrap;
    }

    .test-btn:hover:not(:disabled) {
        background-color: #e5e7eb;
    }

    .test-btn:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }

    .test-status {
        padding: 0.75rem;
        border-radius: 0.375rem;
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-size: 0.875rem;
        margin-bottom: 1rem;
    }

    .test-status.success {
        background-color: #dcfce7;
        color: #166534;
        border: 1px solid #bbf7d0;
    }

    .test-status.error {
        background-color: #fee2e2;
        color: #b91c1c;
        border: 1px solid #fecaca;
    }

    .models-list {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
    }

    .model-tag {
        background-color: #e0f2fe;
        color: #0369a1;
        padding: 0.25rem 0.5rem;
        border-radius: 0.25rem;
        font-size: 0.75rem;
        display: flex;
        align-items: center;
        gap: 0.25rem;
    }

    .remove-model {
        background: none;
        border: none;
        color: #dc2626;
        cursor: pointer;
        font-weight: bold;
        font-size: 1rem;
        line-height: 1;
    }

    .remove-model:hover {
        color: #991b1b;
    }

    .add-model-btn {
        background-color: #f3f4f6;
        border: 1px dashed #d1d5db;
        color: #6b7280;
        padding: 0.25rem 0.5rem;
        border-radius: 0.25rem;
        font-size: 0.75rem;
        cursor: pointer;
    }

    .add-model-btn:hover {
        background-color: #e5e7eb;
        color: #374151;
    }

    .provider-links {
        display: flex;
        gap: 1rem;
        margin-top: 1rem;
        padding-top: 1rem;
        border-top: 1px solid #e5e7eb;
    }

    .provider-links a {
        color: #3b82f6;
        text-decoration: none;
        font-size: 0.875rem;
        display: flex;
        align-items: center;
        gap: 0.25rem;
    }

    .provider-links a:hover {
        text-decoration: underline;
    }

    .setup-note {
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
    }

    .setup-note div {
        color: #92400e;
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
