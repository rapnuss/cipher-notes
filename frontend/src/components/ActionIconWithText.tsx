import {ActionIcon} from '@mantine/core'
import {CSSProperties, forwardRef, ReactNode} from 'react'

export type ActionIconWithTextProps = {
  text: string
  title?: string
  onClick?: () => void
  children: ReactNode
  disabled?: boolean
  style?: CSSProperties
}
export const ActionIconWithText = forwardRef<HTMLButtonElement, ActionIconWithTextProps>(
  ({children, title, text, disabled, style, onClick}, ref) => (
    <ActionIcon
      ref={ref}
      variant='default'
      size='xl'
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
