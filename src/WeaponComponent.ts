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
import { Schema, useHookstate } from '@ir-engine/hyperflux'
import { TransformComponent } from '@ir-engine/spatial'
import { NameComponent } from '@ir-engine/spatial/src/common/NameComponent'
import { RigidBodyComponent } from '@ir-engine/spatial/src/physics/components/RigidBodyComponent'
import { BodyTypes } from '@ir-engine/spatial/src/physics/types/PhysicsTypes'
import { VisibleComponent } from '@ir-engine/spatial/src/renderer/components/VisibleComponent'
import { useEffect } from 'react'

export const WeaponComponent = defineComponent({
  name: 'WeaponComponent',

  jsonID: 'FPS_weapon',

  schema: Schema.Object({
    type: Schema.String(),
    src: Schema.String(),
    sound: Schema.String(),
    color: Schema.String(),
    spread: Schema.Number(),
    projectiles: Schema.Number(),
    distance: Schema.Number(),
    recoil: Schema.Number(),
    damage: Schema.Number(),
    timeBetweenShots: Schema.Number()
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
