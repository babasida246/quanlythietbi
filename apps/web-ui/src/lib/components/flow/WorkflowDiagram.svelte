<script lang="ts">
  import { SvelteFlow, Controls, Background, MiniMap } from '@xyflow/svelte';
  import '@xyflow/svelte/dist/style.css';

  interface FlowNode {
    id: string;
    type?: string;
    position: { x: number; y: number };
    data: {
      label: string;
      status?: 'pending' | 'in-progress' | 'completed' | 'failed';
      description?: string;
      [key: string]: any;
    };
    style?: string;
    class?: string;
  }

  interface FlowEdge {
    id: string;
    source: string;
    target: string;
    type?: string;
    style?: string;
    animated?: boolean;
    label?: string;
  }

  let {
    nodes = $bindable([]),
    edges = $bindable([]),
    class: className = 'w-full h-96',
    interactive = true,
    showControls = true,
    showBackground = true,
    showMiniMap = true,
    onNodeClick,
    onEdgeClick,
    onNodeDragStop,
    onConnect
  } = $props<{
    nodes?: FlowNode[];
    edges?: FlowEdge[];
    class?: string;
    interactive?: boolean;
    showControls?: boolean;
    showBackground?: boolean;
    showMiniMap?: boolean;
    onNodeClick?: (event: any, node: FlowNode) => void;
    onEdgeClick?: (event: any, edge: FlowEdge) => void;
    onNodeDragStop?: (event: any, node: FlowNode) => void;
    onConnect?: (connection: any) => void;
  }>();

  function getNodeStyle(status?: string): string {
    const baseStyle = "padding: 10px; border: 2px solid; border-radius: 8px; background: white;";
    
    switch (status) {
      case 'pending':
        return `${baseStyle} border-color: #fbbf24; background-color: #fef3c7;`;
      case 'in-progress':
        return `${baseStyle} border-color: #3b82f6; background-color: #dbeafe;`;
      case 'completed':
        return `${baseStyle} border-color: #10b981; background-color: #d1fae5;`;
      case 'failed':
        return `${baseStyle} border-color: #ef4444; background-color: #fee2e2;`;
      default:
        return `${baseStyle} border-color: #6b7280; background-color: #f9fafb;`;
    }
  }

  // Update node styles based on status
  $effect(() => {
    nodes = nodes.map(node => ({
      ...node,
      style: getNodeStyle(node.data.status)
    }));
  });
</script>

<div class={className}>
  <SvelteFlow
    {nodes}
    {edges}
    fitView={true}
    nodesDraggable={interactive}
    nodesConnectable={interactive}
    elementsSelectable={interactive}
  >
    {#if showBackground}
      <Background />
    {/if}
    
    {#if showControls}
      <Controls />
    {/if}
    
    {#if showMiniMap}
      <MiniMap />
    {/if}
  </SvelteFlow>
</div>

<style>
  :global(.svelte-flow__node) {
    border-radius: 8px;
    font-family: inherit;
  }
  
  :global(.svelte-flow__node-default) {
    padding: 10px;
    border: 2px solid #d1d5db;
    background: white;
    min-width: 150px;
    text-align: center;
  }
  
  :global(.node-header) {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 4px;
  }
  
  :global(.status-badge) {
    padding: 2px 6px;
    border-radius: 12px;
    font-size: 10px;
    font-weight: bold;
    text-transform: uppercase;
  }
  
  :global(.status-pending) {
    background-color: #fbbf24;
    color: #92400e;
  }
  
  :global(.status-in-progress) {
    background-color: #3b82f6;
    color: white;
  }
  
  :global(.status-completed) {
    background-color: #10b981;
    color: white;
  }
  
  :global(.status-failed) {
    background-color: #ef4444;
    color: white;
  }
  
  :global(.node-description) {
    font-size: 12px;
    color: #6b7280;
    margin-top: 4px;
  }
</style>