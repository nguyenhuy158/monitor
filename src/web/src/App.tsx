import { useEffect, useState } from 'react'
import { Card, Table, Metric, Badge, HeaderBar } from '@ui'

interface Cron {
  id: number;
  name: string;
  nextcall: string;
  active: boolean;
  model_id: [number, string];
}

function App() {
  const [crons, setCrons] = useState<Cron[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/crons')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setCrons(data)
        }
        setLoading(false)
      })
      .catch(err => {
        console.error(err)
        setLoading(false)
      })
  }, [])

  const now = new Date()
  const delayedCrons = crons.filter(c => new Date(c.nextcall + 'Z') < now)

  const columns = [
    { key: 'name', header: 'Tên Cron' },
    { 
      key: 'model_id', 
      header: 'Model', 
      render: (val: [number, string]) => val[1] 
    },
    { 
      key: 'nextcall', 
      header: 'Lần chạy tới',
      render: (val: string) => {
        const isDelayed = new Date(val + 'Z') < now
        return (
          <div className="flex items-center gap-2">
            <span>{val}</span>
            {isDelayed && <Badge tone="critical">Trễ</Badge>}
          </div>
        )
      }
    },
    {
      key: 'active',
      header: 'Trạng thái',
      render: (val: boolean) => val ? <Badge tone="positive">Active</Badge> : <Badge tone="neutral">Inactive</Badge>
    }
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      <HeaderBar title="Odoo Monitor" />
      
      <main className="max-w-7xl mx-auto p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <Metric label="Tổng số Cron Active" value={crons.length} />
          </Card>
          <Card>
            <Metric 
              label="Số Cron bị trễ" 
              value={delayedCrons.length} 
              tone={delayedCrons.length > 0 ? "critical" : "positive"} 
            />
          </Card>
        </div>

        <Card header={<h2 className="text-lg font-semibold">Danh sách Cron Job</h2>}>
          <Table 
            columns={columns} 
            data={crons} 
            loading={loading}
          />
        </Card>
      </main>
    </div>
  )
}

export default App
