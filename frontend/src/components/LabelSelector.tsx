import {
  ActionIcon,
  Box,
  Divider,
  Drawer,
  Flex,
  Group,
  Paper,
  Stack,
  UnstyledButton,
} from '@mantine/core'
import {useSelector} from '../state/store'
import {
  deleteLabel,
  openCreateLabelDialog,
  openEditLabelDialog,
  labelSelected,
  toggleLabelSelector,
  allLabelsSelected,
  unlabeledSelected,
  selectCachedLabels,
} from '../state/labels'
import {IconPencil} from './icons/IconPencil'
import {IconTrash} from './icons/IconTrash'
import {IconPlus} from './icons/IconPlus'
import {darkColorsGradient, labelColor, lightColorsGradient} from '../business/misc'
import {IconX} from './icons/IconX'
import {Label} from '../business/models'
import {useCloseOnBack} from '../helpers/useCloseOnBack'
import {useMyColorScheme} from '../helpers/useMyColorScheme'
import {openConfirmModalWithBackHandler} from '../helpers/openConfirmModal'
import {ActionIconWithText} from './ActionIconWithText'

export const LabelSelector = () => {
  const {activeLabel, labelSelectorOpen} = useSelector((state) => state.labels)
  const labels = useSelector(selectCachedLabels)
  const colorScheme = useMyColorScheme()
  useCloseOnBack({
    id: 'label-selector',
    open: labelSelectorOpen,
    onClose: toggleLabelSelector,
  })
  return (
    <Drawer
      opened={labelSelectorOpen}
      withCloseButton={false}
      onClose={toggleLabelSelector}
      styles={{
        content: {position: 'relative', overflowY: 'hidden'},
        body: {height: '100%', display: 'flex', flexDirection: 'column'},
      }}
    >
      <Stack gap='xs' style={{overflowY: 'auto'}} flex={1}>
        {labels.map((label) => (
          <LabelSelectorItem
            key={label.id}
            active={activeLabel === label.id}
            darkMode={colorScheme === 'dark'}
            {...label}
          />
        ))}
        <div style={{paddingBottom: '3rem'}} />
      </Stack>
      <div style={{position: 'relative', overflow: 'visible'}}>
        <ActionIconWithText
          style={{position: 'absolute', bottom: '4px', right: '4px'}}
          text='new'
          onClick={openCreateLabelDialog}
          title='Create new label'
        >
          <IconPlus />
        </ActionIconWithText>
      </div>
      <Divider mb='md' mt='xs' />
      <Stack gap='xs'>
        <Box
          ta='left'
          bd={activeLabel === null ? '2px solid var(--mantine-color-bright)' : 'none'}
          p='xs'
          style={{borderRadius: 'var(--mantine-radius-md)', outlineOffset: '2px'}}
          bg={colorScheme === 'dark' ? darkColorsGradient : lightColorsGradient}
          onClick={() => {
            allLabelsSelected()
            toggleLabelSelector()
          }}
          component='button'
          title='Show all notes'
        >
          All notes
        </Box>
        <Paper
          shadow='md'
          ta='left'
          bd={activeLabel === false ? '2px solid var(--mantine-color-bright)' : 'none'}
          p='xs'
          style={{borderRadius: 'var(--mantine-radius-md)', outlineOffset: '2px'}}
          onClick={() => {
            unlabeledSelected()
            toggleLabelSelector()
          }}
          bg='var(--mantine-color-body)'
          component='button'
          title='Show unlabeled notes'
        >
          Unlabeled
        </Paper>
      </Stack>
      <Flex justify='space-between' pt='md'>
        Labels
        <UnstyledButton title='Close label selector' onClick={toggleLabelSelector}>
          <IconX />
        </UnstyledButton>
      </Flex>
    </Drawer>
  )
}

type LabelSelectorItemProps = Label & {
  active: boolean
  darkMode: boolean
}

const LabelSelectorItem = ({active, darkMode, ...label}: LabelSelectorItemProps) => (
  <Flex
    key={label.id}
    align='center'
    bd={active ? '2px solid var(--mantine-color-bright)' : 'none'}
    p='xs'
    style={{borderRadius: 'var(--mantine-radius-md)', outlineOffset: '2px'}}
    bg={labelColor(label.hue, darkMode)}
  >
    <UnstyledButton
      flex={1}
      onClick={() => {
        labelSelected(label.id)
        toggleLabelSelector()
      }}
      title={`Select label ${label.name}`}
    >
      {label.name}
    </UnstyledButton>
    <Group>
      <UnstyledButton
        onClick={(e) => {
          e.stopPropagation()
          openEditLabelDialog(label.id)
        }}
        title={`Edit label ${label.name}`}
      >
        <IconPencil />
      </UnstyledButton>
      <UnstyledButton
        onClick={(e) => {
          e.stopPropagation()
          openConfirmModalWithBackHandler({
            id: `delete-label-${label.id}`,
            title: 'Delete Label',
            children: 'Are you sure you want to delete this label?',
            labels: {confirm: 'Delete', cancel: 'Cancel'},
            onConfirm: () => deleteLabel(label.id),
          })
        }}
        title={`Delete label ${label.name}`}
      >
        <IconTrash />
      </UnstyledButton>
    </Group>
  </Flex>
)
