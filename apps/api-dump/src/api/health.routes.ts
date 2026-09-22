import { Router } from 'express'
import { nansenClient } from '../data/nansen.client'

const router = Router()

router.get('/', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Token God Indexes API',
    version: '1.0.0',
    nansenApiCalls: nansenClient.getCallCount(),
    uptime: process.uptime(),
  })
})

export { router as healthRouter }