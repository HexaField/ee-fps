import {
  ECSState,
  EngineState,
  Entity,
  EntityID,
  EntitySchema,
  EntityTreeComponent,
  EntityUUID,
  InputSystemGroup,
  NetworkObjectComponent,
  SourceID,
  UUIDComponent,
  UndefinedEntity,
  createEntity,
  defineSystem,
  getComponent,
  hasComponent,
  isAuthorityOverEntity,
  removeComponent,
  removeEntity,
  setComponent,
  useOptionalComponent
} from '@ir-engine/ecs'
import { ikTargets } from '@ir-engine/engine/src/avatar/animation/Util'
import { AvatarRigComponent } from '@ir-engine/engine/src/avatar/components/AvatarAnimationComponent'
import { AvatarComponent } from '@ir-engine/engine/src/avatar/components/AvatarComponent'
import { AvatarIKTargetComponent } from '@ir-engine/engine/src/avatar/components/AvatarIKComponents'
import {
  NetworkTopics,
  Schema,
  UserID,
  defineAction,
  defineActionQueue,
  defineState,
  dispatchAction,
  getMutableState,
  getState,
  useHookstate,
  useMutableState
} from '@ir-engine/hyperflux'
import { ReferenceSpaceState, TransformComponent } from '@ir-engine/spatial'

import { AvatarMovementSettingsState } from '@ir-engine/engine/src/avatar/state/AvatarMovementSettingsState'
import { GLTFComponent } from '@ir-engine/engine/src/gltf/GLTFComponent'
import { ShadowComponent } from '@ir-engine/engine/src/scene/components/ShadowComponent'
import { CameraComponent } from '@ir-engine/spatial/src/camera/components/CameraComponent'
import { FollowCameraComponent } from '@ir-engine/spatial/src/camera/components/FollowCameraComponent'
import { TargetCameraRotationComponent } from '@ir-engine/spatial/src/camera/components/TargetCameraRotationComponent'
import { FollowCameraMode } from '@ir-engine/spatial/src/camera/types/FollowCameraMode'
import { mergeBufferGeometries } from '@ir-engine/spatial/src/common/classes/BufferGeometryUtils'
import { NameComponent } from '@ir-engine/spatial/src/common/NameComponent'
import { InputComponent } from '@ir-engine/spatial/src/input/components/InputComponent'
import { Physics, RaycastArgs } from '@ir-engine/spatial/src/physics/classes/Physics'
import { CollisionGroups, DefaultCollisionMask } from '@ir-engine/spatial/src/physics/enums/CollisionGroups'
import { getInteractionGroups } from '@ir-engine/spatial/src/physics/functions/getInteractionGroups'
import { SceneQueryType } from '@ir-engine/spatial/src/physics/types/PhysicsTypes'
import { MeshComponent } from '@ir-engine/spatial/src/renderer/components/MeshComponent'
import { VisibleComponent } from '@ir-engine/spatial/src/renderer/components/VisibleComponent'
import { ComputedTransformComponent } from '@ir-engine/spatial/src/transform/components/ComputedTransformComponent'
import { ObjectFitFunctions } from '@ir-engine/spatial/src/transform/functions/ObjectFitFunctions'
import React, { useEffect } from 'react'
import {
  BufferGeometry,
  CircleGeometry,
  Euler,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  Quaternion,
  RingGeometry,
  Vector2,
  Vector3
} from 'three'
import { WeaponConfig, Weapons } from './constants'
import { HealthActions, HealthState } from './HealthSystem'

const WeaponSchema = Schema.LiteralUnion(['assault_rifle', 'pulse_rifle', 'heavy_pistol', 'shotgun'] as const)

