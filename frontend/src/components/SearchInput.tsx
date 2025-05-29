import {TextInput, UnstyledButton} from '@mantine/core'
import {useSelector} from '../state/store'
import {noteQueryChanged} from '../state/notes'
import {IconSearch} from './icons/IconSearch'
import {IconX} from './icons/IconX'

export const SearchInput = () => {
  const query = useSelector((state) => state.notes.query)
  const activeLabel = useSelector((state) => state.labels.activeLabel)
  const labels = useSelector((state) => state.labels.labelsCache)
  return (
    <TextInput
      flex='0 1 auto'
      value={query}
      onChange={(e) => noteQueryChanged(e.target.value)}
      placeholder={
        'Search ' +
        (activeLabel === null
          ? 'all notes'
          : activeLabel === false
          ? 'unlabeled'
          : labels[activeLabel]?.name)
      }
      rightSection={
        query.length === 0 ? (
          <IconSearch />
        ) : (
          <UnstyledButton display='flex' onClick={() => noteQueryChanged('')}>
            <IconX />
          </UnstyledButton>
        )
      }
    />
  )
}
