import {
  AnimationSystemGroup,
  createEntity,
  defineComponent,
  defineQuery,
  defineSystem,
  ECSState,
  EngineState,
  Entity,
  EntityID,
  EntityTreeComponent,
  getAncestorWithComponents,
  getComponent,
  hasComponent,
  removeEntity,
  SerializedComponentType,
  setComponent,
  SourceID,
  UUIDComponent
} from '@ir-engine/ecs'
import { Easing } from '@ir-engine/ecs/src/EasingFunctions'
import { AvatarComponent } from '@ir-engine/engine/src/avatar/components/AvatarComponent'
import { ParticleSystemComponent } from '@ir-engine/engine/src/scene/components/ParticleSystemComponent'

import { TextComponent } from '@ir-engine/engine/src/scene/components/TextComponent'
import { defineActionQueue, getState, Schema } from '@ir-engine/hyperflux'
import { ReferenceSpaceState } from '@ir-engine/spatial'
import { NameComponent } from '@ir-engine/spatial/src/common/NameComponent'
import { RigidBodyComponent } from '@ir-engine/spatial/src/physics/components/RigidBodyComponent'
import { MeshComponent } from '@ir-engine/spatial/src/renderer/components/MeshComponent'
import { SceneComponent } from '@ir-engine/spatial/src/renderer/components/SceneComponents'
import { VisibleComponent } from '@ir-engine/spatial/src/renderer/components/VisibleComponent'
import { TransformComponent } from '@ir-engine/spatial/src/transform/components/TransformComponent'
import {
  AdditiveBlending,
  Color,
  CylinderGeometry,
  Mesh,
  MeshLambertMaterial,
  Quaternion,
  Vector2,
  Vector3
} from 'three'
import { playSoundEffect } from './SoundEffectSystem'
import { WeaponComponent } from './WeaponComponent'
import { WeaponActions } from './WeaponSystem'

const particleParams = {
  systemParameters: {
    version: '1.0',
    autoDestroy: true,
    looping: false,
    prewarm: false,
    duration: 0.7,
    material: '',
    transparent: true,
    shape: { type: 'point' },
    startLife: {
      type: 'IntervalValue',
      a: 0.4,
      b: 0.9,
      value: 0.6,
      functions: []
    },
    startSpeed: {
      type: 'IntervalValue',
      a: 2,
      b: 3,
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
      color: {
        r: 0.7,
        g: 0.7,
        b: 0.7,
        a: 0.7
      },
      a: {
        r: 0.7,
        g: 0.7,
        b: 0.7,
        a: 0.7
      },
      b: {
        r: 0.7,
        g: 0.7,
        b: 0.7,
        a: 0.7
      },
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
        count: 10,
        cycle: 0,
        interval: 0,
        probability: 1
      }
    ],
    worldSpace: true,
    renderMode: 0,
    blending: AdditiveBlending,
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
    {
      type: 'ApplyForce' as 'ApplyForce',
      direction: [0, -1, 0],
      magnitude: {
        type: 'ConstantValue' as 'ConstantValue',
        value: 3
      }
    },
    {
      type: 'SizeOverLife' as 'SizeOverLife',
      size: {
        type: 'ConstantValue' as 'ConstantValue',
        value: 1
      }
    },
    {
      type: 'ColorOverLife' as 'ColorOverLife',
      color: {
        type: 'ConstantColor' as 'ConstantColor',
        color: {
          r: 0,
          g: 0,
          b: 0,
          a: 1
        },
        a: {
          r: 0,
          g: 0,
          b: 0,
          a: 1
        },
        b: {
          r: 1,
          g: 1,
          b: 1,
          a: 0
        },
        functions: []
      }
    }
  ]
} as SerializedComponentType<typeof ParticleSystemComponent>

const HitDamageTextComponent = defineComponent({
  name: 'HitDamageTextComponent',
  jsonID: 'EE_hit_damage_text',
  schema: Schema.Object({
    opacity: Schema.Number(),
    positionY: Schema.Number()
  })
})

/**
 * Creates a stylized damage text effect that fades and moves upward
 * @param damage The damage amount to display
 * @param position The position where the text should appear
 * @param color Optional color for the text (defaults to white)
 */
