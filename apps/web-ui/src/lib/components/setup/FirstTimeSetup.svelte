<script lang="ts">
	import { fade, slide } from 'svelte/transition';
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import { _, isLoading } from '$lib/i18n';
	import { page } from '$app/state';
	import StepIndicator from './StepIndicator.svelte';
	import DatabaseSetup from './steps/DatabaseSetup.svelte';
	import AdminSetup from './steps/AdminSetup.svelte';
	import SystemConfigStep from './SystemConfigStep.svelte';
	import AIProvidersStep from './AIProvidersStep.svelte';
	import SeedDataStep from './SeedDataStep.svelte';
	import CompletionStep from './CompletionStep.svelte';

	interface SetupStatus {
		isCompleted: boolean;
		currentStep: number;
		steps: {
			database: { completed: boolean; status: string; error?: string };
			admin: { completed: boolean; status: string; error?: string };
			system: { completed: boolean; status: string; error?: string };
			aiProviders: { completed: boolean; status: string; error?: string };
			seedData: { completed: boolean; status: string; error?: string };
		};
		systemInfo: {
			version: string;
			environment: string;
			database: {
				type: string;
				connected: boolean;
			};
		};
	}

	let setupStatus = $state<SetupStatus | null>(null);
	let setupData = $state({
		database: null,
		adminUser: null,
		systemConfig: null,
		aiProviders: null,
		seedData: null
	});
	let currentStep = $state(1);
	let loading = $state(true);
	let error = $state<string | null>(null);
	const stepKeyById: Record<number, keyof SetupStatus['steps']> = {
		1: 'database',
		2: 'admin',
		3: 'system',
		4: 'aiProviders',
		5: 'seedData'
	};

	const steps = $derived([
		{
			id: 1,
			title: $_('setup.steps.database'),
			description: $_('setup.steps.databaseDesc'),
			component: DatabaseSetup
		},
		{
			id: 2,
			title: $_('setup.steps.admin'),
			description: $_('setup.steps.adminDesc'),
			component: AdminSetup
		},
		{
			id: 3,
			title: $_('setup.steps.systemConfig'),
			description: $_('setup.steps.systemConfigDesc'),
			component: SystemConfigStep
		},
		{
			id: 4,
			title: $_('setup.steps.aiProviders'),
			description: $_('setup.steps.aiProvidersDesc'),
			component: AIProvidersStep
		},
		{
			id: 5,
			title: $_('setup.steps.seedData'),
			description: $_('setup.steps.seedDataDesc'),
			component: SeedDataStep
		},
		{
			id: 6,
			title: $_('setup.steps.completion'),
			description: $_('setup.steps.completionDesc'),
			component: CompletionStep
		}
	]);

	$effect(() => {
		void loadSetupStatus();
	});

	async function loadSetupStatus() {
		try {
			loading = true;
			error = null;

			const response = await fetch('/api/v1/setup/status');
			if (!response.ok) {
				throw new Error(`HTTP ${response.status}: ${response.statusText}`);
			}

			const result = await response.json();
			
			// Parse API response structure: {success: true, data: {...}}
			const statusData = result.data || result;
			
			// Map API response to our SetupStatus interface
			setupStatus = {
				isCompleted: statusData.isComplete || false,
				currentStep: statusData.currentStep || 1,
				steps: {
					database: {
						completed: statusData.steps?.database_initialized || false,
						status: statusData.steps?.database_initialized ? 'completed' : 'pending',
						error: undefined
					},
					admin: {
						completed: statusData.steps?.admin_user_created || false,
						status: statusData.steps?.admin_user_created ? 'completed' : 'pending',
						error: undefined
					},
					system: {
						completed: statusData.steps?.system_configured || false,
						status: statusData.steps?.system_configured ? 'completed' : 'pending',
						error: undefined
					},
					aiProviders: {
						completed: statusData.steps?.ai_providers_configured || false,
						status: statusData.steps?.ai_providers_configured ? 'completed' : 'pending',
						error: undefined
					},
					seedData: {
						completed: statusData.steps?.seed_data_loaded || false,
						status: statusData.steps?.seed_data_loaded ? 'completed' : 'pending',
						error: undefined
					}
				},
				systemInfo: {
					version: statusData.systemInfo?.version || '1.0.0',
					environment: statusData.systemInfo?.environment || process.env.NODE_ENV || 'production',
					database: {
						type: statusData.systemInfo?.database?.type || 'PostgreSQL',
						connected: statusData.systemInfo?.database?.connected ?? true
					}
				}
			};
			
			currentStep = setupStatus.currentStep || 1;

			// Redirect if setup is already completed
			if (setupStatus.isCompleted && browser) {
				goto('/login');
			}
		} catch (err) {
			console.error('Failed to load setup status:', err);
			error = err instanceof Error ? err.message : $_('setup.firstTime.loadError');
		} finally {
			loading = false;
		}
	}

	function handleStepComplete(data: { nextStep?: number; reload?: boolean }) {
		const { nextStep, reload } = data;

		if (reload) {
			loadSetupStatus();
		} else if (nextStep) {
			currentStep = nextStep;
		} else {
			currentStep = Math.min(currentStep + 1, steps.length);
		}
	}

	async function handleNextStep() {
		const nextStep = Math.min(currentStep + 1, steps.length);
		const stepKey = stepKeyById[currentStep];

		if (setupStatus && stepKey) {
			setupStatus = {
				...setupStatus,
				currentStep: nextStep,
				steps: {
					...setupStatus.steps,
					[stepKey]: {
						...setupStatus.steps[stepKey],
						completed: true,
						status: 'completed',
						error: undefined
					}
				}
			};
		}

		currentStep = nextStep;
	}

	function handleStepBack() {
		const prevStep = Math.max(currentStep - 1, 1);
		if (setupStatus) {
			setupStatus = {
				...setupStatus,
				currentStep: prevStep
			};
		}
		currentStep = prevStep;
	}

	function handleRetry() {
		loadSetupStatus();
	}

	const currentStepData = $derived(steps.find(step => step.id === currentStep));
	const canGoBack = $derived(currentStep > 1 && !setupStatus?.isCompleted);
