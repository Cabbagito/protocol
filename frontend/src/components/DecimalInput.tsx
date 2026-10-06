import { forwardRef } from 'react'
import { sanitizeDecimal } from '../lib/decimal'

type DecimalInputProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'type' | 'inputMode' | 'value' | 'onChange'
> & {
  value: string
  onChange: (value: string) => void
}

/**
 * Text input with the decimal keypad. `type="number"` + parseFloat breaks on
 * "62,5", so this stays a text field and normalizes the separator itself.
 */
const DecimalInput = forwardRef<HTMLInputElement, DecimalInputProps>(function DecimalInput(
  { value, onChange, ...rest },
  ref,
) {
  return (
    <input
      ref={ref}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      {...rest}
      value={value}
      onChange={(e) => onChange(sanitizeDecimal(e.target.value))}
    />
  )
})

export default DecimalInput
