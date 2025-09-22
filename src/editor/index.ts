import { ComponentEditorsState } from '@ir-engine/editor/src/services/ComponentEditors'
import { ComponentShelfCategoriesState } from '@ir-engine/editor/src/services/ComponentShelfCategoriesState'
import { getMutableState } from '@ir-engine/hyperflux'
import { ObjectPrefabComponent } from '../ObjectSystem'
import { WeaponComponent } from '../WeaponSystem'
import ItemPrefabComponentEditor from './ItemEditor'
import WeaponPrefabComponentEditor from './WeaponEditor'

export default async function () {
  getMutableState(ComponentEditorsState).merge({
    [ObjectPrefabComponent.name]: ItemPrefabComponentEditor,
    [WeaponComponent.name]: WeaponPrefabComponentEditor
  })

  getMutableState(ComponentShelfCategoriesState).FPS.merge([WeaponComponent, ObjectPrefabComponent])
}
