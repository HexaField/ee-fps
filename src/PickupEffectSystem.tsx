import {
  EntityID,
  EntityTreeComponent,
  EntityUUID,
  SerializedComponentType,
  SourceID,
  UUIDComponent,
  createEntity,
  getAncestorWithComponents,
  getChildrenWithComponents,
  getComponent,
  setComponent
} from '@ir-engine/ecs'
import { ParticleSystemComponent } from '@ir-engine/engine/src/scene/components/ParticleSystemComponent'

import { defineState, getMutableState, useHookstate } from '@ir-engine/hyperflux'
import { NameComponent } from '@ir-engine/spatial/src/common/NameComponent'
import { ColliderComponent } from '@ir-engine/spatial/src/physics/components/ColliderComponent'
import { SceneComponent } from '@ir-engine/spatial/src/renderer/components/SceneComponents'
import { VisibleComponent } from '@ir-engine/spatial/src/renderer/components/VisibleComponent'
import { TransformComponent } from '@ir-engine/spatial/src/transform/components/TransformComponent'
import React, { useEffect } from 'react'
import { NormalBlending, Vector3 } from 'three'
import { ItemPickupComponent } from './ItemPickupPrefab'
import { PickupActions } from './PickupSystem'

export const PickupEffectState = defineState({
  name: 'hexafield.fps-game.PickupEffectState',
  initial: {
    pickupEffects: [] as {
      pickupEntityUUID: EntityUUID
    }[]
  },

  receptors: {
    onPickupEffect: PickupActions.itemPickup.receive((action) => {
      const state = getMutableState(PickupEffectState)
      state.pickupEffects.merge([
        {
          pickupEntityUUID: action.pickupEntityUUID
        }
      ])
    })
  },

  reactor: () => {
    const pickupEffects = useHookstate(getMutableState(PickupEffectState).pickupEffects)

    return (
      <>
        {pickupEffects.map((_, i) => (
          <PickupEffectReactor key={i} index={i} />
        ))}
      </>
    )
  }
})

const PickupEffectReactor = (props: { index: number }) => {
  const effect = useHookstate(getMutableState(PickupEffectState).pickupEffects[props.index])

  useEffect(() => {
    const entity = createEntity()

    const pickupEntity = UUIDComponent.getEntityByUUID(effect.pickupEntityUUID.value)
    const sceneEntity = getAncestorWithComponents(pickupEntity, [SceneComponent])
    const [itemColliderEntity] = getChildrenWithComponents(pickupEntity, [ColliderComponent])

    const worldPosition = TransformComponent.getWorldPosition(itemColliderEntity, new Vector3())

    const pickupType = getComponent(pickupEntity, ItemPickupComponent).type

    setComponent(entity, NameComponent, 'Pickup Effect')

    setComponent(entity, UUIDComponent, {
      entitySourceID: 'Pickup Effect' as SourceID,
      entityID: `${props.index}` as EntityID
    })
    setComponent(entity, TransformComponent, { position: worldPosition })
    setComponent(entity, EntityTreeComponent, { parentEntity: sceneEntity })
    setComponent(entity, VisibleComponent)

    let particleColor = {
      r: 0.7,
      g: 0.7,
      b: 0.7,
      a: 0.7
    }

    if (pickupType === 'immunity') {
      particleColor = {
        r: 1.0,
        g: 0.84,
        b: 0.0,
        a: 0.7
      }
    } else if (pickupType === 'health') {
      particleColor = {
        r: 0.0,
        g: 1.0,
        b: 0.0,
        a: 0.7
      }
    }

    const particleParams = {
      systemParameters: {
        version: '1.0',
        autoDestroy: true,
        looping: false,
        prewarm: false,
        duration: 0.7,
        material: '',
        transparent: true,
        shape: { type: 'sphere', radius: 0.5 },
        startLife: {
          type: 'IntervalValue',
          a: 0.4,
          b: 0.9,
          value: 0.6,
          functions: []
        },
        startSpeed: {
          type: 'IntervalValue',
          a: 0.5,
          b: 2,
          value: 1,
          functions: []
        },
        startSize: {
          type: 'IntervalValue',
          a: 0.05,
          b: 0.2,
          value: 0.1,
          functions: []
        },
        startColor: {
          type: 'ConstantColor',
          color: particleColor,
          a: particleColor,
          b: particleColor,
          functions: []
        },
        startRotation: {
          type: 'ConstantValue',
          value: 0,
          a: 0,
          b: 0,
          functions: []
        },
        emissionOverTime: {
          type: 'ConstantValue',
          value: 0,
          a: 0,
          b: 1,
          functions: []
        },
        emissionOverDistance: {
          type: 'ConstantValue',
          value: 0,
          a: 0,
          b: 0,
          functions: []
        },
        emissionBursts: [
          {
            time: 0,
            count: 30,
            cycle: 0,
            interval: 0,
            probability: 1
          }
        ],
        worldSpace: true,
        renderMode: 0,
        blending: NormalBlending,
        onlyUsedByOther: false,
        rendererEmitterSettings: {
          startLength: {
            type: 'ConstantValue',
            value: 1,
            a: 0,
            b: 1,
            functions: []
          },
          followLocalOrigin: true
        },
        texture: '/static/editor/dot.png',
        instancingGeometry: '',
        startTileIndex: {
          type: 'ConstantValue',
          value: 0,
          a: 0,
          b: 1,
          functions: []
        },
        uTileCount: 1,
        vTileCount: 1,
        behaviors: []
      },
      behaviorParameters: [
        // {
        //   type: 'Noise' as 'Noise',
        //   frequency: [1, 1, 1],
        //   power: [1, 1, 1],
        //   positionAmount: 1.5,
        //   rotationAmount: 0.5
        // },
        {
          type: 'SizeOverLife' as 'SizeOverLife',
          size: {
            type: 'ConstantValue' as 'ConstantValue',
            value: 1
          }
        },
        // {
        //   type: 'ColorOverLife' as 'ColorOverLife',
        //   color: {
        //     type: 'ConstantColor' as 'ConstantColor',
        //     color: {
        //       ...particleColor,
        //       a: 0
        //     },
        //     a: {
        //       ...particleColor,
        //       a: 0.7
        //     },
        //     b: {
        //       ...particleColor,
        //       a: 0
        //     },
        //     functions: []
        //   }
        // },
        {
          type: 'SpeedOverLife' as 'SpeedOverLife',
          speed: {
            type: 'ConstantValue' as 'ConstantValue',
            value: 0.2
          }
        }
      ]
    } as SerializedComponentType<typeof ParticleSystemComponent>

    setComponent(entity, ParticleSystemComponent, particleParams)

    const cleanupTimeout = setTimeout(() => {
      // removeEntity(entity)
    }, 1000)

    return () => {
      clearTimeout(cleanupTimeout)
      // removeEntity(entity)
    }
  }, [])

  return null
}
