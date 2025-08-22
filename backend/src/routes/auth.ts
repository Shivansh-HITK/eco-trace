import { Router } from 'express'
import { prisma } from '../db/prisma'
import { z } from 'zod'
import { hashPassword, comparePassword } from '../utils/hash'
import { signJwt } from '../utils/jwt'
import { Role } from '@prisma/client'

const router = Router()

const RegisterSchema = z.object({
	email: z.string().email(),
	password: z.string().min(6),
	name: z.string().optional(),
	role: z.enum(['INDIVIDUAL', 'NGO', 'DRIVER']).default('INDIVIDUAL'),
	orgName: z.string().optional()
})

router.post('/register', async (req, res) => {
	const parse = RegisterSchema.safeParse(req.body)
	if (!parse.success) return res.status(400).json({ error: parse.error.flatten() })
	const { email, password, name, role, orgName } = parse.data
	const existing = await prisma.user.findUnique({ where: { email } })
	if (existing) return res.status(409).json({ error: 'Email already registered' })
	const passwordHash = await hashPassword(password)
	const user = await prisma.user.create({ data: { email, passwordHash, role: role as Role, name } })
	if (role === 'NGO') {
		await prisma.nGOProfile.create({ data: { userId: user.id, orgName: orgName || 'NGO Org' } })
	}
	if (role === 'DRIVER') {
		await prisma.driverProfile.create({ data: { userId: user.id } })
	}
	const token = signJwt({ userId: user.id, role: user.role })
	return res.json({ token, user: { id: user.id, email: user.email, role: user.role, name: user.name } })
})

const LoginSchema = z.object({ email: z.string().email(), password: z.string().min(6) })

router.post('/login', async (req, res) => {
	const parse = LoginSchema.safeParse(req.body)
	if (!parse.success) return res.status(400).json({ error: parse.error.flatten() })
	const { email, password } = parse.data
	const user = await prisma.user.findUnique({ where: { email } })
	if (!user || !user.passwordHash) return res.status(401).json({ error: 'Invalid credentials' })
	const ok = await comparePassword(password, user.passwordHash)
	if (!ok) return res.status(401).json({ error: 'Invalid credentials' })
	const token = signJwt({ userId: user.id, role: user.role })
	return res.json({ token, user: { id: user.id, email: user.email, role: user.role, name: user.name } })
})

const OtpRequestSchema = z.object({ email: z.string().email() })
router.post('/otp/request', async (req, res) => {
	const parse = OtpRequestSchema.safeParse(req.body)
	if (!parse.success) return res.status(400).json({ error: parse.error.flatten() })
	const user = await prisma.user.findUnique({ where: { email: parse.data.email } })
	if (!user) return res.status(404).json({ error: 'User not found' })
	const { generateNumericOtp, expirationFromNow } = await import('../utils/otp')
	const code = generateNumericOtp(6)
	await prisma.oTPCode.create({ data: { userId: user.id, code, expiresAt: expirationFromNow(5) } })
	return res.json({ sent: true })
})

const OtpVerifySchema = z.object({ email: z.string().email(), code: z.string().length(6) })
router.post('/otp/verify', async (req, res) => {
	const parse = OtpVerifySchema.safeParse(req.body)
	if (!parse.success) return res.status(400).json({ error: parse.error.flatten() })
	const user = await prisma.user.findUnique({ where: { email: parse.data.email } })
	if (!user) return res.status(404).json({ error: 'User not found' })
	const otp = await prisma.oTPCode.findFirst({ where: { userId: user.id, code: parse.data.code, consumed: false }, orderBy: { createdAt: 'desc' } })
	if (!otp || otp.expiresAt < new Date()) return res.status(400).json({ error: 'Invalid or expired OTP' })
	await prisma.oTPCode.update({ where: { id: otp.id }, data: { consumed: true } })
	const token = signJwt({ userId: user.id, role: user.role })
	return res.json({ token, user: { id: user.id, email: user.email, role: user.role, name: user.name } })
})

export default router