export const WeaponActions = {
  changeWeapon: defineAction(
    Schema.Object(
      {
        userID: Schema.UserID(),
        weapon: WeaponSchema,
        handedness: Schema.LiteralUnion(['left', 'right'] as const)
      },
      {
        $id: 'hexafield.fps-game.WeaponActions.CHANGE_WEAPON',
        metadata: {
          $topic: NetworkTopics.world
        }
      }
    )
  ),
  fireWeapon: defineAction(
    Schema.Object(
      {
        weapon: WeaponSchema,
        hits: Schema.Array(
          Schema.Object({
            position: Schema.Tuple([Schema.Number(), Schema.Number(), Schema.Number()]),
            normal: Schema.Optional(Schema.Tuple([Schema.Number(), Schema.Number(), Schema.Number()])),
            hitEntityUUID: Schema.Optional(EntitySchema.EntityUUID()),
            isPlayer: Schema.Optional(Schema.Bool()),
            damage: Schema.Optional(Schema.Number())
          })
        )
      },
      {
        $id: 'hexafield.fps-game.WeaponActions.HIT',
        metadata: {
          $topic: NetworkTopics.world
        }
      }
    )
  )
}

const WeaponState = defineState({
  name: 'hexafield.fps-game.WeaponState',
  initial: {} as Record<UserID, { weapon: Weapons; handedness: 'left' | 'right' }>,

  receptors: {
    onChangeWeapon: WeaponActions.changeWeapon.receive((action) => {
      getMutableState(WeaponState)[action.userID].set({
        weapon: action.weapon,
        handedness: action.handedness
      })
    })
  },

  reactor: () => {
    const keys = useMutableState(WeaponState).keys
    return (
      <>
        {keys.map((userID: UserID) => (
          <UserWeaponReactor key={userID} userID={userID} />
        ))}
      </>
    )
  }
})

const UserWeaponReactor = (props: { userID: UserID }) => {
  const weaponState = useHookstate(getMutableState(WeaponState)[props.userID])

  const isSelf = props.userID === getState(EngineState).userID
  const userCameraEntity = UUIDComponent.useEntityByUUID((props.userID + 'camera') as EntityUUID)

  const weaponModelEntity = useHookstate(UndefinedEntity)

  useEffect(() => {
    if (!userCameraEntity) return

    const entity = createEntity()
    setComponent(entity, UUIDComponent, {
      entitySourceID: props.userID as any as SourceID,
      entityID: 'weapon' as EntityID
    })
    setComponent(entity, VisibleComponent)
    setComponent(entity, TransformComponent, { scale: new Vector3(0.1, 0.1, -0.1) })
    setComponent(entity, EntityTreeComponent, { parentEntity: getState(ReferenceSpaceState).originEntity })
    setComponent(entity, ComputedTransformComponent, {
      referenceEntities: [userCameraEntity],
      computeFunction: () => {
        const cameraTransform = getComponent(userCameraEntity, TransformComponent)
        const weaponTransform = getComponent(entity, TransformComponent)
        weaponTransform.position
          .copy(cameraTransform.position)
          .add(new Vector3(0.1, -0.15, -0.2).applyQuaternion(cameraTransform.rotation))
        weaponTransform.rotation.copy(cameraTransform.rotation)
      }
    })
    setComponent(entity, NameComponent, 'Weapon Model ' + props.userID)
    setComponent(entity, ShadowComponent)
    weaponModelEntity.set(entity)
    return () => {
      removeEntity(entity)
      weaponModelEntity.set(UndefinedEntity)
    }
  }, [userCameraEntity])

  useEffect(() => {
    if (!weaponModelEntity.value) return
    setComponent(weaponModelEntity.value, GLTFComponent, { src: WeaponConfig[weaponState.weapon.value].src })
    return () => {
      removeComponent(weaponModelEntity.value, GLTFComponent)
    }
  }, [weaponModelEntity.value, weaponState.weapon.value])

  // useEffect(() => {
  //   if (!weaponModelEntity.value) return
  //   setComponent(weaponModelEntity.value, TransformComponent, {
  //     position: new Vector3(weaponState.handedness.value === 'left' ? -0.15 : 0.15, -0.2, -0.5)
  //   })
  // }, [weaponModelEntity.value, weaponState.handedness])

  useEffect(() => {
    return () => {
      // Reset IK targets when weapon is removed
      const avatarSourceID = AvatarComponent.getSelfSourceID()
      const leftHandTarget = AvatarIKTargetComponent.getTargetEntity(avatarSourceID, ikTargets.leftHand)
      const rightHandTarget = AvatarIKTargetComponent.getTargetEntity(avatarSourceID, ikTargets.rightHand)

      if (leftHandTarget) AvatarIKTargetComponent.blendWeight[leftHandTarget] = 0
      if (rightHandTarget) AvatarIKTargetComponent.blendWeight[rightHandTarget] = 0
    }
  }, [])

  const reticleEntity = useHookstate(() => {
    if (!isSelf) return UndefinedEntity

    const viewerEntity = getState(ReferenceSpaceState).viewerEntity
    const entity = createEntity()
    setComponent(entity, NameComponent, 'Weapon Reticle')
    setComponent(entity, UUIDComponent, { entitySourceID: 'camera' as SourceID, entityID: 'reticle' as EntityID })
    setComponent(entity, VisibleComponent)
    setComponent(entity, EntityTreeComponent, { parentEntity: getState(ReferenceSpaceState).localFloorEntity })
    setComponent(entity, ComputedTransformComponent, {
      referenceEntities: [viewerEntity],
      computeFunction: () => {
        const camera = getComponent(viewerEntity, CameraComponent)
        const distance = camera.near * 1.1 // 10% in front of camera
        ObjectFitFunctions.attachObjectInFrontOfCamera(entity, 0.01, distance)
      }
    })
    setComponent(entity, TransformComponent, { position: new Vector3(0, 0, 0.1) })

    return entity
  }).value

  useEffect(() => {
    if (!isSelf) return

    if (weaponState.weapon.value === 'heavy_pistol') {
      createCrosshairReticle(reticleEntity)
    }
    if (weaponState.weapon.value === 'shotgun') {
      createRingReticle(reticleEntity)
    }
    if (weaponState.weapon.value === 'pulse_rifle') {
      createDotReticle(reticleEntity)
    }
    if (weaponState.weapon.value === 'assault_rifle') {
      createCrosshairReticle(reticleEntity, true)
    }

    return () => {
      removeComponent(reticleEntity, MeshComponent)
    }
  }, [weaponState.weapon.value])

  return null
}