const createHitDamageText = (damage: number, position: Vector3, color?: Color) => {
  const entity = createEntity()
  const textColor = color || new Color(1, 1, 1)

  setComponent(entity, UUIDComponent, {
    entitySourceID: 'Damage Text Effect' as SourceID,
    entityID: UUIDComponent.generate()
  })
  setComponent(entity, NameComponent, 'Damage Text Effect')
  setComponent(entity, TransformComponent, {
    position
  })
  setComponent(entity, EntityTreeComponent, { parentEntity: getState(ReferenceSpaceState).originEntity })
  setComponent(entity, VisibleComponent)

  setComponent(entity, TextComponent, {
    text: damage.toString(),
    fontSize: 0.1,
    fontColor: textColor,
    textAlign: 'center',
    textAnchor: new Vector2(50, 50),
    outlineWidth: 5,
    outlineColor: new Color(0, 0, 0),
    outlineOpacity: 100,
    strokeWidth: 0,
    fontMaterial: 0
  })

  const duration = 2000
  const moveDistance = 0.5
  setComponent(entity, HitDamageTextComponent, {
    opacity: 1,
    positionY: position.y
  })

  HitDamageTextComponent.setTransition(entity, 'opacity', 0, { easing: Easing.cubic.out, duration })
  HitDamageTextComponent.setTransition(entity, 'positionY', position.y + moveDistance, {
    easing: Easing.cubic.out,
    duration
  })

  return entity
}

const hitDamageQuery = defineQuery([HitDamageTextComponent])

defineSystem({
  uuid: 'hexafield.fps-game.HitDamageSystem',
  insert: { with: AnimationSystemGroup },
  execute: () => {
    for (const entity of hitDamageQuery()) {
      const animationState = getComponent(entity, HitDamageTextComponent)

      if (animationState.opacity <= 0) {
        removeEntity(entity)
        continue
      }

      const transform = getComponent(entity, TransformComponent)
      transform.position.y = animationState.positionY
      const viewerEntity = getState(ReferenceSpaceState).viewerEntity
      const viewerTransform = getComponent(viewerEntity, TransformComponent)
      transform.rotation.copy(viewerTransform.rotation)

      if (!hasComponent(entity, MeshComponent)) continue

      const text = getComponent(entity, MeshComponent) as any
      text._baseMaterial.transparent = true
      text._baseMaterial.opacity = animationState.opacity
    }
  }
})

let hitscanEntityCounter = 0
const hitscanEntites = [] as Array<[Entity, number]>
const particleEffectEntities = [] as Array<[Entity, number]>
const hitscanTrackerLifespan = 1000 / 60 // 1/60th of a second
const particleEffectLifespan = 2000
const weaponNossleOffset = new Vector3(0, 0.1, 0)

const fireWeaponActionQueue = defineActionQueue(WeaponActions.fireWeapon)

