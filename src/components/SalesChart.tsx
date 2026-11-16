import { useId } from 'react'
import type { MonthPoint } from '../types'

export function SalesChart({ data }: { data: MonthPoint[] }) {
  const rawId = useId().replace(/:/g, '')
  const max = Math.max(...data.flatMap((point) => [point.sales, point.returns]), 1)
  const width = 560
  const height = 168
  const slot = width / Math.max(data.length, 1)

  return (
    <svg className="chart" viewBox={`0 0 ${width} ${height + 28}`} role="img" aria-label="Sales and returns by month">
      <defs>
        <pattern id={rawId} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(32)">
          <rect width="6" height="6" fill="#ff4d3a" />
          <line x1="0" y1="0" x2="0" y2="6" stroke="rgba(255,255,255,0.45)" strokeWidth="2.2" />
        </pattern>
      </defs>
      {[0, 0.25, 0.5, 0.75, 1].map((step) => (
        <line
          key={step}
          x1="0"
          x2={width}
          y1={height - height * step}
          y2={height - height * step}
          stroke="currentColor"
          opacity="0.08"
        />
      ))}
      {data.map((point, index) => {
        const sales = (point.sales / max) * (height - 8)
        const returns = (point.returns / max) * (height - 8)
        const x = index * slot + slot / 2
        return (
          <g key={point.month}>
            <rect className="bar-col" x={x - 16} y={height - returns} width="12" height={returns} rx="4" fill="var(--bar)" style={{ animationDelay: `${index * 40}ms` }} />
            <rect className="bar-col" x={x} y={height - sales} width="14" height={sales} rx="4" fill={`url(#${rawId})`} style={{ animationDelay: `${index * 40 + 80}ms` }} />
            <text x={x} y={height + 18} textAnchor="middle" fontSize="11" fill="currentColor" opacity="0.55">
              {point.month}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
