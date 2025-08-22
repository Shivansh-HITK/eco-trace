import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import { env } from './config/env'

import authRouter from './routes/auth'
import itemsRouter from './routes/items'
import assignmentsRouter from './routes/assignments'
import adminRouter from './routes/admin'

const app = express()
app.use(helmet())
app.use(cors())
app.use(express.json({ limit: '5mb' }))
app.use(morgan('dev'))

app.get('/health', (_req, res) => res.json({ ok: true }))

app.use('/api/auth', authRouter)
app.use('/api/items', itemsRouter)
app.use('/api/assignments', assignmentsRouter)
app.use('/api/admin', adminRouter)

app.use((err: any, _req: any, res: any, _next: any) => {
	console.error(err)
	res.status(err.status || 500).json({ error: err.message || 'Internal Server Error' })
})

app.listen(env.port, () => {
	console.log(`Backend listening on :${env.port}`)
})