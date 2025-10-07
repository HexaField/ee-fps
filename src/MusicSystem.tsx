import {
  EntityID,
  EntityTreeComponent,
  PresentationSystemGroup,
  SourceID,
  UUIDComponent,
  createEntity,
  defineSystem,
  setComponent,
  useQuery
} from '@ir-engine/ecs'
import { MediaComponent } from '@ir-engine/engine/src/scene/components/MediaComponent'
import { PlayMode } from '@ir-engine/engine/src/scene/constants/PlayMode'
import { NameComponent } from '@ir-engine/spatial/src/common/NameComponent'
import { TransformComponent } from '@ir-engine/spatial/src/transform/components/TransformComponent'
import React, { useEffect } from 'react'
import { assetPath } from './constants'
import { WeaponComponent } from './WeaponComponent'

const MUSIC_TRACKS = [assetPath + 'music/track1.mp3', assetPath + 'music/track2.mp3']

const MusicReactor = () => {
  useEffect(() => {
    const musicEntity = createEntity()

    setComponent(musicEntity, UUIDComponent, {
      entitySourceID: 'root' as any as SourceID,
      entityID: 'background-music' as EntityID
    })
    setComponent(musicEntity, NameComponent, 'Background Music')
    setComponent(musicEntity, TransformComponent)
    setComponent(musicEntity, EntityTreeComponent)

    setComponent(musicEntity, MediaComponent, {
      resources: MUSIC_TRACKS,
      autoplay: true,
      isMusic: true,
      playMode: PlayMode.loop,
      volume: 0.5
    })
  }, [])

  return null
}

export const MusicSystem = defineSystem({
  uuid: 'hexafield.fps-game.MusicSystem',
  insert: { after: PresentationSystemGroup },
  reactor: () => {
    const isInGame = useQuery([WeaponComponent]).length > 0
    if (!isInGame) return null
    return <MusicReactor />
  }
})