const execute = () => {
  const now = getState(ECSState).simulationTime

  for (let i = hitscanEntites.length - 1; i >= 0; i--) {
    const entity = hitscanEntites[i][0]
    const time = hitscanEntites[i][1]
    if (time + hitscanTrackerLifespan < now) {
      removeEntity(entity)
      hitscanEntites.splice(i, 1)
    }
  }

  for (let i = particleEffectEntities.length - 1; i >= 0; i--) {
    const entity = particleEffectEntities[i][0]
    const time = particleEffectEntities[i][1]
    if (time + particleEffectLifespan < now) {
      removeEntity(entity)
      particleEffectEntities.splice(i, 1)
    }
  }

  for (const action of fireWeaponActionQueue()) {
    const userID = action.$user
    const avatarEntity = AvatarComponent.getUserAvatarEntity(userID)
    if (!avatarEntity) continue
    const weaponEntity = UUIDComponent.getEntityByUUID(action.weaponEntityUUID)
    if (!weaponEntity) continue
    const weapon = getComponent(weaponEntity, WeaponComponent)
    if (!weapon) continue

    const damage = weapon.damage

    const position = getComponent(avatarEntity, TransformComponent).position
    playSoundEffect(weapon.sound, {
      position: userID === getState(EngineState).userID ? undefined : position,
      volume: 0.8
    })

    for (let i = 0; i < action.hits.length; i++) {
      const hit = action.hits[i]
      const userCameraEntity = UUIDComponent.getEntityByUUID(
        UUIDComponent.join({
          entitySourceID: userID as string as SourceID,
          entityID: 'camera' as EntityID
        })
      )
      const weaponEntity = UUIDComponent.getEntityByUUID(action.weaponEntityUUID)
      const sceneEntity = getAncestorWithComponents(weaponEntity, [SceneComponent])
      const userCameraTransform = getComponent(userCameraEntity, TransformComponent)

      const hitPosition = new Vector3().fromArray(hit.position)
      const hitDistance = hit.hitEntityUUID ? userCameraTransform.position.distanceTo(hitPosition) : weapon.distance
      const hitRotationRelativeToCamera = new Quaternion().setFromUnitVectors(
        new Vector3(0, 0, -1),
        hitPosition.clone().sub(userCameraTransform.position).normalize()
      )

      const laserOffsetFromGun = 0.25

      const weaponTransform = getComponent(weaponEntity, RigidBodyComponent)
      const laserLength = Math.max(hitDistance - laserOffsetFromGun, laserOffsetFromGun)
      const laserPosition = weaponTransform.position.clone().add(
        weaponNossleOffset
          .clone()
          .setZ(-(hitDistance + laserOffsetFromGun) / 2)
          .applyQuaternion(hitRotationRelativeToCamera)
      )

      const laserEntity = createEntity()
      setComponent(laserEntity, UUIDComponent, {
        entitySourceID: 'Bullet Effect' as SourceID,
        entityID: `${hitscanEntityCounter++}` as EntityID
      })
      setComponent(laserEntity, VisibleComponent)
      setComponent(laserEntity, EntityTreeComponent, { parentEntity: sceneEntity })

      setComponent(laserEntity, TransformComponent, {
        position: laserPosition,
        rotation: hitRotationRelativeToCamera
      })

      setComponent(
        laserEntity,
        MeshComponent,
        new Mesh(
          new CylinderGeometry(0.005, 0.005, laserLength, 16, 1, false).rotateX(-Math.PI / 2),
          new MeshLambertMaterial({
            color: new Color(weapon.color).multiplyScalar(2),
            emissiveIntensity: 10,
            emissive: new Color(weapon.color).multiplyScalar(2)
          })
        )
      )

      hitscanEntites.push([laserEntity, now])

      if (!hit.hitEntityUUID) continue

      const hitEffectEntity = createEntity()

      // must add to the scene in order to be rendered
      const hitEntity = UUIDComponent.getEntityByUUID(hit.hitEntityUUID)
      const parentEntity = getAncestorWithComponents(hitEntity, [SceneComponent])

      setComponent(hitEffectEntity, NameComponent, 'Bullet Hit Effect')

      setComponent(hitEffectEntity, UUIDComponent, {
        entitySourceID: 'Bullet Hit Effect' as SourceID,
        entityID: `${hitscanEntityCounter++}` as EntityID
      })
      setComponent(hitEffectEntity, TransformComponent, {
        position: hitPosition
      })
      setComponent(hitEffectEntity, EntityTreeComponent, { parentEntity })
      setComponent(hitEffectEntity, VisibleComponent)

      const color = new Color(weapon.color)

      const selfAvatarEntity = AvatarComponent.getSelfAvatarEntity()

      // Create damage text effect if it's a player hit
      if (hit.isPlayer && hitEntity !== selfAvatarEntity && damage) {
        createHitDamageText(damage, hitPosition, color)
      }

      const particleParamsClone = JSON.parse(JSON.stringify(particleParams))
      particleParamsClone.behaviorParameters[2].color.color.r = color.r
      particleParamsClone.behaviorParameters[2].color.color.g = color.g
      particleParamsClone.behaviorParameters[2].color.color.b = color.b
      particleParamsClone.behaviorParameters[2].color.a.r = color.r
      particleParamsClone.behaviorParameters[2].color.a.g = color.g
      particleParamsClone.behaviorParameters[2].color.a.b = color.b

      setComponent(hitEffectEntity, ParticleSystemComponent, particleParamsClone)
      // getMutableComponent(entity, ParticleSystemComponent).behaviorParameters.merge([
      //   {
      //     bounce: 0.6,
      //     type: 'ApplyCollision'
      //   } as any
      // ])

      particleEffectEntities.push([hitEffectEntity, now])

      if (hit.isPlayer) {
        playSoundEffect('hit', { entity: hitEntity, volume: 0.8 })
      }
    }
  }
}

export const WeaponEffectSystem = defineSystem({
  uuid: 'hexafield.fps-game.WeaponEffectSystem',
  insert: { with: AnimationSystemGroup },
  execute
})
