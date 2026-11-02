// Serves the vanilla example page, the built button packages, and proxies /api/* to a
// wallet-connect server with the API key (the "secure, via backend" mode).
import axios from "axios"
import express from "express"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()
app.use(express.json())

app.use(express.static(__dirname))
app.use("/packages", express.static(path.join(__dirname, "../../packages")))
app.use("/static", express.static(path.join(__dirname, "../static")))

const API_KEY = process.env.WC_API_KEY ?? "c26369a948c6e287905fc5d292e65083a496a43b387bda48dbc14924099d1315"
const UPSTREAM = process.env.WC_UPSTREAM ?? "http://localhost:5021"

app.all("/api/*", async (req, res) => {
  try {
    const response = await axios({
      method: req.method,
      url: `${UPSTREAM}${req.url}`,
      headers: { Authorization: `Bearer ${API_KEY}`, "Content-Type": "application/json" },
      data: req.body,
    })
    res.status(response.status).json(response.data)
  } catch (error) {
    if (error.response) res.status(error.response.status).json(error.response.data)
    else res.status(500).json({ error: "Proxy error", message: error.message })
  }
})

const port = Number(process.env.PORT ?? 5031)
app.listen(port, () => console.log(`Vanilla example on http://localhost:${port} (proxying /api to ${UPSTREAM})`))
