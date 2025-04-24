import {Checkbox, Stack, UnstyledButton, TextInput, ActionIcon, Group} from '@mantine/core'
import {useLiveQuery} from 'dexie-react-hooks'
import {useState} from 'react'
import {useSelector} from '../state/store'
import {db} from '../db'
import {IconSearch} from './icons/IconSearch'
import {IconX} from './icons/IconX'
import {toggleNoteLabel, selectCachedLabels, setNoteMainLabel, applyNewLabel} from '../state/labels'
import {IconCrown} from './icons/IconCrown'
import {IconPlus} from './icons/IconPlus'

export type LabelDropdownContentProps = {
  noteId: string
}
export const LabelDropdownContent = ({noteId}: LabelDropdownContentProps) => {
  const [search, setSearch] = useState('')
  const labels = useSelector(selectCachedLabels)
  const checkedLabels: string[] =
    useLiveQuery(() => db.notes.get(noteId).then((note) => note?.labels ?? []), [noteId]) ?? []
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
          size='lg'
          disabled={search.length === 0}
          onClick={() => applyNewLabel(noteId, search)}
          mb='1px'
          title='Apply new label'
        >
          <IconPlus />
        </ActionIcon>
      </Group>
      <Stack mah={200} style={{overflowY: 'auto'}} mt='md' gap='md'>
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
                      onClick={() => setNoteMainLabel(noteId, label.id)}
                      title='Set as main label (effects color)'
                    >
                      <IconCrown />
                    </ActionIcon>
                  )}
                </>
              }
              checked={checkedLabels.includes(label.id)}
              onChange={() => toggleNoteLabel(noteId, label.id)}
              size='md'
            />
          ))}
      </Stack>
    </>
  )
}
