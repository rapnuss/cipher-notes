import {io} from 'socket.io-client'
import {socketConnectionChanged} from './state/user'

const socket = io({
  withCredentials: true,
  autoConnect: false,
  reconnection: true,
  transports: ['polling'],
})
socket.on('connect_error', (err) => {
  console.error('socket connect_error', err)
})
socket.on('connect', () => socketConnectionChanged(true))
socket.on('disconnect', () => socketConnectionChanged(false))

export default socket
