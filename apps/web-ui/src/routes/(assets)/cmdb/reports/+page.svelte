<script lang="ts">
    import { Button, Tabs, TabsList, TabsTrigger } from '$lib/components/ui'
    import { Download, RefreshCw, FileJson, FileText } from 'lucide-svelte'
    import { API_BASE, apiJson, authorizedFetch } from '$lib/api/httpClient'
    
    interface ReportStats {
        totalCiCount: number
        totalRelationshipCount: number
        orphanedCiCount: number
        brokenRelationshipCount: number
    }

    interface GenerateState {
        loading: boolean
        error: string | null
        success: boolean
    }

    type ReportFormat = 'json' | 'csv' | 'pdf'

    type GeneratedReport = {
        data?: {
            totalCiCount?: number
            totalRelationshipCount?: number
            orphanedCiCount?: number
            brokenRelationshipCount?: number
            countByType?: Array<unknown>
            complianceIssues?: Array<{ ciCode: string; ciName: string; missingAttributes: string[] }>
            hubCis?: Array<{ ciCode: string; connectionCount: number }>
            brokenRelationships?: Array<unknown>
            totalEvents?: number
            ciChangeHistory?: Array<{ ciCode: string; action: string; timestamp: string }>
        }
    }

    let activeTab = $state<string>('ci-inventory')
    let reportFormat = $state<ReportFormat>('json')
    let generateState = $state<GenerateState>({ loading: false, error: null, success: false })
    let stats = $state<ReportStats | null>(null)
    let generatedReport = $state<GeneratedReport | null>(null)

    $effect(() => {
        // In real implementation, fetch initial stats
        stats = {
            totalCiCount: 0,
            totalRelationshipCount: 0,
            orphanedCiCount: 0,
            brokenRelationshipCount: 0
        }
    })

    async function generateReport(reportType: string) {
        generateState.loading = true
        generateState.error = null
        generateState.success = false

        try {
            generatedReport = await apiJson<GeneratedReport>(`${API_BASE}/v1/cmdb/reports/${reportType}`)
            generateState.success = true
        } catch (err) {
            generateState.error = err instanceof Error ? err.message : 'Unknown error'
        } finally {
            generateState.loading = false
        }
    }

    async function exportReport(reportType: string, format: string) {
        try {
            const response = await authorizedFetch(`${API_BASE}/v1/cmdb/reports/export/${reportType}?format=${format}`)
            if (!response.ok) throw new Error(`Failed to export report`)
            
            const blob = await response.blob()
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `${reportType}-${new Date().toISOString().split('T')[0]}.${format}`
            a.click()
            URL.revokeObjectURL(url)
        } catch (err) {
            generateState.error = err instanceof Error ? err.message : 'Export failed'
        }
    }
</script>

