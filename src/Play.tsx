import '@ir-engine/client-core/src/world/LocationModule'
import '@ir-engine/client/src/engine'

import { useThemeProvider } from '@ir-engine/client-core/src/common/services/ThemeService'
import Debug from '@ir-engine/client-core/src/components/Debug'
import { useNetwork } from '@ir-engine/client-core/src/components/World/EngineHooks'
import { useLoadLocation } from '@ir-engine/client-core/src/components/World/LoadLocationScene'
import { useSpatialEngine } from '@ir-engine/spatial/src/initializeEngine'
import { useEngineCanvas } from '@ir-engine/spatial/src/renderer/functions/useEngineCanvas'
import React, { useRef } from 'react'

import './BulletEffectSystem'
import './GameChatSystem'
import GameChatUI from './GameChatUI'
import './GameSystem'
import './HealthSystem'
import './MusicSystem'
import './ObjectSystem'
import './PickupEffectSystem'
import './PickupSystem'
import './SoundEffectSystem'
import './StatsState'
import { StatsUI } from './StatsState'
import './WeaponSystem'

export default function Play() {
  const ref = useRef<HTMLElement>(document.body)

  useThemeProvider()

  useSpatialEngine()
  useEngineCanvas(ref)
  useNetwork({ online: true })
  useLoadLocation({ locationName: 'fps' })

  return (
    <>
      <Debug />
      <GameChatUI />
      <StatsUI />
    </>
  )
}
