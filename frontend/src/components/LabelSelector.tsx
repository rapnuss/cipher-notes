import {Divider, Drawer, Flex, Group, Paper, Stack, UnstyledButton} from '@mantine/core'
import {useSelector} from '../state/store'
import {
  deleteLabel,
  openCreateLabelDialog,
  openEditLabelDialog,
  labelSelected,
  toggleLabelSelector,
  selectCachedLabels,
} from '../state/labels'
import {IconPencil} from './icons/IconPencil'
import {IconTrash} from './icons/IconTrash'
import {IconPlus} from './icons/IconPlus'
import {
  darkColorsGradient,
  labelBgColor,
  labelBorderColor,
  lightColorsGradient,
} from '../business/misc'
import {IconX} from './icons/IconX'
import {Label, ThemeName} from '../business/models'
import {useCloseOnBack} from '../helpers/useCloseOnBack'
import {useMyColorScheme, useThemeName} from '../helpers/useMyColorScheme'
import {openConfirmModalWithBackHandler} from '../helpers/openConfirmModal'
import {ActionIconWithText} from './ActionIconWithText'
import {UUID} from 'crypto'

export const LabelSelector = () => {
  const {activeLabel, labelSelectorOpen} = useSelector((state) => state.labels)
  const labels = useSelector(selectCachedLabels)
  const theme = useThemeName()
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
            theme={theme}
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
      <Flex gap='xs'>
        <Paper
          shadow='md'
          ta='left'
          bd={activeLabel === 'all' ? '2px solid var(--mantine-color-bright)' : 'none'}
          p='xs'
          flex='1 1 0'
          style={{borderRadius: 'var(--mantine-radius-md)', outlineOffset: '2px'}}
          bg={colorScheme === 'dark' ? darkColorsGradient : lightColorsGradient}
          onClick={() => {
            labelSelected('all')
            toggleLabelSelector()
          }}
          component='button'
          title='Show all notes'
          className='special-label-selector-item'
        >
          All notes
        </Paper>
        <Paper
          shadow='md'
          ta='left'
          bd={activeLabel === 'unlabeled' ? '2px solid var(--mantine-color-bright)' : 'none'}
          p='xs'
          flex='1 1 0'
          style={{borderRadius: 'var(--mantine-radius-md)', outlineOffset: '2px'}}
          onClick={() => {
            labelSelected('unlabeled')
            toggleLabelSelector()
          }}
          bg='var(--mantine-color-body)'
          component='button'
          title='Show unlabeled notes'
          className='special-label-selector-item'
        >
          Unlabeled
        </Paper>
        <Paper
          shadow='md'
          ta='left'
          bd={activeLabel === 'archived' ? '2px solid var(--mantine-color-bright)' : 'none'}
          p='xs'
          flex='1 1 0'
          onClick={() => {
            labelSelected('archived')
            toggleLabelSelector()
          }}
          bg='var(--mantine-color-body)'
          component='button'
          title='Show archived notes'
          className='special-label-selector-item'
        >
          Archived
        </Paper>
      </Flex>
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
  theme: ThemeName
}

const LabelSelectorItem = ({active, theme, ...label}: LabelSelectorItemProps) => {
  const borderColor = labelBorderColor(label.hue, theme)
  const bgColor = labelBgColor(label.hue, theme)
  const themeHasBorder = theme === 'black' || theme === 'white'
  return (
    <Flex
      key={label.id}
      align='center'
      bd={
        themeHasBorder
          ? `2px solid ${borderColor}`
          : active
          ? '2px solid var(--mantine-color-bright)'
          : undefined
      }
      fw={themeHasBorder && active ? 'bold' : undefined}
      p='xs'
      style={{
        outlineOffset: '2px',
      }}
      bg={bgColor}
      className='label-selector-item'
    >
      <UnstyledButton
        flex={1}
        onClick={() => {
          labelSelected(label.id as UUID)
          toggleLabelSelector()
        }}
        title={`Select label ${label.name}`}
        style={{
          fontSize: themeHasBorder && active ? '1.2rem' : undefined,
          textDecoration: themeHasBorder && active ? 'underline' : undefined,
          textUnderlineOffset: '0.2rem',
          textDecorationThickness: '0.1rem',
        }}
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
}
