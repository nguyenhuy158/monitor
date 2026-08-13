import { useEffect, useState, useMemo, useCallback } from 'react'
import { Plus, Copy, Mail, Edit2, ArrowUpDown, ArrowUp, ArrowDown, RefreshCw, Search, X } from 'lucide-react'
import { Card, CardHeader, Table, Metric, Badge, HeaderBar, Button, Modal, Input, Field, Select, RadioGroup, useToast, Pagination } from '@ui'

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
  const toast = useToast()
  const [configs, setConfigs] = useState([])
  const [selectedConfigId, setSelectedConfigId] = useState('')
  const [crons, setCrons] = useState([])
  const [loading, setLoading] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add')
  const [newConfig, setNewConfig] = useState({ name: '', url: '', db: '', username: '', password: '', env: 'prod' })
  const [user, setUser] = useState(null)
  const [isSendingEmail, setIsSendingEmail] = useState(false)
  
  const [currentPage, setCurrentPage] = useState(1)
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' | null }>({ key: 'nextcall', direction: 'asc' })
  const [searchQuery, setSearchQuery] = useState('')
  const [isSearchVisible, setIsSearchVisible] = useState(false)
  const PAGE_LIMIT = 5

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

  const fetchCrons = useCallback((configId: string, silent = false) => {
    if (!configId) return
    if (!silent) setLoading(true)
    fetch(`/api/crons?config_id=${configId}`)
      .then(res => res.json())
      .then(data => {
        setCrons(data.crons || [])
        if (!silent) {
          setLoading(false)
          setCurrentPage(1)
        }
      })
      .catch(() => {
        if (!silent) setLoading(false)
      })
  }, [])

  useEffect(() => {
    if (selectedConfigId) {
      fetchCrons(selectedConfigId)
    }
  }, [selectedConfigId, fetchCrons])

  // Auto reload mỗi 30s
  useEffect(() => {
    if (!selectedConfigId || !user) return
    
    const interval = setInterval(() => {
      fetchCrons(selectedConfigId, true)
    }, 30000)

    return () => clearInterval(interval)
  }, [selectedConfigId, user, fetchCrons])

  const handleAddConfig = () => {
    const isEdit = modalMode === 'edit'
    const url = isEdit ? `/api/configs/${selectedConfigId}` : '/api/configs'
    const method = isEdit ? 'PUT' : 'POST'

    fetch(url, {
      method,
      body: JSON.stringify(newConfig)
    }).then(res => {
      if (res.ok) {
        toast.success(isEdit ? 'Đã cập nhật instance' : 'Đã thêm instance thành công')
        setIsModalOpen(false)
        fetchConfigs()
      } else {
        toast.error(isEdit ? 'Lỗi khi cập nhật' : 'Lỗi khi thêm instance')
      }
    }).catch(() => toast.error('Lỗi kết nối'))
  }

  const openAddModal = () => {
    setModalMode('add')
    setNewConfig({ name: '', url: '', db: '', username: '', password: '', env: 'prod' })
    setIsModalOpen(true)
  }

  const openEditModal = () => {
    if (!selectedConfig) return
    setModalMode('edit')
    setNewConfig({
      name: selectedConfig.name,
      url: selectedConfig.url,
      db: selectedConfig.db,
      username: selectedConfig.username,
      password: selectedConfig.password,
      env: selectedConfig.env
    })
    setIsModalOpen(true)
  }

  const handleDuplicateConfig = () => {
    if (!selectedConfigId) return
    fetch(`/api/configs/${selectedConfigId}/duplicate`, { method: 'POST' }).then(res => {
      if (res.ok) {
        toast.success('Đã nhân bản instance')
        fetchConfigs()
      } else {
        toast.error('Lỗi khi nhân bản')
      }
    }).catch(() => toast.error('Lỗi kết nối'))
  }

  const handleTestEmail = () => {
    if (!selectedConfigId) return
    setIsSendingEmail(true)
    fetch(`/api/configs/${selectedConfigId}/test-email`, { method: 'POST' })
      .then(res => {
        if (res.ok) {
          toast.success('Đã gửi email thử nghiệm')
        } else {
          toast.error('Lỗi khi gửi email')
        }
      })
      .catch(() => toast.error('Lỗi kết nối'))
      .finally(() => setIsSendingEmail(false))
  }

  const toggleSearch = () => {
    setIsSearchVisible(!isSearchVisible)
    if (isSearchVisible) setSearchQuery('')
    setCurrentPage(1)
  }

  const selectedConfig = (configs || []).find(c => String(c.id) === String(selectedConfigId))
  const now = new Date()

  const sortedCrons = useMemo(() => {
    if (!Array.isArray(crons)) return []
    let items = [...crons]
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      items = items.filter(item => 
        (item.name || '').toLowerCase().includes(query)
      )
    }

    if (sortConfig.key && sortConfig.direction) {
      items.sort((a, b) => {
        let aValue = a[sortConfig.key]
        let bValue = b[sortConfig.key]

        if (aValue < bValue) {
          return sortConfig.direction === 'asc' ? -1 : 1
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'asc' ? 1 : -1
        }
        return 0
      })
    }
    return items
  }, [crons, sortConfig])

  const paginatedCrons = useMemo(() => {
    const startIndex = (currentPage - 1) * PAGE_LIMIT
    return sortedCrons.slice(startIndex, startIndex + PAGE_LIMIT)
  }, [sortedCrons, currentPage])

  const pageCount = Math.ceil(sortedCrons.length / PAGE_LIMIT)

  const delayed = Array.isArray(crons) ? crons.filter(c => new Date(c.nextcall + 'Z') < now) : []

  const toggleSort = (key: string) => {
    setSortConfig(current => {
      if (current.key === key) {
        if (current.direction === 'asc') return { key, direction: 'desc' }
        if (current.direction === 'desc') return { key, direction: null }
        return { key, direction: 'asc' }
      }
      return { key, direction: 'asc' }
    })
    setCurrentPage(1)
  }

  const SortHeader = ({ label, sortKey }: { label: string, sortKey: string }) => {
    const isSorted = sortConfig.key === sortKey
    const Icon = !isSorted || !sortConfig.direction ? ArrowUpDown : sortConfig.direction === 'asc' ? ArrowUp : ArrowDown
    
    return (
      <button 
        className="flex items-center gap-1 hover:text-fg transition-colors"
        onClick={() => toggleSort(sortKey)}
      >
        {label}
        <Icon className="size-3" />
      </button>
    )
  }

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
                  aria-label="Reload data"
                  loading={loading}
                  onClick={() => fetchCrons(selectedConfigId)}
                >
                  <RefreshCw className="size-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  aria-label="Edit instance"
                  onClick={openEditModal}
                >
                  <Edit2 className="size-4" />
                </Button>
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
                  loading={isSendingEmail}
                  onClick={handleTestEmail}
                >
                  <Mail className="size-4" />
                </Button>
              </>
            )}
          </div>
          <Button 
            size="icon" 
            className="sm:w-auto" 
            leftIcon={<Plus className="size-4" />} 
            onClick={openAddModal}
            aria-label="Add Odoo Instance"
          />
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
          <div className="flex items-center justify-between mb-4">
            {!isSearchVisible ? (
              <>
                <CardHeader title="Cron Jobs" className="mb-0" />
                <Button variant="ghost" size="icon" onClick={toggleSearch}>
                  <Search className="size-4" />
                </Button>
              </>
            ) : (
              <div className="flex items-center gap-2 w-full animate-in fade-in slide-in-from-right-2 duration-200">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-fg-muted" />
                  <Input 
                    autoFocus
                    placeholder="Search crons..." 
                    className="pl-9 h-9"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value)
                      setCurrentPage(1)
                    }}
                  />
                </div>
                <Button variant="ghost" size="icon" onClick={toggleSearch}>
                  <X className="size-4" />
                </Button>
              </div>
            )}
          </div>
          {loading ? (
            <div className="p-6 text-center text-fg-muted">Loading...</div>
          ) : (
            <div className="space-y-4">
              <Table
                rows={paginatedCrons}
                rowKey={(row) => row.id ?? row.name}
                empty={<div className="p-6 text-center text-fg-muted">Không có cron nào</div>}
                columns={[
                  { 
                    key: 'name', 
                    header: <SortHeader label="Name" sortKey="name" />, 
                    cell: (row) => row.name 
                  },
                  { 
                    key: 'nextcall', 
                    header: <SortHeader label="Next Call" sortKey="nextcall" />, 
                    cell: (row) => (
                      <div className="flex gap-2 items-center">
                        {formatDateTime(row.nextcall)} {new Date(row.nextcall + 'Z') < now && <Badge tone="danger">Trễ</Badge>}
                      </div>
                    )
                  },
                  { 
                    key: 'active', 
                    header: <SortHeader label="Status" sortKey="active" />, 
                    hideOnMobile: true, 
                    cell: (row) => row.active ? <Badge tone="success">Active</Badge> : <Badge /> 
                  }
                ]}
              />
              {pageCount > 1 && (
                <Pagination 
                  page={currentPage} 
                  pageCount={pageCount} 
                  onChange={setCurrentPage} 
                  className="py-2"
                />
              )}
            </div>
          )}
        </Card>
      </main>

      <Modal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={modalMode === 'add' ? "Add Odoo Instance" : "Edit Odoo Instance"}
        footer={
          <>
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>Hủy</Button>
            <Button onClick={handleAddConfig}>{modalMode === 'add' ? 'Lưu' : 'Cập nhật'}</Button>
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
