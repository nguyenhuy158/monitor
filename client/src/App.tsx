import { useEffect, useState } from 'react'
import { Card, Table, Metric, Badge, HeaderBar, Button, Modal, Input, Field, Select } from '@ui'

export default function App() {
  const [configs, setConfigs] = useState([])
  const [selectedConfigId, setSelectedConfigId] = useState('')
  const [crons, setCrons] = useState([])
  const [loading, setLoading] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [newConfig, setNewConfig] = useState({ name: '', url: '', db: '', username: '', password: '' })
  const [user, setUser] = useState(null)

  useEffect(() => {
    fetch('/api/me').then(res => res.json()).then(data => {
      if (data.authenticated) setUser(data)
      else window.location.href = `https://auth.huyab.click/login?redirect_uri=${window.location.href}`
    })
  }, [])

  const fetchConfigs = () => {
    fetch('/api/configs').then(res => res.json()).then(data => {
      setConfigs(data)
      if (data.length > 0 && !selectedConfigId) setSelectedConfigId(data[0].id)
    })
  }

  useEffect(() => {
    if (user) fetchConfigs()
  }, [user])

  useEffect(() => {
    if (selectedConfigId) {
      setLoading(true)
      fetch(`/api/crons?config_id=${selectedConfigId}`)
        .then(res => res.json())
        .then(data => {
          setCrons(data.crons || [])
          setLoading(false)
        })
        .catch(() => setLoading(false))
    }
  }, [selectedConfigId])

  const handleAddConfig = () => {
    fetch('/api/configs', {
      method: 'POST',
      body: JSON.stringify(newConfig)
    }).then(() => {
      setIsModalOpen(false)
      fetchConfigs()
    })
  }

  const now = new Date()
  const delayed = crons.filter(c => new Date(c.nextcall + 'Z') < now)

  if (!user) return null

  return (
    <div className="min-h-screen bg-gray-50">
      <HeaderBar title="Odoo Monitor" />
      <main className="max-w-7xl mx-auto p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div className="w-64">
            <Select 
              value={selectedConfigId} 
              onChange={(e) => setSelectedConfigId(e.target.value)}
              options={configs.map(c => ({ label: c.name, value: c.id }))}
            />
          </div>
          <Button onClick={() => setIsModalOpen(true)}>Add Odoo Instance</Button>
        </div>

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

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Add Odoo Instance">
        <div className="space-y-4 p-4">
          <Field label="Instance Name"><Input value={newConfig.name} onChange={e => setNewConfig({...newConfig, name: e.target.value})} placeholder="My Odoo" /></Field>
          <Field label="URL"><Input value={newConfig.url} onChange={e => setNewConfig({...newConfig, url: e.target.value})} placeholder="https://odoo.com" /></Field>
          <Field label="Database"><Input value={newConfig.db} onChange={e => setNewConfig({...newConfig, db: e.target.value})} /></Field>
          <Field label="Username"><Input value={newConfig.username} onChange={e => setNewConfig({...newConfig, username: e.target.value})} /></Field>
          <Field label="Password"><Input type="password" value={newConfig.password} onChange={e => setNewConfig({...newConfig, password: e.target.value})} /></Field>
          <div className="flex justify-end gap-2 mt-6">
            <Button variant="neutral" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button onClick={handleAddConfig}>Save</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
