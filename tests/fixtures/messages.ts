/**
 * Test message fixtures for chat and API testing
 */

export const testMessages = {
    simple: [
        { role: 'user', content: 'Hello, how are you?' },
        { role: 'assistant', content: 'I am doing well, thank you for asking!' },
    ],

    ping: [
        { role: 'user', content: 'ping' },
    ],

    multiTurn: [
        { role: 'user', content: 'What is the capital of France?' },
        { role: 'assistant', content: 'The capital of France is Paris.' },
        { role: 'user', content: 'What about Germany?' },
    ],

    systemMessage: [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: 'Tell me a joke.' },
    ],

    longMessage: [
        {
            role: 'user',
            content: 'This is a very long message that contains a lot of text to test how the system handles larger inputs. '.repeat(10)
        },
    ],

    codeMessage: [
        {
            role: 'user',
            content: 'Can you help me debug this code?\\n\\n```javascript\\nfunction hello() {\\n  console.log("Hello World");\\n}\\n```'
        },
    ],

    toolRequest: [
        {
            role: 'user',
            content: 'Can you get me the latest system logs from Zabbix for the last hour?'
        },
    ],

    // Invalid payloads for error testing
    invalid: {
        emptyMessages: [],

        invalidRole: [
            { role: 'invalid-role', content: 'This should not work' },
        ],

        missingContent: [
            { role: 'user' },
        ],

        missingRole: [
            { content: 'Missing role field' },
        ],

        oversizeContent: [
            {
                role: 'user',
                content: 'x'.repeat(100000) // Very large content
            },
        ],
    },
} as const;

/**
 * Sample log entries for testing
 */
export const testLogs = {
    zabbix: [
        {
            timestamp: '2024-02-09T10:00:00Z',
            severity: 'warning',
            host: 'server-01',
            item: 'cpu.usage',
            value: '85.5',
            message: 'High CPU usage detected',
        },
        {
            timestamp: '2024-02-09T10:05:00Z',
            severity: 'info',
            host: 'server-02',
            item: 'memory.usage',
            value: '60.2',
            message: 'Memory usage normal',
        },
    ],

    syslog: [
        {
            timestamp: '2024-02-09T10:00:00Z',
            facility: 'auth',
            severity: 'notice',
            host: 'web-server',
            program: 'sshd',
            message: 'Accepted publickey for user admin',
        },
        {
            timestamp: '2024-02-09T10:01:00Z',
            facility: 'daemon',
            severity: 'error',
            host: 'web-server',
            program: 'nginx',
            message: 'Connection refused to upstream server',
        },
    ],

    fortigate: [
        {
            timestamp: '2024-02-09T10:00:00Z',
            type: 'traffic',
            subtype: 'forward',
            action: 'accept',
            srcip: '192.168.1.100',
            dstip: '8.8.8.8',
            srcport: 12345,
            dstport: 53,
            service: 'DNS',
        },
        {
            timestamp: '2024-02-09T10:01:00Z',
            type: 'utm',
            subtype: 'virus',
            action: 'blocked',
            srcip: '192.168.1.150',
            dstip: '203.0.113.10',
            virus: 'Malware.Generic',
        },
    ],
} as const;

/**
 * Time ranges for testing
 */
export const testTimeRanges = {
    lastHour: {
        start: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
        end: new Date().toISOString(),
    },

    lastDay: {
        start: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        end: new Date().toISOString(),
    },

    lastWeek: {
        start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        end: new Date().toISOString(),
    },

    invalid: {
        futureRange: {
            start: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
            end: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
        },

        reversedRange: {
            start: new Date().toISOString(),
            end: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
        },
    },
} as const;