<script lang="ts">
  import { onMount } from 'svelte';
  import mermaid from 'mermaid';

  let {
    diagram = '',
    config = {},
    class: className = 'w-full h-96'
  } = $props<{
    diagram: string;
    config?: any;
    class?: string;
  }>();

  let container: HTMLDivElement;
  let isRendered = $state(false);
  let error = $state('');

  onMount(() => {
    mermaid.initialize({
      startOnLoad: false,
      theme: 'default',
      securityLevel: 'loose',
      ...config
    });
    renderDiagram();
  });

  async function renderDiagram() {
    if (!container || !diagram) return;
    
    try {
      error = '';
      isRendered = false;
      
      // Clear previous content
      container.innerHTML = '';
      
      // Generate unique ID
      const id = `mermaid-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      // Render diagram
      const { svg } = await mermaid.render(id, diagram);
      container.innerHTML = svg;
      isRendered = true;
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to render diagram';
      console.error('Mermaid rendering error:', err);
    }
  }

  // Re-render when diagram changes
  $effect(() => {
    if (diagram) {
      renderDiagram();
    }
  });
</script>

<div class={className}>
  {#if error}
    <div class="bg-red-50 border border-red-200 rounded-lg p-4">
      <div class="flex">
        <div class="text-red-400">
          <svg class="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
          </svg>
        </div>
        <div class="ml-3">
          <h3 class="text-sm font-medium text-red-800">Diagram Error</h3>
          <div class="mt-2 text-sm text-red-700">{error}</div>
        </div>
      </div>
    </div>
  {:else if !isRendered}
    <div class="flex items-center justify-center h-full">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
    </div>
  {/if}
  
  <div bind:this={container} class="mermaid-container w-full h-full"></div>
</div>

<style>
  :global(.mermaid-container svg) {
    width: 100%;
    height: auto;
    max-height: 100%;
  }
</style>