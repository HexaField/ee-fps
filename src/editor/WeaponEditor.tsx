import React from 'react'
import { useTranslation } from 'react-i18next'
import { FiPackage } from 'react-icons/fi'

import { commitProperties, EditorComponentType } from '@ir-engine/editor/src/components/properties/Util'
import NodeEditor from '@ir-engine/editor/src/panels/properties/common/NodeEditor'

import { WeaponConfig } from '../constants'
import { WeaponComponent } from '../WeaponComponent'

const weaponOptions = Object.entries(WeaponConfig).map(([key, _]) => ({
  label: key.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
  value: key
}))

export const WeaponPrefabComponentEditor: EditorComponentType = (props) => {
  const { t } = useTranslation()

  return (
    <NodeEditor
      {...props}
      name={t('editor:properties.weapon.name', 'Weapon Prefab')}
      description={t('editor:properties.weapon.description', 'Configure weapon properties for pickups')}
      Icon={WeaponPrefabComponentEditor.iconComponent}
    >
      <div className="mt-2 rounded bg-gray-800 p-2">
        <p className="mb-1 text-sm text-gray-300">{t('editor:properties.weapon.info', 'Available Weapons:')}</p>
        <ul className="ml-2 text-xs text-gray-400">
          {weaponOptions.map((option, index) => (
            <li
              key={index}
              className="cursor-pointer hover:text-white"
              onClick={() =>
                commitProperties(WeaponComponent, { ...WeaponConfig[option.value], type: option.value }, [props.entity])
              }
            >
              {option.label}: <span className="text-blue-400">{option.value}</span>
            </li>
          ))}
        </ul>
      </div>
    </NodeEditor>
  )
}

WeaponPrefabComponentEditor.iconComponent = FiPackage

export default WeaponPrefabComponentEditor
