/**
 * Simple notification store for workflow notifications.
 * Persists to localStorage and provides reactive access across components.
 */
export interface WorkflowNotification {
    id: string;
    message: string;
    type: 'info' | 'success' | 'warning' | 'error';
    timestamp: number;
    read: boolean;
}

const STORAGE_KEY = 'qltb_notifications';
const MAX_NOTIFICATIONS = 50;

let listeners: Array<() => void> = [];

function load(): WorkflowNotification[] {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
}

function save(items: WorkflowNotification[]) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, MAX_NOTIFICATIONS)));
    } catch { /* ignore */ }
}

export function getNotifications(): WorkflowNotification[] {
    return load();
}

export function addNotification(message: string, type: WorkflowNotification['type'] = 'info'): void {
    const items = load();
    items.unshift({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        message,
        type,
        timestamp: Date.now(),
        read: false
    });
    save(items);
    listeners.forEach(fn => fn());
}

export function markAllRead(): void {
    const items = load().map(n => ({ ...n, read: true }));
    save(items);
    listeners.forEach(fn => fn());
}

export function clearNotifications(): void {
    save([]);
    listeners.forEach(fn => fn());
}

export function subscribe(fn: () => void): () => void {
    listeners.push(fn);
    return () => { listeners = listeners.filter(l => l !== fn); };
}
