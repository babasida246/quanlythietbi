import { API_BASE, requireAccessToken } from '$lib/api/httpClient';
import type {
    AddFieldNoteInput,
    ApprovalRequest,
    CaptureSnapshotInput,
    ConnectivityPlan,
    FieldNote,
    GenerateConnectivityPlanInput,
    GeneratePlaybookInput,
    PlaybookRun,
    QuickCheckSnapshot,
    RecordAuditInput,
    RequestApprovalInput,
    RunQuickCheckInput,
    Snapshot,
    Snippet,
    VisualizerData
} from '$lib/tools/field/types';

type ApiResponse<T> = {
    success: boolean;
    data: T;
};

function headers() {
    return {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${requireAccessToken()}`
    };
}

async function getJson<T>(url: string): Promise<T> {
    const response = await fetch(url, {
        method: 'GET',
        headers: headers()
    });
    if (!response.ok) {
        throw new Error(await response.text());
    }
    const payload = (await response.json()) as ApiResponse<T>;
    return payload.data;
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
    const response = await fetch(url, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify(body)
    });
    if (!response.ok) {
        throw new Error(await response.text());
    }
    const payload = (await response.json()) as ApiResponse<T>;
    return payload.data;
}

export async function runQuickCheck(input: RunQuickCheckInput): Promise<QuickCheckSnapshot> {
    return postJson<QuickCheckSnapshot>(`${API_BASE}/v1/field-kit/quick-check`, input);
}

export async function listQuickChecks(deviceId: string): Promise<QuickCheckSnapshot[]> {
    return getJson<QuickCheckSnapshot[]>(`${API_BASE}/v1/field-kit/${encodeURIComponent(deviceId)}/quick-checks`);
}

export async function generatePlaybook(input: GeneratePlaybookInput): Promise<PlaybookRun> {
    return postJson<PlaybookRun>(`${API_BASE}/v1/field-kit/playbooks/generate`, input);
}

export async function listPlaybooks(deviceId: string): Promise<PlaybookRun[]> {
    return getJson<PlaybookRun[]>(`${API_BASE}/v1/field-kit/${encodeURIComponent(deviceId)}/playbooks`);
}

export async function listSnippets(vendor?: 'all' | 'cisco' | 'mikrotik' | 'fortigate'): Promise<Snippet[]> {
    const query = vendor && vendor !== 'all' ? `?vendor=${encodeURIComponent(vendor)}` : '';
    return getJson<Snippet[]>(`${API_BASE}/v1/field-kit/snippets${query}`);
}

export async function getVisualizer(deviceId: string): Promise<VisualizerData> {
    return getJson<VisualizerData>(`${API_BASE}/v1/field-kit/${encodeURIComponent(deviceId)}/visualizer`);
}

export async function captureSnapshot(input: CaptureSnapshotInput): Promise<Snapshot> {
    return postJson<Snapshot>(`${API_BASE}/v1/field-kit/snapshots`, input);
}

export async function listSnapshots(deviceId: string): Promise<Snapshot[]> {
    return getJson<Snapshot[]>(`${API_BASE}/v1/field-kit/${encodeURIComponent(deviceId)}/snapshots`);
}

export async function generateConnectivityPlan(input: GenerateConnectivityPlanInput): Promise<ConnectivityPlan> {
    return postJson<ConnectivityPlan>(`${API_BASE}/v1/field-kit/connectivity-plan`, input);
}

export async function addNote(input: AddFieldNoteInput): Promise<FieldNote> {
    return postJson<FieldNote>(`${API_BASE}/v1/field-kit/notes`, input);
}

export async function listNotes(deviceId: string): Promise<FieldNote[]> {
    return getJson<FieldNote[]>(`${API_BASE}/v1/field-kit/${encodeURIComponent(deviceId)}/notes`);
}

export async function requestApproval(input: RequestApprovalInput): Promise<ApprovalRequest> {
    return postJson<ApprovalRequest>(`${API_BASE}/v1/field-kit/approvals`, input);
}

export async function listApprovals(deviceId: string): Promise<ApprovalRequest[]> {
    return getJson<ApprovalRequest[]>(`${API_BASE}/v1/field-kit/${encodeURIComponent(deviceId)}/approvals`);
}

export async function recordAudit(input: RecordAuditInput): Promise<void> {
    await postJson(`${API_BASE}/v1/field-kit/audit-events`, input);
}
