import {endpointsFactory} from '../endpointsFactory'
import {z} from 'zod'

export const helloEndpoint = endpointsFactory.build({
  method: 'get',
  output: z.object({message: z.string()}),
  handler: async ({}) => {
    return {message: 'Hello, world!'}
  },
})
