import { EngineState } from '@ir-engine/ecs'
import { getState, isClient } from '@ir-engine/hyperflux'

export default async function () {
  if (isClient && getState(EngineState).isEditor) {
    // for editor
    ;(await import('./editor/index')).default()
  } else {
    // for instance server
    await import('./Game')
  }
}
