import config from '@ir-engine/common/src/config'

export const assetPath =
  config.client.fileServer + '/projects/hexafield/ee-fps/public/assets/'

export const WeaponConfig = {
  assault_rifle: {
    src: assetPath + 'weapons/assault_rifle.glb',
    sound: assetPath + 'sfx/Laser Bolt Shot High.mp3',
    color: 'lightblue',
    spread: 0.2,
    projectiles: 1,
    distance: 50,
    recoil: 0.1,
    damage: 4,
    timeBetweenShots: 1 / 10 // 10 shots per second, 40 damage per second
  } as WeaponType,
  pulse_rifle: {
    src: assetPath + 'weapons/pulse_rifle.glb',
    sound: assetPath + 'sfx/Laser Bolt Shot Semi High.mp3',
    color: 'purple',
    spread: 0.02,
    projectiles: 1,
    distance: 50,
    recoil: 0.25,
    damage: 30,
    timeBetweenShots: 1 / 2 // 2 shots per second, 60 damage per second
  } as WeaponType,
  heavy_pistol: {
    src: assetPath + 'weapons/heavy_pistol.glb',
    sound: assetPath + 'sfx/Laser Bolt Shot Normal.mp3',
    color: 'orange',
    spread: 0.1,
    projectiles: 1,
    distance: 20,
    recoil: 0.1,
    damage: 10,
    timeBetweenShots: 1 / 5 // 5 shots per second, 50 damage per second
  } as WeaponType,
  shotgun: {
    src: assetPath + 'weapons/shotgun.glb',
    sound: assetPath + 'sfx/Laser Bolt Shot Very Low.mp3',
    color: 'white',
    spread: 1,
    projectiles: 6,
    distance: 5,
    recoil: 1,
    damage: 8,
    timeBetweenShots: 1 / 1 // 1 shot per second, 6 projectiles, 48 damage per second
  } as WeaponType
}

export interface WeaponType {
  /**
   * @description path to the weapon model.
   */
  src: string
  /**
   * @description path to the weapon sound.
   */
  sound: string
  /**
   * @description color of the weapon.
   */
  color: string
  /**
   * @description variation in accuracy.
   */
  spread: number
  /**
   * @description number of projectiles fired per shot.
   */
  projectiles: number
  /**
   * @description max distance of projectile.
   */
  distance: number
  /**
   * @description amount of camera shake.
   */
  recoil: number
  /**
   * @description amount of damage per projectile.
   */
  damage: number
  /**
   * @description time between shots.
   */
  timeBetweenShots: number
}

export type Weapons = keyof typeof WeaponConfig
