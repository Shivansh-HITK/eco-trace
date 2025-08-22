import jwt from 'jsonwebtoken'
import { env } from '../config/env'
import { Role } from '@prisma/client'

export type JwtPayload = { userId: string; role: Role }

export function signJwt(payload: JwtPayload, expiresIn: string = '7d'): string {
	return jwt.sign(payload, env.jwtSecret, { expiresIn })
}

export function verifyJwt(token: string): JwtPayload {
	return jwt.verify(token, env.jwtSecret) as JwtPayload
}