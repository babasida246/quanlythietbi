<script lang="ts">
	import { fade } from 'svelte/transition';
	import { _, isLoading } from '$lib/i18n';

	let {
		setupStatus,
		setupData,
		oncomplete,
		onback
	} = $props<{
		setupStatus: any;
		setupData: any;
		oncomplete?: (data: { nextStep: number; reload?: boolean }) => void;
		onback?: () => void;
	}>();

	let formData = $state({
		email: 'admin@techcorp.vn',
		name: 'System Administrator',
		username: 'admin',
		password: '',
		confirmPassword: ''
	});

	let submitting = $state(false);
	let error = $state<string | null>(null);
	let result = $state<any>(null);
	let validationErrors = $state<Record<string, string>>({});

	async function handleSubmit() {
		try {
			// Reset states
			submitting = true;
			error = null;
			result = null;
			validationErrors = {};

			// Client-side validation
			if (!validateForm()) {
				submitting = false;
				return;
			}

			const response = await fetch('/api/setup/admin', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					email: formData.email,
					name: formData.name,
					username: formData.username,
					password: formData.password
				})
			});

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));
				throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
			}

			const payload = await response.json();
			result = payload.data || payload;

			if (setupData) {
				setupData.adminUser = {
					id: payload.data?.userId,
					email: formData.email,
					name: formData.name,
					username: formData.username
				};
			}

			// Move to next step after successful admin creation
			setTimeout(() => {
				oncomplete?.({ nextStep: 3, reload: true });
			}, 1500);

		} catch (err) {
			console.error('Admin setup failed:', err);
			error = err instanceof Error ? err.message : ($isLoading ? 'Admin setup failed' : $_('setup.adminSetup.setupFailed'));
		} finally {
			submitting = false;
		}
	}

	function validateForm(): boolean {
		const errors: Record<string, string> = {};

		// Email validation
		const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
		if (!formData.email) {
			errors.email = $isLoading ? 'Email is required' : $_('setup.adminSetup.emailRequired');
		} else if (!emailRegex.test(formData.email)) {
			errors.email = $isLoading ? 'Invalid email' : $_('setup.adminSetup.emailInvalid');
		}

		// Name validation
		if (!formData.name || formData.name.trim().length < 2) {
			errors.name = $isLoading ? 'Name must be at least 2 characters' : $_('setup.adminSetup.nameMinLength');
		}

		// Username validation
		if (!formData.username || formData.username.length < 3) {
			errors.username = $isLoading ? 'Username must be at least 3 characters' : $_('setup.adminSetup.usernameMinLength');
		} else if (!/^[a-zA-Z0-9._-]+$/.test(formData.username)) {
			errors.username = $isLoading ? 'Username can only contain letters, numbers, dots, underscores and hyphens' : $_('setup.adminSetup.usernameInvalidChars');
		}

		// Password validation
		if (!formData.password || formData.password.length < 8) {
			errors.password = $isLoading ? 'Password must be at least 8 characters' : $_('setup.adminSetup.passwordMinLength');
		} else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(formData.password)) {
			errors.password = $isLoading ? 'Password must contain at least 1 lowercase, 1 uppercase and 1 number' : $_('setup.adminSetup.passwordComplexity');
		}

		// Confirm password validation
		if (formData.password !== formData.confirmPassword) {
			errors.confirmPassword = $isLoading ? 'Passwords do not match' : $_('setup.adminSetup.passwordMismatch');
		}

		validationErrors = errors;
		return Object.keys(errors).length === 0;
	}

	function handleBack() {
		onback?.();
	}

	const isCompleted = $derived(setupStatus?.steps?.admin?.status === 'completed');
	const hasError = $derived(setupStatus?.steps?.admin?.status === 'error');
</script>

