import {modals} from '@mantine/modals'
import {FnProps} from '../util/type'
import {closeOnBack, removeBrowserHistory} from './useCloseOnBack'

export type OpenConfirmModalProps = Pick<
  FnProps<(typeof modals)['openConfirmModal']>,
  'title' | 'onConfirm' | 'labels' | 'children' | 'id' | 'confirmProps'
> & {
  id: string
}

export const openConfirmModalWithBackHandler = ({
  id,
  title,
  onConfirm,
  labels,
  children,
  confirmProps,
}: OpenConfirmModalProps) => {
  let cleanup: () => void
  const modalId = modals.openConfirmModal({
    title,
    onConfirm,
    labels,
    children,
    confirmProps,
    centered: true,
    onClose: () => {
      cleanup()
      removeBrowserHistory(id)
    },
  })
  cleanup = closeOnBack(id, () => {
    modals.close(modalId)
  })
}
