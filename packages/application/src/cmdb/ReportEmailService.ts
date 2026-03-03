import nodemailer, { Transporter } from 'nodemailer'
import { EventEmitter } from 'events'

export interface EmailConfig {
    host: string
    port: number
    secure: boolean
    auth: {
        user: string
        pass: string
    }
    from: string
}

export interface EmailSubscription {
    id: string
    email: string
    reportTypes: ReportType[]
    frequency: 'daily' | 'weekly' | 'immediately'
    active: boolean
    createdAt: Date
}

export interface EmailTemplate {
    subject: string
    html: string
    text: string
}

export type ReportType = 'ci-inventory' | 'relationship-analytics' | 'audit-trail'

export interface ReportEmailData {
    type: ReportType
    timestamp: Date
    data: any
    filename?: string
}

export class ReportEmailService extends EventEmitter {
    private transporter: Transporter | null = null
    private subscriptions: Map<string, EmailSubscription> = new Map()
    private config: EmailConfig

    constructor(config?: Partial<EmailConfig>) {
        super()
        this.config = {
            host: config?.host || process.env.SMTP_HOST || 'localhost',
            port: config?.port || parseInt(process.env.SMTP_PORT || '587'),
            secure: config?.secure ?? (process.env.SMTP_SECURE === 'true'),
            auth: {
                user: config?.auth?.user || process.env.SMTP_USER || '',
                pass: config?.auth?.pass || process.env.SMTP_PASS || ''
            },
            from: config?.from || process.env.SMTP_FROM || 'noreply@netopsai.local'
        }
    }

    async initialize(): Promise<void> {
        try {
            this.transporter = nodemailer.createTransport({
                host: this.config.host,
                port: this.config.port,
                secure: this.config.secure,
                auth: this.config.auth
            })

            // Verify connection
            await this.transporter.verify()
            this.emit('initialized', { timestamp: new Date() })
        } catch (error) {
            this.emit('error', {
                message: 'Failed to initialize email service',
                error
            })
            // Allow graceful degradation
            this.transporter = null
        }
    }

    async sendReport(report: ReportEmailData, recipients: string[]): Promise<void> {
        if (!this.transporter) {
            this.emit('warning', {
                message: 'Email service not initialized, skipping report delivery'
            })
            return
        }

        try {
            const template = this.generateTemplate(report)

            const mailOptions = {
                from: this.config.from,
                to: recipients.join(', '),
                subject: template.subject,
                html: template.html,
                text: template.text
            }

            const info = await this.transporter.sendMail(mailOptions)

            this.emit('sent', {
                messageId: info.messageId,
                reportType: report.type,
                recipients: recipients.length,
                timestamp: new Date()
            })
        } catch (error) {
            this.emit('error', {
                message: `Failed to send ${report.type} report`,
                error,
                reportType: report.type
            })
            throw error
        }
    }

    async sendToSubscribers(report: ReportEmailData): Promise<void> {
        const subscribers = Array.from(this.subscriptions.values()).filter(
            (sub) => sub.active && sub.reportTypes.includes(report.type)
        )

        if (subscribers.length === 0) {
            return
        }

        const recipients = subscribers.map((sub) => sub.email)

        try {
            await this.sendReport(report, recipients)
        } catch (error) {
            this.emit('error', {
                message: `Failed to send report to subscribers`,
                error
            })
        }
    }

