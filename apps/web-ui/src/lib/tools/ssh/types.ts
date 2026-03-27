export interface SshSession {
    id: string;
    deviceId: string;
    deviceName: string;
    host: string;
    port: number;
    user: string;
    authType: 'password' | 'key';
    status: 'connected' | 'closed';
    createdAt: string;
    lastActivityAt: string;
}

export interface SshLogEvent {
    type: 'input' | 'output' | 'error' | 'warning';
    text: string;
    timestamp: string;
}

export interface SshCommandPolicy {
    environment: 'dev' | 'staging' | 'prod';
    allowList: string[];
    denyList: string[];
    dangerousList: string[];
}

export interface OpenSessionInput {
    deviceId: string;
    deviceName: string;
    host: string;
    port: number;
    user: string;
    authType: 'password' | 'key';
}

export interface SendCommandResult {
    output: string[];
    warning?: string;
}