<div class="space-y-6">
	{#if isCompleted}
		<!-- Already Completed -->
		<div class="flex items-center space-x-3 p-4 bg-green-50 border border-green-200 rounded-lg" transition:fade>
			<div class="flex-shrink-0">
				<svg class="w-6 h-6 text-green-600" fill="currentColor" viewBox="0 0 20 20">
					<path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"></path>
				</svg>
			</div>
			<div>
				<h3 class="text-green-800 font-medium">{$isLoading ? 'Admin account has been created' : $_('setup.adminSetup.accountCreated')}</h3>
				<p class="text-green-700 text-sm mt-1">
					{$isLoading ? 'Admin account already exists in the system.' : $_('setup.adminSetup.accountExistsDesc')}
				</p>
			</div>
		</div>

		<div class="flex justify-between">
			<button 
				onclick={handleBack}
				class="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
			>
				← {$isLoading ? 'Back' : $_('setup.adminSetup.back')}
			</button>
			<button 
				onclick={() => oncomplete?.({ nextStep: 3 })}
				class="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
			>
				{$isLoading ? 'Continue' : $_('setup.adminSetup.continue')} →
			</button>
		</div>
	{:else if result}
		<!-- Success -->
		<div class="space-y-4" transition:fade>
			<div class="flex items-center space-x-3 p-4 bg-green-50 border border-green-200 rounded-lg">
				<div class="flex-shrink-0">
					<svg class="w-6 h-6 text-green-600" fill="currentColor" viewBox="0 0 20 20">
						<path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"></path>
					</svg>
				</div>
				<div>
					<h3 class="text-green-800 font-medium">{$isLoading ? 'Admin account created successfully!' : $_('setup.adminSetup.createdSuccess')}</h3>
					<p class="text-green-700 text-sm mt-1">{result.message}</p>
				</div>
			</div>

			{#if result.user}
				<div class="bg-gray-50 rounded-lg p-4">
					<h4 class="font-medium text-gray-900 mb-3">{$isLoading ? 'Account information:' : $_('setup.adminSetup.accountInfo')}</h4>
					<div class="grid grid-cols-2 gap-4 text-sm">
						<div>
							<span class="text-gray-500">Email:</span>
							<span class="ml-2 font-medium">{result.user.email}</span>
						</div>
						<div>
							<span class="text-gray-500">{$isLoading ? 'Name:' : $_('setup.adminSetup.nameLabel')}</span>
							<span class="ml-2 font-medium">{result.user.name}</span>
						</div>
						<div>
							<span class="text-gray-500">{$isLoading ? 'Role:' : $_('setup.adminSetup.roleLabel')}</span>
							<span class="ml-2 font-medium">{result.user.role}</span>
						</div>
						<div>
							<span class="text-gray-500">ID:</span>
							<span class="ml-2 font-mono text-xs">{result.user.id}</span>
						</div>
					</div>
				</div>
			{/if}
		</div>
	{:else}
		<!-- Create Admin Form -->
		<div class="space-y-6">
			<div class="text-center">
				<div class="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
					<svg class="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z"></path>
					</svg>
				</div>
				<h3 class="text-lg font-medium text-gray-900 mb-2">{$isLoading ? 'Create admin account' : $_('setup.adminSetup.createTitle')}</h3>
				<p class="text-gray-600">
					{$isLoading ? 'Create the first admin account to manage the system.' : $_('setup.adminSetup.createDesc')}
				</p>
			</div>

			<!-- Error Display -->
			{#if error}
				<div class="p-4 bg-red-50 border border-red-200 rounded-lg" transition:fade>
					<div class="flex items-start space-x-2">
						<svg class="w-5 h-5 text-red-600 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
							<path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"></path>
						</svg>
						<p class="text-red-800 text-sm">{error}</p>
					</div>
				</div>
			{/if}

			<!-- Form -->
			<form onsubmit={(e) => { e.preventDefault(); handleSubmit(); }} class="space-y-4">
				<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
					<!-- Email -->
					<div class="md:col-span-2">
						<label for="email" class="block text-sm font-medium text-gray-700 mb-1">
							Email *
						</label>
						<input
							type="email"
							id="email"
							bind:value={formData.email}
							disabled={submitting}
							class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50
								{validationErrors.email ? 'border-red-500' : ''}"
							placeholder="admin@company.com"
						/>
						{#if validationErrors.email}
							<p class="mt-1 text-sm text-red-600">{validationErrors.email}</p>
						{/if}
					</div>

					<!-- Name -->
					<div>
						<label for="name" class="block text-sm font-medium text-gray-700 mb-1">
							{$isLoading ? 'Full Name *' : $_('setup.adminSetup.fullName')}
						</label>
						<input
							type="text"
							id="name"
							bind:value={formData.name}
							disabled={submitting}
							class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50
								{validationErrors.name ? 'border-red-500' : ''}"
							placeholder={$isLoading ? 'Enter display name' : $_('setup.adminSetup.namePlaceholder')}
						/>
						{#if validationErrors.name}
							<p class="mt-1 text-sm text-red-600">{validationErrors.name}</p>
						{/if}
					</div>

					<!-- Username -->
					<div>
						<label for="username" class="block text-sm font-medium text-gray-700 mb-1">
							Username *
						</label>
						<input
							type="text"
							id="username"
							bind:value={formData.username}
							disabled={submitting}
							class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50
								{validationErrors.username ? 'border-red-500' : ''}"
							placeholder="admin"
						/>
						{#if validationErrors.username}
							<p class="mt-1 text-sm text-red-600">{validationErrors.username}</p>
						{/if}
					</div>

					<!-- Password -->
					<div>
						<label for="password" class="block text-sm font-medium text-gray-700 mb-1">
							{$isLoading ? 'Password *' : $_('setup.adminSetup.password')}
						</label>
						<input
							type="password"
							id="password"
							bind:value={formData.password}
							disabled={submitting}
							class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50
								{validationErrors.password ? 'border-red-500' : ''}"
							placeholder="••••••••"
						/>
						{#if validationErrors.password}
							<p class="mt-1 text-sm text-red-600">{validationErrors.password}</p>
						{/if}
					</div>

					<!-- Confirm Password -->
					<div>
						<label for="confirmPassword" class="block text-sm font-medium text-gray-700 mb-1">
							{$isLoading ? 'Confirm Password *' : $_('setup.adminSetup.confirmPassword')}
						</label>
						<input
							type="password"
							id="confirmPassword"
							bind:value={formData.confirmPassword}
							disabled={submitting}
							class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50
								{validationErrors.confirmPassword ? 'border-red-500' : ''}"
							placeholder="••••••••"
						/>
						{#if validationErrors.confirmPassword}
							<p class="mt-1 text-sm text-red-600">{validationErrors.confirmPassword}</p>
						{/if}
					</div>
				</div>

				<!-- Password Requirements -->
				<div class="bg-gray-50 rounded-lg p-3">
					<p class="text-sm text-gray-600 font-medium mb-2">{$isLoading ? 'Password requirements:' : $_('setup.adminSetup.passwordRequirements')}</p>
					<ul class="text-xs text-gray-500 space-y-1">
						<li>• {$isLoading ? 'At least 8 characters' : $_('setup.adminSetup.pwReq1')}</li>
						<li>• {$isLoading ? 'At least 1 uppercase letter (A-Z)' : $_('setup.adminSetup.pwReq2')}</li>
						<li>• {$isLoading ? 'At least 1 lowercase letter (a-z)' : $_('setup.adminSetup.pwReq3')}</li>
						<li>• {$isLoading ? 'At least 1 number (0-9)' : $_('setup.adminSetup.pwReq4')}</li>
						<li>• {$isLoading ? 'Should contain special characters (!@#$%...)' : $_('setup.adminSetup.pwReq5')}</li>
					</ul>
				</div>

				<!-- Form Actions -->
				<div class="flex justify-between pt-4">
					<button 
						type="button"
						onclick={handleBack}
						disabled={submitting}
						class="px-4 py-2 text-gray-600 hover:text-gray-800 disabled:opacity-50 transition-colors"
					>
						← {$isLoading ? 'Back' : $_('setup.adminSetup.back')}
					</button>
					<button 
						type="submit"
						disabled={submitting}
						class="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center space-x-2"
					>
						{#if submitting}
							<div class="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
						{/if}
						<span>{submitting ? ($isLoading ? 'Creating...' : $_('setup.adminSetup.creating')) : ($isLoading ? 'Create account' : $_('setup.adminSetup.createAccount'))}</span>
					</button>
				</div>
			</form>
		</div>
	{/if}
</div>
