import { ComponentEditorsState } from '@ir-engine/editor/src/services/ComponentEditors'
import { ComponentShelfCategoriesState } from '@ir-engine/editor/src/services/ComponentShelfCategoriesState'
import { getMutableState } from '@ir-engine/hyperflux'
import { ItemPickupComponent } from '../ItemPickupPrefab'
import { WeaponComponent } from '../WeaponComponent'
import ItemPrefabComponentEditor from './ItemEditor'
import WeaponPrefabComponentEditor from './WeaponEditor'

export default async function () {
  getMutableState(ComponentEditorsState).merge({
    [ItemPickupComponent.name]: ItemPrefabComponentEditor,
    [WeaponComponent.name]: WeaponPrefabComponentEditor
  })

  getMutableState(ComponentShelfCategoriesState).FPS.merge([WeaponComponent, ItemPickupComponent])
}
