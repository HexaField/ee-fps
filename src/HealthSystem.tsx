import {
  EngineState,
  Entity,
  EntityID,
  EntityTreeComponent,
  EntityUUID,
  SourceID,
  UUIDComponent,
  createEntity,
  defineSystem,
  entityExists,
  getComponent,
  removeEntity,
  setComponent
} from '@ir-engine/ecs'
import { respawnAvatar } from '@ir-engine/engine/src/avatar/functions/respawnAvatar'
import {
  NetworkState,
  NetworkTopics,
  Schema,
  UserID,
  defineAction,
  defineState,
  dispatchAction,
  getMutableState,
  getState,
  isClient,
  none,
  useHookstate,
  useMutableState
} from '@ir-engine/hyperflux'
import { PhysicsSystem, ReferenceSpaceState, TransformComponent } from '@ir-engine/spatial'
import { NameComponent } from '@ir-engine/spatial/src/common/NameComponent'
import { Vector3_Up, Vector3_Zero } from '@ir-engine/spatial/src/common/constants/MathConstants'
import { playSoundEffect } from './SoundEffectSystem'

import { MeshComponent } from '@ir-engine/spatial/src/renderer/components/MeshComponent'
import { VisibleComponent, setVisibleComponent } from '@ir-engine/spatial/src/renderer/components/VisibleComponent'
import { ComputedTransformComponent } from '@ir-engine/spatial/src/transform/components/ComputedTransformComponent'
import { ObjectFitFunctions } from '@ir-engine/spatial/src/transform/functions/ObjectFitFunctions'

import React, { useEffect } from 'react'
import { DoubleSide, Matrix4, Mesh, PlaneGeometry, Quaternion, ShaderMaterial, Uniform, Vector2, Vector3 } from 'three'
import { PlayerActions } from './GameSystem'
import { PickupActions } from './PickupSystem'

export const HealthActions = {
  takeDamage: defineAction(
    Schema.Object(
      {
        userID: Schema.UserID(),
        amount: Schema.Number()
      },
      {
        $id: 'hexafield.fps-game.HealthActions.TAKE_DAMAGE',
        metadata: {
          $topic: NetworkTopics.world
        }
      }
    )
  ),
  die: defineAction(
    Schema.Object(
      {
        userID: Schema.UserID()
      },
      {
        $id: 'hexafield.fps-game.HealthActions.DIE',
        metadata: {
          $topic: NetworkTopics.world
        }
      }
    )
  ),
  respawn: defineAction(
    Schema.Object(
      {
        userID: Schema.UserID()
      },
      {
        $id: 'hexafield.fps-game.HealthActions.RESPAWN',
        metadata: {
          $topic: NetworkTopics.world
        }
      }
    )
  ),
  immunityTimedout: defineAction(
    Schema.Object(
      {
        userID: Schema.UserID()
      },
      {
        $id: 'hexafield.fps-game.HealthActions.IMMUNITY_TIMEDOUT',
        metadata: {
          $topic: NetworkTopics.world
        }
      }
    )
  )
}

/**
 * Validate that the action is being performed by the host peer on server-authoritative mode
 */
const validateHealthChange = (action: {
  $network: string | undefined
  $peer: string
  userID: string
  $user: string
}) => {
  // if no network, we dispatched it, thus we can assume it's valid
  if (!action.$network) return true
  const network = getState(NetworkState).networks[action.$network]
  if (!network) return false
  return network.hostPeerID ? action.$peer === network.hostPeerID : true
}

export const HealthState = defineState({
  name: 'hexafield.fps-game.HealthState',
  initial: {} as Record<UserID, { lives: number; health: number; immunity: { active: boolean; endTime: number } }>,

  receptors: {
    onPlayerJoin: PlayerActions.playerJoined.receive((action) => {
      getMutableState(HealthState)[action.userID].set({
        health: 100,
        lives: 5,
        immunity: {
          active: false,
          endTime: 0
        }
      })
    }),
    onAffectHealth: HealthActions.takeDamage
      .receive((action) => {
        if (!getState(HealthState)[action.userID]) return

        const userState = getState(HealthState)[action.userID]
        if (userState.immunity.active && action.amount < 0) {
          return
        }

        getMutableState(HealthState)[action.userID].health.set((current) => Math.min(current + action.amount, 100))
      })
      .validate(validateHealthChange),
    onDie: HealthActions.die
      .receive((action) => {
        getMutableState(HealthState)[action.userID].health.set(0)
      })
      .validate(validateHealthChange),
    onRespawn: HealthActions.respawn.receive((action) => {
      getMutableState(HealthState)[action.userID].health.set(100)
    }),
    onPlayerLeave: PlayerActions.playerLeft.receive((action) => {
      if (getState(HealthState)[action.userID]) {
        getMutableState(HealthState)[action.userID].set(none)
      }
    }),

    onItemPickup: PickupActions.itemPickup.receive((action) => {
      if (!getState(HealthState)[action.userID]) return

      switch (action.pickupType) {
        case 'immunity':
          if (action.value) {
            const state = getMutableState(HealthState)[action.userID].immunity

            state.merge({
              active: true,
              endTime: action.$time + action.value
            })
          }
          break

        case 'health':
          if (typeof action.value === 'number') {
            getMutableState(HealthState)[action.userID].health.set((current) => Math.min(current + action.value!, 100))
          }
          break

        default:
          console.warn(`Unknown pickup type: ${action.pickupType}`)
          break
      }
    }),
    onImmunityTimedout: HealthActions.immunityTimedout.receive((action) => {
      getMutableState(HealthState)[action.userID].immunity.active.set(false)
    })
  },

  reactor: () => {
    const keys = useMutableState(HealthState).keys
    return (
      <>
        {keys.map((userID: UserID) => (
          <UserHealthReactor key={userID} userID={userID} />
        ))}
      </>
    )
  }
})

