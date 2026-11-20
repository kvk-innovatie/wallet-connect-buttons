// A fake wallet-connect server. Listens on the port the buttons use for `useLocalWcServer`
// (5021), so every button in the examples can run against it with any API key.
//
// A session walks through CREATED -> WAITING_FOR_RESPONSE -> DONE on its own: the first two
// status polls return CREATED (with a universal link), the next two WAITING_FOR_RESPONSE, then
// DONE. Set MOCK_OUTCOME=FAILED|EXPIRED|CANCELLED to end differently, MOCK_POLLS to change the
// pace. DELETE cancels. /api/disclosed-attributes returns fixed attributes.
//
// Issuance sessions as on the WE BUILD lane (POST /api/issuance/sessions): every status hands out
// the same credential offer (openid-credential-offer://) for MOCK_OFFER_POLLS polls (default 150,
// about five minutes), then EXPIRED; an issuance never reports DONE. With MOCK_ID_STEP=1 an ID step
// comes first: MOCK_POLLS polls with a new openid4vp:// request each, MOCK_POLLS polls
// WAITING_FOR_RESPONSE, then the offer.
import express from "express"
import { randomBytes } from "node:crypto"

const port = Number(process.env.PORT ?? 5021)
const outcome = process.env.MOCK_OUTCOME ?? "DONE"
const polls = Number(process.env.MOCK_POLLS ?? 2)
const offerPolls = Number(process.env.MOCK_OFFER_POLLS ?? 150)
const idStepPolls = process.env.MOCK_ID_STEP === "1" ? polls : 0

const sessions = new Map()
const issuances = new Map()
const app = express()
app.use(express.json())
app.use((req, res, next) => {
  res.set("Access-Control-Allow-Origin", req.headers.origin ?? "*")
  res.set("Access-Control-Allow-Headers", "Authorization, Content-Type")
  res.set("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")
  if (req.method === "OPTIONS") return res.sendStatus(204)
  next()
})

app.post("/api/create-session", (req, res) => {
  const token = randomBytes(16).toString("hex")
  sessions.set(token, { usecase: req.body?.usecase, polls: 0, cancelled: false, returnUrl: req.query.return_url })
  console.log(`session ${token} for ${req.body?.usecase} (return_url=${req.query.return_url})`)
  res.json({ status_url: `http://${req.headers.host}/disclosure/${token}/status`, session_token: token })
})

app.get("/disclosure/:token/status", (req, res) => {
  const s = sessions.get(req.params.token)
  if (!s) return res.status(404).json({ error: "unknown session" })
  if (s.cancelled) return res.json({ status: "CANCELLED" })
  s.polls += 1
  if (s.polls <= polls) {
    const ul = `walletdebuginteraction://wallet.edi.rijksoverheid.nl/disclosure/${req.params.token}?session_type=${req.query.session_type}`
    return res.json({ status: "CREATED", ul })
  }
  if (s.polls <= polls * 2) return res.json({ status: "WAITING_FOR_RESPONSE" })
  res.json({ status: outcome })
})

app.delete("/disclosure/:token/status", (req, res) => {
  const s = sessions.get(req.params.token)
  if (s) s.cancelled = true
  res.sendStatus(204)
})

app.post("/api/issuance/sessions", (req, res) => {
  const token = randomBytes(16).toString("hex")
  issuances.set(token, { usecase: req.body?.usecase, polls: 0, cancelled: false })
  console.log(`issuance session ${token} for ${req.body?.usecase}`)
  res.json({ status_url: `http://${req.headers.host}/api/issuance/sessions/${token}`, session_token: token })
})

app.get("/api/issuance/sessions/:token", (req, res) => {
  const s = issuances.get(req.params.token)
  if (!s) return res.status(404).json({ error: "unknown session" })
  if (s.cancelled) return res.json({ status: "CANCELLED" })
  s.polls += 1
  const base = `http://${req.headers.host}/api/issuance/sessions/${req.params.token}`
  if (s.polls <= idStepPolls) {
    // the ID step's request carries a short-lived id, so its link changes on every poll
    return res.json({ status: "CREATED", ul: `openid4vp://?request_uri=${encodeURIComponent(`${base}/request/${s.polls}`)}` })
  }
  if (s.polls <= idStepPolls * 2) return res.json({ status: "WAITING_FOR_RESPONSE" })
  if (s.polls <= idStepPolls * 2 + offerPolls) {
    return res.json({ status: "CREATED", ul: `openid-credential-offer://?credential_offer_uri=${encodeURIComponent(`${base}/offer`)}` })
  }
  res.json({ status: "EXPIRED" })
})

app.delete("/api/issuance/sessions/:token", (req, res) => {
  const s = issuances.get(req.params.token)
  if (s) s.cancelled = true
  res.sendStatus(204)
})

app.get("/api/disclosed-attributes", (req, res) => {
  const id = req.query.client_id ?? req.query.service_id
  res.json({
    attributes: {
      "urn:eudi:pid:nl:1": {
        attributes: { given_name: "Willeke", family_name: "De Bruijn", age_over_18: true },
        issuerUri: "https://pid.example",
        validityInfo: { validFrom: "2026-01-01T00:00:00Z", validUntil: "2027-01-01T00:00:00Z" },
      },
    },
    session_token: req.query.session_token,
    [req.query.client_id ? "client_id" : "service_id"]: id,
  })
})

const credentials = (req, res) =>
  res.json({
    success: true,
    data: {
      clientId: req.params.id,
      companyName: "Mock Relying Party",
      requestedCredentials: [
        { credentialKey: "pid", credentialName: { en: "Personal identity data", nl: "Persoonsgegevens" }, websiteUrl: "https://example.com/pid", vct: "urn:eudi:pid:nl:1" },
      ],
    },
  })
app.get("/api/client/:id/requested-credentials", credentials)
app.get("/api/service/:id/requested-credentials", credentials)

app.listen(port, () => console.log(`mock wallet-connect on http://localhost:${port} (outcome ${outcome}, ${polls} polls per step)`))
