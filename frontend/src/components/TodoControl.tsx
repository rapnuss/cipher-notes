import {Divider, Flex, Stack, UnstyledButton} from '@mantine/core'
import {Todo, Todos} from '../business/models'
import {useEffect, useMemo, useRef, useState} from 'react'
import {draggable, dropTargetForElements} from '@atlaskit/pragmatic-drag-and-drop/element/adapter'
import {
  attachClosestEdge,
  Edge,
  extractClosestEdge,
} from '@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge'
import {getReorderDestinationIndex} from '@atlaskit/pragmatic-drag-and-drop-hitbox/util/get-reorder-destination-index'
import {IconGridDots} from './icons/IconGridDots'
import {IconTrash} from './icons/IconTrash'
import {IconPlus} from './icons/IconPlus'
import {AutoResizingTextarea} from './AutoResizingTextarea'
import {FancyCheckbox} from './FancyCheckbox'

export type TodoControlProps = {
  todos: Todos
  onTodoChecked?: (index: number, checked: boolean) => void
  onTodoChanged?: (index: number, txt: string) => void
  onInsertTodo?: (bellow: number) => void
  onTodoDeleted?: (index: number) => void
  onUndo?: () => void
  onRedo?: () => void
  onUp?: () => void
  onMoveTodo?: (source: number, target: number) => void
}
export const TodoControl = ({
  todos,
  onTodoChecked,
  onTodoChanged,
  onInsertTodo,
  onTodoDeleted,
  onUndo,
  onRedo,
  onUp,
  onMoveTodo,
}: TodoControlProps) => (
  <Stack flex={1} style={{overflowY: 'auto', paddingTop: '1px'}} gap={0}>
    {todos.map((todo, i) =>
      todo.done ? null : (
        <TodoItem
          key={i}
          todo={todo}
          i={i}
          onTodoChecked={onTodoChecked}
          onTodoChanged={onTodoChanged}
          onInsertTodo={onInsertTodo}
          onTodoDeleted={todos.length === 1 ? undefined : onTodoDeleted}
          onUndo={onUndo}
          onRedo={onRedo}
          onUp={onUp}
          onMoveTodo={onMoveTodo}
        />
      )
    )}
    {!!onInsertTodo && (
      <Flex justify='end'>
        <UnstyledButton title='Add todo' onClick={() => onInsertTodo(todos.length - 1)}>
          <IconPlus />
        </UnstyledButton>
      </Flex>
    )}
    <Divider m='5px 0' />
    {todos.map((todo, i) =>
      todo.done ? (
        <TodoItem
          key={i}
          todo={todo}
          i={i}
          onTodoChecked={onTodoChecked}
          onTodoDeleted={onTodoDeleted}
        />
      ) : null
    )}
  </Stack>
)

