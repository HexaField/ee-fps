import { isClient } from '@ir-engine/hyperflux'
import './Game'

export default async function () {
  if (isClient) {
    ;(await import('./editor/index')).default()
  }
}
