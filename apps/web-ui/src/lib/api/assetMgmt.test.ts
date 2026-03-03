import { describe, it, expect } from 'vitest'
import { getAttachmentDownloadUrl } from './assetMgmt'

describe('assetMgmt api', () => {
  it('builds attachment download url', () => {
    const url = getAttachmentDownloadUrl('asset-1', 'att-1')
    expect(url).toContain('/v1/assets/asset-1/attachments/att-1/download')
  })
})
