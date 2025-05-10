import {Divider, Flex, Stack, UnstyledButton} from '@mantine/core'
import {Todo, Todos} from '../business/models'
import {Fragment, useEffect, useMemo, useRef, useState} from 'react'
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

export type TodoControlProps = {
  todos: Todos
  onTodoChecked?: (index: number, checked: boolean) => void
  onTodoChanged?: (index: number, txt: string) => void
  onInsertTodo?: (bellow: number) => void
  onTodoDeleted?: (index: number) => void
  onUndo?: () => void
  onRedo?: () => void
  onUp?: () => void
  onMoveTodo?: typeof moveTodo
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
}: TodoControlProps) => {
  const {idToTodo, idToIndex, parentToChildIds, parentToChildrenDone} = deriveTodosData(todos)
  return (
    <Stack flex={1} style={{overflowY: 'auto', paddingTop: '1px'}} gap={0}>
      {todos.map((todo, i) =>
        todo.done || todo.parent ? null : (
          <Fragment key={`${i}undone`}>
            <TodoItem
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
            {parentToChildIds[todo.id] &&
              parentToChildIds[todo.id]!.map(
                (childId) =>
                  !idToTodo[childId]!.done && (
                    <TodoItem
                      key={childId}
                      todo={idToTodo[childId]!}
                      i={idToIndex[childId]!}
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
          </Fragment>
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
      {todos.map((todo, i) => {
        return todo.parent ||
          (!todo.done && !(todo.id in parentToChildrenDone)) ||
          (!todo.done && parentToChildrenDone[todo.id] === 'none') ? null : (
          <Fragment key={`${i}done`}>
            <TodoItem
              todo={todo}
              i={i}
              onTodoChecked={onTodoChecked}
              onTodoDeleted={todo.done ? onTodoDeleted : undefined}
              ghost={!todo.done}
            />
            {parentToChildIds[todo.id] &&
              parentToChildIds[todo.id]!.map(
                (childId) =>
                  idToTodo[childId]!.done && (
                    <TodoItem
                      key={childId}
                      todo={idToTodo[childId]!}
                      i={idToIndex[childId]!}
                      onTodoChecked={onTodoChecked}
                      onTodoDeleted={onTodoDeleted}
                    />
                  )
              )}
          </Fragment>
        )
      })}
    </Stack>
  )
}

const TodoItem = ({
  todo,
  i,
  ghost,
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
  ghost?: boolean
  onTodoChecked?: (index: number, checked: boolean) => void
  onTodoChanged?: (index: number, txt: string) => void
  onInsertTodo?: (bellow: number) => void
  onTodoDeleted?: (index: number) => void
  onUndo?: () => void
  onRedo?: () => void
  onUp?: () => void
  onMoveTodo?: typeof moveTodo
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const handleRef = useRef<HTMLDivElement>(null)
  const [dragState, setDragState] = useState<{
    edge: Edge | null
    indented: boolean
  } | null>(null)
  const data = useMemo(() => ({i}), [i])

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
      getData({input, element}) {
        let dataWithEdge = attachClosestEdge(data, {
          element: containerRef.current!,
          input,
          allowedEdges: ['top', 'bottom'],
        })
        const rect = element.getBoundingClientRect()
        const xInTarget = input.clientX - rect.left
        return {
          ...dataWithEdge,
          indented: (i !== 0 || extractClosestEdge(dataWithEdge) === 'bottom') && xInTarget > 32,
        }
      },
      onDrag({self}) {
        setDragState({
          edge: extractClosestEdge(self.data),
          indented: !!self.data.indented,
        })
      },
      onDragLeave() {
        setDragState(null)
      },
      onDrop({self, source}) {
        setDragState(null)
        if (typeof source.data.i === 'number' && typeof self.data.i === 'number') {
          const edge = extractClosestEdge(self.data)
          if (edge !== 'top' && edge !== 'bottom') {
            return
          }
          onMoveTodo?.({
            dragIndex: source.data.i,
            dropIndex: self.data.i,
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
  }, [i, todo.done, data, onMoveTodo, ghost])

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
          onChange={(e) => onTodoChecked?.(i, e.target.checked)}
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
