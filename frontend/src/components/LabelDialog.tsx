import {ActionIcon, Button, Group, Modal, TextInput} from '@mantine/core'
import {useSelector} from '../state/store'
import {
  closeLabelDialog,
  createLabel,
  labelDialogHueChanged,
  labelDialogNameChanged,
  updateLabel,
} from '../state/labels'
import {hueOptions} from '../business/models'
import {labelBgColor, labelBorderColor} from '../business/misc'
import {useCloseOnBack} from '../helpers/useCloseOnBack'
import {useThemeName} from '../helpers/useMyColorScheme'

export const LabelDialog = () => {
  const {hue, name, open, id} = useSelector((state) => state.labels.dialog)
  const theme = useThemeName()
  const isMinimalTheme = theme === 'white' || theme === 'black'
  useCloseOnBack({
    id: 'label-dialog',
    open,
    onClose: closeLabelDialog,
  })
  return (
    <Modal opened={open} onClose={closeLabelDialog} title={id ? 'Edit Label' : 'Create Label'}>
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
              border: !isMinimalTheme
                ? h === hue
                  ? '2px solid var(--mantine-color-bright)'
                  : undefined
                : `2px solid ${labelBorderColor(h, theme)}`,
              outline: !isMinimalTheme
                ? undefined
                : h === hue
                ? `2px solid ${labelBorderColor(h, theme)}`
                : undefined,
            }}
            id={String(h)}
            onClick={() => labelDialogHueChanged(h)}
            c='var(--mantine-color-text)'
            bg={labelBgColor(h, theme)}
            title={`Select hue ${h ?? 'none'}`}
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
