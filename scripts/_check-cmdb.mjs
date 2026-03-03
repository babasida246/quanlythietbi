import pg from 'pg'
const c = new pg.Client('postgresql://postgres:postgres@localhost:5432/qltb')
await c.connect()

// cmdb_cis columns
const cisCols = await c.query("SELECT column_name FROM information_schema.columns WHERE table_name='cmdb_cis' ORDER BY ordinal_position")
console.log('cmdb_cis columns:', cisCols.rows.map(r => r.column_name).join(', '))

// cmdb_services columns
const svcCols = await c.query("SELECT column_name FROM information_schema.columns WHERE table_name='cmdb_services' ORDER BY ordinal_position")
console.log('cmdb_services columns:', svcCols.rows.map(r => r.column_name).join(', '))

// cmdb_relationships columns
const relCols = await c.query("SELECT column_name FROM information_schema.columns WHERE table_name='cmdb_relationships' ORDER BY ordinal_position")
console.log('cmdb_relationships columns:', relCols.rows.map(r => r.column_name).join(', '))

// cmdb_service_cis columns
const sciCols = await c.query("SELECT column_name FROM information_schema.columns WHERE table_name='cmdb_service_cis' ORDER BY ordinal_position")
console.log('cmdb_service_cis columns:', sciCols.rows.map(r => r.column_name).join(', '))

// Data counts
const counts = await c.query(`
    SELECT 
        (SELECT COUNT(*) FROM cmdb_cis) as cis,
        (SELECT COUNT(*) FROM cmdb_services) as services,
        (SELECT COUNT(*) FROM cmdb_relationships) as rels,
        (SELECT COUNT(*) FROM cmdb_service_cis) as service_cis,
        (SELECT COUNT(*) FROM cmdb_ci_types) as ci_types
`)
console.log('Counts:', counts.rows[0])

// Sample cmdb_cis
const cis = await c.query("SELECT id, ci_code, name FROM cmdb_cis LIMIT 5")
console.log('Sample CIs:', JSON.stringify(cis.rows))

// Sample cmdb_services
const svcs = await c.query("SELECT id, code, name FROM cmdb_services")
console.log('Services:', JSON.stringify(svcs.rows))

// organizations
const orgs = await c.query("SELECT id, name, slug FROM organizations LIMIT 3")
console.log('Organizations:', JSON.stringify(orgs.rows))

await c.end()
