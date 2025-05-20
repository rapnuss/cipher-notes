import {Divider, Flex, Stack, UnstyledButton} from '@mantine/core'
import {Todo, Todos} from '../business/models'
import {useEffect, useMemo, useRef, useState} from 'react'
import {draggable, dropTargetForElements} from '@atlaskit/pragmatic-drag-and-drop/element/adapter'
import {
  attachClosestEdge,
  Edge,
  extractClosestEdge,
} from '@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge'
import {IconGridDots} from './icons/IconGridDots'
import {IconTrash} from './icons/IconTrash'
import {IconPlus} from './icons/IconPlus'
import {AutoResizingTextarea} from './AutoResizingTextarea'
import {IconsCheckbox} from './IconsCheckbox'
import {IconSquareMinus} from './icons/IconSquareMinus'
import {moveTodo} from '../state/notes'
import {deriveTodosData} from '../business/misc'
import {last} from '../util/misc'

export type TodoControlProps = {
  todos: Todos
  onTodoChecked?: (id: string, checked: boolean) => void
  onTodoChanged?: (id: string, txt: string) => void
  onInsertTodo?: (bellowId?: string) => void
  onTodoDeleted?: (id: string) => void
  onUndo?: () => void
  onRedo?: () => void
  onUp?: () => void
  onMoveTodo?: typeof moveTodo
  onMoveTodoByOne?: (id: string, direction: 'up' | 'down') => void
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
  onMoveTodoByOne,
}: TodoControlProps) => {
  const {idToTodo, visualOrderUndone, visualOrderDone} = deriveTodosData(todos)
  return (
    <Stack flex={1} style={{overflowY: 'auto', paddingTop: '1px'}} gap={0}>
      {visualOrderUndone.map((id, visualIndex) => (
        <TodoItem
          key={`${id}undone`}
          todo={idToTodo[id]!}
          visualIndex={visualIndex}
          onTodoChecked={onTodoChecked}
          onTodoChanged={onTodoChanged}
          onInsertTodo={onInsertTodo}
          onTodoDeleted={todos.length === 1 ? undefined : onTodoDeleted}
          onUndo={onUndo}
          onRedo={onRedo}
          onUp={onUp}
          onMoveTodo={onMoveTodo}
          onMoveTodoByOne={onMoveTodoByOne}
        />
      ))}
      {!!onInsertTodo && (
        <Flex justify='end'>
          <UnstyledButton
            title='Add todo'
            onClick={() => {
              onInsertTodo(last(todos)?.id)
            }}
          >
            <IconPlus />
          </UnstyledButton>
        </Flex>
      )}
      <Divider m='5px 0' />
      {visualOrderDone.map((id) => {
        const todo = idToTodo[id]!
        return (
          <TodoItem
            key={`${id}done`}
            todo={todo}
            onTodoChecked={onTodoChecked}
            onTodoDeleted={todo.done ? onTodoDeleted : undefined}
            ghost={!todo.done && !todo.parent}
          />
        )
      })}
    </Stack>
  )
}

