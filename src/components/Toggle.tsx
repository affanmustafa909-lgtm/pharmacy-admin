interface ToggleProps {
  on: boolean
  label: string
  onClick: () => void
}

export function Toggle({ on, label, onClick }: ToggleProps) {
  return (
    <button type="button" className={on ? 'switch on' : 'switch'} role="switch" aria-checked={on} aria-label={label} onClick={onClick}>
      <i />
    </button>
  )
}