const lastShotTime = new Map<Weapons, number>()
const _tempVector3 = new Vector3()
const _camera = new PerspectiveCamera()

const IK_BLEND_WEIGHT = 1
const RAD2DEG = 180 / Math.PI

const raycastComponentData = {
  type: SceneQueryType.Closest,
  origin: new Vector3(),
  direction: new Vector3(),
  maxDistance: 100,
  groups: getInteractionGroups(CollisionGroups.Default, DefaultCollisionMask)
} as RaycastArgs

const onPrimaryClick = () => {
  const selfAvatarEntity = AvatarComponent.getSelfAvatarEntity()!
  const physicsWorld = Physics.getWorld(selfAvatarEntity)
  if (!physicsWorld) return

  const currentWeapon = getState(WeaponState)[getState(EngineState).userID].weapon
  const weaponConfig = WeaponConfig[currentWeapon]

  const now = getState(ECSState).simulationTime
  const lastShot = lastShotTime.get(currentWeapon) || 0
  if (now - lastShot < weaponConfig.timeBetweenShots * 1000) {
    return
  }
  lastShotTime.set(currentWeapon, now)

  const viewerEntity = getState(ReferenceSpaceState).viewerEntity
  const cameraTransform = getComponent(viewerEntity, TransformComponent)

  raycastComponentData.excludeRigidBody = selfAvatarEntity
  raycastComponentData.maxDistance = weaponConfig.distance

  const spread = weaponConfig.spread * 0.1

  if (weaponConfig.recoil > 0) {
    const recoilAmount = weaponConfig.recoil * 0.25
    const recoilX = recoilAmount * RAD2DEG * (0.05 - Math.random() * 0.1) * 0.5
    const recoilY = recoilAmount * RAD2DEG * (1 - Math.random() * 0.1)
    const cameraTarget = getComponent(viewerEntity, TargetCameraRotationComponent)
    cameraTarget.theta += recoilX
    cameraTarget.phi -= recoilY
  }

  const entityHits = [] as {
    position: Vector3
    normal?: Vector3
    hitEntityUUID?: EntityUUID
    isPlayer?: boolean
  }[]

  for (let i = 0; i < weaponConfig.projectiles; i++) {
    _camera.copy(getComponent(viewerEntity, CameraComponent))

    const spreadX = (Math.random() - 0.5) * spread
    const spreadY = (Math.random() - 0.5) * spread

    // apply spread to camera
    const spreadEuler = new Euler(spreadX, spreadY, 0, 'YXZ')
    const rot = cameraTransform.rotation.clone().multiply(new Quaternion().setFromEuler(spreadEuler))
    _camera.matrixWorld.compose(cameraTransform.position, rot, cameraTransform.scale)

    const [cameraRaycastHit] = Physics.castRayFromCamera(physicsWorld, _camera, new Vector2(0, 0), raycastComponentData)

    if (!cameraRaycastHit) {
      entityHits.push({
        position: new Vector3(0, 0, -1).applyQuaternion(rot).multiplyScalar(weaponConfig.distance).add(_camera.position)
      })
      continue
    }

    const hitEntity = cameraRaycastHit.entity
    const isAvatarEntity = hasComponent(hitEntity, AvatarRigComponent)

    if (hitEntity !== selfAvatarEntity) {
      entityHits.push({
        position: new Vector3().copy(cameraRaycastHit.position as Vector3),
        normal: new Vector3().copy(cameraRaycastHit.normal as Vector3),
        hitEntityUUID: UUIDComponent.get(hitEntity),
        isPlayer: isAvatarEntity
      })
    }
  }

  dispatchAction(
    WeaponActions.fireWeapon({
      weapon: currentWeapon,
      hits: entityHits.map((hit) => ({
        position: hit.position.toArray() as [number, number, number],
        normal: hit.normal ? (hit.normal.toArray() as [number, number, number]) : undefined,
        hitEntityUUID: hit.hitEntityUUID,
        isPlayer: hit.isPlayer,
        damage: weaponConfig.damage
      }))
    })
  )
}

