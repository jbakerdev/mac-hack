declare enum Directions {LEFT='LEFT', RIGHT='RIGHT', UP='UP', DOWN='DOWN'}

declare enum MatchStatus {ACTIVE='ACTIVE',WIN='WIN',LOSE='LOSE', SETUP='SETUP'}

declare enum TileType {
    GAP='GAP',
    NETWORK_LINE='NETWORK_LINE',
    GRID='GRID',
    HUB='HUB'
}

declare enum StatusEffect {
    HP='HP', HP5='HP5', CDR='CDR', CDR5='CDR5', MOVES_MINUS_1='MOVES_MINUS_1', 
    ABILITY_LOCK='ABILITY_LOCK', NONE='NONE', PIERCE='PIERCE', CAPTURE='CAPTURE',
    EDIT_STREAM='EDIT_STREAM',PULL='PULL', PUSH='PUSH', ABILITY_UNLOCK='ABILITY_UNLOCK',
    BLIND='BLIND'
}

interface Tuple {
    x: number
    y: number
}

interface Player {
    name:string
    id:string
    teamColor: string
    respawnTurns: number
    character: Character
    x:number
    y:number
    route?: Array<Tuple>
}

interface Character {
    id: string
    rune: string
    hp: number
    maxHp: number
    move: number
    maxMove: number
    abilities: Array<Ability>
    passives: Array<Passive>
    armor: number
    sight:number
}

interface Ability {
    name:string
    range: number
    radius: number
    cdr: number
    maxCdr: number
    damage: number
    effect: StatusEffect
    description: string
}

interface Passive {
    stacks: number
    effect: StatusEffect
    isNegative: boolean
    stacksTargetSelf: boolean
    isAura: boolean
}

interface Tile {
    x: number
    y: number
    type: TileType
    subType: string
    playerId: string
    teamColor: string
    virusColor: string
    isFirewall: boolean
    isSpawner: boolean
    isCharacterSpawn: boolean
    captureTicks: number
    maxCaptureTicks: number
    isCapturableBy: object
}

interface Path {
    nodes: Array<Tile>
}

interface Session {
    sessionId: string
    hostPlayerId: string
    activePlayerId: string
    status: MatchStatus
    players: Array<Player>
    map: Array<Array<Tile>>
    paths: Array<Path>
    ticks: number
    turnTickLimit: number
    turn: number
    isSinglePlayer: boolean
    hubDamage: object
}

interface RState {
    isConnected: boolean
    currentUser: Player
    activeSession: Session
}