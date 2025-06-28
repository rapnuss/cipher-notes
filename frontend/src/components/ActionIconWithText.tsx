import {ActionIcon} from '@mantine/core'
import {CSSProperties, forwardRef, ReactNode} from 'react'

export type ActionIconWithTextProps = {
  text: ReactNode
  title?: string
  onClick?: () => void
  children: ReactNode
  disabled?: boolean
  style?: CSSProperties
  id?: string
  className?: string
}
export const ActionIconWithText = forwardRef<HTMLButtonElement, ActionIconWithTextProps>(
  ({children, title, text, disabled, style, onClick, id, className}, ref) => (
    <ActionIcon
      ref={ref}
      id={id}
      className={className}
      variant='default'
      size='input-md'
      title={title}
      disabled={disabled}
      style={style}
      onClick={onClick}
      styles={{
        icon: {
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        },
      }}
    >
      {children}
      <div
        style={{
          fontSize: '0.75rem',
          color: 'var(--mantine-color-dimmed)',
        }}
      >
        {text}
      </div>
    </ActionIcon>
  )
)
