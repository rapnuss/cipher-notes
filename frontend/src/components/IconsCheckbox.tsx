import {ChangeEvent, CSSProperties} from 'react'
import {IconCheckbox} from './icons/IconCheckbox'
import {IconSquare} from './icons/IconSquare'
import classes from './IconsCheckbox.module.css'

export type IconsCheckboxProps = {
  tabIndex?: number
  readOnly?: boolean
  checked?: boolean
  onChange?: (e: ChangeEvent<HTMLInputElement>) => void
  disabled?: boolean
  style?: CSSProperties
}
export const IconsCheckbox = ({
  checked,
  onChange,
  disabled,
  style,
  tabIndex,
  readOnly,
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
    />
    {checked ? <IconCheckbox /> : <IconSquare />}
  </label>
)
