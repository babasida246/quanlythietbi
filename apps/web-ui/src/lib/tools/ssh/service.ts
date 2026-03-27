import type {
    OpenSessionInput,
    SendCommandResult,
    SshCommandPolicy,
    SshLogEvent,
    SshSession
} from '$lib/tools/ssh/types';

const SESSIONS_KEY = 'netops.ssh.sessions.v1';
const LOGS_KEY = 'netops.ssh.logs.v1';

function uid(prefix: string): string {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function loadSessions(): SshSession[] {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(SESSIONS_KEY);
    if (!raw) return [];
    try {
        return JSON.parse(raw) as SshSession[];
    } catch {
        return [];
    }
}

function saveSessions(items: SshSession[]): void {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(items));
}

function loadLogs(): Record<string, SshLogEvent[]> {
    if (typeof localStorage === 'undefined') return {};
    const raw = localStorage.getItem(LOGS_KEY);
    if (!raw) return {};
    try {
        return JSON.parse(raw) as Record<string, SshLogEvent[]>;
    } catch {
        return {};
    }
}

function saveLogs(logs: Record<string, SshLogEvent[]>): void {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(LOGS_KEY, JSON.stringify(logs));
}

function appendLog(sessionId: string, event: SshLogEvent): void {
    const logs = loadLogs();
    const sessionLogs = logs[sessionId] || [];
    sessionLogs.push(event);
    logs[sessionId] = sessionLogs.slice(-600);
    saveLogs(logs);
}

export async function listSessions(): Promise<SshSession[]> {
    return loadSessions().filter((item) => item.status === 'connected');
}

export async function openSession(input: OpenSessionInput): Promise<SshSession> {
    const sessions = loadSessions();
    const existing = sessions.find((item) => item.deviceId === input.deviceId && item.status === 'connected');
    if (existing) return existing;

    const now = new Date().toISOString();
    const created: SshSession = {
        id: uid('ssh'),
        ...input,
        status: 'connected',
        createdAt: now,
        lastActivityAt: now
    };
    sessions.unshift(created);
    saveSessions(sessions);
    appendLog(created.id, { type: 'output', text: `Connected to ${created.host}:${created.port} as ${created.user}`, timestamp: now });
    return created;
}

export async function sendCommand(
    sessionId: string,
    command: string,
    policy: SshCommandPolicy,
    _meta?: { ticketId?: string; deviceId?: string }
): Promise<SendCommandResult> {
    const sessions = loadSessions();
    const session = sessions.find((item) => item.id === sessionId && item.status === 'connected');
    if (!session) {
        throw new Error('SSH session not found or already closed.');
    }

    const now = new Date().toISOString();
    appendLog(sessionId, { type: 'input', text: command, timestamp: now });

    if (policy.allowList.length > 0 && !policy.allowList.some((rule) => command.toLowerCase().includes(rule.toLowerCase()))) {
        const warning = 'Command rejected by allow-list policy.';
        appendLog(sessionId, { type: 'error', text: warning, timestamp: now });
        throw new Error(warning);
    }

    if (policy.denyList.some((rule) => command.toLowerCase().includes(rule.toLowerCase()))) {
        const warning = 'Command rejected by deny-list policy.';
        appendLog(sessionId, { type: 'error', text: warning, timestamp: now });
        throw new Error(warning);
    }

    const warning = policy.environment === 'prod' && policy.dangerousList.some((rule) => command.toLowerCase().includes(rule.toLowerCase()))
        ? 'Dangerous command executed in production context.'
        : undefined;

    const output = [
        `[${session.host}] ${command}`,
        'OK'
    ];

    for (const line of output) {
        appendLog(sessionId, { type: 'output', text: line, timestamp: new Date().toISOString() });
    }
    if (warning) {
        appendLog(sessionId, { type: 'warning', text: warning, timestamp: new Date().toISOString() });
    }

    session.lastActivityAt = new Date().toISOString();
    saveSessions(sessions);

    return { output, warning };
}

export async function closeSession(sessionId: string): Promise<void> {
    const sessions = loadSessions();
    const target = sessions.find((item) => item.id === sessionId);
    if (!target) return;
    target.status = 'closed';
    target.lastActivityAt = new Date().toISOString();
    saveSessions(sessions);
    appendLog(sessionId, { type: 'output', text: 'Session closed.', timestamp: new Date().toISOString() });
}

export async function getSessionLog(sessionId: string): Promise<SshLogEvent[]> {
    return loadLogs()[sessionId] || [];
}

export async function exportSessionText(sessionId: string): Promise<string> {
    const logs = await getSessionLog(sessionId);
    return logs.map((line) => `${line.timestamp} [${line.type}] ${line.text}`).join('\n');
}

export function purgeIdleSessions(maxMinutes = 180): void {
    const sessions = loadSessions();
    const now = Date.now();
    const threshold = maxMinutes * 60 * 1000;
    let changed = false;

    for (const session of sessions) {
        if (session.status !== 'connected') continue;
        const age = now - new Date(session.lastActivityAt).getTime();
        if (age > threshold) {
            session.status = 'closed';
            session.lastActivityAt = new Date().toISOString();
            changed = true;
        }
    }

    if (changed) saveSessions(sessions);
}