const TodoItem = ({
  todo,
  i,
  onTodoChecked,
  onTodoChanged,
  onInsertTodo,
  onTodoDeleted,
  onUndo,
  onRedo,
  onUp,
  onMoveTodo,
}: {
  todo: Todo
  i: number
  onTodoChecked?: (index: number, checked: boolean) => void
  onTodoChanged?: (index: number, txt: string) => void
  onInsertTodo?: (bellow: number) => void
  onTodoDeleted?: (index: number) => void
  onUndo?: () => void
  onRedo?: () => void
  onUp?: () => void
  onMoveTodo?: (source: number, target: number) => void
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const handleRef = useRef<HTMLDivElement>(null)
  const [highlightedEdge, setHighlightedEdge] = useState<Edge | null>(null)
  const data = useMemo(() => ({i}), [i])

  useEffect(() => {
    const draggableCleanup = draggable({
      element: containerRef.current!,
      dragHandle: handleRef.current!,
      getInitialData: () => data,
      canDrag: () => !todo.done,
    })
    const dropTargetCleanup = dropTargetForElements({
      element: containerRef.current!,
      canDrop: () => !todo.done,
      getData({input}) {
        return attachClosestEdge(data, {
          element: containerRef.current!,
          input,
          allowedEdges: ['top', 'bottom'],
        })
      },
      onDrag({self, source}) {
        if (self.element === source.element) return
        setHighlightedEdge(extractClosestEdge(self.data))
      },
      onDragLeave() {
        setHighlightedEdge(null)
      },
      onDrop({self, source}) {
        setHighlightedEdge(null)
        if (
          source.data.i !== self.data.i &&
          typeof source.data.i === 'number' &&
          typeof self.data.i === 'number'
        ) {
          const edge = extractClosestEdge(self.data)
          const dest = getReorderDestinationIndex({
            startIndex: source.data.i,
            closestEdgeOfTarget: edge,
            indexOfTarget: self.data.i,
            axis: 'vertical',
          })
          if (source.data.i !== dest) {
            onMoveTodo?.(source.data.i, dest)
          }
        }
      },
    })
    return () => {
      draggableCleanup()
      dropTargetCleanup()
    }
  }, [i, todo.done, data, onMoveTodo])

  return (
    <Flex
      ref={containerRef}
      align='center'
      p='2px 0'
      gap={0}
      className='todo-list-item'
      pos='relative'
    >
      <div ref={handleRef} style={{padding: '0 12px 0 0'}}>
        <IconGridDots style={{display: 'block', opacity: todo.done ? 0.2 : 0.5}} />
      </div>
      <FancyCheckbox
        tabIndex={onTodoChecked ? undefined : -1}
        checked={todo.done}
        readOnly={!onTodoChecked}
        onChange={(e) => onTodoChecked?.(i, e.target.checked)}
        style={{
          height: '1.35rem',
          width: '1.35rem',
        }}
      />
      <AutoResizingTextarea
        tabIndex={onTodoChanged ? undefined : -1}
        placeholder='To do...'
        style={{flex: 1}}
        rows={1}
        textareaStyles={{
          border: 'none',
          outline: 'none',
          backgroundColor: 'transparent',
          textDecoration: todo.done ? 'line-through' : 'none',
          resize: 'none',
        }}
        value={todo.txt}
        disabled={todo.done}
        readOnly={!onTodoChanged}
        onChange={(e) => onTodoChanged?.(i, e.target.value)}
        onKeyDown={(e) => {
          if (
            i === 0 &&
            e.currentTarget.selectionStart === 0 &&
            (e.key === 'Backspace' || e.key === 'ArrowUp')
          ) {
            e.preventDefault()
            onUp?.()
          }
          if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
            e.preventDefault()
            if (e.shiftKey) {
              onRedo?.()
            } else {
              onUndo?.()
            }
          }
          if ((e.metaKey || e.ctrlKey) && e.key === 'y') {
            e.preventDefault()
            onRedo?.()
          }
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            onInsertTodo?.(i)
            const target = e.currentTarget
            Promise.resolve().then(() => {
              target
                .closest('.todo-list-item')
                ?.nextElementSibling?.querySelector('textarea')
                ?.focus()
            })
          }
          if (e.key === 'Backspace' && todo.txt === '') {
            e.preventDefault()
            e.currentTarget
              .closest('.todo-list-item')
              ?.previousElementSibling?.querySelector('textarea')
              ?.focus()
            onTodoDeleted?.(i)
          }
          const target = e.currentTarget
          if (e.key === 'ArrowDown' && target.selectionEnd === todo.txt.length) {
            target
              .closest('.todo-list-item')
              ?.nextElementSibling?.querySelector('textarea')
              ?.focus()
          }
          if (e.key === 'ArrowUp' && target.selectionEnd === 0) {
            target
              .closest('.todo-list-item')
              ?.previousElementSibling?.querySelector('textarea')
              ?.focus()
          }
        }}
      />
      {!!onTodoDeleted && (
        <UnstyledButton title='Delete todo' onClick={() => onTodoDeleted(i)}>
          <IconTrash />
        </UnstyledButton>
      )}
      <DropIndicator edge={highlightedEdge} />
    </Flex>
  )
}

const DropIndicator = ({edge}: {edge: Edge | null}) =>
  edge !== null &&
  (edge === 'top' || edge === 'bottom') && (
    <div
      style={{
        position: 'absolute',
        top: edge === 'top' ? 0 : undefined,
        left: 0,
        right: 0,
        bottom: edge === 'bottom' ? 0 : undefined,
        border: '2px solid var(--mantine-primary-color-filled)',
        transform: edge === 'top' ? 'translateY(-1px)' : 'translateY(1px)',
      }}
    />
  )
