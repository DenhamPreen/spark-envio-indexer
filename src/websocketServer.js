import { Server, OPEN } from "ws"

const wss = new Server({ port: 8081 })

wss.on("connection", function connection(ws) {
  ws.on("message", function incoming(message) {
    console.log("received: %s", message)
  })

  ws.send(
    JSON.stringify({
      type: "connection",
      message: "Connected to WebSocket server",
    })
  )
})

function replacer(key, value) {
  if (typeof value === "bigint") {
    return value.toString()
  }
  return value
}

function notifyClients(eventType, data) {
  const message = JSON.stringify({ type: eventType, data: data }, replacer)

  wss.clients.forEach(function each(client) {
    if (client.readyState === OPEN) {
      client.send(message)
    }
  })
}

export default notifyClients
