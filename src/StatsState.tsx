import { EngineState } from '@ir-engine/ecs'
import {
  UserID,
  defineState,
  getMutableState,
  getState,
  none,
  useHookstate,
  useMutableState
} from '@ir-engine/hyperflux'
import { ReferenceSpaceState } from '@ir-engine/spatial'
import { InputComponent } from '@ir-engine/spatial/src/input/components/InputComponent'
import React, { useEffect, useState } from 'react'
import { PlayerActions } from './GameSystem'
import { HealthActions } from './HealthSystem'

export type PlayerStats = {
  kills: number
  deaths: number

  lastDamagedBy: UserID | null
}

export const StatsState = defineState({
  name: 'hexafield.fps-game.StatsState',
  initial: {} as Record<UserID, PlayerStats>,

  receptors: {
    onPlayerJoin: PlayerActions.playerJoined.receive((action) => {
      getMutableState(StatsState)[action.userID].set({
        kills: 0,
        deaths: 0,
        lastDamagedBy: null
      })
    }),

    onPlayerLeave: PlayerActions.playerLeft.receive((action) => {
      if (getState(StatsState)[action.userID]) {
        getMutableState(StatsState)[action.userID].set(none)
      }
    }),

    onTakeDamage: HealthActions.takeDamage.receive((action) => {
      if (action.amount < 0) {
        const attackerID = action.$user

        if (attackerID && attackerID !== action.userID) {
          getMutableState(StatsState)[action.userID].lastDamagedBy.set(attackerID)
        }
      }
    }),

    onPlayerDie: HealthActions.die.receive((action) => {
      if (getState(StatsState)[action.userID]) {
        getMutableState(StatsState)[action.userID].deaths.set((deaths) => deaths + 1)
      }

      const lastDamagedBy = getState(StatsState)[action.userID]?.lastDamagedBy

      if (lastDamagedBy && getState(StatsState)[lastDamagedBy]) {
        getMutableState(StatsState)[lastDamagedBy].kills.set((kills) => kills + 1)
      }
    })
  }
})

export const StatsUI = () => {
  const stats = useMutableState(StatsState)
  const localUserID = getState(EngineState).userID
  const [isVisible, setIsVisible] = useState(false)
  const viewerEntity = useHookstate(getState(ReferenceSpaceState).viewerEntity).value

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Tab') {
        event.preventDefault()
        setIsVisible(true)
      }
    }

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.key === 'Tab') {
        event.preventDefault()
        setIsVisible(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [])

  useEffect(() => {
    if (!viewerEntity) return

    const checkTabKey = () => {
      const buttons = InputComponent.getMergedButtons(viewerEntity)
      setIsVisible(!!buttons.Tab?.pressed)
    }

    const intervalId = setInterval(checkTabKey, 16)
    return () => clearInterval(intervalId)
  }, [viewerEntity])

  if (!isVisible) {
    return (
      <div className="absolute right-2.5 top-2.5 z-[1000] rounded bg-black/30 p-1.5 font-sans text-xs text-white">
        Hold Tab for Stats
      </div>
    )
  }

  return (
    <div className="absolute right-2.5 top-2.5 z-[1000] min-w-[200px] rounded bg-black/50 p-2.5 font-sans text-white">
      <div className="mb-2.5 text-center text-lg font-bold">Player Stats</div>
      <div className="mb-2 text-center text-xs text-gray-400">Release Tab to hide</div>
      {stats.keys.map((userID: UserID) => {
        const playerStats = stats[userID].value
        const isLocalPlayer = userID === localUserID

        return (
          <div key={userID} className="mb-1.5 flex justify-between">
            <span className={`font-bold ${isLocalPlayer ? 'text-[#ffcc00]' : 'text-white'}`}>
              {isLocalPlayer ? 'You' : userID.substring(0, 8)}
            </span>
            <span>
              K: {playerStats.kills} / D: {playerStats.deaths}
            </span>
          </div>
        )
      })}
    </div>
  )
}
