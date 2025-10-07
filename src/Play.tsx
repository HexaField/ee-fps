import '@ir-engine/client-core/src/world/LocationModule'
import '@ir-engine/client/src/engine'

import { useThemeProvider } from '@ir-engine/client-core/src/common/services/ThemeService'
import Debug from '@ir-engine/client-core/src/components/Debug'
import { useLoadLocation } from '@ir-engine/client-core/src/components/World/LoadLocationScene'
import { useSpatialEngine } from '@ir-engine/spatial/src/initializeEngine'
import { useEngineCanvas } from '@ir-engine/spatial/src/renderer/functions/useEngineCanvas'
import React, { useEffect, useRef } from 'react'

import './Game'

import './BulletEffectSystem'
import './GameChatSystem'
import './MusicSystem'
import './PickupEffectSystem'
import './SoundEffectSystem'
import './StatsState'

import { getMutableState, NetworkState } from '@ir-engine/hyperflux'
import GameChatUI from './GameChatUI'
import { StatsUI } from './StatsState'

export default function Play() {
  const ref = useRef<HTMLElement>(document.body)

  useThemeProvider()

  useSpatialEngine()
  useEngineCanvas(ref)
  useLoadLocation({ locationName: 'fps' })
  

  useEffect(() => {
    getMutableState(NetworkState).config.set({
      world: true,
      media: true,
      friends: true,
      instanceID: true,
      roomID: false
    })
  }, [])

  return (
    <>
      <Debug />
      <GameChatUI />
      <StatsUI />
    </>
  )
}