const UserHealthReactor = (props: { userID: UserID }) => {
  const userHealthState = useMutableState(HealthState)[props.userID]
  const userEntity = UUIDComponent.useEntityByUUID((props.userID + 'avatar') as EntityUUID)

  useEffect(() => {
    if (!userEntity) return

    setVisibleComponent(userEntity, userHealthState.health.value > 0)

    if (userHealthState.health.value <= 0) {
      const isSelf = props.userID === getState(EngineState).userID

      playSoundEffect(isSelf ? 'death' : 'kill', {
        volume: 1.0,
        position: isSelf ? undefined : getComponent(userEntity, TransformComponent).position
      })

      if (isSelf) {
        /** @todo replace this with timed action */
        setTimeout(() => {
          dispatchAction(HealthActions.respawn({ userID: getState(EngineState).userID }))
          respawnAvatar(userEntity)
          playSoundEffect('respawn', { volume: 1.0 })
        }, 3000)
      }
    }
  }, [userEntity, userHealthState.health.value])

  if (!isClient || !userEntity || props.userID === getState(EngineState).userID) return null

  return <UserHealthBarUI userID={props.userID} userEntity={userEntity} />
}

const vertexShader = `varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`
const fragmentShader = `varying vec2 vUv;
uniform float fps_health;
uniform float fps_immunity;
void main() {
  float health = fps_health * 0.01;
  if (1.0 - vUv.x < health) {
    if (fps_immunity > 0.5) {
      // Gold/yellow color for immunity
      gl_FragColor = vec4(1.0, 0.84, 0.0, 1.0);
    } else {
      // Normal health color gradient
      gl_FragColor = vec4(vUv.x, 1.0 - vUv.x, 0.0, 1.0);
    }
  } else {
    gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
  }
}`

// Player's own health display shader - slightly different visual style
const playerHealthVertexShader = `varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`
const playerHealthFragmentShader = `varying vec2 vUv;
uniform float fps_health;
uniform float fps_immunity;
void main() {
  float health = fps_health * 0.01;
  float border = 0.03;

  // Add border effect
  if (vUv.x < border || vUv.x > (1.0 - border) || vUv.y < border || vUv.y > (1.0 - border)) {
    gl_FragColor = vec4(0.2, 0.2, 0.2, 0.8);
    return;
  }

  if (1.0 - vUv.x < health) {
    if (fps_immunity > 0.5) {
      // Gold/yellow color for immunity with slight glow effect
      gl_FragColor = vec4(1.0, 0.84, 0.0, 0.9);
    } else {
      // Brighter health color for player's own health
      gl_FragColor = vec4(vUv.x, 1.0 - vUv.x, 0.0, 1.0);
    }
  } else {
    // Semi-transparent background
    gl_FragColor = vec4(0.1, 0.1, 0.1, 0.7);
  }
}`

const healthbarEntities = new Set<Entity>()

const _srcPosition = new Vector3()
const _dstPosition = new Vector3()
const _direction = new Vector3()
const _lookMatrix = new Matrix4()
const _lookRotation = new Quaternion()
const _quat = new Quaternion()

