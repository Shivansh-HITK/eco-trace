import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../db/prisma'
import { requireAuth, requireRole } from '../middleware/auth'
import { Role, ItemStatus } from '@prisma/client'
import { signQrPayload, generateQrDataUrl } from '../utils/qr'

const router = Router()

const CreateItemSchema = z.object({
	type: z.string(),
	brand: z.string().optional(),
	model: z.string().optional(),
	weightKg: z.number().optional(),
	condition: z.string().optional(),
	photoUrl: z.string().url().optional(),
	geolocation: z.string().optional()
})

router.post('/', requireAuth, async (req, res) => {
	const parse = CreateItemSchema.safeParse(req.body)
	if (!parse.success) return res.status(400).json({ error: parse.error.flatten() })
	const user = (req as any).user as { userId: string; role: Role }
	const publicId = `EW-${Math.random().toString(36).slice(2, 10).toUpperCase()}`
	const item = await prisma.eWasteItem.create({
		data: {
			publicId,
			ownerId: user.userId,
			...parse.data,
			status: 'REGISTERED'
		}
	})
	await prisma.statusHistory.create({ data: { itemId: item.id, status: 'REGISTERED' } })
	return res.json(item)
})

router.get('/', requireAuth, async (req, res) => {
	const user = (req as any).user as { userId: string; role: Role }
	let items
	if (user.role === 'ADMIN') {
		items = await prisma.eWasteItem.findMany({ orderBy: { submittedAt: 'desc' } })
	} else if (user.role === 'INDIVIDUAL') {
		items = await prisma.eWasteItem.findMany({ where: { ownerId: user.userId }, orderBy: { submittedAt: 'desc' } })
	} else if (user.role === 'NGO') {
		const ngo = await prisma.nGOProfile.findFirst({ where: { userId: user.userId } })
		items = await prisma.eWasteItem.findMany({ where: { ngoId: ngo?.id || undefined }, orderBy: { submittedAt: 'desc' } })
	} else {
		const driver = await prisma.driverProfile.findFirst({ where: { userId: user.userId } })
		items = await prisma.eWasteItem.findMany({ where: { driverId: driver?.id || undefined }, orderBy: { submittedAt: 'desc' } })
	}
	return res.json(items)
})

router.get('/:publicId', requireAuth, async (req, res) => {
	const item = await prisma.eWasteItem.findUnique({ where: { publicId: req.params.publicId }, include: { statusHistory: true } })
	if (!item) return res.status(404).json({ error: 'Item not found' })
	return res.json(item)
})

const UpdateStatusSchema = z.object({ status: z.nativeEnum(ItemStatus), note: z.string().optional(), geo: z.string().optional() })
router.post('/:publicId/status', requireAuth, requireRole('NGO', 'DRIVER', 'ADMIN'), async (req, res) => {
	const parse = UpdateStatusSchema.safeParse(req.body)
	if (!parse.success) return res.status(400).json({ error: parse.error.flatten() })
	const item = await prisma.eWasteItem.findUnique({ where: { publicId: req.params.publicId } })
	if (!item) return res.status(404).json({ error: 'Item not found' })
	const updated = await prisma.eWasteItem.update({ where: { id: item.id }, data: { status: parse.data.status } })
	await prisma.statusHistory.create({ data: { itemId: item.id, status: parse.data.status, note: parse.data.note, geo: parse.data.geo } })
	return res.json(updated)
})

router.get('/:publicId/qr', requireAuth, async (req, res) => {
	const item = await prisma.eWasteItem.findUnique({ where: { publicId: req.params.publicId } })
	if (!item) return res.status(404).json({ error: 'Item not found' })
	const payload = signQrPayload({ publicId: item.publicId })
	const dataUrl = await generateQrDataUrl(payload)
	return res.json({ dataUrl, payload })
})

const ScanSchema = z.object({ payload: z.record(z.any()) })
router.post('/scan', requireAuth, async (req, res) => {
	const parse = ScanSchema.safeParse(req.body)
	if (!parse.success) return res.status(400).json({ error: parse.error.flatten() })
	const { verifyQrPayload } = await import('../utils/qr')
	const verified = verifyQrPayload(parse.data.payload)
	if (!verified) return res.status(400).json({ error: 'Invalid QR payload' })
	const item = await prisma.eWasteItem.findUnique({ where: { publicId: verified.publicId } })
	if (!item) return res.status(404).json({ error: 'Item not found' })
	const user = (req as any).user as { userId: string; role: Role }
	if (user.role === 'ADMIN' || user.role === 'NGO' || user.role === 'DRIVER' || item.ownerId === user.userId) {
		return res.json({ item })
	}
	return res.status(403).json({ error: 'Forbidden' })
})

export default router