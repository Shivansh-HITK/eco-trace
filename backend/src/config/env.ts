import dotenv from 'dotenv'
import { z } from 'zod'

dotenv.config()

const EnvSchema = z.object({
	PORT: z.string().optional(),
	DATABASE_URL: z.string().min(1),
	JWT_SECRET: z.string().min(10),
	QR_SIGNING_SECRET: z.string().optional().default('qr-signing-dev-secret'),
	OTP_EXP_MINUTES: z.string().optional().default('5')
})

const parsed = EnvSchema.safeParse(process.env)
if (!parsed.success) {
	console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors)
	process.exit(1)
}

export const env = {
	port: Number(parsed.data.PORT ?? 4000),
	databaseUrl: parsed.data.DATABASE_URL,
	jwtSecret: parsed.data.JWT_SECRET,
	qrSigningSecret: parsed.data.QR_SIGNING_SECRET,
	otpExpMinutes: Number(parsed.data.OTP_EXP_MINUTES)
}