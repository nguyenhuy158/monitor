import { useEffect, useState } from 'react'
import { Plus, Copy, Mail } from 'lucide-react'
import { Card, CardHeader, Table, Metric, Badge, HeaderBar, Button, Modal, Input, Field, Select, RadioGroup } from '@ui'

const ENV_OPTIONS = [
  { value: 'dev', label: 'Dev' },
  { value: 'preprod', label: 'Preprod' },
  { value: 'prod', label: 'Prod' },
]

const ENV_TONE = { dev: 'neutral', preprod: 'warning', prod: 'danger' }

function pad(n) {
  return String(n).padStart(2, '0')
}

// Odoo tra ve gio UTC khong co suffix 'Z', can tu them vao truoc khi parse.
function formatDateTime(value) {
  const d = new Date(value + 'Z')
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  const date = `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${String(d.getFullYear()).slice(-2)}`
  return `${time} ${date}`
}

export default function App() {
  const [configs, setConfigs] = useState([])
  const [selectedConfigId, setSelectedConfigId] = useState('')
  const [crons, setCrons] = useState([])
  const [loading, setLoading] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [newConfig, setNewConfig] = useState({ name: '', url: '', db: '', username: '', password: '', env: 'prod' })
  const [user, setUser] = useState(null)
  const [testEmailStatus, setTestEmailStatus] = useState('')

  useEffect(() => {
    fetch('/api/me').then(res => res.json()).then(data => {
      if (data.authenticated) setUser(data)
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

  const handleDuplicateConfig = () => {
    if (!selectedConfigId) return
    fetch(`/api/configs/${selectedConfigId}/duplicate`, { method: 'POST' }).then(() => fetchConfigs())
  }

  const handleTestEmail = () => {
    if (!selectedConfigId) return
    setTestEmailStatus('sending')
    fetch(`/api/configs/${selectedConfigId}/test-email`, { method: 'POST' })
      .then(res => res.ok ? setTestEmailStatus('sent') : setTestEmailStatus('error'))
      .catch(() => setTestEmailStatus('error'))
      .finally(() => setTimeout(() => setTestEmailStatus(''), 3000))
  }

  const selectedConfig = (configs || []).find(c => String(c.id) === String(selectedConfigId))
  const now = new Date()
  const delayed = Array.isArray(crons) ? crons.filter(c => new Date(c.nextcall + 'Z') < now) : []

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg p-4">
        <Card className="max-w-md w-full text-center space-y-6 py-12">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight text-fg">Odoo Monitor</h1>
            <p className="text-fg-muted">Giám sát Cron Job Odoo và cảnh báo tức thì</p>
          </div>
          <Button 
            size="lg" 
            className="w-full"
            onClick={() => window.location.href = `https://auth.huyab.click/login?redirect_uri=${window.location.href}`}
          >
            Login with Google
          </Button>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-bg">
      <HeaderBar title="Odoo Monitor" />
      <main className="max-w-7xl mx-auto p-4 space-y-4 sm:p-6 sm:space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="w-full sm:w-64">
              <Select
                value={selectedConfigId}
                onChange={(e) => setSelectedConfigId(e.target.value)}
              >
                {(configs || []).map(c => (
                  <option key={c.id} value={String(c.id)}>{c.name}</option>
                ))}
              </Select>
            </div>
            {selectedConfig && (
              <>
                <Badge tone={ENV_TONE[selectedConfig.env] || 'neutral'}>{selectedConfig.env}</Badge>
                <Button
                  variant="outline"
                  size="icon"
                  aria-label="Duplicate instance"
                  onClick={handleDuplicateConfig}
                >
                  <Copy className="size-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  aria-label="Test send email"
                  loading={testEmailStatus === 'sending'}
                  onClick={handleTestEmail}
                >
                  <Mail className="size-4" />
                </Button>
                {testEmailStatus === 'sent' && <Badge tone="success">Đã gửi</Badge>}
                {testEmailStatus === 'error' && <Badge tone="danger">Lỗi gửi</Badge>}
              </>
            )}
          </div>
          <Button block className="sm:w-auto" leftIcon={<Plus className="size-4" />} onClick={() => setIsModalOpen(true)}>Add Odoo Instance</Button>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:gap-6">
          <Card><Metric label="Active Crons" value={Array.isArray(crons) ? crons.length : 0} /></Card>
          <Card>
            <Metric
              label="Delayed"
              value={
                <span className={delayed.length > 0 ? "text-danger" : "text-success"}>
                  {delayed.length}
                </span>
              }
            />
          </Card>
        </div>

        <Card>
          <CardHeader title="Cron Jobs" className="mb-4" />
          {loading ? (
            <div className="p-6 text-center text-fg-muted">Loading...</div>
          ) : (
            <Table
              rows={Array.isArray(crons) ? crons : []}
              rowKey={(row) => row.id ?? row.name}
              empty={<div className="p-6 text-center text-fg-muted">Không có cron nào</div>}
              columns={[
                { key: 'name', header: 'Name', cell: (row) => row.name },
                { key: 'nextcall', header: 'Next Call', cell: (row) => (
                  <div className="flex gap-2 items-center">
                    {formatDateTime(row.nextcall)} {new Date(row.nextcall + 'Z') < now && <Badge tone="danger">Trễ</Badge>}
                  </div>
                )},
                { key: 'active', header: 'Status', hideOnMobile: true, cell: (row) => row.active ? <Badge tone="success">Active</Badge> : <Badge /> }
              ]}
            />
          )}
        </Card>
      </main>

      <Modal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Add Odoo Instance"
        footer={
          <>
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button onClick={handleAddConfig}>Save</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Instance Name"><Input value={newConfig.name} onChange={e => setNewConfig({...newConfig, name: e.target.value})} placeholder="My Odoo" /></Field>
          <Field label="URL"><Input value={newConfig.url} onChange={e => setNewConfig({...newConfig, url: e.target.value})} placeholder="https://odoo.com" /></Field>
          <Field label="Database"><Input value={newConfig.db} onChange={e => setNewConfig({...newConfig, db: e.target.value})} /></Field>
          <Field label="Username"><Input value={newConfig.username} onChange={e => setNewConfig({...newConfig, username: e.target.value})} /></Field>
          <Field label="Password"><Input type="password" value={newConfig.password} onChange={e => setNewConfig({...newConfig, password: e.target.value})} /></Field>
          <RadioGroup
            label="Environment"
            name="env"
            value={newConfig.env}
            onChange={(value) => setNewConfig({...newConfig, env: value})}
            options={ENV_OPTIONS}
          />
        </div>
      </Modal>
    </div>
  )
}
