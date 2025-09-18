import '@ir-engine/client-core/src/world/LocationModule'
import '@ir-engine/client/src/engine'

import React, { lazy } from 'react'

import { Authenticate } from '@ir-engine/client-core/src/user/services/Authenticate'

const Play = lazy(() => import('./Play'))

export default function Main() {
  return (
    <Authenticate>
      <Play />
    </Authenticate>
  )
}
