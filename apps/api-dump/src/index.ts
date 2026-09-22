import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import { indexRouter } from './api/index.routes'
import { arbitrageRouter } from './api/arbitrage.routes'
import { healthRouter } from './api/health.routes'
import { errorHandler, notFound } from './middleware/error.middleware'

const app = express()
const PORT = process.env.PORT_API || 3001

app.use(helmet())
app.use(cors())
app.use(express.json())

app.use('/api/index', indexRouter)
app.use('/api/arbitrage', arbitrageRouter)
app.use('/health', healthRouter)

app.use(notFound)
app.use(errorHandler)

app.listen(PORT, () => {
  console.log(`Token God Indexes API running on http://localhost:${PORT}`)
})

export default app