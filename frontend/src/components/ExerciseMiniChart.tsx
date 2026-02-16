import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import type { ProgressEntry } from '../types'

interface ExerciseMiniChartProps {
  data: ProgressEntry[]
}

export default function ExerciseMiniChart({ data }: ExerciseMiniChartProps) {
  return (
    <div className="h-[120px]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
          <XAxis
            dataKey="date"
            stroke="#64748b"
            fontSize={9}
            tickLine={false}
            axisLine={false}
            tickFormatter={(value) => {
              const d = new Date(value)
              return `${d.getMonth() + 1}/${d.getDate()}`
            }}
          />
          <YAxis
            stroke="#64748b"
            fontSize={9}
            tickLine={false}
            axisLine={false}
            domain={['auto', 'auto']}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1e293b',
              border: '1px solid #334155',
              borderRadius: '8px',
              fontSize: '12px',
            }}
            labelStyle={{ color: '#f1f5f9' }}
            formatter={(value: number) => [`${value} kg`, 'Weight']}
            labelFormatter={(value) => new Date(value).toLocaleDateString()}
          />
          <Line
            type="monotone"
            dataKey="max_weight"
            stroke="#8b5cf6"
            strokeWidth={2}
            dot={{ fill: '#8b5cf6', strokeWidth: 0, r: 3 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
