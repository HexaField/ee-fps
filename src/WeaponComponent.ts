import {
  Entity,
  EntityID,
  EntityTreeComponent,
  UUIDComponent,
  UndefinedEntity,
  createEntity,
  defineComponent,
  getComponent,
  removeEntity,
  setComponent,
  useComponent
} from '@ir-engine/ecs'
import { GLTFComponent } from '@ir-engine/engine/src/gltf/GLTFComponent'
import { ShadowComponent } from '@ir-engine/engine/src/scene/components/ShadowComponent'
import { Schema, Static, useHookstate } from '@ir-engine/hyperflux'
import { TransformComponent } from '@ir-engine/spatial'
import { NameComponent } from '@ir-engine/spatial/src/common/NameComponent'
import { RigidBodyComponent } from '@ir-engine/spatial/src/physics/components/RigidBodyComponent'
import { BodyTypes } from '@ir-engine/spatial/src/physics/types/PhysicsTypes'
import { VisibleComponent } from '@ir-engine/spatial/src/renderer/components/VisibleComponent'
import { useEffect } from 'react'
import { assetPath } from './constants'

export const WeaponComponent = defineComponent({
  name: 'WeaponComponent',

  jsonID: 'FPS_weapon',

  schema: Schema.Object({
    /**
     * @description type of weapon.
     */
    type: Schema.String(),
    /**
     * @description path to the weapon model.
     */
    src: Schema.String(),
    /**
     * @description path to the weapon sound.
     */
    sound: Schema.String(),
    /**
     * @description color of the weapon.
     */
    color: Schema.String(),
    /**
     * @description spread of the weapon.
     */
    spread: Schema.Number(),
    /**
     * @description number of projectiles fired.
     */
    projectiles: Schema.Number(),
    /**
     * @description maximum distance of the weapon.
     */
    distance: Schema.Number(),
    /**
     * @description recoil of the weapon.
     */
    recoil: Schema.Number(),
    /**
     * @description damage of the weapon.
     */
    damage: Schema.Number(),
    /**
     * @description time between shots of the weapon.
     */
    timeBetweenShots: Schema.Number(),
    /**
     * @description whether the weapon has a scope.
     */
    hasScope: Schema.Bool()
  }),

  reactor: WeaponReactor
})

function WeaponReactor(props: { entity: Entity }) {
  const entity = props.entity
  const weapon = useComponent(props.entity, WeaponComponent)

  const modelEntityState = useHookstate(UndefinedEntity)
  const modelURL = weapon.src

  useEffect(() => {
    const name = weapon.type.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())
    setComponent(entity, NameComponent, name)
    setComponent(entity, VisibleComponent, name)
    setComponent(entity, RigidBodyComponent, { type: BodyTypes.Dynamic })

    const modelEntity = createEntity()
    setComponent(entity, NameComponent, name)
    setComponent(modelEntity, UUIDComponent, {
      entitySourceID: UUIDComponent.getAsSourceID(entity),
      entityID: 'model' as EntityID
    })
    setComponent(modelEntity, TransformComponent)
    setComponent(modelEntity, EntityTreeComponent, { parentEntity: entity })
    setComponent(modelEntity, NameComponent, getComponent(entity, NameComponent) + ' Model')
    setComponent(modelEntity, VisibleComponent)
    setComponent(modelEntity, GLTFComponent, { src: modelURL, applyColliders: true, shape: 'mesh' })
    setComponent(modelEntity, ShadowComponent)

    modelEntityState.set(modelEntity)
    return () => {
      removeEntity(modelEntity)
      modelEntityState.set(UndefinedEntity)
    }
  }, [modelURL])

  return null
}

export type WeaponType = Static<typeof WeaponComponent.schema>

export const WeaponConfig = {
  assault_rifle: {
    src: assetPath + 'weapons/assault_rifle/assault_rifle.gltf',
    sound: assetPath + 'sfx/Laser Bolt Shot High.mp3',
    color: 'lightblue',
    spread: 0.2,
    projectiles: 1,
    distance: 50,
    recoil: 0.1,
    damage: 4,
    timeBetweenShots: 1 / 10, // 10 shots per second, 40 damage per second
    hasScope: true
  } as WeaponType,
  pulse_rifle: {
    src: assetPath + 'weapons/pulse_rifle/pulse_rifle.gltf',
    sound: assetPath + 'sfx/Laser Bolt Shot Semi High.mp3',
    color: 'purple',
    spread: 0.02,
    projectiles: 1,
    distance: 50,
    recoil: 0.25,
    damage: 30,
    timeBetweenShots: 1 / 2, // 2 shots per second, 60 damage per second
    hasScope: true
  } as WeaponType,
  heavy_pistol: {
    src: assetPath + 'weapons/heavy_pistol/heavy_pistol.gltf',
    sound: assetPath + 'sfx/Laser Bolt Shot Normal.mp3',
    color: 'orange',
    spread: 0.1,
    projectiles: 1,
    distance: 20,
    recoil: 0.1,
    damage: 10,
    timeBetweenShots: 1 / 5, // 5 shots per second, 50 damage per second
    hasScope: false
  } as WeaponType,
  shotgun: {
    src: assetPath + 'weapons/shotgun/shotgun.gltf',
    sound: assetPath + 'sfx/Laser Bolt Shot Very Low.mp3',
    color: 'white',
    spread: 1,
    projectiles: 6,
    distance: 5,
    recoil: 1,
    damage: 8,
    timeBetweenShots: 1 / 1, // 1 shot per second, 6 projectiles, 48 damage per second
    hasScope: false
  } as WeaponType
}