    subscribeUser(email: string, reportTypes: ReportType[], frequency: 'daily' | 'weekly' | 'immediately' = 'daily'): EmailSubscription {
        const id = `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        const subscription: EmailSubscription = {
            id,
            email,
            reportTypes,
            frequency,
            active: true,
            createdAt: new Date()
        }

        this.subscriptions.set(id, subscription)
        this.emit('subscription-created', subscription)

        return subscription
    }

    unsubscribeUser(subscriptionId: string): boolean {
        const subscription = this.subscriptions.get(subscriptionId)
        if (!subscription) {
            return false
        }

        this.subscriptions.delete(subscriptionId)
        this.emit('subscription-deleted', {
            subscriptionId,
            email: subscription.email
        })

        return true
    }

    updateSubscription(subscriptionId: string, updates: Partial<EmailSubscription>): EmailSubscription | null {
        const subscription = this.subscriptions.get(subscriptionId)
        if (!subscription) {
            return null
        }

        const updated: EmailSubscription = {
            ...subscription,
            ...updates,
            id: subscription.id,
            createdAt: subscription.createdAt
        }

        this.subscriptions.set(subscriptionId, updated)
        this.emit('subscription-updated', updated)

        return updated
    }

    getSubscription(subscriptionId: string): EmailSubscription | null {
        return this.subscriptions.get(subscriptionId) || null
    }

    getSubscriptions(email?: string): EmailSubscription[] {
        if (!email) {
            return Array.from(this.subscriptions.values())
        }

        return Array.from(this.subscriptions.values()).filter((sub) => sub.email === email)
    }

    getSubscriberCount(): number {
        return this.subscriptions.size
    }

    getActiveSubscribers(reportType: ReportType): number {
        return Array.from(this.subscriptions.values()).filter((sub) => sub.active && sub.reportTypes.includes(reportType)).length
    }

    private generateTemplate(report: ReportEmailData): EmailTemplate {
        const reportTypeLabel = this.getReportTypeLabel(report.type)
        const timestamp = report.timestamp.toLocaleString()

        const subject = `[CMDB] ${reportTypeLabel} Report - ${timestamp}`

        const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #2c3e50; color: white; padding: 20px; border-radius: 5px; }
        .content { margin: 20px 0; }
        .footer { font-size: 12px; color: #7f8c8d; margin-top: 20px; border-top: 1px solid #ecf0f1; padding-top: 10px; }
        table { width: 100%; border-collapse: collapse; margin: 10px 0; }
        th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ecf0f1; }
        th { background-color: #34495e; color: white; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>${reportTypeLabel} Report</h1>
            <p>Generated: ${timestamp}</p>
        </div>

        <div class="content">
            <p>Hello,</p>
            <p>Your scheduled ${reportTypeLabel} report has been generated.</p>

            ${this.formatReportContent(report)}

            <p>If you have any questions about this report, please contact your system administrator.</p>
        </div>

        <div class="footer">
            <p>This is an automated email from CMDB System. Please do not reply to this email.</p>
            <p>To manage your subscriptions, please visit the CMDB dashboard.</p>
        </div>
    </div>
</body>
</html>
        `

        const text = `
${reportTypeLabel} Report
Generated: ${timestamp}

${this.formatReportContentText(report)}

---
This is an automated email from CMDB System.
To manage your subscriptions, please visit the CMDB dashboard.
        `

        return { subject, html, text }
    }

    private formatReportContent(report: ReportEmailData): string {
        switch (report.type) {
            case 'ci-inventory':
                return this.formatCiInventoryContent(report.data)
            case 'relationship-analytics':
                return this.formatAnalyticsContent(report.data)
            case 'audit-trail':
                return this.formatAuditContent(report.data)
            default:
                return '<p>Report data available.</p>'
        }
    }

    private formatReportContentText(report: ReportEmailData): string {
        switch (report.type) {
            case 'ci-inventory':
                return this.formatCiInventoryContentText(report.data)
            case 'relationship-analytics':
                return this.formatAnalyticsContentText(report.data)
            case 'audit-trail':
                return this.formatAuditContentText(report.data)
            default:
                return 'Report data available.'
        }
    }

    private formatCiInventoryContent(data: any): string {
        return `
<table>
    <tr>
        <th>Metric</th>
        <th>Value</th>
    </tr>
    <tr>
        <td>Total CIs</td>
        <td>${data.totalCiCount || 0}</td>
    </tr>
    <tr>
        <td>Active CIs</td>
        <td>${data.activeCiCount || 0}</td>
    </tr>
    <tr>
        <td>Last Updated</td>
        <td>${new Date(data.lastUpdated || Date.now()).toLocaleString()}</td>
    </tr>
</table>
        `
    }

    private formatCiInventoryContentText(data: any): string {
        return `
Total CIs: ${data.totalCiCount || 0}
Active CIs: ${data.activeCiCount || 0}
Last Updated: ${new Date(data.lastUpdated || Date.now()).toLocaleString()}
        `
    }

