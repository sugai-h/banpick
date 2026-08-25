// Simple load test: multiple clients concurrently requestAction 'ban' on the same character
const io = require('socket.io-client')

const SERVER = process.env.SERVER_URL || 'http://localhost:4000'
const ROOM = process.argv[2] || 'loadtest-room'
const CHAR_ID = parseInt(process.argv[3] || '1')
const CLIENTS = parseInt(process.argv[4] || '4')

function sleep(ms){ return new Promise(r=>setTimeout(r, ms)) }

async function run(){
  console.log('Server:', SERVER, 'Room:', ROOM, 'Char:', CHAR_ID, 'Clients:', CLIENTS)
  const host = io(SERVER)
  await new Promise(res => host.on('connect', res))
  const hostId = 'host-' + Math.random().toString(36).slice(2)
  host.emit('joinRoom', { roomId: ROOM, playerId: hostId, playerName: 'Host' })
  console.log('Host joined as', hostId)
  // give server a moment
  await sleep(300)
  host.emit('startBanPick', { roomId: ROOM, playerId: hostId })
  console.log('Host started ban/pick')
  await sleep(300)

  const clients = []
  for (let i=0;i<CLIENTS;i++){
    const id = 'c' + i + '-' + Math.random().toString(36).slice(2)
    const s = io(SERVER)
    clients.push({ id, sock: s })
    s.on('connect', () => {
      s.emit('joinRoom', { roomId: ROOM, playerId: id, playerName: id })
    })
    s.on('error', (e)=> console.log('client err', id, e))
    s.on('action:confirmed', (a)=> console.log('confirmed', id, a))
  }

  // wait for all to join
  await sleep(800)

  console.log('Sending concurrent ban requests...')
  const promises = clients.map(c => new Promise(res => {
    c.sock.emit('requestAction', { roomId: ROOM, playerId: c.id, actionType: 'ban', characterId: CHAR_ID }, (ack)=>{})
    // listen for confirmation or error to resolve
    const ok = (a)=>{ cleanup(); res({ok:true, a}) }
    const err = (e)=>{ cleanup(); res({ok:false, e}) }
    function cleanup(){ c.sock.off('action:confirmed', ok); c.sock.off('error', err) }
    c.sock.on('action:confirmed', ok)
    c.sock.on('error', err)
    // safety timeout
    setTimeout(()=>{ cleanup(); res({ok:false, e:'timeout'}) }, 3000)
  }))

  const results = await Promise.all(promises)
  console.log('Results:', results)

  // teardown
  clients.forEach(c=>c.sock.disconnect())
  host.disconnect()
}

run().catch(e=>{ console.error(e); process.exit(1) })
