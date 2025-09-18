import { ComponentEditorsState } from '@ir-engine/editor/src/services/ComponentEditors'
import { ComponentShelfCategoriesState } from '@ir-engine/editor/src/services/ComponentShelfCategoriesState'
import { getMutableState } from '@ir-engine/hyperflux'
import { ObjectPrefabComponent } from './ObjectSystem'
import ItemPrefabComponentEditor from './editor/ItemEditor'

export default async function () {
  getMutableState(ComponentEditorsState).merge({
    [ObjectPrefabComponent.name]: ItemPrefabComponentEditor
  })

  getMutableState(ComponentShelfCategoriesState).FPS.merge([ObjectPrefabComponent])
}
