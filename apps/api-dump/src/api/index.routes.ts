import { Router } from 'express'
import { indexService } from '../services/index.service'

const router = Router()

router.get('/current', async (req, res, next) => {
  try {
    const index = await indexService.getCurrent()
    res.json(index)
  } catch (error) {
    next(error)
  }
})

router.get('/rebalance', async (req, res, next) => {
  try {
    const { rebalanceService } = await import('../services/rebalance.service')
    const signal = await rebalanceService.generateSignal()
    res.json(signal)
  } catch (error) {
    next(error)
  }
})

export { router as indexRouter }