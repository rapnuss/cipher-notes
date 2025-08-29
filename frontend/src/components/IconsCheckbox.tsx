import {ChangeEvent, CSSProperties} from 'react'
import {IconCheckbox} from './icons/IconCheckbox'
import {IconSquare} from './icons/IconSquare'
import {IconSquareMinus} from './icons/IconSquareMinus'
import {UnstyledButton} from '@mantine/core'
import classes from './IconsCheckbox.module.css'

export type IconsCheckboxProps = {
  tabIndex?: number
  readOnly?: boolean
  checked?: boolean
  onChange?: (e: ChangeEvent<HTMLInputElement>) => void
  disabled?: boolean
  style?: CSSProperties
  'aria-labelledby'?: string
}
export const IconsCheckbox = ({
  checked,
  onChange,
  disabled,
  style,
  tabIndex,
  readOnly,
  'aria-labelledby': ariaLabelledBy,
}: IconsCheckboxProps) => (
  <label className={classes.label} style={style}>
    <input
      type='checkbox'
      className={classes.input}
      checked={checked}
      onChange={onChange}
      disabled={disabled}
      tabIndex={tabIndex}
      readOnly={readOnly}
      aria-labelledby={ariaLabelledBy}
    />
    {checked ? <IconCheckbox /> : <IconSquare />}
  </label>
)

export type CrazyCheckboxProps = {
  initialChecked: boolean | 'indeterminate'
  updatedChecked: boolean | 'unchanged'
  onChange: (checked: boolean | 'unchanged') => void
  disabled?: boolean
  style?: CSSProperties
  label: string
} & {[Key in `data-${string}`]?: string}
export const CrazyCheckbox = ({
  initialChecked,
  updatedChecked,
  onChange,
  disabled = false,
  style,
  label,
  ...props
}: CrazyCheckboxProps) => {
  const ariaChecked =
    updatedChecked === 'unchanged'
      ? initialChecked === 'indeterminate'
        ? 'mixed'
        : initialChecked
      : updatedChecked

  const toggle = () => {
    if (disabled) return
    else if (initialChecked === false && updatedChecked === 'unchanged') onChange(true)
    else if (initialChecked === false && updatedChecked === true) onChange('unchanged')
    else if (initialChecked === false && updatedChecked === false) onChange(true)
    else if (initialChecked === true && updatedChecked === 'unchanged') onChange(false)
    else if (initialChecked === true && updatedChecked === true) onChange(false)
    else if (initialChecked === true && updatedChecked === false) onChange('unchanged')
    else if (initialChecked === 'indeterminate' && updatedChecked === 'unchanged') onChange(true)
    else if (initialChecked === 'indeterminate' && updatedChecked === true) onChange(false)
    else if (initialChecked === 'indeterminate' && updatedChecked === false) onChange('unchanged')
  }

  let Icon
  if (ariaChecked === true) Icon = IconCheckbox
  else if (ariaChecked === 'mixed') Icon = IconSquareMinus
  else Icon = IconSquare

  return (
    <UnstyledButton
      role='checkbox'
      aria-checked={ariaChecked}
      aria-disabled={disabled}
      disabled={disabled}
      onClick={toggle}
      className={classes.crazyCheckbox}
      style={{
        opacity: disabled || updatedChecked === 'unchanged' ? 0.5 : undefined,
        ...style,
      }}
      {...props}
    >
      <Icon aria-hidden='true' />
      {label}
    </UnstyledButton>
  )
}
