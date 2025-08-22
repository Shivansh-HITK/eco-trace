import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../db/prisma'
import { requireAuth, requireRole } from '../middleware/auth'

const router = Router()

const CreateAssignmentSchema = z.object({
	driverUserId: z.string(),
	itemPublicIds: z.array(z.string()).min(1)
})

router.post('/', requireAuth, requireRole('NGO', 'ADMIN'), async (req, res) => {
	const parse = CreateAssignmentSchema.safeParse(req.body)
	if (!parse.success) return res.status(400).json({ error: parse.error.flatten() })
	const ngo = await prisma.nGOProfile.findFirst({ where: { userId: (req as any).user.userId } })
	if (!ngo) return res.status(400).json({ error: 'NGO profile not found' })
	const driver = await prisma.driverProfile.findFirst({ where: { userId: parse.data.driverUserId } })
	if (!driver) return res.status(404).json({ error: 'Driver not found' })
	const items = await prisma.eWasteItem.findMany({ where: { publicId: { in: parse.data.itemPublicIds } } })
	const assignment = await prisma.pickupAssignment.create({ data: { ngoId: ngo.id, driverId: driver.id } })
	await prisma.eWasteItem.updateMany({ where: { id: { in: items.map(i => i.id) } }, data: { assignmentId: assignment.id, driverId: driver.id, ngoId: ngo.id } })
	return res.json({ assignmentId: assignment.id, itemsAssigned: items.length })
})

router.get('/my', requireAuth, requireRole('DRIVER'), async (req, res) => {
	const driver = await prisma.driverProfile.findFirst({ where: { userId: (req as any).user.userId } })
	if (!driver) return res.status(400).json({ error: 'Driver profile not found' })
	const assignments = await prisma.pickupAssignment.findMany({ where: { driverId: driver.id }, include: { items: true } })
	return res.json(assignments)
})

const BatchStatusSchema = z.object({
	publicIds: z.array(z.string()).min(1),
	status: z.enum(['PICKED_UP', 'IN_TRANSIT', 'AT_SORTING_CENTER', 'RECYCLED_DISPOSED']),
	note: z.string().optional(),
	geo: z.string().optional()
})

router.post('/batch/status', requireAuth, requireRole('NGO', 'DRIVER', 'ADMIN'), async (req, res) => {
	const parse = BatchStatusSchema.safeParse(req.body)
	if (!parse.success) return res.status(400).json({ error: parse.error.flatten() })
	const items = await prisma.eWasteItem.findMany({ where: { publicId: { in: parse.data.publicIds } } })
	for (const item of items) {
		await prisma.eWasteItem.update({ where: { id: item.id }, data: { status: parse.data.status as any } })
		await prisma.statusHistory.create({ data: { itemId: item.id, status: parse.data.status as any, note: parse.data.note, geo: parse.data.geo } })
	}
	return res.json({ updated: items.length })
})

export default router