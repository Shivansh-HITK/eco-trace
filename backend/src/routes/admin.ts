import { Router } from 'express'
import { requireAuth, requireRole } from '../middleware/auth'
import { prisma } from '../db/prisma'

const router = Router()

router.get('/stats', requireAuth, requireRole('ADMIN'), async (_req, res) => {
	const [totalItems, totalUsers, totalNGOs, totalDrivers, statusBuckets] = await Promise.all([
		prisma.eWasteItem.count(),
		prisma.user.count(),
		prisma.user.count({ where: { role: 'NGO' } }),
		prisma.user.count({ where: { role: 'DRIVER' } }),
		prisma.eWasteItem.groupBy({ by: ['status'], _count: { _all: true } })
	])
	return res.json({
		totalItems,
		totalUsers,
		totalNGOs,
		totalDrivers,
		statusDistribution: statusBuckets.map(b => ({ status: b.status, count: b._count._all }))
	})
})

export default router