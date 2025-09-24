import {
  ECSState,
  EntityUUID,
  PresentationSystemGroup,
  SourceID,
  useExecute,
  useOptionalComponent,
  UUIDComponent
} from '@ir-engine/ecs'
import { AvatarComponent } from '@ir-engine/engine/src/avatar/components/AvatarComponent'
import { getState, useHookstate, useMutableState } from '@ir-engine/hyperflux'
import { NameComponent } from '@ir-engine/spatial/src/common/NameComponent'
import React, { useEffect, useRef } from 'react'
import { twMerge } from 'tailwind-merge'
import { GameChatState, GameMessage } from './GameChatSystem'

const GameMessageItem = ({ message }: { message: GameMessage }) => {
  const getMessageColor = () => {
    switch (message.type) {
      case 'join':
        return 'text-green-400'
      case 'leave':
        return 'text-yellow-400'
      case 'kill':
        return 'text-red-400'
      case 'death':
        return 'text-red-300'
      case 'respawn':
        return 'text-blue-400'
      case 'pickup':
        return 'text-purple-400'
      default:
        return 'text-white'
    }
  }

  const avatarEntity = UUIDComponent.useEntityByUUID(
    UUIDComponent.join({
      entitySourceID: message.userID as string as SourceID,
      entityID: AvatarComponent.entityID
    })
  )

  const userName = useOptionalComponent(avatarEntity, NameComponent) ?? message.userID

  const targetEntity = UUIDComponent.useEntityByUUID(
    message.targetUserID
      ? UUIDComponent.join({
          entitySourceID: message.targetUserID as string as SourceID,
          entityID: AvatarComponent.entityID
        })
      : ('' as string as EntityUUID)
  )

  const targetName = useOptionalComponent(targetEntity, NameComponent)

  const targetUserName = message.targetUserID ? targetName : undefined

  let parsedMessage = message.text.replace(/\${userID}/g, userName)
  if (targetUserName) {
    parsedMessage = parsedMessage.replace(/\${targetUserID}/g, targetUserName)
  }

  return (
    <div
      className={twMerge(
        'animate-fadeIn my-2 w-fit rounded-md bg-gray-500 bg-opacity-40 px-3 py-1 text-sm',
        getMessageColor()
      )}
      data-testid="game-message"
    >
      {parsedMessage}
    </div>
  )
}

const MESSAGE_LIFETIME = 5000

export default function GameChatUI() {
  const { messages } = useMutableState(GameChatState)
  const scrollRef = useRef<HTMLDivElement>(null)
  const recentMessages = useHookstate([] as GameMessage[])

  useExecute(
    () => {
      const now = getState(ECSState).frameTime
      const filteredMessages = messages.value.filter((message) => now - message.timestamp <= MESSAGE_LIFETIME)
      if (JSON.stringify(filteredMessages) === JSON.stringify(recentMessages.value)) return
      recentMessages.set(filteredMessages)
    },
    { after: PresentationSystemGroup }
  )

  useEffect(() => {
    if (!scrollRef.current) return
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [messages.length])

  return (
    <>
      <div className="absolute bottom-4 left-4 z-10 w-[300px] lg:w-[350px]">
        <style>
          {`
          .hide-scrollbar {
            -ms-overflow-style: none;  /* IE and Edge */
            scrollbar-width: none;  /* Firefox */
          }
          .hide-scrollbar::-webkit-scrollbar {
            display: none;  /* Chrome, Safari and Opera */
          }

          @keyframes fadeIn {
            0% { opacity: 0; }
            100% { opacity: 0.9; }
          }

          .animate-fadeIn {
            animation: fadeIn 0.3s ease-in-out forwards;
          }
        `}
        </style>

        <div className="bg-transparent">
          <div className="relative flex max-h-[30vh] flex-col justify-end lg:max-h-[25vh]">
            <div className="hide-scrollbar min-h-[0px] flex-1 overflow-y-auto" ref={scrollRef}>
              {recentMessages.value.map((message, index) => (
                <GameMessageItem key={index} message={message} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