const UserHealthBarUI = (props: { userID: UserID; userEntity: Entity }) => {
  const userHealthState = useMutableState(HealthState)[props.userID]

  const avatarHealthBarEntity = useHookstate(() => {
    const entity = createEntity()
    setComponent(entity, NameComponent, getComponent(props.userEntity, NameComponent) + ' Health Bar')
    setComponent(entity, UUIDComponent, {
      entitySourceID: props.userID as any as SourceID,
      entityID: 'health_bar' as EntityID
    })
    setComponent(entity, VisibleComponent)
    setComponent(entity, EntityTreeComponent, { parentEntity: props.userEntity })
    setComponent(entity, TransformComponent, { position: new Vector3(0, 2.5, 0), scale: new Vector3(1, 0.025, 1) })
    setComponent(entity, ComputedTransformComponent, {
      referenceEntities: [props.userEntity, getState(ReferenceSpaceState).viewerEntity],
      computeFunction: () => {
        if (!entityExists(props.userEntity)) return

        const camera = getState(ReferenceSpaceState).viewerEntity
        TransformComponent.getWorldPosition(entity, _srcPosition)
        TransformComponent.getWorldPosition(camera, _dstPosition)
        _direction.subVectors(_dstPosition, _srcPosition).normalize()
        _direction.y = 0
        _lookMatrix.lookAt(Vector3_Zero, _direction, Vector3_Up)
        _lookRotation.setFromRotationMatrix(_lookMatrix)
        const transform = getComponent(entity, TransformComponent)
        const parentEntity = props.userEntity
        transform.rotation
          .copy(_lookRotation)
          .premultiply(TransformComponent.getWorldRotation(parentEntity, _quat).invert())
      }
    })

    setComponent(
      entity,
      MeshComponent,
      new Mesh(
        new PlaneGeometry(1, 1),
        new ShaderMaterial({
          uniforms: {
            fps_health: new Uniform(100),
            fps_immunity: new Uniform(0)
          },
          side: DoubleSide,
          vertexShader,
          fragmentShader
        })
      )
    )

    healthbarEntities.add(entity)

    return entity
  }).value

  useEffect(() => {
    return () => {
      healthbarEntities.delete(avatarHealthBarEntity)
      removeEntity(avatarHealthBarEntity)
    }
  }, [])

  useEffect(() => {
    const material = getComponent(avatarHealthBarEntity, MeshComponent).material as ShaderMaterial
    material.uniforms.fps_health.value = userHealthState.health.value
    material.uniforms.fps_immunity.value = userHealthState.immunity.active.value ? 1 : 0
  }, [userHealthState.health.value, userHealthState.immunity.active.value])

  return null
}

const healthBarContentSize = new Vector2(1, 0.025)

const PlayerHealthDisplay = () => {
  const userID = getState(EngineState).userID
  const userHealthState = useMutableState(HealthState)[userID]

  const healthDisplayEntity = useHookstate(() => {
    const entity = createEntity()
    setComponent(entity, NameComponent, 'Player Health Display')
    setComponent(entity, UUIDComponent, {
      entitySourceID: 'camera' as SourceID,
      entityID: 'health_display' as EntityID
    })
    setComponent(entity, VisibleComponent)
    setComponent(entity, TransformComponent)

    setComponent(
      entity,
      MeshComponent,
      new Mesh(
        new PlaneGeometry(0.5, 0.01).scale(-1, 1, 1),
        new ShaderMaterial({
          uniforms: {
            fps_health: new Uniform(userHealthState.health.value),
            fps_immunity: new Uniform(userHealthState.immunity.active.value ? 1 : 0)
          },
          transparent: true,
          side: DoubleSide,
          vertexShader: playerHealthVertexShader,
          fragmentShader: playerHealthFragmentShader
        })
      )
    )

    return entity
  }).value

  useEffect(() => {
    const { viewerEntity, originEntity } = getState(ReferenceSpaceState)
    if (!viewerEntity) return

    setComponent(healthDisplayEntity, EntityTreeComponent, { parentEntity: originEntity })

    setComponent(healthDisplayEntity, ComputedTransformComponent, {
      referenceEntities: [viewerEntity],
      computeFunction: () => {
        ObjectFitFunctions.snapToSideOfScreen(
          healthDisplayEntity,
          healthBarContentSize,
          1.0,
          0.5,
          'center',
          0.95,
          viewerEntity
        )
      }
    })
  }, [])

  useEffect(() => {
    const material = getComponent(healthDisplayEntity, MeshComponent).material as ShaderMaterial
    material.uniforms.fps_health.value = userHealthState.health.value
    material.uniforms.fps_immunity.value = userHealthState.immunity.active.value ? 1 : 0
  }, [userHealthState.health.value, userHealthState.immunity.active.value])

  useEffect(() => {
    return () => {
      removeEntity(healthDisplayEntity)
    }
  }, [])

  return null
}

const execute = () => {
  const myHealthState = getState(HealthState)[getState(EngineState).userID]
  if (!myHealthState) return

  const now = Date.now()

  if (myHealthState.immunity.active && myHealthState.immunity.endTime < now) {
    dispatchAction(HealthActions.immunityTimedout({ userID: getState(EngineState).userID }))
  }
}

export const HealthSystem = defineSystem({
  uuid: 'hexafield.fps-game.HealthSystem',
  insert: { with: PhysicsSystem },
  execute,
  reactor: () => {
    const users = useMutableState(HealthState).keys
    if (!users.includes(getState(EngineState).userID)) return null
    return <PlayerHealthDisplay />
  }
})
