import { useEffect, useState } from 'react'
import { Card, Table, Metric, Badge, HeaderBar } from '@ui'

export default function App() {
  const [crons, setCrons] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/crons')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setCrons(data)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const now = new Date()
  const delayed = crons.filter(c => new Date(c.nextcall + 'Z') < now)

  return (
    <div className="min-h-screen bg-gray-50">
      <HeaderBar title="Odoo Monitor" />
      <main className="max-w-7xl mx-auto p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card><Metric label="Active Crons" value={crons.length} /></Card>
          <Card><Metric label="Delayed" value={delayed.length} tone={delayed.length > 0 ? "critical" : "positive"} /></Card>
        </div>
        <Card header={<h2 className="text-lg font-semibold">Cron Jobs</h2>}>
          <Table 
            data={crons} 
            loading={loading}
            columns={[
              { key: 'name', header: 'Name' },
              { key: 'nextcall', header: 'Next Call', render: (v) => (
                <div className="flex gap-2 items-center">
                  {v} {new Date(v + 'Z') < now && <Badge tone="critical">Trễ</Badge>}
                </div>
              )},
              { key: 'active', header: 'Status', render: (v) => v ? <Badge tone="positive">Active</Badge> : <Badge /> }
            ]}
          />
        </Card>
      </main>
    </div>
  )
}
