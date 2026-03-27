export interface DiffLine {
    type: 'added' | 'removed' | 'unchanged';
    text: string;
}

export function diffCommandsDetailed(previous: string[], next: string[]): DiffLine[] {
    const prevSet = new Set(previous);
    const nextSet = new Set(next);

    const lines: DiffLine[] = [];
    for (const command of previous) {
        if (!nextSet.has(command)) lines.push({ type: 'removed', text: command });
        else lines.push({ type: 'unchanged', text: command });
    }

    for (const command of next) {
        if (!prevSet.has(command)) lines.push({ type: 'added', text: command });
    }

    return lines;
}
