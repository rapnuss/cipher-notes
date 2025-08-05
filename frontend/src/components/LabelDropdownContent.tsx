import {Checkbox, Stack, UnstyledButton, TextInput, ActionIcon, Group} from '@mantine/core'
import {useLiveQuery} from 'dexie-react-hooks'
import {useEffect, useState} from 'react'
import {useSelector} from '../state/store'
import {db} from '../db'
import {IconSearch} from './icons/IconSearch'
import {IconX} from './icons/IconX'
import {
  toggleNoteLabel,
  selectCachedLabels,
  setNoteMainLabel,
  applyNewLabel,
  setFileMainLabel,
  toggleFileLabel,
} from '../state/labels'
import {IconCrown} from './icons/IconCrown'
import {IconPlus} from './icons/IconPlus'
import {applyBulkLabels, selectSelectionActive} from '../state/selection'
import {CrazyCheckbox} from './IconsCheckbox'
import {ActionIconWithText} from './ActionIconWithText'
import {IconChecks} from './icons/IconChecks'

export type LabelDropdownContentProps = {
  noteId?: string
  fileId?: string
}
export const LabelDropdownContent = ({noteId, fileId}: LabelDropdownContentProps) => {
  const [search, setSearch] = useState('')
  const labels = useSelector(selectCachedLabels)
  const checkedLabels: string[] =
    useLiveQuery(
      () =>
        noteId
          ? db.notes.get(noteId).then((note) => note?.labels ?? [])
          : fileId
          ? db.files_meta.get(fileId).then((file) => file?.labels ?? [])
          : [],
      [noteId, fileId]
    ) ?? []
  return (
    <>
      <Group align='end' gap='xs'>
        <TextInput
          autoFocus
          flex={1}
          label='Label'
          placeholder='Search or create label'
          rightSection={
            <UnstyledButton
              style={{display: 'flex', alignItems: 'center', justifyContent: 'center'}}
              disabled={search.length === 0}
              title='Clear search'
              onClick={() => setSearch('')}
            >
              {search.length === 0 ? <IconSearch /> : <IconX />}
            </UnstyledButton>
          }
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <ActionIcon
          size='input-sm'
          disabled={search.length === 0}
          onClick={() => {
            if (noteId) {
              applyNewLabel(noteId, search, 'note')
            } else if (fileId) {
              applyNewLabel(fileId, search, 'file')
            }
            setSearch('')
          }}
          title='Apply new label'
        >
          <IconPlus />
        </ActionIcon>
      </Group>
      <Stack h={160} style={{overflowY: 'auto'}} mt='md' gap='md'>
        {labels
          .filter((label) => label.name.toLowerCase().includes(search.toLowerCase()))
          .map((label) => (
            <Checkbox
              key={label.id}
              styles={{
                root: {
                  display: 'flex',
                },
                body: {
                  flex: 1,
                  width: '100%',
                  alignItems: 'center',
                },
                labelWrapper: {
                  flex: 1,
                },
                label: {
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  height: '1.75rem',
                },
              }}
              label={
                <>
                  {label.name}
                  {!checkedLabels.includes(label.id) ||
                  checkedLabels.length <= 1 ? undefined : label.id === checkedLabels[0] ? (
                    <IconCrown
                      onClick={(e) => {
                        e.stopPropagation()
                        e.preventDefault()
                      }}
                    />
                  ) : (
                    <ActionIcon
                      opacity={0.5}
                      size='md'
                      variant='outline'
                      color='gray'
                      onClick={() =>
                        noteId
                          ? setNoteMainLabel(noteId, label.id)
                          : fileId
                          ? setFileMainLabel(fileId, label.id)
                          : undefined
                      }
                      title='Set as main label (effects color)'
                    >
                      <IconCrown />
                    </ActionIcon>
                  )}
                </>
              }
              checked={checkedLabels.includes(label.id)}
              onChange={() =>
                noteId
                  ? toggleNoteLabel(noteId, label.id)
                  : fileId
                  ? toggleFileLabel(fileId, label.id)
                  : undefined
              }
              size='md'
            />
          ))}
      </Stack>
    </>
  )
}

export const BulkLabelDropdownContent = ({opened}: {opened: boolean}) => {
  const [search, setSearch] = useState('')
  const [updatedLabelState, setUpdatedLabelState] = useState<Record<string, boolean | 'unchanged'>>(
    {}
  )
  const labels = useSelector(selectCachedLabels)
  const selected = useSelector((state) => state.selection.selected)
  const selectionActive = useSelector(selectSelectionActive)
  const initialLabelState = useLiveQuery<Record<string, boolean | 'indeterminate'>>(async () => {
    const selIds = Object.keys(selected)
    if (selIds.length === 0) {
      return {}
    }
    const selectedNotes = await db.notes.bulkGet(selIds)
    const selectedFiles = await db.files_meta.bulkGet(selIds)
    const selectedRecords = [...selectedNotes, ...selectedFiles].filter((rec) => rec !== undefined)
    const initialLabelState: Record<string, boolean | 'indeterminate'> = {}
    for (const rec of selectedRecords) {
      const recLabels = new Set<string>(rec.labels)
      for (const lable of labels) {
        const has = recLabels.has(lable.id)
        if (initialLabelState[lable.id] === 'indeterminate') {
          // pass
        } else if (
          (initialLabelState[lable.id] === true && !has) ||
          (initialLabelState[lable.id] === false && has)
        ) {
          initialLabelState[lable.id] = 'indeterminate'
        } else if (has) {
          initialLabelState[lable.id] = true
        } else {
          initialLabelState[lable.id] = false
        }
      }
    }
    return initialLabelState
  }, [selected, labels])

  useEffect(() => {
    setUpdatedLabelState({})
    setSearch('')
  }, [opened, selectionActive])

  if (!initialLabelState || !selectionActive) {
    return null
  }
  return (
    <>
      <Group align='end' gap='xs'>
        <TextInput
          autoFocus
          flex={1}
          label='Label'
          placeholder='Search or create label'
          rightSection={
            <UnstyledButton
              style={{display: 'flex', alignItems: 'center', justifyContent: 'center'}}
              disabled={search.length === 0}
              title='Clear search'
              onClick={() => setSearch('')}
            >
              {search.length === 0 ? <IconSearch /> : <IconX />}
            </UnstyledButton>
          }
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <ActionIcon
          size='input-sm'
          disabled={search.length === 0}
          onClick={() => {
            setSearch('')
          }}
          title='Apply new label'
        >
          <IconPlus />
        </ActionIcon>
      </Group>
      <Stack h={160} style={{overflowY: 'auto'}} mt='md' gap='md' pos='relative'>
        {labels
          .filter((label) => label.name.toLowerCase().includes(search.toLowerCase()))
          .map((label) => (
            <CrazyCheckbox
              key={label.id}
              initialChecked={initialLabelState[label.id] ?? 'indeterminate'}
              updatedChecked={updatedLabelState[label.id] ?? 'unchanged'}
              onChange={(updated) => {
                setUpdatedLabelState((prev) => ({...prev, [label.id]: updated}))
              }}
              label={label.name}
            />
          ))}
      </Stack>
      <ActionIconWithText
        style={{position: 'absolute', right: '.5rem', bottom: '.5rem', zIndex: 1}}
        text='apply'
        title='Apply labels to selected items'
        onClick={() => applyBulkLabels(updatedLabelState)}
      >
        <IconChecks />
      </ActionIconWithText>
    </>
  )
}
