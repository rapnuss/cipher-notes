import {ActionIcon, Button, Group, Modal, TextInput, useComputedColorScheme} from '@mantine/core'
import {useSelector} from '../state/store'
import {
  closeLabelDialog,
  createLabel,
  labelDialogHueChanged,
  labelDialogNameChanged,
  updateLabel,
} from '../state/labels'
import {hueOptions} from '../business/models'
import {labelColor} from '../business/misc'

export const LabelDialog = () => {
  const {hue, name, open, id} = useSelector((state) => state.labels.dialog)
  const colorScheme = useComputedColorScheme()
  return (
    <Modal
      opened={open}
      onClose={closeLabelDialog}
      title={id ? 'Edit Label' : 'Create Label'}
      closeButtonProps={{title: 'Close dialog'}}
    >
      <TextInput
        label='Name'
        value={name}
        onChange={(e) => labelDialogNameChanged(e.target.value)}
      />
      <Group my='md' gap='xs'>
        {hueOptions.map((h) => (
          <ActionIcon
            key={String(h)}
            size='lg'
            variant={'default'}
            style={{
              border: h === hue ? '2px solid var(--mantine-color-bright)' : 'none',
              outline: 'none',
            }}
            id={String(h)}
            onClick={() => labelDialogHueChanged(h)}
            c='var(--mantine-color-text)'
            bg={labelColor(h, colorScheme === 'dark')}
            aria-label={`Select hue ${h ?? 'none'}`}
          >
            {h === null ? '-' : h}
          </ActionIcon>
        ))}
      </Group>
      <Button onClick={() => (id ? updateLabel(id, {name, hue}) : createLabel(name, hue))}>
        {id ? 'Update' : 'Create'}
      </Button>
    </Modal>
  )
}
