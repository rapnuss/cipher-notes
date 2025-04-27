import {FC, InputHTMLAttributes, useId} from 'react'
import styles from './FancyCheckbox.module.css'

export interface FancyCheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  /** Optional label text; if omitted, renders only the checkbox */
  label?: string
  id?: string
}

export const FancyCheckbox: FC<FancyCheckboxProps> = ({
  label,
  id,
  checked,
  defaultChecked,
  onChange,
  className,
  style,
  ...rest
}) => {
  const autoId = useId()
  const inputId = id || `fancy-cb-${autoId}`

  return (
    <div className={`${styles.wrapper} ${className || ''}`} style={style}>
      <label htmlFor={inputId} className={styles.label}>
        <input
          {...rest}
          type='checkbox'
          id={inputId}
          checked={checked}
          defaultChecked={defaultChecked}
          onChange={onChange}
          className={styles.input}
        />
        <span className={styles.cbx} aria-hidden='true'>
          <svg width='12px' height='11px' viewBox='0 0 12 11'>
            <polyline points='1 6.29411765 4.5 10 11 1' />
          </svg>
        </span>
        {label && <span className={styles.text}>{label}</span>}
      </label>
    </div>
  )
}
