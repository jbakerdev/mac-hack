import { dispatch } from '../../../client/App'
import { ReducerActions, MatchStatus, StatusEffect, MaxRespawnTurns, Characters, TileType } from '../../../enum'
import * as TestGround from '../../assets/TestGround.json'
import { getUncontrolledAdjacentNetworkLine, getInitialPaths, getControlledFirewall, getObstructionAt } from '../Util';
import { server } from '../../App'
import AppStyles from '../../AppStyles';
import AStar from '../AStar'

export const setUser = (currentUser:object) => {
    dispatch({
        type: ReducerActions.SET_USER,
        currentUser
    })
}

export const onWSMessage = (data:any) => {
    if (!data ) {
        dispatch({
            type:'noop'
        })
    }
    else{
        const payload = JSON.parse(data.data)
        dispatch({...payload})
    }
}

export const onConnected= () => {
    dispatch({
        type: ReducerActions.CONNECTED
    })
}

export const onConnectionError= () => {
    dispatch({
        type: ReducerActions.CONNECTION_ERROR
    })
}

export const onLogin = (currentUser:Player, sessionId?:string) => {
    if(sessionId){
        dispatch({ type: ReducerActions.SET_USER, currentUser })
        server.publishMessage({type: ReducerActions.PLAYER_AVAILABLE, currentUser, sessionId})
    } 
    else {
        dispatch({ type: ReducerActions.START_SP, currentUser })
    }
}

export const onMatchStart = (currentUser:Player, session:Session) => {
    const map = TestGround.map((row, i) => 
        row.map((tile:Tile, j) => {
            return {
                ...tile,
                x:i,
                y:j,
                virusColor: tile.isSpawner ? 'red' : '',
                isCapturableBy: {},
                maxCaptureTicks: tile.type === TileType.HUB ? 10 : 2
            }
        }))
    const newSession = {
        ...session,
        status: MatchStatus.ACTIVE,
        hostPlayerId: currentUser.id,
        activePlayerId: currentUser.id,
        map,
        ticks: 0,
        paths: getInitialPaths(map),
        turnTickLimit: 5,
        hubDamage: {}
    }

    sendSessionUpdate(newSession)
}

export const onMovePlayer = (player:Player, session:Session) => {
    sendReplaceMapPlayer(session, player)
}

export const onChooseVirus = (player:Player, color:string, session:Session) => {
    session.map[player.x][player.y].virusColor = color
    sendSessionUpdate(session)
}

export const onAttackTile = (attacker:Player, ability:Ability, tile:Tile, session:Session) => {
    const target = session.players.find(player=>player.id === tile.playerId)
    if(target){
        target.character.hp -= ability.damage - (ability.effect === StatusEffect.PIERCE ?  0 : target.character.armor)
        if(target.character.hp <= 0){
            target.character = null
            target.respawnTurns = MaxRespawnTurns
        }
        else {
            //apply ability status effect
            let candidateTuple
            switch(ability.effect){
                case StatusEffect.ABILITY_LOCK: 
                    target.character.abilities.forEach(abil=>abil.cdr=abil.maxCdr)
                    break
                case StatusEffect.ABILITY_UNLOCK: 
                    target.character.abilities.forEach(abil=>abil.cdr=0)
                    break
                case StatusEffect.MOVES_MINUS_1:
                    if(target.character.move > 0) target.character.move--
                    break
                case StatusEffect.BLIND: 
                    target.character.sight = 2
                case StatusEffect.PULL:
                    if(target.y===attacker.y){
                        if(target.x > attacker.x) candidateTuple = {x: target.x-1, y:target.y}
                        else candidateTuple = {x: target.x+1, y:target.y}
                    }
                    else{
                        if(target.y > attacker.y) candidateTuple = {x: target.x, y:target.y-1}
                        else candidateTuple = {x: target.x, y:target.y+1}
                    }
                    if(!getObstructionAt(candidateTuple, session.map)){
                        target.x=candidateTuple.x
                        target.y=candidateTuple.y
                        delete target.route
                    }
                    break
                case StatusEffect.PUSH:
                    if(target.y===attacker.y){
                        if(target.x > attacker.x) candidateTuple = {x: target.x+1, y:target.y}
                        else candidateTuple = {x: target.x-1, y:target.y}
                    }
                    else{
                        if(target.y > attacker.y) candidateTuple = {x: target.x, y:target.y+1}
                        else candidateTuple = {x: target.x, y:target.y-1}
                    }
                    if(!getObstructionAt(candidateTuple, session.map)){
                        target.x=candidateTuple.x
                        target.y=candidateTuple.y
                        delete target.route
                    }
                    break

            }
        }
        sendReplaceMapPlayer(session, target)
    } 
    sendReplaceMapPlayer(session, attacker)
}

export const onMatchTick = (session:Session) => {
    session.ticks++
    if(session.ticks >= session.turnTickLimit){
        onEndTurn(session)
        return
    }
    sendSessionTick(session)
}

