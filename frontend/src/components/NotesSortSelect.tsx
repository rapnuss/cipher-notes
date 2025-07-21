import {ActionIcon, Select} from '@mantine/core'
import {useSelector} from '../state/store'
import {sortChanged, sortDirectionChanged} from '../state/notes'
import {noteSortOptions, NoteSortProp} from '../business/models'
import {IconSortAscending} from './icons/IconSortAscending'
import {IconSortDescending} from './icons/IconSortDescending'

export const NotesSortSelect = () => {
  const {prop, desc} = useSelector((state) => state.notes.sort)
  return (
    <>
      <Select
        flex='0 0 auto'
        w='7rem'
        data={noteSortOptions}
        value={prop}
        title='Sort notes by'
        onChange={(value) => value && sortChanged(value as NoteSortProp)}
      />
      <ActionIcon
        size='input-sm'
        title={desc ? 'Sort ascending' : 'Sort descending'}
        onClick={sortDirectionChanged}
      >
        {desc ? <IconSortAscending /> : <IconSortDescending />}
      </ActionIcon>
    </>
  )
}
