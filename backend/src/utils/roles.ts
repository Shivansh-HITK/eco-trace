import { Role } from '@prisma/client'

export function isElevated(role: Role) {
	return role === 'ADMIN' || role === 'NGO'
}

export function canUpdateItemStatus(role: Role) {
	return role === 'NGO' || role === 'DRIVER' || role === 'ADMIN'
}