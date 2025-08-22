export function generateNumericOtp(length: number = 6): string {
	let code = ''
	for (let i = 0; i < length; i++) {
		code += Math.floor(Math.random() * 10).toString()
	}
	return code
}

export function expirationFromNow(minutes: number): Date {
	const now = new Date()
	now.setMinutes(now.getMinutes() + minutes)
	return now
}