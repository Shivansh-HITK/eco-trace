import bcrypt from 'bcryptjs'

const SALT_ROUNDS = 10

export async function hashPassword(plainPassword: string): Promise<string> {
	return await bcrypt.hash(plainPassword, SALT_ROUNDS)
}

export async function comparePassword(plainPassword: string, hash: string): Promise<boolean> {
	return await bcrypt.compare(plainPassword, hash)
}