export const onEndTurn = (session:Session) => {
    session.ticks = 0
    session.turn++
    
    //run ai player turn
    let activePlayer = session.players.find(player=>player.id===session.activePlayerId)
    if(activePlayer.name === 'Bot'){
        session.ticks = session.turnTickLimit
        //stupid bot will just try to capture all the firewalls
        if(activePlayer.x===-1) {
            session = onChooseCharacter(activePlayer, Characters.find(char=>char.id==='Technician'), session, true)
            activePlayer = session.players.find(player=>player.id===session.activePlayerId)
        }
        let currentTile = session.map[activePlayer.x][activePlayer.y]
        if(activePlayer.route && activePlayer.route.length > 0){
            for(var moves=activePlayer.character.move; moves > 0;moves--){
                //TODO: fire these async
                let nextSpace = activePlayer.route.shift()
                if(nextSpace){
                    if(!getObstructionAt({x:nextSpace.x, y:nextSpace.y}, session.map)){
                        activePlayer.x = nextSpace.x
                        activePlayer.y = nextSpace.y
                    }
                    else {
                        let destination = activePlayer.route[activePlayer.route.length-1]
                        const astar = new AStar(destination.x, destination.y, (x:number, y:number)=>{ return session.map[x][y].type!==TileType.GAP })
                        activePlayer.route = astar.compute(activePlayer.x, activePlayer.y)
                        nextSpace = activePlayer.route.shift()
                        if(!getObstructionAt({x:nextSpace.x, y:nextSpace.y}, session.map)){
                            activePlayer.x = nextSpace.x
                            activePlayer.y = nextSpace.y
                        }
                    }
                }
            }
            session = sendReplaceMapPlayer(session, activePlayer, true)
        }
        else if(currentTile.isFirewall && currentTile.teamColor !== activePlayer.teamColor){
            session = onApplyCapture(activePlayer, session, true)
        }
        else if((currentTile.isFirewall && currentTile.teamColor === activePlayer.teamColor) || !currentTile.isFirewall){
            let nextFirewall
            session.map.forEach(row=>row.forEach(tile=>{
                if(tile.isFirewall && tile.x !== currentTile.x && tile.y !== currentTile.y && tile.teamColor !== activePlayer.teamColor) nextFirewall = tile
            }))
            const astar = new AStar(nextFirewall.x, nextFirewall.y, (x:number, y:number)=>{ return session.map[x][y].type!==TileType.GAP })
            activePlayer.route = astar.compute(activePlayer.x, activePlayer.y)
        }
    }

    //TODO Check for any status to wear off
    //TODO 'edit virus' cdr is reduced by the number of your controlled firewalls in the lane
    //TODO SP map(s), SP campign mode, SP-only AI units
    
    //advance all network lines by one if possible (possible = unopposed, or of a winning color takes a segment, cannot pass any uncontrolled firewall), 
    session.paths.forEach(path=>{

        //walk every node in each path except the last one, 
        let count = 0
        for(var i=0; i< path.nodes.length; i++){
            //advance colors of sections by 1 position, 3 times
            if(i>0){
                //0th element is the spawner
                let previousNode = path.nodes[i-1]
                if(previousNode.virusColor !== path.nodes[i].virusColor){
                    path.nodes[i].virusColor = previousNode.virusColor
                    count++
                    if(count > 2) break
                }
            }
        }

        //special case for new insertion at ends of paths
        let currentEnd = path.nodes[path.nodes.length-1]
        //search the 4 directions from the end to find a tile of type Network Line that is not controlled by us
        let nextTile = getUncontrolledAdjacentNetworkLine(currentEnd, session.map)
        if(!nextTile){
            //we found a controlled firewall that was not added to the path yet, maybe
            nextTile = getControlledFirewall(currentEnd, session.map)
            if(nextTile){
                //Firewall is added
                nextTile.virusColor = currentEnd.virusColor
                path.nodes.push(nextTile)
            }
        }
        if(nextTile.isFirewall){
            if(nextTile.teamColor !== currentEnd.teamColor){
                //Must manually take firewalls
                nextTile.isCapturableBy[currentEnd.teamColor] = true
            }
        }
        else if(nextTile.isSpawner){
            //deal hub damage
            session.hubDamage[nextTile.teamColor] ? session.hubDamage[nextTile.teamColor]++ : session.hubDamage[nextTile.teamColor]=1
            nextTile.captureTicks++
            let activePlayer = session.players.find(player=>player.id===session.activePlayerId)
            if(session.hubDamage[nextTile.teamColor] > 10){
                if(nextTile.teamColor === activePlayer.teamColor)
                    session.status = MatchStatus.LOSE
                else 
                    session.status = MatchStatus.WIN
            }
        }
        else if(nextTile.teamColor === AppStyles.colors.grey1) {
            //Next tile was unowned
            //Network line is taken
            nextTile.teamColor = currentEnd.teamColor
            nextTile.virusColor = currentEnd.virusColor
            path.nodes.push(nextTile)
        }
        else{
            //paths have met.
            //Next tile is owned by other team. find other path
            let otherPath = session.paths.find(path=>
                !!path.nodes.find(node=>node.x===nextTile.x && node.y===nextTile.y))
            //Network line is taken depending on color, only winning cases covered
            let capture = false

            if(nextTile.virusColor === 'red' && currentEnd.virusColor === 'blue')
                capture = true
            if(nextTile.virusColor === 'green' && currentEnd.virusColor === 'red')
                capture = true
            if(nextTile.virusColor === 'blue' && currentEnd.virusColor === 'green')
                capture = true
                
            if(capture){
                //check if previous node was a firewall, and mark as uncappable by losing team
                if(currentEnd.isFirewall)
                    currentEnd.isCapturableBy[nextTile.teamColor] = false
                
                //line is taken
                nextTile.teamColor = currentEnd.teamColor
                nextTile.virusColor = currentEnd.virusColor
                //remove tile from other path
                //add to our path
                path.nodes.push(otherPath.nodes.pop())
            }
        }
    })
    //TODO, remove captureTicks from any firewall which is not occupied at the end of any turn
    let found = false
    session.players.forEach((player, i)=>{
        if(player.id===session.activePlayerId && !found){
            player.character.move = player.character.maxMove
            session.activePlayerId = session.players[(i+1) % session.players.length].id
            found=true
        }
        player.character.abilities.forEach(ability=>ability.cdr > 0 && ability.cdr--)
    })

    sendSessionUpdate(session)
}

