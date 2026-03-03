import { z } from 'zod'
import { assetIdParamsSchema } from './assets.schemas.js'

export const attachmentAssetParamsSchema = assetIdParamsSchema

export const attachmentDownloadParamsSchema = assetIdParamsSchema.extend({
    attachmentId: z.string().uuid()
})

export type AttachmentAssetParams = z.infer<typeof attachmentAssetParamsSchema>
export type AttachmentDownloadParams = z.infer<typeof attachmentDownloadParamsSchema>
