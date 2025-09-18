import { PresentationSystemGroup, defineSystem } from '@ir-engine/ecs'
import { Schema, UserID, WorldUserState, defineAction, dispatchAction, useMutableState } from '@ir-engine/hyperflux'
import React, { useEffect } from 'react'

export class PlayerActions {
  static playerJoined = defineAction(
    Schema.Object(
      {
        userID: Schema.UserID()
      },
      {
        $id: 'hexafield.fps-game.PlayerActions.PLAYER_JOINED'
      }
    )
  )

  static playerLeft = defineAction(
    Schema.Object(
      {
        userID: Schema.UserID()
      },
      {
        $id: 'hexafield.fps-game.PlayerActions.PLAYER_LEFT'
      }
    )
  )
}

export const GameSystem = defineSystem({
  uuid: 'hexafield.fps-game.GameSystem',
  insert: { after: PresentationSystemGroup },
  reactor: () => {
    /** @todo this will be replaced with some lobby/game active logic */
    const users = useMutableState(WorldUserState).keys

    return (
      <>
        {users.map((userID: UserID) => (
          <ConnectedUserReactor key={userID} userID={userID} />
        ))}
      </>
    )
  }
})

const ConnectedUserReactor = (props: { userID: UserID }) => {
  useEffect(() => {
    dispatchAction(
      PlayerActions.playerJoined({
        userID: props.userID
      })
    )
    return () => {
      dispatchAction(
        PlayerActions.playerLeft({
          userID: props.userID
        })
      )
    }
  }, [])

  return null
}
