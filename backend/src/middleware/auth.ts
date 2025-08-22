import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { env } from '../config/env'
import { Role } from '@prisma/client'

export type AuthPayload = { userId: string; role: Role }

export function requireAuth(req: Request, res: Response, next: NextFunction) {
	const header = req.headers.authorization
	if (!header || !header.startsWith('Bearer ')) {
		return res.status(401).json({ error: 'Missing Authorization header' })
	}
	const token = header.slice('Bearer '.length)
	try {
		const decoded = jwt.verify(token, env.jwtSecret) as AuthPayload
		;(req as any).user = decoded
		next()
	} catch (err) {
		return res.status(401).json({ error: 'Invalid or expired token' })
	}
}

export function requireRole(...roles: Role[]) {
	return (req: Request, res: Response, next: NextFunction) => {
		const user = (req as any).user as AuthPayload | undefined
		if (!user) return res.status(401).json({ error: 'Unauthorized' })
		if (!roles.includes(user.role)) return res.status(403).json({ error: 'Forbidden' })
		next()
	}
}