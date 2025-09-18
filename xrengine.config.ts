import type { ProjectConfigInterface } from '@ir-engine/projects/ProjectConfigInterface'

const config: ProjectConfigInterface = {
  onEvent: './projectEventHooks.ts',
  thumbnail: '/static/etherealengine_thumbnail.jpg',
  routes: {
    '/fps': {
      component: () => import('./src/Play'),
      props: {
        exact: true
      }
    }
  },
  worldInjection: () => import('./src/worldInjection')
}

export default config
