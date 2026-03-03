<script lang="ts">
  import MermaidDiagram from './MermaidDiagram.svelte';
  import WorkflowDiagram from './WorkflowDiagram.svelte';
  import { Button, Card } from 'flowbite-svelte';
  
  type DiagramType = 'mermaid' | 'workflow';
  
  interface WorkflowStep {
    id: string;
    name: string;
    status: 'pending' | 'in-progress' | 'completed' | 'failed';
    description?: string;
    dependencies?: string[];
    assignee?: string;
    dueDate?: string;
    progress?: number;
  }

  let {
    steps = [],
    diagramType = 'workflow',
    title = 'Workflow Progress',
    editable = false,
    onStepClick,
    onStepUpdate
  } = $props<{
    steps: WorkflowStep[];
    diagramType?: DiagramType;
    title?: string;
    editable?: boolean;
    onStepClick?: (step: WorkflowStep) => void;
    onStepUpdate?: (stepId: string, updates: Partial<WorkflowStep>) => void;
  }>();

  // Convert workflow steps to flow nodes and edges
  function generateFlowData() {
    const nodes = steps.map((step, index) => ({
      id: step.id,
      position: { x: (index % 3) * 200, y: Math.floor(index / 3) * 150 },
      data: {
        label: step.name,
        status: step.status,
        description: step.description,
        assignee: step.assignee,
        progress: step.progress
      },
      style: getNodeStyle(step.status)
    }));

    const edges = steps.flatMap(step => 
      (step.dependencies || []).map(depId => ({
        id: `${depId}-${step.id}`,
        source: depId,
        target: step.id,
        animated: step.status === 'in-progress'
      }))
    );

    return { nodes, edges };
  }

  // Generate mermaid diagram syntax
  function generateMermaidDiagram(): string {
    const lines = ['graph TD'];
    
    // Add nodes
    steps.forEach(step => {
      const statusSymbol = getStatusSymbol(step.status);
      lines.push(`    ${step.id}[${statusSymbol} ${step.name}]`);
      
      // Add styling
      lines.push(`    ${step.id} --> ${step.id}_style`);
      lines.push(`    classDef ${step.status} fill:${getStatusColor(step.status)}`);
      lines.push(`    class ${step.id} ${step.status}`);
    });

    // Add edges
    steps.forEach(step => {
      (step.dependencies || []).forEach(depId => {
        lines.push(`    ${depId} --> ${step.id}`);
      });
    });

    return lines.join('\n');
  }

  function getStatusSymbol(status: string): string {
    switch (status) {
      case 'pending': return '⏳';
      case 'in-progress': return '🔄';
      case 'completed': return '✅';
      case 'failed': return '❌';
      default: return '📋';
    }
  }

  function getStatusColor(status: string): string {
    switch (status) {
      case 'pending': return '#fef3c7,#f59e0b';
      case 'in-progress': return '#dbeafe,#3b82f6';
      case 'completed': return '#d1fae5,#10b981';
      case 'failed': return '#fee2e2,#ef4444';
      default: return '#f9fafb,#6b7280';
    }
  }

  function getNodeStyle(status: string): string {
    const baseStyle = "padding: 10px; border: 2px solid; border-radius: 8px; background: white;";
    return `${baseStyle} border-color: ${getStatusColor(status).split(',')[1]}; background-color: ${getStatusColor(status).split(',')[0]};`;
  }

  function updateStepStatus(stepId: string, newStatus: WorkflowStep['status']) {
    onStepUpdate?.(stepId, { status: newStatus });
  }

  // Reactive data
  $: flowData = generateFlowData();
  $: mermaidDiagram = generateMermaidDiagram();

  // Summary statistics
  $: totalSteps = steps.length;
  $: completedSteps = steps.filter(s => s.status === 'completed').length;
  $: inProgressSteps = steps.filter(s => s.status === 'in-progress').length;
  $: failedSteps = steps.filter(s => s.status === 'failed').length;
  $: overallProgress = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;
</script>

<Card class="w-full">
  <!-- Header with title and controls -->
  <div class="flex justify-between items-center mb-4">
    <div>
      <h3 class="text-lg font-semibold text-gray-900">{title}</h3>
      <div class="flex items-center gap-4 mt-2 text-sm text-gray-600">
        <span>Progress: {overallProgress}%</span>
        <span>Completed: {completedSteps}/{totalSteps}</span>
        {#if inProgressSteps > 0}
          <span class="text-blue-600">In Progress: {inProgressSteps}</span>
        {/if}
        {#if failedSteps > 0}
          <span class="text-red-600">Failed: {failedSteps}</span>
        {/if}
      </div>
    </div>
    
    <div class="flex gap-2">
      <Button
        size="xs"
        color={diagramType === 'workflow' ? 'blue' : 'alternative'}
        onclick={() => diagramType = 'workflow'}
      >
        Flow
      </Button>
      <Button
        size="xs"
        color={diagramType === 'mermaid' ? 'blue' : 'alternative'}
        onclick={() => diagramType = 'mermaid'}
      >
        Mermaid
      </Button>
    </div>
  </div>

  <!-- Progress bar -->
  <div class="w-full bg-gray-200 rounded-full h-2 mb-6">
    <div class="bg-green-600 h-2 rounded-full transition-all duration-300" style="width: {overallProgress}%"></div>
  </div>

  <!-- Diagrams -->
  <div class="h-96 border rounded-lg">
    {#if diagramType === 'workflow'}
      <WorkflowDiagram
        nodes={flowData.nodes}
        edges={flowData.edges}
        class="w-full h-full"
        onNodeClick={(event, node) => {
          const step = steps.find(s => s.id === node.id);
          if (step) onStepClick?.(step);
        }}
      />
    {:else}
      <MermaidDiagram
        diagram={mermaidDiagram}
        class="w-full h-full"
        config={{
          theme: 'default',
          themeVariables: {
            primaryColor: '#3b82f6',
            primaryTextColor: '#ffffff',
            primaryBorderColor: '#1e40af'
          }
        }}
      />
    {/if}
  </div>

  <!-- Step List -->
  <div class="mt-6">
    <h4 class="text-md font-medium text-gray-900 mb-3">Steps Detail</h4>
    <div class="space-y-3">
      {#each steps as step}
        <div class="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50">
          <div class="flex items-center gap-3">
            <div class="text-lg">
              {getStatusSymbol(step.status)}
            </div>
            <div>
              <div class="font-medium text-gray-900">{step.name}</div>
              {#if step.description}
                <div class="text-sm text-gray-600">{step.description}</div>
              {/if}
              {#if step.assignee}
                <div class="text-xs text-gray-500">Assignee: {step.assignee}</div>
              {/if}
            </div>
          </div>
          
          <div class="flex items-center gap-2">
            {#if step.progress !== undefined}
              <div class="text-sm text-gray-600">{step.progress}%</div>
            {/if}
            
            {#if editable}
              <select
                value={step.status}
                onchange={(e) => updateStepStatus(step.id, e.target.value)}
                class="text-xs border rounded px-2 py-1"
              >
                <option value="pending">Pending</option>
                <option value="in-progress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="failed">Failed</option>
              </select>
            {:else}
              <span class="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-700 capitalize">
                {step.status.replace('-', ' ')}
              </span>
            {/if}
          </div>
        </div>
      {/each}
    </div>
  </div>
</Card>