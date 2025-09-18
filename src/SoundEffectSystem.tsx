import {
  Entity,
  EntityTreeComponent,
  PresentationSystemGroup,
  SourceID,
  UUIDComponent,
  createEntity,
  defineSystem,
  getComponent,
  hasComponent,
  removeEntity,
  setComponent
} from '@ir-engine/ecs'
import { PositionalAudioComponent } from '@ir-engine/engine/src/audio/components/PositionalAudioComponent'
import { MediaComponent, MediaElementComponent } from '@ir-engine/engine/src/scene/components/MediaComponent'
import { PlayMode } from '@ir-engine/engine/src/scene/constants/PlayMode'
import { NameComponent } from '@ir-engine/spatial/src/common/NameComponent'
import { TransformComponent } from '@ir-engine/spatial/src/transform/components/TransformComponent'
import { Vector3 } from 'three'
import { assetPath } from './constants'

export const SOUND_EFFECT_PATHS = {
  hit: assetPath + '/sfx/Got Hit Grunt.mp3',
  powerup: assetPath + '/sfx/Power Up Sound.mp3',
  heal: assetPath + '/sfx/Healing Power Up.mp3',
  kill: assetPath + '/sfx/Killed Enemy.mp3',
  lightning: assetPath + '/sfx/Lighting Strike.mp3',
  lightningCrackle: assetPath + '/sfx/Lightning Crackle.mp3',
  death: assetPath + '/sfx/Death Groan.mp3',
  respawn: assetPath + '/sfx/Respawn.mp3'
}

export interface PlaySoundEffectOptions {
  entity?: Entity
  position?: Vector3
  volume?: number
  loop?: boolean
}

const DEFAULT_OPTIONS: PlaySoundEffectOptions = {
  volume: 1.0,
  loop: false
}

const soundEffectEntities = new Map<Entity, number>()

export const playSoundEffect = (type: string, options: PlaySoundEffectOptions = {}): Entity => {
  const mergedOptions = { ...DEFAULT_OPTIONS, ...options }

  const soundPath = type.endsWith('.mp3') ? type : SOUND_EFFECT_PATHS[type]
  const soundName = soundPath.split('/').pop()!.replace('.mp3', '')

  const soundEntity = createEntity()

  setComponent(soundEntity, UUIDComponent, {
    entitySourceID: 'SoundEffect' as any as SourceID,
    entityID: UUIDComponent.generate()
  })
  setComponent(soundEntity, NameComponent, `SoundEffect_${soundName}`)

  if (mergedOptions.entity) {
    setComponent(soundEntity, EntityTreeComponent, { parentEntity: mergedOptions.entity })
  } else {
    setComponent(soundEntity, EntityTreeComponent)
  }

  if (mergedOptions.position) {
    setComponent(soundEntity, TransformComponent, {
      position: mergedOptions.position
    })
  } else {
    setComponent(soundEntity, TransformComponent)
  }

  if (mergedOptions.position) {
    setComponent(soundEntity, PositionalAudioComponent, {
      refDistance: 5,
      rolloffFactor: 1,
      maxDistance: 100,
      distanceModel: 'inverse',
      coneInnerAngle: 360,
      coneOuterAngle: 360,
      coneOuterGain: 0
    })
  }

  setComponent(soundEntity, MediaComponent, {
    resources: [soundPath],
    autoplay: true,
    isMusic: false,
    playMode: mergedOptions.loop ? PlayMode.loop : PlayMode.single,
    volume: mergedOptions.volume || 1.0
  })

  if (!mergedOptions.loop) {
    soundEffectEntities.set(soundEntity, Date.now())
  }

  return soundEntity
}

const execute = () => {
  for (const entity of soundEffectEntities.keys()) {
    const mediaComponent = getComponent(entity, MediaComponent)
    if (!hasComponent(entity, MediaElementComponent)) continue
    if (mediaComponent.ended && getComponent(entity, MediaElementComponent).element.readyState === 4) {
      removeEntity(entity)
      soundEffectEntities.delete(entity)
    }
  }
}

export const SoundEffectSystem = defineSystem({
  uuid: 'hexafield.fps-game.SoundEffectSystem',
  insert: { after: PresentationSystemGroup },
  execute
})
