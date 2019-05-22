declare enum Directions {LEFT='LEFT', RIGHT='RIGHT', UP='UP', DOWN='DOWN'}

declare enum MatchStatus {ACTIVE='ACTIVE',WIN='WIN',LOSE='LOSE', SETUP='SETUP'}

declare enum TileType {
    GAP='GAP',
    NETWORK_LINE='NETWORK_LINE',
    GRID='GRID',
    HUB='HUB'
}

declare enum StatusEffect {
    HP='HP', HP5='HP5', CDR='CDR', CDR5='CDR5', MOVES_MINUS_1='MOVES_MINUS_1', ABILITY_LOCK='ABILITY_LOCK', NONE='NONE', PIERCE='PIERCE', CAPTURE='CAPTURE',EDIT_STREAM='EDIT_STREAM',PULL='PULL'
}

interface Player {
    name:string
    id:string
    teamColor: string
    respawnTurns: number
    character: Character
    x:number
    y:number
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
    minionId: string
    firewallId: string
    hubId: string
    minionSpawnerId: string
}

interface Session {
    sessionId: string
    hostPlayerId: string
    activePlayerId: string
    status: MatchStatus
    players: Array<Player>
    map: Array<Array<Tile>>
    ticks: number
    turnTickLimit: number
    turn: number
    isSinglePlayer: boolean
}

interface RState {
    isConnected: boolean
    currentUser: Player
    activeSession: Session
}