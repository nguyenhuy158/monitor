import { useEffect, useState, useMemo, useCallback } from 'react'
import { Plus, Copy, Mail, Edit2, ArrowUpDown, ArrowUp, ArrowDown, RefreshCw, Search, X, MoreVertical, LogOut, PackageOpen, LayoutDashboard, Settings, BellRing, BarChart3, Activity, Server, Clock, ChevronUp, ChevronDown, ListTree } from 'lucide-react'
import { Card, CardHeader, Table, Metric, Badge, HeaderBar, Button, Modal, Input, Field, Select, RadioGroup, useToast, Pagination, Menu, Avatar, Skeleton, EmptyState, cn, Combobox, BottomNav, Switch } from '@ui'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'

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

function getDelayText(nextCall) {
  const diffMs = new Date() - new Date(nextCall + 'Z')
  if (diffMs <= 0) return null
  
  const diffMins = Math.floor(diffMs / 60000)
  if (diffMins < 1) return 'vừa xong'
  if (diffMins < 60) return `trễ ${diffMins}m`
  
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `trễ ${diffHours}h`
  
  return `trễ ${Math.floor(diffHours / 24)}d`
}

function Logo() {
  return (
    <div className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-fg shadow-sm shadow-primary/20">
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
  const [viewingCron, setViewingCron] = useState(null)
  
  const [userSettings, setUserSettings] = useState({ alert_delay_minutes: 30 })
  const [isUpdatingSettings, setIsUpdatingSettings] = useState(false)
  
  const [activeTab, setActiveTab] = useState<'stats' | 'dashboard' | 'configs' | 'settings'>('stats')
  const [allCronsData, setAllCronsData] = useState<Record<string, any[]>>({})
  const [loadingAllCrons, setLoadingAllCrons] = useState(false)
  
  const [currentPage, setCurrentPage] = useState(1)
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' | null }>({ key: 'nextcall', direction: 'asc' })
  const [searchQuery, setSearchQuery] = useState('')
  const [isSearchVisible, setIsSearchVisible] = useState(false)
  const PAGE_LIMIT = 5

  // Cập nhật title là giờ hiện tại
  useEffect(() => {
    const updateTitle = () => {
      const now = new Date()
      const timeStr = `${pad(now.getHours())}:${pad(now.getMinutes())}`
      document.title = timeStr
    }

    updateTitle()
    const interval = setInterval(updateTitle, 10000) // Cập nhật mỗi 10s để chính xác phút
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    fetch('/api/me')
      .then(res => res.json())
      .then(data => {
        if (data.authenticated) {
          setUser(data)
          if (data.settings) setUserSettings(data.settings)
        }
      })
      .finally(() => setLoadingUser(false))
  }, [])

  const updateSettings = (newSettings) => {
    setIsUpdatingSettings(true)
    fetch('/api/settings', {
      method: 'PUT',
      body: JSON.stringify(newSettings)
    })
      .then(res => {
        if (res.ok) {
          setUserSettings(newSettings)
          toast.success('Đã lưu cài đặt')
        } else {
          toast.error('Lỗi khi lưu cài đặt')
        }
      })
      .catch(() => toast.error('Lỗi kết nối'))
      .finally(() => setIsUpdatingSettings(false))
  }

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

  const fetchAllCrons = useCallback(async () => {
    if (configs.length === 0) return
    setLoadingAllCrons(true)
    const results: Record<string, any[]> = {}
    
    try {
      await Promise.all(configs.map(async (config) => {
        const res = await fetch(`/api/crons?config_id=${config.id}`)
        const data = await res.json()
        results[config.id] = data.crons || []
      }))
      setAllCronsData(results)
    } catch (e) {
      console.error("Failed to fetch all crons:", e)
    } finally {
      setLoadingAllCrons(false)
    }
  }, [configs])

  useEffect(() => {
    if (activeTab === 'stats' && Object.keys(allCronsData).length === 0) {
      fetchAllCrons()
    }
  }, [activeTab, allCronsData, fetchAllCrons])

  const statsData = useMemo(() => {
    const now = new Date()
    const envStats = {
      prod: { delayed: 0, total: 0 },
      preprod: { delayed: 0, total: 0 },
      dev: { delayed: 0, total: 0 }
    }

    let globalTotal = 0
    let globalDelayed = 0

    configs.forEach(config => {
      const crons = allCronsData[config.id] || []
      const env = (config.env || 'prod') as keyof typeof envStats
      
      const delayedCount = crons.filter(c => new Date(c.nextcall + 'Z') < now).length
      
      if (envStats[env]) {
        envStats[env].delayed += delayedCount
        envStats[env].total += crons.length
      }

      globalTotal += crons.length
      globalDelayed += delayedCount
    })

    const healthScore = globalTotal > 0 ? Math.round(((globalTotal - globalDelayed) / globalTotal) * 100) : 100

    return {
      envs: [
        { name: 'Production', delayed: envStats.prod.delayed, total: envStats.prod.total, color: 'var(--ui-danger)' },
        { name: 'Preprod', delayed: envStats.preprod.delayed, total: envStats.preprod.total, color: 'var(--ui-warning)' },
        { name: 'Dev', delayed: envStats.dev.delayed, total: envStats.dev.total, color: 'var(--ui-fg-muted)' }
      ],
      global: {
        totalInstances: configs.length,
        totalCrons: globalTotal,
        totalDelayed: globalDelayed,
        healthScore
      }
    }
  }, [configs, allCronsData])

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

  const handleDuplicateConfig = (configId) => {
    fetch(`/api/configs/${configId}/duplicate`, { method: 'POST' }).then(res => {
      if (res.ok) {
        toast.success('Đã nhân bản instance')
        fetchConfigs()
      } else {
        toast.error('Lỗi khi nhân bản')
      }
    }).catch(() => toast.error('Lỗi kết nối'))
  }

  const handleMoveConfig = (index: number, direction: 'up' | 'down') => {
    const newConfigs = [...configs]
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    
    if (targetIndex < 0 || targetIndex >= newConfigs.length) return

    const [movedItem] = newConfigs.splice(index, 1)
    newConfigs.splice(targetIndex, 0, movedItem)
    
    setConfigs(newConfigs)
    
    fetch('/api/configs/reorder', {
      method: 'POST',
      body: JSON.stringify({ ids: newConfigs.map(c => c.id) })
    }).catch(() => toast.error('Lỗi khi lưu thứ tự'))
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

  const instanceOptions = useMemo(() => {
    return (configs || []).map(c => ({
      value: String(c.id),
      label: c.name,
      description: c.url.replace(/^https?:\/\//, '')
    }))
  }, [configs])

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
      <div className="min-h-screen flex items-center justify-center bg-bg p-6">
        <Card className="max-w-md w-full text-center space-y-8 py-16 shadow-2xl border-primary/5">
          <div className="flex flex-col items-center space-y-4">
            <div className="scale-150 mb-2">
              <Logo />
            </div>
            <div className="space-y-2">
              <p className="text-sm text-fg-muted max-w-[280px] mx-auto leading-relaxed">
                Giải pháp giám sát Cron Job Odoo thông minh. Nhận cảnh báo tức thì qua email khi hệ thống gặp sự cố.
              </p>
            </div>
          </div>
          
          <Button 
            size="lg" 
            className="w-full h-12 font-semibold shadow-md shadow-primary/20"
            leftIcon={
              <svg className="size-5 mr-1" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
            }
            onClick={() => window.location.href = `https://auth.huyab.click/login?redirect_uri=${window.location.href}`}
          >
            Tiếp tục với Google
          </Button>

          <p className="text-[10px] text-fg-muted uppercase tracking-widest font-medium">
            Powered by huyab auth
          </p>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-bg">
      <HeaderBar 
        title="" 
        leading={<Logo />}
        actions={
          <div className="flex items-center gap-2">
            <nav className="hidden lg:flex items-center gap-1 mr-4 border-r border-border pr-4">
              <Button 
                variant={activeTab === 'stats' ? 'primary' : 'ghost'} 
                size="sm" 
                onClick={() => setActiveTab('stats')}
                leftIcon={<BarChart3 size={16} />}
              >
                Stats
              </Button>
              <Button 
                variant={activeTab === 'dashboard' ? 'primary' : 'ghost'} 
                size="sm" 
                onClick={() => setActiveTab('dashboard')}
                leftIcon={<LayoutDashboard size={16} />}
              >
                Dashboard
              </Button>
              <Button 
                variant={activeTab === 'configs' ? 'primary' : 'ghost'} 
                size="sm" 
                onClick={() => setActiveTab('configs')}
                leftIcon={<ListTree size={16} />}
              >
                Instances
              </Button>
              <Button 
                variant={activeTab === 'settings' ? 'primary' : 'ghost'} 
                size="sm" 
                onClick={() => setActiveTab('settings')}
                leftIcon={<Settings size={16} />}
              >
                Settings
              </Button>
            </nav>
            
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
      
      <main className="mx-auto max-w-3xl p-4 pb-24 space-y-6 sm:p-6 lg:pb-6">
        {activeTab === 'dashboard' ? (
          <>
            <section className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  {loadingConfigs ? (
                    <Skeleton className="h-10 w-full" />
                  ) : (
                    <Combobox
                      value={selectedConfigId}
                      onChange={setSelectedConfigId}
                      options={instanceOptions}
                      placeholder="Chọn instance Odoo..."
                      className="w-full"
                    />
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
                    
                    <Button
                      variant="outline"
                      size="icon"
                      aria-label="Test send email"
                      onClick={handleTestEmail}
                      disabled={isSendingEmail}
                      className="size-8"
                    >
                      <Mail className="size-3.5" />
                    </Button>
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
                      wrap
                      onRowClick={(row) => setViewingCron(row)}
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
                            <div className="font-medium break-words py-1">
                              {row.name}
                            </div>
                          )
                        },
                        { 
                          key: 'nextcall', 
                          header: <SortHeader label="Lần chạy tới" sortKey="nextcall" />, 
                          cell: (row) => {
                            const delay = getDelayText(row.nextcall)
                            return (
                              <div className="flex flex-col py-1">
                                <span className={cn("text-sm whitespace-nowrap", delay && "text-danger font-medium")}>
                                  {formatDateTime(row.nextcall).split(' ')[0]}
                                </span>
                                <div className="flex items-center gap-1.5 whitespace-nowrap">
                                  <span className="text-[10px] text-fg-muted">
                                    {formatDateTime(row.nextcall).split(' ')[1]}
                                  </span>
                                  {delay && (
                                    <span className="text-[10px] font-bold text-danger bg-danger/10 px-1 rounded-sm uppercase tracking-tighter">
                                      {delay}
                                    </span>
                                  )}
                                </div>
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
          </>
        ) : activeTab === 'stats' ? (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
              <Card className="flex flex-col items-start p-4 bg-primary/5 border-primary/10">
                <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center mb-3">
                  <Server className="size-4 text-primary" />
                </div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-fg-muted">Instances</p>
                <p className="text-2xl font-black text-fg">{loadingAllCrons ? "..." : statsData.global.totalInstances}</p>
              </Card>

              <Card className="flex flex-col items-start p-4 bg-success/5 border-success/10">
                <div className="size-8 rounded-lg bg-success/10 flex items-center justify-center mb-3">
                  <Activity className="size-4 text-success" />
                </div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-fg-muted">Tổng Crons</p>
                <p className="text-2xl font-black text-fg">{loadingAllCrons ? "..." : statsData.global.totalCrons}</p>
              </Card>

              <Card className="flex flex-col items-start p-4 bg-danger/5 border-danger/10">
                <div className="size-8 rounded-lg bg-danger/10 flex items-center justify-center mb-3">
                  <Clock className="size-4 text-danger" />
                </div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-fg-muted">Tổng Trễ</p>
                <p className="text-2xl font-black text-danger">{loadingAllCrons ? "..." : statsData.global.totalDelayed}</p>
              </Card>

              <Card className="flex flex-col items-start p-4 bg-warning/5 border-warning/10">
                <div className="size-8 rounded-lg bg-warning/10 flex items-center justify-center mb-3">
                  <Activity className="size-4 text-warning" />
                </div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-fg-muted">Health</p>
                <p className="text-2xl font-black text-fg">{loadingAllCrons ? "..." : `${statsData.global.healthScore}%`}</p>
              </Card>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {statsData.envs.map(stat => (
                <Card key={stat.name} className="flex flex-col items-center justify-center py-6">
                  <p className="text-xs font-bold uppercase tracking-widest text-fg-muted mb-1">{stat.name}</p>
                  <p className={cn("text-3xl font-black", stat.delayed > 0 ? "text-danger" : "text-success")}>
                    {loadingAllCrons ? "..." : stat.delayed}
                  </p>
                  <p className="text-[10px] text-fg-muted mt-1 italic">trễ / {loadingAllCrons ? "..." : stat.total} tổng</p>
                </Card>
              ))}
            </div>

            <Card className="p-6">
              <CardHeader 
                title="Thống kê Cron trễ theo môi trường" 
                description="Biểu đồ so sánh số lượng cron bị delay giữa các env"
                action={
                  <Button variant="ghost" size="icon" onClick={fetchAllCrons} loading={loadingAllCrons}>
                    <RefreshCw className="size-4" />
                  </Button>
                }
              />
              <div className="h-72 w-full mt-8">
                {loadingAllCrons ? (
                  <div className="h-full w-full flex items-center justify-center">
                    <Skeleton className="h-full w-full rounded-ui" />
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={statsData.envs} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--ui-border)" opacity={0.5} />
                      <XAxis 
                        dataKey="name" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fill: 'var(--ui-fg-muted)', fontSize: 12 }}
                      />
                      <YAxis 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fill: 'var(--ui-fg-muted)', fontSize: 12 }}
                      />
                      <Tooltip 
                        cursor={{ fill: 'var(--ui-surface-muted)', opacity: 0.4 }}
                        contentStyle={{ 
                          backgroundColor: 'var(--ui-surface)', 
                          borderRadius: 'var(--ui-radius)', 
                          border: '1px solid var(--ui-border)',
                          boxShadow: 'var(--ui-shadow-lg)'
                        }}
                      />
                      <Bar dataKey="delayed" radius={[4, 4, 0, 0]} barSize={40}>
                        {statsData.envs.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </Card>

            <div className="rounded-ui bg-primary-soft p-4 border border-primary/10 flex items-start gap-3">
              <div className="size-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0 mt-0.5">
                <BarChart3 className="size-4 text-primary" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-primary">Phân tích nhanh</h4>
                <p className="text-xs text-primary/80 leading-relaxed">
                  {statsData.envs.find(s => s.name === 'Production')?.delayed! > 0 
                    ? "Cảnh báo: Đang có cron bị trễ trên Production. Hãy kiểm tra ngay lập tức để tránh gián đoạn dịch vụ."
                    : "Hệ thống hoạt động ổn định. Không có cron nào bị trễ trên Production."}
                </p>
              </div>
            </div>
          </div>
        ) : activeTab === 'configs' ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-fg uppercase tracking-wider">Danh sách Instance</h3>
              <Button size="sm" leftIcon={<Plus size={16} />} onClick={openAddModal}>Thêm mới</Button>
            </div>
            
            <div className="space-y-3">
              {configs.map((config, index) => (
                <Card key={config.id} className="p-3">
                  <div className="flex items-center gap-3">
                    <div className="flex flex-col gap-1">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="size-6" 
                        disabled={index === 0}
                        onClick={() => handleMoveConfig(index, 'up')}
                      >
                        <ChevronUp size={14} />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="size-6" 
                        disabled={index === configs.length - 1}
                        onClick={() => handleMoveConfig(index, 'down')}
                      >
                        <ChevronDown size={14} />
                      </Button>
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-sm truncate">{config.name}</p>
                        <Badge tone={ENV_TONE[config.env] || 'neutral'} size="sm">{config.env}</Badge>
                      </div>
                      <p className="text-[11px] text-fg-muted truncate mt-0.5">{config.url}</p>
                    </div>

                    <div className="flex items-center gap-1">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="size-8"
                        onClick={() => {
                          setSelectedConfigId(String(config.id))
                          openEditModal()
                        }}
                      >
                        <Edit2 size={14} />
                      </Button>
                      <Menu
                        align="right"
                        trigger={({ onClick }) => (
                          <Button variant="ghost" size="icon" className="size-8" onClick={onClick}>
                            <MoreVertical size={14} />
                          </Button>
                        )}
                        items={[
                          {
                            label: 'Nhân bản',
                            icon: <Copy size={14} />,
                            onSelect: () => handleDuplicateConfig(config.id)
                          }
                        ]}
                      />
                    </div>
                  </div>
                </Card>
              ))}
              
              {configs.length === 0 && (
                <EmptyState 
                  title="Chưa có instance nào" 
                  description="Hãy thêm instance Odoo đầu tiên để bắt đầu giám sát."
                  action={<Button onClick={openAddModal}>Thêm Odoo Instance</Button>}
                />
              )}
            </div>
          </div>
        ) : (
          <Card className="space-y-6">
            <CardHeader 
              title="Cài đặt thông báo" 
              description="Tùy chỉnh ngưỡng thời gian cảnh báo qua email"
              action={<BellRing className="size-5 text-primary opacity-50" />}
            />
            
            <div className="space-y-6 py-4">
              <Field 
                label="Ngưỡng trễ cảnh báo (phút)" 
                description={`Hệ thống sẽ gửi mail khi có ít nhất 1 cron trễ từ ${userSettings.alert_delay_minutes} phút trở lên.`}
              >
                <div className="flex gap-3">
                  <Input 
                    type="number" 
                    min="1"
                    value={userSettings.alert_delay_minutes}
                    onChange={(e) => setUserSettings({ ...userSettings, alert_delay_minutes: parseInt(e.target.value) || 0 })}
                    className="flex-1"
                  />
                  <Button 
                    loading={isUpdatingSettings}
                    onClick={() => updateSettings(userSettings)}
                  >
                    Lưu
                  </Button>
                </div>
              </Field>

              <div className="rounded-ui bg-surface-muted p-4 border border-border space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-fg-muted">Thông tin tài khoản</h4>
                <div className="flex items-center gap-3">
                  <Avatar src={`https://www.gravatar.com/avatar/${btoa(user.email)}?d=mp`} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{user.email}</p>
                    <p className="text-[11px] text-fg-muted">Tài khoản SSO huyab auth</p>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        )}
      </main>

      <BottomNav
        active={activeTab}
        onChange={(id) => setActiveTab(id as any)}
        items={[
          { id: 'stats', label: 'Stats', icon: BarChart3 },
          { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
          { id: 'configs', label: 'Instances', icon: ListTree },
          { id: 'settings', label: 'Settings', icon: Settings },
        ]}
      />


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

      <Modal
        open={!!viewingCron}
        onClose={() => setViewingCron(null)}
        title="Chi tiết Cron Job"
        footer={<Button onClick={() => setViewingCron(null)}>Đóng</Button>}
      >
        {viewingCron && (
          <div className="space-y-4">
            <Field label="Tên Cron">
              <div className="rounded-ui bg-surface-muted p-3 text-sm font-medium border border-border">
                {viewingCron.name}
              </div>
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Lần chạy tới">
                <div className="text-sm">{formatDateTime(viewingCron.nextcall)}</div>
              </Field>
              <Field label="Trạng thái">
                {viewingCron.active ? <Badge tone="success">Active</Badge> : <Badge />}
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Số lần chạy (Number)">
                <div className="text-sm">{viewingCron.numbercall}</div>
              </Field>
              <Field label="Định kỳ (Interval)">
                <div className="text-sm">{viewingCron.interval_number} {viewingCron.interval_type}</div>
              </Field>
            </div>
            {viewingCron.lastcall && (
              <Field label="Lần chạy cuối">
                <div className="text-sm">{formatDateTime(viewingCron.lastcall)}</div>
              </Field>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}
