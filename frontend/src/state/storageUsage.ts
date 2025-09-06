import {notifications} from '@mantine/notifications'
import {isUnauthorizedRes, reqStorageUsage} from '../services/backend'
import {getState, setState} from './store'

export type StorageUsageState = {
  open: boolean
  fetching: boolean
  calculating: boolean
  local: {
    used: number
    limit: number
  } | null
  remote: {
    files: {
      used: number
      limit: number
    }
    notes: {
      used: number
      limit: number
    }
  } | null
}

export const storageUsageInit: StorageUsageState = {
  open: false,
  fetching: false,
  calculating: false,
  local: null,
  remote: null,
}

export const calcLocalStorageUsage = async () => {
  setState((state) => {
    state.storageUsage.calculating = true
  })
  const {quota, usage} = await navigator.storage.estimate()
  setState((state) => {
    state.storageUsage.calculating = false
  })
  if (quota === undefined || usage === undefined) {
    return
  }
  setState((state) => {
    state.storageUsage.local = {
      used: usage,
      limit: quota,
    }
  })
}

export const fetchStorageUsage = async () => {
  setState((state) => {
    state.storageUsage.fetching = true
  })
  const res = await reqStorageUsage()
  if (res.success) {
    setState((state) => {
      state.storageUsage.remote = res.data
    })
  } else {
    notifications.show({
      title: 'Failed to fetch storage usage',
      message: res.error,
      color: 'red',
    })
    if (isUnauthorizedRes(res)) {
      setState((state) => {
        state.user.user.loggedIn = false
      })
    }
  }
  setState((state) => {
    state.storageUsage.fetching = false
  })
}

export const openStorageUsageDialog = () => {
  const state = getState()
  if (state.storageUsage.open) return
  setState((s) => {
    s.storageUsage.open = true
  })
  queueMicrotask(calcLocalStorageUsage)
  if (state.user.user.loggedIn) {
    queueMicrotask(fetchStorageUsage)
  }
}

export const closeStorageUsageDialog = () => {
  setState((state) => {
    state.storageUsage.open = false
  })
}