</script>

<svelte:head>
	<title>{$isLoading ? 'First Time Setup - NetOpsAI Gateway' : $_('setup.firstTime.pageTitle')}</title>
</svelte:head>

<div class="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
	<!-- Header -->
	<header class="bg-surface-1 border-b border-slate-700/60 px-4 py-6">
		<div class="max-w-4xl mx-auto">
			<div class="flex items-center space-x-4">
				<div class="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
					<span class="text-white font-bold text-lg">N</span>
				</div>
				<div>
					<h1 class="text-xl font-semibold text-gray-900">{$isLoading ? 'NetOpsAI Gateway' : $_('setup.firstTime.brand')}</h1>
					<p class="text-sm text-gray-500">{$isLoading ? 'First Time Setup' : $_('setup.firstTime.title')}</p>
				</div>
			</div>
		</div>
	</header>

	<main class="max-w-4xl mx-auto px-4 py-8">
		{#if loading}
			<!-- Loading State -->
			<div class="flex flex-col items-center justify-center py-20" transition:fade>
				<div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
				<h2 class="text-lg font-medium text-gray-900 mb-2">{$isLoading ? 'Checking...' : $_('setup.firstTime.checking')}</h2>
				<p class="text-gray-500">{$isLoading ? 'Please wait' : $_('setup.firstTime.pleaseWait')}</p>
			</div>
		{:else if error}
			<!-- Error State -->
			<div class="text-center py-20" transition:fade>
				<div class="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
					<svg class="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
					</svg>
				</div>
				<h2 class="text-xl font-semibold text-gray-900 mb-2">{$isLoading ? 'Connection error' : $_('setup.firstTime.connectionError')}</h2>
				<p class="text-gray-600 mb-6">{error}</p>
				<button 
					onclick={handleRetry}
					class="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
				>
					{$isLoading ? 'Retry' : $_('setup.firstTime.retry')}
				</button>
			</div>
		{:else if setupStatus}
			<!-- Setup Wizard -->
			<div class="space-y-8" transition:fade>
				<!-- Progress -->
				<StepIndicator 
					{steps} 
					{currentStep} 
					{setupStatus} 
				/>

				<!-- System Info -->
				<div class="bg-surface-1 rounded-lg border border-slate-700/60 p-4">
					<div class="flex items-center justify-between">
						<div class="flex items-center space-x-4">
							<div class="text-sm text-gray-500">
								{$isLoading ? 'Version:' : $_('setup.firstTime.version')} <span class="font-medium text-gray-900">{setupStatus.systemInfo.version}</span>
							</div>
							<div class="text-sm text-gray-500">
								{$isLoading ? 'Environment:' : $_('setup.firstTime.environment')} <span class="font-medium text-gray-900">{setupStatus.systemInfo.environment}</span>
							</div>
							<div class="flex items-center space-x-2">
								<div class="w-2 h-2 rounded-full {setupStatus.systemInfo.database.connected ? 'bg-green-500' : 'bg-red-500'}"></div>
								<span class="text-sm text-gray-500">{$isLoading ? 'Database:' : $_('setup.firstTime.database')} {setupStatus.systemInfo.database.type}</span>
							</div>
						</div>
						<button 
							onclick={handleRetry}
							class="text-gray-400 hover:text-gray-600 transition-colors"
							title={$isLoading ? 'Refresh' : $_('setup.firstTime.refreshStatus')}
						>
							<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
							</svg>
						</button>
					</div>
				</div>
				<!-- Current Step -->
				{#if currentStepData}
					<div class="bg-surface-1 rounded-lg border border-slate-700/60 overflow-hidden" transition:slide>
						<!-- Step Header -->
						<div class="px-6 py-4 border-b border-gray-200 bg-gray-50">
							<h2 class="text-lg font-medium text-gray-900">
							{$isLoading ? 'Step ' + currentStep : $_('setup.firstTime.stepLabel', { values: { step: currentStep, title: currentStepData.title } })}
							</h2>
							<p class="text-sm text-gray-600 mt-1">
								{currentStepData.description}
							</p>
						</div>

						<!-- Step Content -->
						<div class="p-6">
							{#if currentStepData.id === 1}
								<DatabaseSetup
									{setupStatus}
									{setupData}
									oncomplete={handleStepComplete}
								/>
							{:else if currentStepData.id === 2}
								<AdminSetup
									{setupStatus}
									{setupData}
									oncomplete={handleStepComplete}
									onback={handleStepBack}
								/>
							{:else if currentStepData.id === 3}
								<SystemConfigStep
									{setupData}
									onNext={handleNextStep}
									onBack={handleStepBack}
								/>
							{:else if currentStepData.id === 4}
								<AIProvidersStep
									{setupData}
									onNext={handleNextStep}
									onBack={handleStepBack}
								/>
							{:else if currentStepData.id === 5}
								<SeedDataStep
									{setupData}
									onNext={handleNextStep}
									onBack={handleStepBack}
								/>
							{:else if currentStepData.id === 6}
								<CompletionStep {setupData} />
							{/if}
						</div>

						<!-- Step Navigation -->
						{#if currentStep < 6}
							<div class="px-6 py-4 border-t border-gray-100 bg-gray-50 flex justify-between">
								{#if canGoBack}
									<button 
										onclick={handleStepBack}
										class="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
									>
										← {$isLoading ? 'Back' : $_('setup.firstTime.back')}
									</button>
								{:else}
									<div></div>
								{/if}

								<div class="text-sm text-gray-500">
								{$isLoading ? 'Step ' + currentStep + ' / ' + (steps.length - 1) : $_('setup.firstTime.stepProgress', { values: { current: currentStep, total: steps.length - 1 } })}
								</div>
							</div>
						{/if}
					</div>
				{/if}
			</div>
		{/if}
	</main>

	<!-- Footer -->
	<footer class="text-center py-6 text-sm text-gray-500">
		<p>{$isLoading ? '' : $_('setup.firstTime.copyright')}</p>
	</footer>
</div>

<style>
	/* Custom scrollbar for better UX */
	:global(html) {
		scroll-behavior: smooth;
	}
	
	:global(::-webkit-scrollbar) {
		width: 6px;
	}
	
	:global(::-webkit-scrollbar-track) {
		background: #f1f5f9;
	}
	
	:global(::-webkit-scrollbar-thumb) {
		background: #cbd5e1;
		border-radius: 3px;
	}
	
	:global(::-webkit-scrollbar-thumb:hover) {
		background: #94a3b8;
	}
</style>
