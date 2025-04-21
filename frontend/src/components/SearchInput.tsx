import {TextInput} from '@mantine/core'
import {useSelector} from '../state/store'
import {noteQueryChanged} from '../state/notes'
import {IconSearch} from './icons/IconSearch'

export const SearchInput = () => {
  const query = useSelector((state) => state.notes.query)
  return (
    <TextInput
      flex='0 1 auto'
      value={query}
      onChange={(e) => noteQueryChanged(e.target.value)}
      rightSection={<IconSearch />}
      title='Search notes'
    />
  )
}
