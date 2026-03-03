// Flow diagram components
export { default as MermaidDiagram } from './MermaidDiagram.svelte';
export { default as WorkflowDiagram } from './WorkflowDiagram.svelte';
export { default as WorkflowProgressPanel } from './WorkflowProgressPanel.svelte';

// Types
export interface FlowNode {
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

export interface FlowEdge {
    id: string;
    source: string;
    target: string;
    type?: string;
    style?: string;
    animated?: boolean;
    label?: string;
}

export interface WorkflowStep {
    id: string;
    name: string;
    status: 'pending' | 'in-progress' | 'completed' | 'failed';
    description?: string;
    dependencies?: string[];
    assignee?: string;
    dueDate?: string;
    progress?: number;
}

// Utility functions
export function generateMermaidWorkflow(steps: WorkflowStep[]): string {
    const lines = ['graph TD'];

    // Add nodes with status styling
    steps.forEach(step => {
        const statusSymbol = getStatusSymbol(step.status);
        lines.push(`    ${step.id}[${statusSymbol} ${step.name}]`);
    });

    // Add dependencies
    steps.forEach(step => {
        (step.dependencies || []).forEach(depId => {
            lines.push(`    ${depId} --> ${step.id}`);
        });
    });

    // Add styling
    lines.push('');
    lines.push('    classDef pending fill:#fef3c7,stroke:#f59e0b,stroke-width:2px');
    lines.push('    classDef inProgress fill:#dbeafe,stroke:#3b82f6,stroke-width:2px');
    lines.push('    classDef completed fill:#d1fae5,stroke:#10b981,stroke-width:2px');
    lines.push('    classDef failed fill:#fee2e2,stroke:#ef4444,stroke-width:2px');

    steps.forEach(step => {
        const className = step.status.replace('-', '');
        lines.push(`    class ${step.id} ${className}`);
    });

    return lines.join('\n');
}

export function convertStepsToFlow(steps: WorkflowStep[]) {
    const nodes = steps.map((step, index) => ({
        id: step.id,
        position: { x: (index % 4) * 250, y: Math.floor(index / 4) * 150 },
        data: {
            label: step.name,
            status: step.status,
            description: step.description,
            assignee: step.assignee,
            progress: step.progress
        }
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

function getStatusSymbol(status: string): string {
    switch (status) {
        case 'pending': return '⏳';
        case 'in-progress': return '🔄';
        case 'completed': return '✅';
        case 'failed': return '❌';
        default: return '📋';
    }
}