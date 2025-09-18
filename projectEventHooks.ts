import { ProjectEventHooks } from '@ir-engine/projects/ProjectConfigInterface'
import { Application } from '@ir-engine/server-core/declarations'
import { createLocations } from '@ir-engine/server-core/src/social/location/location-helper'
import manifestJson from './manifest.json'

const config = {
  onInstall: async (app: Application) => {
    await createLocations(app, manifestJson.name, {
      'fps': 'public/scenes/training-ground.gltf'
    })
    await app
      .service('route-activate')
      .create({ project: manifestJson.name, route: '/fps', activate: true })
  }
} as ProjectEventHooks

export default config