<div class="p-6">
    <div class="mb-8">
        <h1 class="text-3xl font-bold mb-2">CMDB Reports</h1>
        <p class="text-slate-400">Generate and export reports on Configuration Items, Relationships, and Audit Trail</p>
    </div>

    {#if generateState.error}
        <div class="alert alert-error mb-4">
            <span>{generateState.error}</span>
        </div>
    {/if}

    {#if generateState.success}
        <div class="alert alert-success mb-4">
            <span>Report generated successfully</span>
        </div>
    {/if}

    <Tabs>
        <TabsList>
            <TabsTrigger active={activeTab === 'ci-inventory'} onclick={() => activeTab = 'ci-inventory'}>CI Inventory</TabsTrigger>
            <TabsTrigger active={activeTab === 'relationship-analytics'} onclick={() => activeTab = 'relationship-analytics'}>Relationship Analytics</TabsTrigger>
            <TabsTrigger active={activeTab === 'audit-trail'} onclick={() => activeTab = 'audit-trail'}>Audit Trail</TabsTrigger>
        </TabsList>
    </Tabs>

    {#if activeTab === 'ci-inventory'}
        <div class="space-y-4">
            <div class="card">
                    <h3 class="text-xl font-semibold mb-4">CI Inventory Report</h3>
                    <p class="text-slate-400 mb-4">
                        View comprehensive inventory statistics including CI count by type, status, environment,
                        age distribution, and compliance issues.
                    </p>

                    <div class="flex gap-2 mb-4">
                        <Button
                            onclick={() => generateReport('ci-inventory')}
                            disabled={generateState.loading}
                        >
                            {#if generateState.loading}
                                <div class="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"></div>
                            {:else}
                                <RefreshCw class="w-4 h-4" />
                            {/if}
                            Generate Report
                        </Button>

                        <select
                            class="select-base w-32"
                            bind:value={reportFormat}
                        >
                            <option value="json">JSON</option>
                            <option value="csv">CSV</option>
                            <option value="pdf">PDF</option>
                        </select>

                        <Button
                            variant="secondary"
                            onclick={() => exportReport('ci-inventory', reportFormat)}
                            disabled={!generatedReport || generateState.loading}
                        >
                            <Download class="w-4 h-4" />
                            Export
                        </Button>
                    </div>

                    {#if generatedReport && generatedReport.data && generatedReport.data.totalCiCount !== undefined}
                        <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div class="bg-blue-900/30 p-4 rounded">
                                <p class="text-slate-400 text-sm">Total CIs</p>
                                <p class="text-2xl font-bold text-blue-400">{generatedReport.data.totalCiCount}</p>
                            </div>
                            <div class="bg-orange-900/30 p-4 rounded">
                                <p class="text-slate-400 text-sm">Orphaned CIs</p>
                                <p class="text-2xl font-bold text-orange-400">{generatedReport.data.orphanedCiCount}</p>
                            </div>
                            <div class="bg-green-900/30 p-4 rounded">
                                <p class="text-slate-400 text-sm">CI Types</p>
                                <p class="text-2xl font-bold text-green-400">{generatedReport.data.countByType?.length || 0}</p>
                            </div>
                            <div class="bg-red-900/30 p-4 rounded">
                                <p class="text-slate-400 text-sm">Compliance Issues</p>
                                <p class="text-2xl font-bold text-red-400">{generatedReport.data.complianceIssues?.length || 0}</p>
                            </div>
                        </div>

                        {#if generatedReport.data.complianceIssues && generatedReport.data.complianceIssues.length > 0}
                            <div class="mt-6">
                                <h4 class="font-semibold mb-3">Compliance Issues</h4>
                                <div class="space-y-2 max-h-80 overflow-y-auto">
                                    {#each generatedReport.data.complianceIssues.slice(0, 10) as issue}
                                        <div class="border border-slate-700 p-3 rounded flex justify-between items-start">
                                            <div>
                                                <p class="font-medium">{issue.ciCode} - {issue.ciName}</p>
                                                <p class="text-sm text-slate-400">Missing: {issue.missingAttributes.join(', ')}</p>
                                            </div>
                                            <span class="badge-error">Issue</span>
                                        </div>
                                    {/each}
                                </div>
                            </div>
                        {/if}
                    {/if}
                </div>
            </div>
    {:else if activeTab === 'relationship-analytics'}
        <div class="space-y-4">
            <div class="card">
                    <h3 class="text-xl font-semibold mb-4">Relationship Analytics Report</h3>
                    <p class="text-slate-400 mb-4">
                        Analyze relationship patterns including density metrics, hub CIs, isolated clusters,
                        and broken relationships.
                    </p>

                    <div class="flex gap-2 mb-4">
                        <Button
                            onclick={() => generateReport('relationship-analytics')}
                            disabled={generateState.loading}
                        >
                            {#if generateState.loading}
                                <div class="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"></div>
                            {:else}
                                <RefreshCw class="w-4 h-4" />
                            {/if}
                            Generate Report
                        </Button>

                        <select
                            class="select-base w-32"
                            bind:value={reportFormat}
                        >
                            <option value="json">JSON</option>
                            <option value="csv">CSV</option>
                            <option value="pdf">PDF</option>
                        </select>

                        <Button
                            variant="secondary"
                            onclick={() => exportReport('relationship-analytics', reportFormat)}
                            disabled={!generatedReport || generateState.loading}
                        >
                            <Download class="w-4 h-4" />
                            Export
                        </Button>
                    </div>

                    {#if generatedReport && generatedReport.data && generatedReport.data.totalRelationshipCount !== undefined}
                        <div class="grid grid-cols-2 md:grid-cols-3 gap-4">
                            <div class="bg-blue-900/30 p-4 rounded">
                                <p class="text-slate-400 text-sm">Total Relationships</p>
                                <p class="text-2xl font-bold text-blue-400">{generatedReport.data.totalRelationshipCount}</p>
                            </div>
                            <div class="bg-purple-900/30 p-4 rounded">
                                <p class="text-slate-400 text-sm">Hub CIs (Top)</p>
                                <p class="text-2xl font-bold text-purple-400">{generatedReport.data.hubCis?.length || 0}</p>
                            </div>
                            <div class="bg-red-900/30 p-4 rounded">
                                <p class="text-slate-400 text-sm">Broken Relationships</p>
                                <p class="text-2xl font-bold text-red-400">{generatedReport.data.brokenRelationships?.length || 0}</p>
                            </div>
                        </div>

                        {#if generatedReport.data.hubCis && generatedReport.data.hubCis.length > 0}
                            <div class="mt-6">
                                <h4 class="font-semibold mb-3">Most Connected CIs</h4>
                                <div class="space-y-2 max-h-80 overflow-y-auto">
                                    {#each generatedReport.data.hubCis as hub, idx}
                                        <div class="border border-slate-700 p-3 rounded flex justify-between items-center">
                                            <div>
                                                <p class="font-medium">#{idx + 1} {hub.ciCode}</p>
                                                <p class="text-sm text-slate-400">{hub.connectionCount} total connections</p>
                                            </div>
                                            <span class="badge-primary">{hub.connectionCount}</span>
                                        </div>
                                    {/each}
                                </div>
                            </div>
                        {/if}
                    {/if}
                </div>
            </div>
    {:else if activeTab === 'audit-trail'}
        <div class="space-y-4">
            <div class="card">
                    <h3 class="text-xl font-semibold mb-4">Audit Trail Report</h3>
                    <p class="text-slate-400 mb-4">
                        Review change history including CI modifications, relationship changes, and schema version history.
                    </p>

                    <div class="space-y-4 mb-4">
                        <input class="input-base" placeholder="Filter by CI ID (optional)" type="text" />
                        <div class="flex gap-2">
                            <Button
                                onclick={() => generateReport('audit-trail')}
                                disabled={generateState.loading}
                            >
                                {#if generateState.loading}
                                    <div class="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"></div>
                                {:else}
                                    <RefreshCw class="w-4 h-4" />
                                {/if}
                                Generate Report
                            </Button>

                            <select
                                class="select-base w-32"
                                bind:value={reportFormat}
                            >
                                <option value="json">JSON</option>
                                <option value="csv">CSV</option>
                                <option value="pdf">PDF</option>
                            </select>

                            <Button
                                variant="secondary"
                                onclick={() => exportReport('audit-trail', reportFormat)}
                                disabled={!generatedReport || generateState.loading}
                            >
                                <Download class="w-4 h-4" />
                                Export
                            </Button>
                        </div>
                    </div>

                    {#if generatedReport && generatedReport.data && generatedReport.data.totalEvents !== undefined}
                        <div class="bg-blue-900/30 p-4 rounded mb-4">
                            <p class="text-slate-400 text-sm">Total Events</p>
                            <p class="text-2xl font-bold text-blue-400">{generatedReport.data.totalEvents}</p>
                        </div>

                        {#if generatedReport.data.ciChangeHistory && generatedReport.data.ciChangeHistory.length > 0}
                            <div>
                                <h4 class="font-semibold mb-3">Recent CI Changes</h4>
                                <div class="space-y-2 max-h-80 overflow-y-auto">
                                    {#each generatedReport.data.ciChangeHistory.slice(0, 10) as change}
                                        <div class="border border-slate-700 p-3 rounded">
                                            <p class="font-medium">{change.ciCode}</p>
                                            <p class="text-sm text-slate-400">
                                                {change.action} at {new Date(change.timestamp).toLocaleString()}
                                            </p>
                                        </div>
                                    {/each}
                                </div>
                            </div>
                        {/if}
                    {/if}
                </div>
            </div>
    {/if}
</div>