const swapHands = () => {
  const weaponState = getState(WeaponState)[getState(EngineState).userID]
  dispatchAction(
    WeaponActions.changeWeapon({
      userID: getState(EngineState).userID,
      weapon: weaponState.weapon,
      handedness: weaponState.handedness === 'left' ? 'right' : 'left'
    })
  )
}

/**
 * @todo IK is currently super buggy unfortunately :(
 * Updates the IK targets for the avatar's hands based on the weapon model position
 */
const updateIKTargets = () => {
  const selfAvatarEntity = AvatarComponent.getSelfAvatarEntity()
  if (!selfAvatarEntity) return

  const avatarSourceID = AvatarComponent.getSelfSourceID()
  const weaponState = getState(WeaponState)[getState(EngineState).userID]
  if (!weaponState) return

  const weaponModelEntity = UUIDComponent.getEntityByUUID(
    UUIDComponent.join({
      entitySourceID: getState(EngineState).userID as any as SourceID,
      entityID: 'weapon' as EntityID
    })
  )
  if (!weaponModelEntity) return

  const viewerEntity = getState(ReferenceSpaceState).viewerEntity
  const viewerTransform = getComponent(viewerEntity, TransformComponent)

  const leftHandTarget = AvatarIKTargetComponent.getTargetEntity(avatarSourceID, ikTargets.leftHand)
  const rightHandTarget = AvatarIKTargetComponent.getTargetEntity(avatarSourceID, ikTargets.rightHand)

  const isLeftHanded = weaponState.handedness === 'left'
  const activeHandTarget = isLeftHanded ? leftHandTarget : rightHandTarget

  if (activeHandTarget) {
    if (isLeftHanded) {
      _tempVector3.set(-0.125, -0.125, 0.75)
    } else {
      _tempVector3.set(0.125, -0.125, 0.75)
    }

    _tempVector3.applyQuaternion(viewerTransform.rotation)
    _tempVector3.add(viewerTransform.position)

    setComponent(activeHandTarget, TransformComponent, {
      position: _tempVector3,
      rotation: viewerTransform.rotation
    })

    AvatarIKTargetComponent.blendWeight[activeHandTarget] = IK_BLEND_WEIGHT
  }

  /** off-hand, does nothing for pistol, so ignore */
  // const inactiveHandTarget = isLeftHanded ? rightHandTarget : leftHandTarget
  // if (inactiveHandTarget) {
  //   if (isLeftHanded) {
  //     _tempVector3.set(0, -0.125, 0.75)
  //   } else {
  //     _tempVector3.set(0, -0.125, 0.75)
  //   }
  //   _tempVector3.applyQuaternion(viewerTransform.rotation)
  //   _tempVector3.add(viewerTransform.position)
  //   setComponent(inactiveHandTarget, TransformComponent, {
  //     position: _tempVector3,
  //     rotation: viewerTransform.rotation
  //   })
  //   AvatarIKTargetComponent.blendWeight[inactiveHandTarget] = IK_BLEND_WEIGHT
  // }
}

