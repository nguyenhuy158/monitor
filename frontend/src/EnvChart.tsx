import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

export type EnvChartDatum = { name: string; delayed: number; color: string }

export default function EnvChart({ data }: { data: EnvChartDatum[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
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
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