const TodoItem = ({
  todo,
  visualIndex,
  ghost,
  onTodoChecked,
  onTodoChanged,
  onInsertTodo,
  onTodoDeleted,
  onUndo,
  onRedo,
  onUp,
  onMoveTodo,
  onMoveTodoByOne,
}: {
  todo: Todo
  visualIndex?: number
  ghost?: boolean
  onTodoChecked?: (id: string, checked: boolean) => void
  onTodoChanged?: (id: string, txt: string) => void
  onInsertTodo?: (bellowId?: string, parentId?: string) => void
  onTodoDeleted?: (id: string) => void
  onUndo?: () => void
  onRedo?: () => void
  onUp?: () => void
  onMoveTodo?: typeof moveTodo
  onMoveTodoByOne?: (id: string, direction: 'up' | 'down') => void
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const handleRef = useRef<HTMLDivElement>(null)
  const [dragState, setDragState] = useState<{
    edge: Edge | null
    indented: boolean
  } | null>(null)
  const data = useMemo(() => ({id: todo.id, visualIndex}), [todo.id, visualIndex])

  useEffect(() => {
    const draggableCleanup = draggable({
      element: containerRef.current!,
      dragHandle: handleRef.current!,
      getInitialData: () => data,
      canDrag: () => !todo.done && !ghost,
    })
    const dropTargetCleanup = dropTargetForElements({
      element: containerRef.current!,
      canDrop: () => !todo.done && !ghost,
      getData({input, element, source}) {
        let dataWithEdge = attachClosestEdge(data, {
          element: containerRef.current!,
          input,
          allowedEdges: ['top', 'bottom'],
        })
        const rect = element.getBoundingClientRect()
        const xInTarget = input.clientX - rect.left
        const edge = extractClosestEdge(dataWithEdge)
        const sourceVisualIndex = Number(source.data.visualIndex)
        return {
          ...dataWithEdge,
          indented: (visualIndex !== 0 || edge === 'bottom') && xInTarget > 32,
          insertInSameSlot:
            source.data.id === todo.id ||
            visualIndex === undefined ||
            (edge === 'top'
              ? sourceVisualIndex === visualIndex - 1
              : sourceVisualIndex === visualIndex + 1),
        }
      },
      onDrag({self}) {
        const indented = !!self.data.indented
        const insertInSameSlot = !!self.data.insertInSameSlot
        const edge = extractClosestEdge(self.data)
        setDragState(
          insertInSameSlot && indented === !!todo.parent
            ? null
            : {
                edge,
                indented,
              }
        )
      },
      onDragLeave() {
        setDragState(null)
      },
      onDrop({self, source}) {
        setDragState(null)
        if (typeof source.data.id === 'string' && typeof self.data.id === 'string') {
          const edge = extractClosestEdge(self.data)
          if (edge !== 'top' && edge !== 'bottom') {
            return
          }
          onMoveTodo?.({
            dragId: source.data.id,
            dropId: self.data.id,
            closestEdge: edge,
            indent: !!self.data.indented,
          })
        }
      },
    })
    return () => {
      draggableCleanup()
      dropTargetCleanup()
    }
  }, [todo.done, data, onMoveTodo, ghost, visualIndex, todo.parent, todo.id])

  return (
    <Flex
      ref={containerRef}
      align='center'
      p='2px 0'
      gap={0}
      className='todo-list-item'
      pos='relative'
      style={{opacity: ghost ? 0.5 : 1}}
    >
      <div ref={handleRef} style={{padding: '0 .75rem 0 0', marginLeft: todo.parent ? '2rem' : 0}}>
        <IconGridDots style={{display: 'block', opacity: todo.done ? 0.2 : 0.5}} />
      </div>
      {ghost ? (
        <IconSquareMinus />
      ) : (
        <IconsCheckbox
          tabIndex={onTodoChecked ? undefined : -1}
          checked={todo.done}
          readOnly={!onTodoChecked}
          onChange={(e) => onTodoChecked?.(todo.id, e.target.checked)}
          style={{marginRight: '.25rem'}}
        />
      )}
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
        onChange={(e) => onTodoChanged?.(todo.id, e.target.value)}
        onKeyDown={(e) => {
          const target = e.currentTarget
          if (
            visualIndex === 0 &&
            target.selectionStart === 0 &&
            (e.key === 'Backspace' || e.key === 'ArrowUp')
          ) {
            e.preventDefault()
            onUp?.()
          } else if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
            e.preventDefault()
            if (e.shiftKey) {
              onRedo?.()
            } else {
              onUndo?.()
            }
          } else if ((e.metaKey || e.ctrlKey) && e.key === 'y') {
            e.preventDefault()
            onRedo?.()
          } else if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            onInsertTodo?.(todo.id, todo.parent)
            Promise.resolve().then(() => {
              target
                .closest('.todo-list-item')
                ?.nextElementSibling?.querySelector('textarea')
                ?.focus()
            })
          } else if (e.key === 'Backspace' && todo.txt === '') {
            e.preventDefault()
            target
              .closest('.todo-list-item')
              ?.previousElementSibling?.querySelector('textarea')
              ?.focus()
            onTodoDeleted?.(todo.id)
          } else if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && e.altKey) {
            e.preventDefault()
            onMoveTodoByOne?.(todo.id, e.key === 'ArrowUp' ? 'up' : 'down')
          } else if (e.key === 'ArrowDown' && target.selectionEnd === todo.txt.length) {
            target
              .closest('.todo-list-item')
              ?.nextElementSibling?.querySelector('textarea')
              ?.focus()
          } else if (e.key === 'ArrowUp' && target.selectionEnd === 0) {
            target
              .closest('.todo-list-item')
              ?.previousElementSibling?.querySelector('textarea')
              ?.focus()
          } else if (e.key === 'I' && e.shiftKey && e.altKey) {
            e.preventDefault()
            onMoveTodo?.({
              dragId: todo.id,
              dropId: todo.id,
              closestEdge: 'top',
              indent: !todo.parent,
            })
          }
        }}
      />
      {!!onTodoDeleted && (
        <UnstyledButton title='Delete todo' onClick={() => onTodoDeleted(todo.id)}>
          <IconTrash />
        </UnstyledButton>
      )}
      <DropIndicator edge={dragState?.edge ?? null} indented={dragState?.indented ?? false} />
    </Flex>
  )
}

const DropIndicator = ({edge, indented}: {edge: Edge | null; indented: boolean}) =>
  (edge === 'top' || edge === 'bottom') && (
    <div
      style={{
        position: 'absolute',
        top: edge === 'top' ? 0 : undefined,
        left: indented ? '2rem' : 0,
        right: 0,
        bottom: edge === 'bottom' ? 0 : undefined,
        border: '2px solid var(--mantine-primary-color-filled)',
        transform: edge === 'top' ? 'translateY(-1px)' : 'translateY(1px)',
      }}
    />
  )
