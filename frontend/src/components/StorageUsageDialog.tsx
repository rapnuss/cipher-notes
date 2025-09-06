import {Group, Loader, Modal, Progress, Stack, Text, Tooltip} from '@mantine/core'
import {useSelector} from '../state/store'
import {closeStorageUsageDialog} from '../state/storageUsage'
import {useCloseOnBack} from '../helpers/useCloseOnBack'

const formatBytes = (bytes: number): string => {
  if (!Number.isFinite(bytes)) return `${bytes}`
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let idx = 0
  let val = bytes
  while (val >= 1024 && idx < units.length - 1) {
    val = val / 1024
    idx++
  }
  return `${val.toFixed(2)} ${units[idx]}`
}

export const StorageUsageDialog = () => {
  const {open, fetching, calculating, local, remote} = useSelector((s) => s.storageUsage)
  const loggedIn = useSelector((s) => s.user.user.loggedIn)

  useCloseOnBack({id: 'storage-usage-dialog', open, onClose: closeStorageUsageDialog})

  const localPct = local ? Math.min(100, (local.used / Math.max(1, local.limit)) * 100) : 0
  const filesPct = remote
    ? Math.min(100, (remote.files.used / Math.max(1, remote.files.limit)) * 100)
    : 0
  const notesPct = remote
    ? Math.min(100, (remote.notes.used / Math.max(1, remote.notes.limit)) * 100)
    : 0

  return (
    <Modal opened={open} onClose={closeStorageUsageDialog} title='Storage Usage'>
      <Stack gap='md'>
        <Stack gap={4} style={{opacity: calculating ? 0.7 : 1}}>
          <Group justify='space-between'>
            <Text fw={500}>Local storage</Text>
            <Text size='sm' c='dimmed'>
              {local ? `${formatBytes(local.used)} / ${formatBytes(local.limit)}` : '—'}
            </Text>
          </Group>
          <Group gap='xs' align='center'>
            <Progress style={{flex: 1}} value={local ? localPct : 0} />
            {calculating && (
              <Tooltip label='Calculating'>
                <Loader size='xs' type='dots' />
              </Tooltip>
            )}
          </Group>
        </Stack>

        {loggedIn && (
          <>
            <Stack gap={4} style={{opacity: fetching ? 0.7 : 1}}>
              <Group justify='space-between'>
                <Text fw={500}>Remote files</Text>
                <Text size='sm' c='dimmed'>
                  {remote
                    ? `${formatBytes(remote.files.used)} / ${formatBytes(remote.files.limit)}`
                    : '—'}
                </Text>
              </Group>
              <Group gap='xs' align='center'>
                <Progress style={{flex: 1}} value={remote ? filesPct : 0} color='cyan' />
                {fetching && (
                  <Tooltip label='Fetching'>
                    <Loader size='xs' type='dots' />
                  </Tooltip>
                )}
              </Group>
            </Stack>

            <Stack gap={4} style={{opacity: fetching ? 0.7 : 1}}>
              <Group justify='space-between'>
                <Text fw={500}>Remote notes</Text>
                <Text size='sm' c='dimmed'>
                  {remote
                    ? `${formatBytes(remote.notes.used)} / ${formatBytes(remote.notes.limit)}`
                    : '—'}
                </Text>
              </Group>
              <Group gap='xs' align='center'>
                <Progress style={{flex: 1}} value={remote ? notesPct : 0} color='grape' />
                {fetching && (
                  <Tooltip label='Fetching'>
                    <Loader size='xs' type='dots' />
                  </Tooltip>
                )}
              </Group>
            </Stack>
          </>
        )}
      </Stack>
    </Modal>
  )
}
