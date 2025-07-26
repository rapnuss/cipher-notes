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
  loading?: boolean
  // Accept any data-* props
  [key: `data-${string}`]: any
}
export const ActionIconWithText = forwardRef<HTMLButtonElement, ActionIconWithTextProps>(
  ({children, title, text, disabled, style, onClick, id, className, loading, ...rest}, ref) => (
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
      loading={loading}
      styles={{
        icon: {
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        },
      }}
      {...rest}
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

export type ActionIconLinkProps = {
  href: string
  filename?: string
  title?: string
  text?: string
  children?: ReactNode
  target?: '_blank' | '_self' | '_parent' | '_top'
}
export const ActionIconLink = forwardRef<HTMLAnchorElement, ActionIconLinkProps>(
  ({children, title, text, href, filename, target}, ref) => (
    <ActionIcon
      component='a'
      href={href}
      download={filename}
      ref={ref}
      variant='default'
      size='input-md'
      title={title}
      target={target}
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
