import {
  ECSState,
  EngineState,
  Entity,
  EntityID,
  EntitySchema,
  EntityTreeComponent,
  EntityUUID,
  NetworkObjectAuthorityTag,
  NetworkObjectComponent,
  QueryReactor,
  SourceID,
  UUIDComponent,
  UndefinedEntity,
  createEntity,
  defineSystem,
  getAncestorWithComponents,
  getComponent,
  getOptionalComponent,
  hasComponent,
  isAuthorityOverEntity,
  removeComponent,
  setComponent,
  useHasComponent,
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

import { AvatarControllerComponent } from '@ir-engine/engine/src/avatar/components/AvatarControllerComponent'
import { AvatarMovementSettingsState } from '@ir-engine/engine/src/avatar/state/AvatarMovementSettingsState'
import { AvatarInputSystem } from '@ir-engine/engine/src/avatar/systems/AvatarInputSystem'
import { GrabbedComponent } from '@ir-engine/engine/src/grabbable/GrabbableComponent'
import { CameraSettings } from '@ir-engine/spatial/src/camera/CameraState'
import { CameraComponent } from '@ir-engine/spatial/src/camera/components/CameraComponent'
import { FollowCameraComponent } from '@ir-engine/spatial/src/camera/components/FollowCameraComponent'
import { TargetCameraRotationComponent } from '@ir-engine/spatial/src/camera/components/TargetCameraRotationComponent'
import { FollowCameraMode } from '@ir-engine/spatial/src/camera/types/FollowCameraMode'
import { mergeBufferGeometries } from '@ir-engine/spatial/src/common/classes/BufferGeometryUtils'
import { Axis } from '@ir-engine/spatial/src/common/constants/MathConstants'
import { createTransitionState } from '@ir-engine/spatial/src/common/functions/createTransitionState'
import { lerp } from '@ir-engine/spatial/src/common/functions/MathLerpFunctions'
import { NameComponent } from '@ir-engine/spatial/src/common/NameComponent'
import { InputButtonBindings, InputComponent } from '@ir-engine/spatial/src/input/components/InputComponent'
import { KeyboardButton, MouseButton } from '@ir-engine/spatial/src/input/state/ButtonState'
import { InputState } from '@ir-engine/spatial/src/input/state/InputState'
import { Physics, RaycastArgs } from '@ir-engine/spatial/src/physics/classes/Physics'
import { RigidBodyComponent } from '@ir-engine/spatial/src/physics/components/RigidBodyComponent'
import { CollisionGroups, DefaultCollisionMask } from '@ir-engine/spatial/src/physics/enums/CollisionGroups'
import { getInteractionGroups } from '@ir-engine/spatial/src/physics/functions/getInteractionGroups'
import { SceneQueryType } from '@ir-engine/spatial/src/physics/types/PhysicsTypes'
import { MeshComponent } from '@ir-engine/spatial/src/renderer/components/MeshComponent'
import { VisibleComponent, setVisibleComponent } from '@ir-engine/spatial/src/renderer/components/VisibleComponent'
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
import { WeaponComponent } from './WeaponComponent'

export const WeaponActions = {
  changeWeapon: defineAction(
    Schema.Object(
      {
        userID: Schema.UserID(),
        weaponEntityUUID: EntitySchema.EntityUUID()
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
        weaponEntityUUID: EntitySchema.EntityUUID(),
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
  initial: {} as Record<UserID, { weaponEntityUUID: EntityUUID }>,

  receptors: {
    onChangeWeapon: WeaponActions.changeWeapon.receive((action) => {
      getMutableState(WeaponState)[action.userID].set({
        weaponEntityUUID: action.weaponEntityUUID
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

  const weaponEntity = UUIDComponent.useEntityByUUID(weaponState.weaponEntityUUID.value)
  const weaponType = useOptionalComponent(weaponEntity, WeaponComponent)?.type as Weapons

  useEffect(() => {
    if (!isSelf || !weaponType) return

    if (weaponType === 'heavy_pistol') {
      createCrosshairReticle(reticleEntity)
    }
    if (weaponType === 'shotgun') {
      createRingReticle(reticleEntity)
    }
    if (weaponType === 'pulse_rifle') {
      createDotReticle(reticleEntity)
    }
    if (weaponType === 'assault_rifle') {
      createCrosshairReticle(reticleEntity, true)
    }

    return () => {
      removeComponent(reticleEntity, MeshComponent)
    }
  }, [weaponType])

  const vignettingEntity = useHookstate(() => {
    if (!isSelf) return UndefinedEntity

    const viewerEntity = getState(ReferenceSpaceState).viewerEntity
    const entity = createEntity()
    setComponent(entity, NameComponent, 'Weapon Vignetting')
    setComponent(entity, UUIDComponent, { entitySourceID: 'camera' as SourceID, entityID: 'vignetting' as EntityID })
    setComponent(entity, EntityTreeComponent, { parentEntity: getState(ReferenceSpaceState).localFloorEntity })
    setComponent(entity, ComputedTransformComponent, {
      referenceEntities: [viewerEntity],
      computeFunction: () => {
        const camera = getComponent(viewerEntity, CameraComponent)
        const distance = camera.near * 1.1 // 10% in front of camera
        ObjectFitFunctions.attachObjectInFrontOfCamera(entity, 0.1, distance)
      }
    })
    setComponent(entity, TransformComponent, { position: new Vector3(0, 0, 0.1) })

    // create a simple custom shader on a plane that darkens the edges of the screen
    const geometry = new RingGeometry(0.2, 1, 32)
    const material = new MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.5
    })
    const mesh = new Mesh(geometry, material)
    setComponent(entity, MeshComponent, mesh)

    return entity
  }).value

  const weaponVisible = useHasComponent(weaponEntity, VisibleComponent)

  // apply vignetting effect when using assault rifle or sniper rifle
  useEffect(() => {
    if (!isSelf || weaponVisible) return

    if (weaponType !== 'assault_rifle' && weaponType !== 'pulse_rifle') return

    setComponent(vignettingEntity, VisibleComponent)
    return () => {
      removeComponent(vignettingEntity, VisibleComponent)
    }
  }, [isSelf, weaponType, weaponVisible])

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

  const weaponEntityUUID = getState(WeaponState)[getState(EngineState).userID]?.weaponEntityUUID
  if (!weaponEntityUUID) return
  const currentWeaponEntity = UUIDComponent.getEntityByUUID(weaponEntityUUID)
  const currentWeapon = getComponent(currentWeaponEntity, WeaponComponent).type as Weapons
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

  const spread = weaponConfig.spread * 0.1 * lerp(1, 0.2, zoomTransition.alpha)

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

    const [cameraRaycastHit] = Physics.castRayFromCamera(
      physicsWorld,
      _camera,
      new Vector2(0, 0),
      raycastComponentData,
      (collider) => {
        const rigidbody = getAncestorWithComponents(collider.entity, [RigidBodyComponent])
        return currentWeaponEntity !== rigidbody // don't hit own weapon
      }
    )

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
      weaponEntityUUID,
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

/**
 * @todo IK is currently super buggy unfortunately :(
 * Updates the IK targets for the avatar's hands based on the weapon model position
 */
const updateIKTargets = () => {
  const selfAvatarEntity = AvatarComponent.getSelfAvatarEntity()
  if (!selfAvatarEntity) return

  const avatarSourceID = AvatarComponent.getSelfSourceID()

  const leftHandTarget = AvatarIKTargetComponent.getTargetEntity(avatarSourceID, ikTargets.leftHand)
  const rightHandTarget = AvatarIKTargetComponent.getTargetEntity(avatarSourceID, ikTargets.rightHand)

  // reset IK targets
  AvatarIKTargetComponent.blendWeight[leftHandTarget] = 0
  AvatarIKTargetComponent.blendWeight[rightHandTarget] = 0

  const weaponState = getState(WeaponState)[getState(EngineState).userID]
  if (!weaponState) return

  const weaponModelEntity = UUIDComponent.getEntityByUUID(weaponState.weaponEntityUUID)
  if (!weaponModelEntity) return

  const viewerEntity = getState(ReferenceSpaceState).viewerEntity
  const viewerTransform = getComponent(viewerEntity, TransformComponent)

  const headEntity = getComponent(selfAvatarEntity, AvatarRigComponent).bonesToEntities.head
  if (!headEntity) return
  const headPosition = TransformComponent.getScenePosition(headEntity, new Vector3())

  const preferredHand = getState(InputState).preferredHand
  const isLeftHanded = preferredHand === 'left'
  const frontHandTarget = isLeftHanded ? rightHandTarget : leftHandTarget
  const backHandTarget = isLeftHanded ? leftHandTarget : rightHandTarget

  if (!frontHandTarget || !backHandTarget) return

  /** @todo add scope mode, for now just have gun at chest height */

  // back hand is the preferred hand, that holds the grip
  // front hand is the off-hand, that holds the barrel
  // adjust Y based on look pitch: lower when looking up, higher when looking down
  _tempVector3.set(0, 0, -1).applyQuaternion(viewerTransform.rotation)
  const pitchAdjust = _tempVector3.y * 0.25

  _tempVector3.set(0, -0.125 - pitchAdjust, -0.25)

  _tempVector3.applyQuaternion(viewerTransform.rotation)
  _tempVector3.add(headPosition)

  setComponent(backHandTarget, TransformComponent, {
    position: _tempVector3,
    // rotate 180 degrees on X axis to match hand orientation
    rotation: new Quaternion().multiplyQuaternions(
      viewerTransform.rotation,
      new Quaternion().setFromAxisAngle(Axis.Y, Math.PI)
    )
  })

  AvatarIKTargetComponent.blendWeight[backHandTarget] = IK_BLEND_WEIGHT

  _tempVector3.set(0, -0.125 - pitchAdjust, -0.5)
  _tempVector3.applyQuaternion(viewerTransform.rotation)
  _tempVector3.add(headPosition)
  setComponent(frontHandTarget, TransformComponent, {
    position: _tempVector3,
    // rotate 180 degrees on X axis to match hand orientation
    rotation: new Quaternion().multiplyQuaternions(
      viewerTransform.rotation,
      new Quaternion().setFromAxisAngle(Axis.X, Math.PI)
    )
  })
  AvatarIKTargetComponent.blendWeight[frontHandTarget] = IK_BLEND_WEIGHT

  // pistol is always held in one hand, so ignore off-hand for now
  // for now, we will ignore the pistol
}

const processWeaponFireAction = (action: typeof WeaponActions.fireWeapon._TYPE) => {
  const avatarEntity = AvatarComponent.getUserAvatarEntity(action.$user)
  if (!isAuthorityOverEntity(avatarEntity)) return

  const weaponEntity = UUIDComponent.getEntityByUUID(action.weaponEntityUUID)
  if (!weaponEntity) return
  const weaponType = getComponent(weaponEntity, WeaponComponent).type as Weapons
  if (!weaponType) return
  const weaponConfig = WeaponConfig[weaponType]

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

/** @todo maybe replace this with a component WeaponZoomComponent */
const zoomTransition = createTransitionState(0.1, 'OUT')
const zoomWalkSpeedModifier = 2

const lerpCameraZoom = (entity: Entity, zoomIn?: boolean) => {
  const camera = getComponent(entity, CameraComponent)

  zoomTransition.setState(zoomIn ? 'IN' : 'OUT')

  zoomTransition.update(getState(ECSState).deltaSeconds)
  const alpha = zoomTransition.alpha
  camera.zoom = alpha + 1
  camera.updateProjectionMatrix()

  const selfAvatarEntity = AvatarComponent.getSelfAvatarEntity()
  if (!selfAvatarEntity) return
  const controller = getOptionalComponent(selfAvatarEntity, AvatarControllerComponent)
  if (!controller) return
  const zoomWalkSpeed = lerp(1, zoomWalkSpeedModifier, alpha)
  controller.gamepadLocalInput.multiplyScalar(1 / zoomWalkSpeed)
  const cameraSettings = getState(CameraSettings)
  cameraSettings.cameraRotationSpeed = 200 / zoomWalkSpeed

  const weaponEntityUUID = getState(WeaponState)[getState(EngineState).userID]?.weaponEntityUUID
  if (!weaponEntityUUID) return
  const currentWeaponEntity = UUIDComponent.getEntityByUUID(weaponEntityUUID)
  if (!currentWeaponEntity) return
  const weaponTransform = getComponent(currentWeaponEntity, TransformComponent)
  if (!weaponTransform) return
  setVisibleComponent(currentWeaponEntity, alpha > 0.75 ? false : true)
}

const weaponFireQueue = defineActionQueue(WeaponActions.fireWeapon)

const WeaponKeybindings = {
  Fire: [MouseButton.PrimaryClick],
  Zoom: [MouseButton.SecondaryClick, KeyboardButton.ShiftLeft, KeyboardButton.ShiftRight]
} as InputButtonBindings

const execute = () => {
  const viewerEntity = getState(ReferenceSpaceState).viewerEntity

  if (viewerEntity) {
    const buttons = InputComponent.getButtons(viewerEntity, WeaponKeybindings)
    if (buttons.Fire?.pressed) onPrimaryClick()
    lerpCameraZoom(viewerEntity, buttons.Zoom?.pressed)

    updateIKTargets()
  }

  for (const action of weaponFireQueue()) processWeaponFireAction(action)
}

const WeaponSetupReactor = () => {
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

const WeaponGrabbedReactor = ({ entity }: { entity: Entity }) => {
  useEffect(() => {
    console.log('equipped weapon', entity)
    dispatchAction(
      WeaponActions.changeWeapon({
        userID: getState(EngineState).userID,
        weaponEntityUUID: UUIDComponent.get(entity)
      })
    )
  }, [])
  return null
}

export const WeaponSystem = defineSystem({
  uuid: 'hexafield.fps-game.WeaponSystem',
  insert: { after: AvatarInputSystem },
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

    return (
      <>
        <WeaponSetupReactor />
        <QueryReactor
          Components={[WeaponComponent, GrabbedComponent, NetworkObjectAuthorityTag]}
          ChildEntityReactor={WeaponGrabbedReactor}
        />
      </>
    )
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
