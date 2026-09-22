import { Router } from 'express'
import { arbitrageService } from '../services/arbitrage.service'

const router = Router()

router.get('/opportunities', async (req, res, next) => {
  try {
    const opportunities = await arbitrageService.getOpportunities()
    res.json({ opportunities })
  } catch (error) {
    next(error)
  }
})

export { router as arbitrageRouter }