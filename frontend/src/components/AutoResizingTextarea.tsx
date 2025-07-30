import {TextareaHTMLAttributes, useRef, useLayoutEffect, FC, FormEvent, CSSProperties} from 'react'
import classes from './AutoResizingTextarea.module.css'

export type AutoResizingTextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  textareaStyles?: CSSProperties
}

export const AutoResizingTextarea: FC<AutoResizingTextareaProps> = (props) => {
  const {onInput, textareaStyles, style, autoFocus, ...rest} = props
  const wrapperRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useLayoutEffect(() => {
    if (wrapperRef.current && textareaRef.current) {
      wrapperRef.current.dataset.replicatedValue = textareaRef.current.value + ' '
    }
  }, [])

  const handleInput = (e: FormEvent<HTMLTextAreaElement>) => {
    const value = e.currentTarget.value + ' '
    if (wrapperRef.current) {
      wrapperRef.current.dataset.replicatedValue = value
    }
    onInput?.(e)
  }

  return (
    <div ref={wrapperRef} className={classes.growWrap} style={style}>
      <textarea
        {...rest}
        ref={textareaRef}
        onInput={handleInput}
        className={classes.textarea}
        style={textareaStyles}
        autoFocus={autoFocus}
        data-autofocus={autoFocus ? true : undefined}
      />
    </div>
  )
}
