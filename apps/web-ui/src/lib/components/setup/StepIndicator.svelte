<script lang="ts">
	import { _, isLoading } from '$lib/i18n';
	type StepConfig = { id: number; title: string; description: string };
	type ProcessedStep = StepConfig & { status: string; icon: string; isCurrent: boolean };

	let { steps, currentStep, setupStatus } = $props<{
		steps: StepConfig[];
		currentStep: number;
		setupStatus: {
			steps?: Record<string, { status?: string }>;
		} | null;
	}>();

	function getStepStatus(stepId: number) {
		if (!setupStatus?.steps) return 'pending';
		
		const stepKey = {
			1: 'database',
			2: 'admin', 
			3: 'system',
			4: 'aiProviders',
			5: 'seedData'
		}[stepId];

		if (!stepKey) return 'pending';
		return setupStatus.steps[stepKey]?.status || 'pending';
	}

	function getStepIcon(stepId: number, status: string) {
		if (status === 'completed') {
			return 'check';
		} else if (status === 'error') {
			return 'error';
		} else if (stepId === currentStep) {
			return 'current';
		} else {
			return 'pending';
		}
	}

	const processedSteps = $derived(
		steps.slice(0, -1).map((step: StepConfig) => ({
			...step,
			status: getStepStatus(step.id),
			icon: getStepIcon(step.id, getStepStatus(step.id)),
			isCurrent: step.id === currentStep
		}))
	) as ProcessedStep[];
</script>

<div class="bg-surface-1 rounded-lg border border-slate-700/60 p-6">
	<h3 class="text-lg font-medium text-gray-900 mb-6">{$isLoading ? 'Setup Progress' : $_('setup.stepIndicator.progressTitle')}</h3>
	
	<div class="space-y-4">
		{#each processedSteps as step, index}
			<div class="flex items-center space-x-4">
				<!-- Step Icon -->
				<div class="flex-shrink-0">
					{#if step.icon === 'completed'}
						<div class="w-8 h-8 bg-green-100 text-green-600 rounded-full flex items-center justify-center">
							<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
								<path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"></path>
							</svg>
						</div>
					{:else if step.icon === 'error'}
						<div class="w-8 h-8 bg-red-100 text-red-600 rounded-full flex items-center justify-center">
							<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
								<path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"></path>
							</svg>
						</div>
					{:else if step.icon === 'current'}
						<div class="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center">
							<div class="w-3 h-3 bg-blue-600 rounded-full animate-pulse"></div>
						</div>
					{:else}
						<div class="w-8 h-8 bg-gray-100 text-gray-400 rounded-full flex items-center justify-center">
							<span class="text-sm font-medium">{step.id}</span>
						</div>
					{/if}
				</div>

				<!-- Step Content -->
				<div class="flex-1 min-w-0">
					<div class="flex items-center justify-between">
						<div>
							<p class="text-sm font-medium text-gray-900 {step.isCurrent ? 'text-blue-600' : ''}">
								{step.title}
							</p>
							<p class="text-xs text-gray-500 mt-1">
								{step.description}
							</p>
						</div>

						<!-- Status Badge -->
						{#if step.status === 'completed'}
							<span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
							{$isLoading ? 'Completed' : $_('setup.wizard.statusCompleted')}
							</span>
						{:else if step.status === 'error'}
							<span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
								{$isLoading ? 'Error' : $_('setup.wizard.statusError')}
							</span>
						{:else if step.isCurrent}
							<span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
							{$isLoading ? 'In Progress' : $_('setup.wizard.statusInProgress')}
							</span>
						{:else}
							<span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
								{$isLoading ? 'Pending' : $_('setup.wizard.statusPending')}
							</span>
						{/if}
					</div>
				</div>

				<!-- Connector Line -->
				{#if index < processedSteps.length - 1}
					<div class="absolute left-[51px] mt-8 w-0.5 h-6 bg-gray-200" style="margin-left: 16px;"></div>
				{/if}
			</div>
		{/each}
	</div>

	<!-- Overall Progress -->
	<div class="mt-6 pt-4 border-t border-gray-100">
		<div class="flex items-center justify-between text-sm text-gray-600 mb-2">
			<span>{$isLoading ? 'Overall progress' : $_('setup.stepIndicator.overallProgress')}</span>
			<span>{processedSteps.filter(step => step.status === 'completed').length}/{processedSteps.length}</span>
		</div>
		
		<div class="w-full bg-gray-200 rounded-full h-2">
			<div 
				class="bg-blue-600 h-2 rounded-full transition-all duration-300" 
				style:width="{(processedSteps.filter(step => step.status === 'completed').length / processedSteps.length) * 100}%"
			></div>
		</div>
	</div>
</div>

<style>
	/* Make the step indicators relative for the connector lines */
	:global(.space-y-4 > div) {
		position: relative;
	}
</style>
