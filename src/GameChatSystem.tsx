import { UserID, defineState, getMutableState } from '@ir-engine/hyperflux'
import { PlayerActions } from './GameSystem'
import { HealthActions } from './HealthSystem'
import { PickupActions } from './PickupSystem'

export type GameMessageType = 'join' | 'leave' | 'kill' | 'death' | 'respawn' | 'pickup'

export interface GameMessage {
  type: GameMessageType
  text: string
  timestamp: number
  userID: UserID
  targetUserID?: UserID
}

const createTextMessage = (type: GameMessageType) => {
  switch (type) {
    case 'join':
      return '${userID} has joined the game'
    case 'leave':
      return '${userID} has left the game'
    case 'kill':
      return '${userID} has killed ${targetUserID}'
    case 'death':
      return '${userID} has died'
    case 'respawn':
      return '${userID} has respawned'
    case 'pickup':
      return '${userID} has picked up an item'
  }
}

export const GameChatState = defineState({
  name: 'hexafield.fps-game.GameChatState',
  initial: {
    messages: [] as GameMessage[]
  },

  receptors: {
    onPlayerRespawn: HealthActions.respawn.receive((action) => {
      const state = getMutableState(GameChatState)

      const respawnMessage: GameMessage = {
        type: 'respawn',
        text: '${userID} has respawned',
        timestamp: action.$time,
        userID: action.userID
      }

      state.messages.merge([respawnMessage])
    }),

    onPlayerDie: HealthActions.die.receive((action) => {
      const state = getMutableState(GameChatState)

      const deathMessage: GameMessage = {
        type: 'death',
        text: '${userID} has died',
        timestamp: action.$time,
        userID: action.userID
      }

      state.messages.merge([deathMessage])
    }),

    onPlayerJoin: PlayerActions.playerJoined.receive((action) => {
      const state = getMutableState(GameChatState)

      const joinMessage: GameMessage = {
        type: 'join',
        text: '${userID} has joined the game',
        timestamp: action.$time,
        userID: action.userID
      }

      state.messages.merge([joinMessage])
    }),

    onPlayerLeave: PlayerActions.playerLeft.receive((action) => {
      const state = getMutableState(GameChatState)

      const leaveMessage: GameMessage = {
        type: 'leave',
        text: '${userID} has left the game',
        timestamp: action.$time,
        userID: action.userID
      }

      state.messages.merge([leaveMessage])
    }),

    onPickup: PickupActions.itemPickup.receive((action) => {
      const state = getMutableState(GameChatState)

      const pickupMessage: GameMessage = {
        type: 'pickup',
        text: action.pickupType === 'immunity' ? '${userID} is invincible! RUN!' : '${userID} is fully healed!',
        timestamp: action.$time,
        userID: action.$user
      }

      state.messages.merge([pickupMessage])
    }),

    onImmunityTimedout: HealthActions.immunityTimedout.receive((action) => {
      const state = getMutableState(GameChatState)

      const immunityTimedoutMessage: GameMessage = {
        type: 'pickup',
        text: '${userID} is no longer invincible! KILL THEM!',
        timestamp: action.$time,
        userID: action.userID
      }

      state.messages.merge([immunityTimedoutMessage])
    })
  }
})
