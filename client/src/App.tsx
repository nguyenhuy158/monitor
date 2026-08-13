import { useEffect, useState, useMemo, useCallback } from 'react'
import { Plus, Copy, Mail, Edit2, ArrowUpDown, ArrowUp, ArrowDown, RefreshCw, Search, X, MoreVertical, LogOut, PackageOpen } from 'lucide-react'
import { Card, CardHeader, Table, Metric, Badge, HeaderBar, Button, Modal, Input, Field, Select, RadioGroup, useToast, Pagination, Menu, Avatar, Skeleton, EmptyState } from '@ui'

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

function Logo() {
  return (
    <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
      <svg viewBox="0 0 64 64" className="size-6 fill-current">
        <rect x="16" y="49" width="32" height="8" rx="4" />
        <rect x="27" y="43" width="10" height="7" />
        <rect x="7" y="6" width="50" height="38" rx="9" fill="none" stroke="currentColor" strokeWidth="3" />
        <path d="M28 30 Q32 34 36 30" stroke="currentColor" strokeWidth="2.2" fill="none" strokeLinecap="round" />
        <circle cx="24" cy="24" r="3.5" />
        <circle cx="40" cy="24" r="3.5" />
      </svg>
    </div>
  )
}

export default function App() {
  const toast = useToast()
  const [configs, setConfigs] = useState([])
  const [loadingConfigs, setLoadingConfigs] = useState(true)
  const [selectedConfigId, setSelectedConfigId] = useState('')
  const [crons, setCrons] = useState([])
  const [loading, setLoading] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add')
  const [newConfig, setNewConfig] = useState({ name: '', url: '', db: '', username: '', password: '', env: 'prod' })
  const [user, setUser] = useState(null)
  const [loadingUser, setLoadingUser] = useState(true)
  const [isSendingEmail, setIsSendingEmail] = useState(false)
  
  const [currentPage, setCurrentPage] = useState(1)
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' | null }>({ key: 'nextcall', direction: 'asc' })
  const [searchQuery, setSearchQuery] = useState('')
  const [isSearchVisible, setIsSearchVisible] = useState(false)
  const PAGE_LIMIT = 5

  useEffect(() => {
    fetch('/api/me')
      .then(res => res.json())
      .then(data => {
        if (data.authenticated) setUser(data)
      })
      .finally(() => setLoadingUser(false))
  }, [])

  const fetchConfigs = () => {
    setLoadingConfigs(true)
    fetch('/api/configs')
      .then(res => res.json())
      .then(data => {
        setConfigs(data)
        if (data.length > 0 && !selectedConfigId) setSelectedConfigId(data[0].id)
      })
      .finally(() => setLoadingConfigs(false))
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

  if (loadingUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg p-4">
        <div className="flex flex-col items-center gap-4">
          <Logo />
          <div className="flex items-center gap-2 text-sm text-fg-muted">
            <RefreshCw className="size-4 animate-spin" />
            <span>Đang xác thực...</span>
          </div>
        </div>
      </div>
    )
  }

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
      <HeaderBar 
        title="Odoo Monitor" 
        leading={<Logo />}
        actions={
          <div className="flex items-center gap-2">
            <Button 
              variant="outline"
              size="icon" 
              onClick={openAddModal}
              aria-label="Add Odoo Instance"
              className="rounded-full"
            >
              <Plus className="size-4" />
            </Button>
            {user && (
              <Menu
                align="right"
                trigger={({ onClick }) => (
                  <button onClick={onClick} className="flex items-center">
                    <Avatar src={`https://www.gravatar.com/avatar/${btoa(user.email)}?d=mp`} alt={user.email} size="sm" />
                  </button>
                )}
                items={[
                  {
                    label: user.email,
                    disabled: true,
                    onSelect: () => {}
                  },
                  {
                    label: 'Đăng xuất',
                    icon: <LogOut className="size-4" />,
                    destructive: true,
                    onSelect: () => window.location.href = 'https://auth.huyab.click/logout'
                  }
                ]}
              />
            )}
          </div>
        }
      />
      
      <main className="mx-auto max-w-3xl p-4 space-y-6 sm:p-6">
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="flex-1">
              {loadingConfigs ? (
                <Skeleton className="h-10 w-full" />
              ) : (
                <Select
                  value={selectedConfigId}
                  onChange={(e) => setSelectedConfigId(e.target.value)}
                  className="h-10"
                >
                  {(configs || []).map(c => (
                    <option key={c.id} value={String(c.id)}>{c.name}</option>
                  ))}
                </Select>
              )}
            </div>
            {selectedConfig && (
              <div className="flex items-center gap-1.5">
                <Badge tone={ENV_TONE[selectedConfig.env] || 'neutral'} className="h-8">
                  {selectedConfig.env}
                </Badge>
                
                <div className="h-8 w-px bg-border mx-1" />

                <Button
                  variant="outline"
                  size="icon"
                  aria-label="Reload data"
                  loading={loading}
                  onClick={() => fetchCrons(selectedConfigId)}
                  className="size-8"
                >
                  <RefreshCw className="size-3.5" />
                </Button>
                
                <Menu
                  align="right"
                  trigger={({ onClick, 'aria-expanded': expanded }) => (
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={onClick}
                      aria-expanded={expanded}
                      aria-label="More actions"
                      className="size-8"
                    >
                      <MoreVertical className="size-3.5" />
                    </Button>
                  )}
                  items={[
                    {
                      label: 'Gửi email test',
                      icon: <Mail className="size-4" />,
                      onSelect: handleTestEmail,
                      disabled: isSendingEmail
                    },
                    {
                      label: 'Nhân bản',
                      icon: <Copy className="size-4" />,
                      onSelect: handleDuplicateConfig
                    },
                    {
                      label: 'Chỉnh sửa',
                      icon: <Edit2 className="size-4" />,
                      onSelect: openEditModal
                    }
                  ]}
                />
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Metric 
              label="Active Crons" 
              value={loading ? <Skeleton className="h-6 w-12" /> : (Array.isArray(crons) ? crons.length : 0)} 
            />
            <Metric
              label="Delayed"
              value={
                loading ? (
                  <Skeleton className="h-6 w-12" />
                ) : (
                  <span className={delayed.length > 0 ? "text-danger" : "text-success"}>
                    {delayed.length}
                  </span>
                )
              }
            />
          </div>
        </section>

        <Card padded={false} className="overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-surface-muted/50">
            {!isSearchVisible ? (
              <>
                <h3 className="text-sm font-semibold text-fg">Cron Jobs</h3>
                <Button variant="ghost" size="icon" onClick={toggleSearch} className="size-8">
                  <Search className="size-4 text-fg-muted" />
                </Button>
              </>
            ) : (
              <div className="flex items-center gap-2 w-full animate-in fade-in slide-in-from-right-2 duration-200">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-fg-muted" />
                  <Input 
                    autoFocus
                    placeholder="Tìm kiếm cron..." 
                    className="pl-9 h-8 text-sm"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value)
                      setCurrentPage(1)
                    }}
                  />
                </div>
                <Button variant="ghost" size="icon" onClick={toggleSearch} className="size-8">
                  <X className="size-4 text-fg-muted" />
                </Button>
              </div>
            )}
          </div>
          
          <div className="min-h-[300px]">
            {loading ? (
              <div className="divide-y divide-border px-4">
                {[...Array(PAGE_LIMIT)].map((_, i) => (
                  <div key={i} className="flex items-center gap-3 py-4">
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-1/2" />
                      <Skeleton className="h-3 w-1/4" />
                    </div>
                    <Skeleton className="h-4 w-20" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col">
                <Table
                  className="border-0 rounded-none shadow-none"
                  rows={paginatedCrons}
                  rowKey={(row) => row.id ?? row.name}
                  empty={
                    <EmptyState 
                      title="Không có cron nào" 
                      description="Có vẻ như instance này không có cron job nào đang chạy."
                      icon={<PackageOpen className="size-8 opacity-20" />}
                      className="border-0 rounded-none py-20"
                    />
                  }
                  columns={[
                    { 
                      key: 'name', 
                      header: <SortHeader label="Tên Cron" sortKey="name" />, 
                      cell: (row) => (
                        <div className="max-w-[180px] sm:max-w-xs truncate font-medium">
                          {row.name}
                        </div>
                      )
                    },
                    { 
                      key: 'nextcall', 
                      header: <SortHeader label="Lần chạy tới" sortKey="nextcall" />, 
                      cell: (row) => {
                        const isLate = new Date(row.nextcall + 'Z') < now
                        return (
                          <div className="flex flex-col">
                            <span className={cn("text-sm", isLate && "text-danger font-medium")}>
                              {formatDateTime(row.nextcall).split(' ')[0]}
                            </span>
                            <span className="text-[10px] text-fg-muted">
                              {formatDateTime(row.nextcall).split(' ')[1]}
                            </span>
                          </div>
                        )
                      }
                    },
                    { 
                      key: 'active', 
                      header: <SortHeader label="Trạng thái" sortKey="active" />, 
                      hideOnMobile: true, 
                      cell: (row) => row.active ? <Badge tone="success">Active</Badge> : <Badge /> 
                    }
                  ]}
                />
                
                {pageCount > 1 && (
                  <div className="px-4 py-3 border-t border-border bg-surface-muted/30">
                    <Pagination 
                      page={currentPage} 
                      pageCount={pageCount} 
                      onChange={setCurrentPage} 
                    />
                  </div>
                )}
              </div>
            )}
          </div>
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
