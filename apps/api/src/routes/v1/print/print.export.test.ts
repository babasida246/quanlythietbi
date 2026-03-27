import { describe, it, expect } from 'vitest'
import { stripHtml, toCsv, toExcelXml, buildExportBuffer } from './print.route'

describe('Print Export Helpers', () => {
    describe('stripHtml', () => {
        it('should remove HTML tags and entities', () => {
            const html = '<p>Hello &amp; <strong>world</strong></p>'
            const result = stripHtml(html)
            expect(result).toBe('Hello & world')
        })

        it('should handle br and p tags', () => {
            const html = '<p>Line 1</p><br/><p>Line 2</p>'
            const result = stripHtml(html)
            expect(result).toContain('Line 1')
            expect(result).toContain('Line 2')
        })

        it('should remove script and style tags', () => {
            const html = '<style>body{}</style><p>Text</p><script>alert("x")</script>'
            const result = stripHtml(html)
            expect(result).not.toContain('body{}')
            expect(result).not.toContain('alert')
            expect(result).toContain('Text')
        })
    })

    describe('toCsv', () => {
        it('should convert object to CSV with proper escaping', () => {
            const data = { name: 'John Doe', value: '100' }
            const result = toCsv(data)
            expect(result).toContain('"field","value"')
            expect(result).toContain('"name","John Doe"')
            expect(result).toContain('"value","100"')
        })

        it('should escape quotes in values', () => {
            const data = { field: 'Say "hello"' }
            const result = toCsv(data)
            expect(result).toContain('Say ""hello""')
        })
    })

    describe('toExcelXml', () => {
        it('should generate valid Excel XML structure', () => {
            const data = { name: 'Test', count: '10' }
            const result = toExcelXml(data)
            expect(result).toContain('<?xml version="1.0"?>')
            expect(result).toContain('<Workbook')
            expect(result).toContain('<Worksheet ss:Name="PrintData">')
            expect(result).toContain('<Data ss:Type="String">name</Data>')
            expect(result).toContain('<Data ss:Type="String">Test</Data>')
        })

        it('should escape XML special chars', () => {
            const data = { text: 'A < B & C > D' }
            const result = toExcelXml(data)
            expect(result).toContain('A &lt; B &amp; C &gt; D')
        })
    })

    describe('buildExportBuffer', () => {
        it('should return JSON buffer for json format', async () => {
            const html = '<p>Test</p>'
            const mappings = { field: 'value' }
            const meta = { docType: 'asset' }

            const buffer = await buildExportBuffer('json', html, mappings, meta)
            const content = buffer.toString('utf-8')
            const parsed = JSON.parse(content)

            expect(parsed).toHaveProperty('docType', 'asset')
            expect(parsed).toHaveProperty('mappings.field', 'value')
            expect(parsed).toHaveProperty('renderedHtml')
        })

        it('should return CSV buffer for csv format', async () => {
            const html = '<p>Test</p>'
            const mappings = { field: 'value' }
            const meta = {}

            const buffer = await buildExportBuffer('csv', html, mappings, meta)
            const content = buffer.toString('utf-8')

            expect(content).toContain('"field","value"')
        })

        it('should return Excel XML buffer for excel format', async () => {
            const html = '<p>Test</p>'
            const mappings = { field: 'value' }
            const meta = {}

            const buffer = await buildExportBuffer('excel', html, mappings, meta)
            const content = buffer.toString('utf-8')

            expect(content).toContain('<?xml version="1.0"?>')
            expect(content).toContain('<Workbook')
        })

        it('should return Word HTML buffer for word format', async () => {
            const html = '<p>Test Content</p>'
            const mappings = {}
            const meta = {}

            const buffer = await buildExportBuffer('word', html, mappings, meta)
            const content = buffer.toString('utf-8')

            expect(content).toContain('<!DOCTYPE html>')
            expect(content).toContain('<body>')
            expect(content).toContain('Test Content')
        })

        it('should return PDF buffer for pdf format', async () => {
            const html = '<p>Test PDF</p>'
            const mappings = {}
            const meta = {}

            const buffer = await buildExportBuffer('pdf', html, mappings, meta)
            expect(buffer).toBeInstanceOf(Buffer)
            expect(buffer.length).toBeGreaterThan(0)
            // PDF magic bytes check: %PDF
            expect(buffer.toString('utf-8', 0, 4)).toBe('%PDF')
        })
    })
})
