

import React from 'react'
import { useTranslation } from 'react-i18next'
import { FiPackage } from 'react-icons/fi'

import { useComponent } from '@ir-engine/ecs'
import { commitProperty, EditorComponentType } from '@ir-engine/editor/src/components/properties/Util'
import NodeEditor from '@ir-engine/editor/src/panels/properties/common/NodeEditor'

import InputGroup from '@ir-engine/ui/src/components/editor/input/Group'
import SelectInput from '@ir-engine/ui/src/components/editor/input/Select'
import StringInput from '@ir-engine/ui/src/components/editor/input/String'

import { assetPath } from '../constants'
import { ObjectPrefabComponent } from '../ObjectSystem'

// Define the available item types
const itemTypeOptions = [
  { label: 'Health', value: 'health' },
  { label: 'Immunity', value: 'immunity' }
]

// Define the available model URLs
// In a real implementation, this might be fetched from a server or asset registry
const modelURLOptions = [
  {
    label: 'Health Pack',
    value: assetPath + 'health.glb'
  },
  {
    label: 'Invincibility',
    value: assetPath + 'invincibility.glb'
  }
]

export const ItemPrefabComponentEditor: EditorComponentType = (props) => {
  const { t } = useTranslation()
  const objectPrefabComponent = useComponent(props.entity, ObjectPrefabComponent)

  return (
    <NodeEditor
      {...props}
      name={t('editor:properties.item.name', 'Item Prefab')}
      description={t('editor:properties.item.description', 'Configure item properties for pickups')}
      Icon={ItemPrefabComponentEditor.iconComponent}
    >
      <InputGroup name="Type" label={t('editor:properties.item.lbl-type', 'Item Type')}>
        <SelectInput
          options={itemTypeOptions}
          value={objectPrefabComponent.type}
          onChange={commitProperty(ObjectPrefabComponent, 'type')}
        />
      </InputGroup>

      <InputGroup name="Name" label={t('editor:properties.item.lbl-name', 'Item Name')}>
        <StringInput
          value={objectPrefabComponent.name}
          onChange={commitProperty(ObjectPrefabComponent, 'name')}
        />
      </InputGroup>

      <InputGroup
        name="ModelURL"
        label={t('editor:properties.item.lbl-modelURL', 'Model URL')}
        info={t('editor:properties.item.info-modelURL', 'URL to the 3D model for this item')}
      >
        <StringInput
          value={objectPrefabComponent.modelURL}
          onChange={commitProperty(ObjectPrefabComponent, 'modelURL')}
          placeholder="Enter model URL"
        />
      </InputGroup>

      {/* Helper section for model URLs */}
      <div className="mt-2 rounded bg-gray-800 p-2">
        <p className="mb-1 text-sm text-gray-300">
          {t('editor:properties.item.info-modelURLs', 'Available model URLs:')}
        </p>
        <ul className="ml-2 text-xs text-gray-400">
          {modelURLOptions.map((option, index) => (
            <li
              key={index}
              className="cursor-pointer hover:text-white"
              onClick={() => commitProperty(ObjectPrefabComponent, 'modelURL')(option.value)}
            >
              {option.label}: <span className="text-blue-400">{option.value}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Display additional information based on item type */}
      {objectPrefabComponent.type === 'health' && (
        <div className="mt-2 rounded bg-gray-800 p-2">
          <p className="text-sm text-gray-300">
            {t('editor:properties.item.info-health', 'Health items restore player health when picked up.')}
          </p>
        </div>
      )}

      {objectPrefabComponent.type === 'immunity' && (
        <div className="mt-2 rounded bg-gray-800 p-2">
          <p className="text-sm text-gray-300">
            {t(
              'editor:properties.item.info-immunity',
              'Immunity items provide temporary invulnerability to damage for 10 seconds.'
            )}
          </p>
        </div>
      )}
    </NodeEditor>
  )
}

// Set the icon component for the editor
ItemPrefabComponentEditor.iconComponent = FiPackage

export default ItemPrefabComponentEditor
