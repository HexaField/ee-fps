import {
  defineQuery,
  defineSystem,
  ECSState,
  EntityUUID,
  getComponent,
  getOptionalComponent,
  NetworkObjectComponent,
  UUIDComponent
} from '@ir-engine/ecs'
import { AvatarControllerComponent } from '@ir-engine/engine/src/avatar/components/AvatarControllerComponent'
import {
  defineAction,
  defineState,
  dispatchAction,
  getMutableState,
  getState,
  matches,
  matchesUserID,
  NetworkTopics,
  none,
  useHookstate
} from '@ir-engine/hyperflux'
import { PhysicsSystem, TransformComponent } from '@ir-engine/spatial'
import { CollisionComponent } from '@ir-engine/spatial/src/physics/components/CollisionComponent'
import { CollisionEvents } from '@ir-engine/spatial/src/physics/types/PhysicsTypes'
import { setVisibleComponent } from '@ir-engine/spatial/src/renderer/components/VisibleComponent'
import React, { useEffect } from 'react'
import { ObjectPrefabComponent } from './ObjectSystem'
import { playSoundEffect } from './SoundEffectSystem'

export const PickupActions = {
  itemPickup: defineAction({
    type: 'hexafield.fps-game.PickupActions.ITEM_PICKUP',
    userID: matchesUserID,
    pickupType: matches.string,
    pickupEntityUUID: matches.string as any as EntityUUID,
    respawnDelay: matches.number,
    value: matches.number,
    $cache: true,
    $topic: NetworkTopics.world
  }),

  pickupRespawned: defineAction({
    type: 'hexafield.fps-game.PickupActions.PICKUP_RESPAWNED',
    pickupEntityUUID: matches.string as any as EntityUUID,
    $cache: true,
    $topic: NetworkTopics.world
  }),

  pickupRemoved: defineAction({
    type: 'hexafield.fps-game.PickupActions.PICKUP_REMOVED',
    pickupEntityUUID: matches.string as any as EntityUUID,
    $cache: true,
    $topic: NetworkTopics.world
  })
}

export type PickupStateType = {
  active: boolean
  lastPickupTime: number
  respawnDelay: number // in milliseconds
}

export const PickupState = defineState({
  name: 'hexafield.fps-game.PickupState',
  initial: {} as Record<EntityUUID, PickupStateType>,

  receptors: {
    onPickupSpawned: ObjectPrefabComponent.action.receive((action) => {
      const pickupState = getMutableState(PickupState)
      pickupState[UUIDComponent.join(action)].set({
        active: true,
        lastPickupTime: 0,
        respawnDelay: 60000
      })
    }),

    onPickupCollected: PickupActions.itemPickup.receive((action) => {
      const pickupState = getMutableState(PickupState)
      pickupState[action.pickupEntityUUID].set({
        active: false,
        lastPickupTime: action.$time,
        respawnDelay: action.respawnDelay || 60000
      })
    }),

    onPickupRespawned: PickupActions.pickupRespawned.receive((action) => {
      const pickupState = getMutableState(PickupState)

      if (pickupState[action.pickupEntityUUID].value) {
        pickupState[action.pickupEntityUUID].active.set(true)
      }
    }),

    onPickupRemoved: PickupActions.pickupRemoved.receive((action) => {
      const pickupState = getMutableState(PickupState)

      if (pickupState[action.pickupEntityUUID].value) {
        pickupState[action.pickupEntityUUID].set(none)
      }
    })
  },

  reactor: () => {
    const pickupEntities = useHookstate(getMutableState(PickupState)).keys

    return (
      <>
        {pickupEntities.map((pickupEntityUUID: EntityUUID) => (
          <PickupReactor key={pickupEntityUUID} pickupEntityUUID={pickupEntityUUID} />
        ))}
      </>
    )
  }
})

const PickupReactor = (props: { pickupEntityUUID: EntityUUID }) => {
  const pickupState = useHookstate(getMutableState(PickupState)[props.pickupEntityUUID])

  useEffect(() => {
    const entity = UUIDComponent.getEntityByUUID(props.pickupEntityUUID)
    setVisibleComponent(entity, !!pickupState.value?.active)
  }, [pickupState.value.active])

  useEffect(() => {
    if (pickupState.value?.active) return

    const itemEntity = UUIDComponent.getEntityByUUID(props.pickupEntityUUID)
    const itemPrefab = getComponent(itemEntity, ObjectPrefabComponent)

    const transform = getComponent(itemEntity, TransformComponent)
    playSoundEffect(itemPrefab.type === 'health' ? 'heal' : 'powerup', {
      position: transform.position,
      volume: 0.8
    })
  }, [pickupState.value.active])

  return null
}

const itemCollisionQuery = defineQuery([ObjectPrefabComponent, CollisionComponent, UUIDComponent])

const execute = () => {
  const now = getState(ECSState).simulationTime
  const pickupStates = getState(PickupState)

  for (const [pickupEntityUUID, state] of Object.entries(pickupStates)) {
    if (!state.active && state.lastPickupTime + state.respawnDelay < now) {
      dispatchAction(
        PickupActions.pickupRespawned({
          pickupEntityUUID: pickupEntityUUID as EntityUUID
        })
      )
    }
  }

  for (const itemEntity of itemCollisionQuery()) {
    const itemEntityUUID = UUIDComponent.get(itemEntity)
    const pickupState = pickupStates[itemEntityUUID]

    if (pickupState && !pickupState.active) continue

    const collisionComponent = getComponent(itemEntity, CollisionComponent)

    for (const [otherEntity, hit] of collisionComponent) {
      if (hit.type !== CollisionEvents.TRIGGER_START) continue

      if (!getOptionalComponent(otherEntity, AvatarControllerComponent)) continue

      const networkObj = getOptionalComponent(otherEntity, NetworkObjectComponent)
      if (!networkObj) continue

      const userID = networkObj.ownerId
      const itemPrefab = getComponent(itemEntity, ObjectPrefabComponent)

      dispatchAction(
        PickupActions.itemPickup({
          userID,
          pickupType: itemPrefab.type,
          pickupEntityUUID: itemEntityUUID,
          respawnDelay: 5000,
          value:
            itemPrefab.type === 'immunity' ? 10000 : 100 /** @todo put these values on the pickup prefab component */
        })
      )
    }
  }
}

export const ItemPickupSystem = defineSystem({
  uuid: 'ItemPickupSystem',
  insert: { with: PhysicsSystem },
  execute
})
