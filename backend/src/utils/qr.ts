import crypto from 'crypto'
import QRCode from 'qrcode'
import { env } from '../config/env'

export type QrPayload = {
	kind: 'e-waste-item'
	publicId: string
	aud?: string
	iat: number
	exp?: number
}

export function signQrPayload(data: Omit<QrPayload, 'iat' | 'kind'>): QrPayload & { sig: string } {
	const payload: QrPayload = { kind: 'e-waste-item', publicId: data.publicId, aud: data.aud, iat: Math.floor(Date.now() / 1000), exp: data.exp }
	const serialized = JSON.stringify(payload)
	const sig = crypto.createHmac('sha256', env.qrSigningSecret).update(serialized).digest('hex')
	return { ...payload, sig }
}

export function verifyQrPayload(signed: any): QrPayload | null {
	try {
		const { sig, ...rest } = signed
		const serialized = JSON.stringify(rest)
		const expectedSig = crypto.createHmac('sha256', env.qrSigningSecret).update(serialized).digest('hex')
		if (expectedSig !== sig) return null
		if (rest.exp && rest.exp < Math.floor(Date.now() / 1000)) return null
		return rest as QrPayload
	} catch {
		return null
	}
}

export async function generateQrDataUrl(data: object): Promise<string> {
	const text = JSON.stringify(data)
	return await QRCode.toDataURL(text, { width: 256, errorCorrectionLevel: 'M' })
}