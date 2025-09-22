import { useEffect } from 'react'

import {
  createEntity,
  Entity,
  EntityID,
  EntityTreeComponent,
  getComponent,
  getOptionalComponent,
  removeComponent,
  removeEntity,
  setComponent,
  UndefinedEntity,
  useComponent,
  UUIDComponent
} from '@ir-engine/ecs'
import { GLTFComponent } from '@ir-engine/engine/src/gltf/GLTFComponent'

import { ShadowComponent } from '@ir-engine/engine/src/scene/components/ShadowComponent'
import { TriggerCallbackComponent } from '@ir-engine/engine/src/scene/components/TriggerCallbackComponent'
import { definePrefab } from '@ir-engine/engine/src/scene/functions/definePrefab'
import { Schema, useHookstate } from '@ir-engine/hyperflux'
import { NameComponent } from '@ir-engine/spatial/src/common/NameComponent'
import { ColliderComponent } from '@ir-engine/spatial/src/physics/components/ColliderComponent'
import { RigidBodyComponent } from '@ir-engine/spatial/src/physics/components/RigidBodyComponent'
import { BodyTypes, Shapes } from '@ir-engine/spatial/src/physics/types/PhysicsTypes'
import { MeshComponent } from '@ir-engine/spatial/src/renderer/components/MeshComponent'
import { VisibleComponent } from '@ir-engine/spatial/src/renderer/components/VisibleComponent'
import { TransformComponent } from '@ir-engine/spatial/src/transform/components/TransformComponent'
import React from 'react'
import { Box3, Vector3 } from 'three'

export const ObjectReactor = (props: { entity: Entity }) => {
  const entity = props.entity
  const { modelURL, name } = useComponent(entity, ItemPickupPrefab)

  useEffect(() => {
    setComponent(entity, NameComponent, name)
    setComponent(entity, VisibleComponent, name)
  }, [])

  const modelEntityState = useHookstate(UndefinedEntity)

  useEffect(() => {
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
    setComponent(modelEntity, GLTFComponent, { src: modelURL })
    setComponent(modelEntity, ShadowComponent)
    modelEntityState.set(modelEntity)
    return () => {
      removeEntity(modelEntity)
      modelEntityState.set(UndefinedEntity)
    }
  }, [modelURL])

  const modelLoaded = GLTFComponent.useSceneLoaded(modelEntityState.value)

  useEffect(() => {
    if (!modelLoaded) return

    const box3 = new Box3()
    const source = UUIDComponent.getAsSourceID(modelEntityState.value)
    const entities = UUIDComponent.getEntitiesBySource(source)
    for (const entity of entities) {
      const mesh = getOptionalComponent(entity, MeshComponent)
      if (!mesh) continue
      box3.expandByObject(mesh)
    }

    box3.applyMatrix4(getComponent(modelEntityState.value, TransformComponent).matrixWorld.clone().invert())

    setComponent(entity, RigidBodyComponent, { type: BodyTypes.Fixed })

    const size = box3.getSize(new Vector3())
    const center = box3.getCenter(new Vector3())

    const colliderEntity = createEntity()
    setComponent(colliderEntity, UUIDComponent, {
      entitySourceID: UUIDComponent.getAsSourceID(entity),
      entityID: 'collider' as EntityID
    })
    setComponent(colliderEntity, EntityTreeComponent, { parentEntity: entity })
    setComponent(colliderEntity, TransformComponent, {
      position: center,
      scale: size
    })
    setComponent(colliderEntity, NameComponent, getComponent(entity, NameComponent) + ' Collider')
    setComponent(colliderEntity, VisibleComponent)
    setComponent(colliderEntity, ColliderComponent, { shape: Shapes.Box })
    setComponent(colliderEntity, TriggerCallbackComponent)

    return () => {
      removeEntity(colliderEntity)
      removeComponent(entity, RigidBodyComponent)
    }
  }, [modelLoaded])

  return null
}

export const ItemPickupPrefab = definePrefab({
  name: 'ItemPickupPrefab',

  jsonID: 'FPS_pickup',

  schema: Schema.Object({
    type: Schema.String(),
    name: Schema.String(),
    modelURL: Schema.String()
  }),

  reactor: ({ entity }) => <ObjectReactor entity={entity} />
})
