import { ProjectEventHooks } from '@ir-engine/projects/ProjectConfigInterface'
import { Application } from '@ir-engine/server-core/declarations'
import { createLocations } from '@ir-engine/server-core/src/social/location/location-helper'
import manifestJson from './manifest.json'

const config = {
  onInstall: async (app: Application) => {
    await createLocations(app, manifestJson.name, {
      'infinite-shootout': 'public/scenes/VoidStation.gltf'
    })
    await app
      .service('route-activate')
      .create({ project: manifestJson.name, route: '/infinite-shootout', activate: true })
  }
} as ProjectEventHooks

export default config