    private formatAnalyticsContent(data: any): string {
        return `
<table>
    <tr>
        <th>Metric</th>
        <th>Value</th>
    </tr>
    <tr>
        <td>Total Relationships</td>
        <td>${data.totalRelationshipCount || 0}</td>
    </tr>
    <tr>
        <td>Types</td>
        <td>${data.relationshipTypes || 0}</td>
    </tr>
    <tr>
        <td>Dependencies</td>
        <td>${data.dependencyCount || 0}</td>
    </tr>
</table>
        `
    }

    private formatAnalyticsContentText(data: any): string {
        return `
Total Relationships: ${data.totalRelationshipCount || 0}
Relationship Types: ${data.relationshipTypes || 0}
Dependencies: ${data.dependencyCount || 0}
        `
    }

    private formatAuditContent(data: any): string {
        return `
<table>
    <tr>
        <th>Metric</th>
        <th>Value</th>
    </tr>
    <tr>
        <td>Changes in Last 24h</td>
        <td>${data.changesInLast24h || 0}</td>
    </tr>
    <tr>
        <td>Modified CIs</td>
        <td>${data.modifiedCiCount || 0}</td>
    </tr>
    <tr>
        <td>Most Active User</td>
        <td>${data.mostActiveUser || 'N/A'}</td>
    </tr>
</table>
        `
    }

    private formatAuditContentText(data: any): string {
        return `
Changes in Last 24h: ${data.changesInLast24h || 0}
Modified CIs: ${data.modifiedCiCount || 0}
Most Active User: ${data.mostActiveUser || 'N/A'}
        `
    }

    private getReportTypeLabel(type: ReportType): string {
        switch (type) {
            case 'ci-inventory':
                return 'CI Inventory'
            case 'relationship-analytics':
                return 'Relationship Analytics'
            case 'audit-trail':
                return 'Audit Trail'
            default:
                return 'CMDB'
        }
    }

    async disconnect(): Promise<void> {
        if (this.transporter) {
            try {
                await this.transporter.close()
                this.transporter = null
                this.emit('disconnected', { timestamp: new Date() })
            } catch (error) {
                this.emit('error', {
                    message: 'Failed to disconnect email service',
                    error
                })
            }
        }
    }
}

export class CachedEmailService {
    private emailService: ReportEmailService
    private sentCache: Map<string, Date> = new Map()
    private rateLimitMs: number = 300000 // 5 minutes

    constructor(emailService: ReportEmailService, rateLimitMs = 300000) {
        this.emailService = emailService
        this.rateLimitMs = rateLimitMs
    }

    async sendReport(report: ReportEmailData, recipients: string[]): Promise<void> {
        const cacheKey = `${report.type}:${recipients.join(',')}`
        const lastSent = this.sentCache.get(cacheKey)

        if (lastSent && Date.now() - lastSent.getTime() < this.rateLimitMs) {
            console.log(`Rate limited: ${cacheKey}`)
            return
        }

        await this.emailService.sendReport(report, recipients)
        this.sentCache.set(cacheKey, new Date())
    }

    async sendToSubscribers(report: ReportEmailData): Promise<void> {
        await this.emailService.sendToSubscribers(report)
    }

    subscribeUser(email: string, reportTypes: ReportType[], frequency?: 'daily' | 'weekly' | 'immediately'): EmailSubscription {
        return this.emailService.subscribeUser(email, reportTypes, frequency)
    }

    unsubscribeUser(subscriptionId: string): boolean {
        return this.emailService.unsubscribeUser(subscriptionId)
    }

    updateSubscription(subscriptionId: string, updates: Partial<EmailSubscription>): EmailSubscription | null {
        return this.emailService.updateSubscription(subscriptionId, updates)
    }

    getSubscription(subscriptionId: string): EmailSubscription | null {
        return this.emailService.getSubscription(subscriptionId)
    }

    getSubscriptions(email?: string): EmailSubscription[] {
        return this.emailService.getSubscriptions(email)
    }

    getSubscriberCount(): number {
        return this.emailService.getSubscriberCount()
    }

    getActiveSubscribers(reportType: ReportType): number {
        return this.emailService.getActiveSubscribers(reportType)
    }

    clearSentCache(): void {
        this.sentCache.clear()
    }

    getService(): ReportEmailService {
        return this.emailService
    }
}