const changeWeapon = (weapon: Weapons) => {
  const weaponState = getState(WeaponState)[getState(EngineState).userID]
  if (weaponState.weapon === weapon) return

  dispatchAction(
    WeaponActions.changeWeapon({
      userID: getState(EngineState).userID,
      weapon: weapon,
      handedness: weaponState.handedness
    })
  )
}

const processWeaponFireAction = (action: typeof WeaponActions.fireWeapon._TYPE) => {
  const avatarEntity = AvatarComponent.getUserAvatarEntity(action.$user)
  if (!isAuthorityOverEntity(avatarEntity)) return

  const weaponConfig = WeaponConfig[action.weapon]

  for (const ray of action.hits) {
    if (!ray.hitEntityUUID) continue
    const hitEntity = UUIDComponent.getEntityByUUID(ray.hitEntityUUID)
    if (!avatarEntity || !hasComponent(hitEntity, NetworkObjectComponent)) continue

    const playerIsAlive = getState(HealthState)?.[getComponent(hitEntity, NetworkObjectComponent).ownerId]?.health > 0
    if (playerIsAlive) {
      const targetUserID = getComponent(hitEntity, NetworkObjectComponent).ownerId

      const amount = weaponConfig.damage
      const currentHealth = getState(HealthState)[targetUserID].health

      if (currentHealth - amount <= 0) {
        dispatchAction(HealthActions.die({ userID: targetUserID }))
      } else {
        dispatchAction(HealthActions.takeDamage({ userID: targetUserID, amount: -amount }))
      }
    }
  }
}

const weaponKeys = Object.keys(WeaponConfig) as Weapons[]

const weaponFireQueue = defineActionQueue(WeaponActions.fireWeapon)

const execute = () => {
  const viewerEntity = getState(ReferenceSpaceState).viewerEntity

  if (viewerEntity) {
    const buttons = InputComponent.getMergedButtons(viewerEntity)
    if (buttons.PrimaryClick?.pressed) onPrimaryClick()
    if (buttons.KeyZ?.down) swapHands()
    if (buttons.Digit1?.down) changeWeapon(weaponKeys[0])
    if (buttons.Digit2?.down) changeWeapon(weaponKeys[1])
    if (buttons.Digit3?.down) changeWeapon(weaponKeys[2])
    if (buttons.Digit4?.down) changeWeapon(weaponKeys[3])

    // updateIKTargets()
  }

  for (const action of weaponFireQueue()) processWeaponFireAction(action)
}

