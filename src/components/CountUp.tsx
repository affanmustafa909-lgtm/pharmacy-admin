import { useEffect, useRef, useState } from 'react'

interface CountUpProps {
  value: number
  prefix?: string
  decimals?: number
}

export function CountUp({ value, prefix = '', decimals = 0 }: CountUpProps) {
  const [display, setDisplay] = useState(0)
  const from = useRef(0)

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce) {
      setDisplay(value)
      from.current = value
      return
    }
    const start = performance.now()
    const origin = from.current
    const duration = 900
    let frame = 0
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration)
      const eased = 1 - (1 - progress) ** 3
      setDisplay(origin + (value - origin) * eased)
      if (progress < 1) frame = requestAnimationFrame(tick)
      else from.current = value
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [value])

  return (
    <>
      {prefix}
      {display.toLocaleString('en-US', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })}
    </>
  )
}