export const onUpdatePlayer = (player:Player, session:Session) => {
    sendReplaceMapPlayer(session, player)
}

export const onApplyCapture = (player:Player, session:Session, noDispatch?:boolean) => {
    let tile = session.map[player.x][player.y]
    if(tile.isFirewall && tile.teamColor !== player.teamColor) {
        tile.captureTicks++
        if(tile.captureTicks > tile.maxCaptureTicks){
            if(tile.teamColor == AppStyles.colors.grey1)
                tile.teamColor = player.teamColor
            else tile.teamColor = AppStyles.colors.grey1
            tile.captureTicks = 0
        }
    }
    player.character.abilities.forEach(ability=>{
        if(ability.effect === StatusEffect.CAPTURE) ability.cdr = ability.maxCdr
    })
    if(noDispatch) return session
    sendSessionUpdate(session)
}

export const onChooseCharacter = (player:Player, character:Character, session:Session, noDispatch?:boolean) => {
    session.players.forEach(splayer=>{
        if(splayer.id===player.id){
            player.character = {...character}
            if(player.x===-1){
                let pad
                session.map.forEach(row=>row.forEach(tile=>{if(tile.isCharacterSpawn && tile.teamColor === player.teamColor && !tile.playerId) pad = tile}))
                player.x = pad.x
                player.y = pad.y
                session.map[pad.x][pad.y].playerId = player.id
            }
        } 
    })
    if(noDispatch) return session 
    sendSessionUpdate(session)
}

export const onMatchWon = (session:Session) => {
    session.status = MatchStatus.WIN
    sendSessionUpdate(session)
}

export const onCleanSession = () => {
    dispatch({
        type: ReducerActions.MATCH_CLEANUP
    })
}

const sendSessionUpdate = (session:Session) => {
    if(session.isSinglePlayer){
        dispatch({
            type: ReducerActions.MATCH_UPDATE,
            session: {...session}
        })
    }
    else
        server.publishMessage({
            type: ReducerActions.MATCH_UPDATE,
            sessionId: session.sessionId,
            session: {...session}
        })
}

const sendSessionTick = (session:Session) => {
    if(session.isSinglePlayer){
        dispatch({
            type: ReducerActions.MATCH_UPDATE,
            session: {...session}
        })
    }
    else
        server.publishMessage({
            type: ReducerActions.MATCH_TICK,
            sessionId: session.sessionId
        })
}

const sendReplaceMapPlayer = (session:Session, player:Player, noDispatch?:boolean) => {
    if(session.isSinglePlayer){
        session.players.forEach(splayer=>{
            if(splayer.id === player.id){
                session.map.forEach(row => row.forEach(tile => {
                    if(tile.playerId && tile.playerId === player.id) delete tile.playerId
                }))
                var tile = session.map[player.x][player.y]
                tile.playerId = player.id
                splayer = {...player}
            } 
        })
        if(noDispatch) return session
        dispatch({
            type: ReducerActions.MATCH_UPDATE,
            session: {...session}
        })
    }
    else
        server.publishMessage({
            type: ReducerActions.PLAYER_MAP_REPLACE,
            sessionId: session.sessionId,
            player
        })
}