const WeaponReactor = (props: { viewerEntity: Entity }) => {
  useEffect(() => {
    dispatchAction(
      WeaponActions.changeWeapon({
        userID: getState(EngineState).userID,
        weapon: weaponKeys[0],
        handedness: 'right'
      })
    )
  }, [])

  const viewerEntity = useMutableState(ReferenceSpaceState).viewerEntity.value
  const followCamera = useOptionalComponent(viewerEntity, FollowCameraComponent)

  useEffect(() => {
    if (!followCamera) return
    if (followCamera.mode === FollowCameraMode.FirstPerson) return
    setComponent(viewerEntity, FollowCameraComponent, {
      mode: FollowCameraMode.FirstPerson,
      allowedModes: [FollowCameraMode.FirstPerson],
      pointerLock: true,
      smoothLerp: false
    })
  }, [followCamera?.mode])

  return null
}

export const WeaponSystem = defineSystem({
  uuid: 'hexafield.fps-game.WeaponSystem',
  insert: { with: InputSystemGroup },
  execute,
  reactor: () => {
    const avatarMovementSettings = useMutableState(AvatarMovementSettingsState)

    useEffect(() => {
      if (avatarMovementSettings.runSpeed.value === 10) return
      avatarMovementSettings.jumpHeight.set(1)
      avatarMovementSettings.runSpeed.set(5)
      avatarMovementSettings.walkSpeed.set(3)
    }, [avatarMovementSettings.runSpeed.value])

    const viewerEntity = useMutableState(ReferenceSpaceState).viewerEntity.value
    if (!viewerEntity) return null

    return <WeaponReactor viewerEntity={viewerEntity} />
  }
})

const length = 0.1
const thickness = 0.025

export const createCrosshairReticle = (entity: Entity, diagonal = false) => {
  // create four rectangles for reticle
  const templateGeometry = new BufferGeometry()
    .setFromPoints([
      // a
      new Vector3(thickness, -length, 0),
      new Vector3(thickness, length, 0),
      new Vector3(-thickness, length, 0),
      // b
      new Vector3(thickness, -length, 0),
      new Vector3(-thickness, length, 0),
      new Vector3(-thickness, -length, 0)
    ])
    .scale(0.5, 0.5, 0.5)
  const topGeometry = templateGeometry.clone().translate(0, 0.1, 0)
  const bottomGeometry = templateGeometry.clone().translate(0, -0.1, 0)
  const leftGeometry = templateGeometry
    .clone()
    .rotateZ(Math.PI / 2)
    .translate(-0.1, 0, 0)
  const rightGeometry = templateGeometry
    .clone()
    .rotateZ(Math.PI / 2)
    .translate(0.1, 0, 0)
  const reticleGeometry = mergeBufferGeometries([topGeometry, bottomGeometry, leftGeometry, rightGeometry])!
  const reticleMaterial = new MeshBasicMaterial({ color: 'grey' })
  if (diagonal) {
    reticleGeometry.rotateZ(Math.PI / 4)
  }
  setComponent(entity, MeshComponent, new Mesh(reticleGeometry, reticleMaterial))
}

/** broken curved corner arcs */
export const createRingReticle = (entity: Entity) => {
  const corner = new RingGeometry(0.2 - thickness, 0.2, 32, 1, 0, Math.PI / 2)

  const reticleGeometry = mergeBufferGeometries([
    corner.clone().rotateZ(0).translate(0.2, 0.2, 0),
    corner
      .clone()
      .rotateZ(Math.PI / 2)
      .translate(-0.2, 0.2, 0),
    corner.clone().rotateZ(Math.PI).translate(-0.2, -0.2, 0),
    corner
      .clone()
      .rotateZ((Math.PI * 3) / 2)
      .translate(0.2, -0.2, 0)
  ])!
  const reticleMaterial = new MeshBasicMaterial({ color: 'grey' })
  setComponent(entity, MeshComponent, new Mesh(reticleGeometry, reticleMaterial))
}

export const createDotReticle = (entity: Entity) => {
  const reticleGeometry = new CircleGeometry(thickness, 32)
  const reticleMaterial = new MeshBasicMaterial({ color: 'red' })
  setComponent(entity, MeshComponent, new Mesh(reticleGeometry, reticleMaterial))
}
