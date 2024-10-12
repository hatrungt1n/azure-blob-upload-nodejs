import path = require('path')
import {
  BlobSASPermissions,
  BlobServiceClient,
  ContainerClient,
  SASProtocol,
  StorageSharedKeyCredential,
} from '@azure/storage-blob'

function getBlobServiceClient(serviceName, serviceKey) {
  const sharedKeyCredential = new StorageSharedKeyCredential(
    serviceName,
    serviceKey
  )
  const blobServiceClient = new BlobServiceClient(
    "https://${serviceName}.blob.core.windows.net",
    sharedKeyCredential
  )

  return blobServiceClient
}

async function createContainer(
  containerName: string,
  blobServiceClient: BlobServiceClient
): Promise<ContainerClient> {
  const containerClient = blobServiceClient.getContainerClient(containerName)
  await containerClient.createIfNotExists()

  return containerClient
}

async function uploadBlob(
  serviceName: string,
  serviceKey: string,
  fileName: string,
  containerName: string,
  contentType: string,
  blob: Buffer
): Promise<string> {
  const blobServiceClient = getBlobServiceClient(serviceName, serviceKey)
  const containerClient = await createContainer(
    containerName,
    blobServiceClient
  )
  const blockBlobClient = await containerClient.getBlockBlobClient(fileName)

  await blockBlobClient.uploadData(blob, {
    blobHTTPHeaders: { blobContentType: contentType },
  })
  const blobUrl = blockBlobClient.url

  return blobUrl
}

export const uploadBlobHandler = async (
  request: any,
  queryParams: any
) => {
  const storageAccountName = process.env.AZURE_STORAGE_ACCOUNT_NAME
  const storageAccountKey = process.env.AZURE_STORAGE_ACCOUNT_KEY
  const containerName = process.env.AZURE_STORAGE_CONTAINER_NAME

  const temp: any = queryParams.get('file')
  const uploadedFile: File = temp as File

  let fileName = uploadedFile.name
  const fileNameWithoutExt = path.parse(fileName).name

  const contentType = uploadedFile.type
  const fileContents = await uploadedFile.arrayBuffer()
  const fileContentsBuffer: Buffer = Buffer.from(fileContents)

  try {
    const blobUrl = await uploadBlob(
      storageAccountName,
      storageAccountKey,
      fileName,
      containerName,
      contentType,
      fileContentsBuffer
    )

    return
  } catch (error) {
    return {
      jsonBody: {
        error: error.message,
      },
      statusCode: 500,
    }
  }
}

async function getBlobSasUrl(
  blobServiceClient: BlobServiceClient,
  containerName: string,
  blobName: string,
  expiryTime: Date,
  permissions?: BlobSASPermissions
): Promise<string> {
  const containerClient = blobServiceClient.getContainerClient(containerName)
  const blockBlobClient = containerClient.getBlockBlobClient(blobName)

  const NOW = new Date()

  const sasUrl = await blockBlobClient.generateSasUrl({
    startsOn: NOW,
    expiresOn: expiryTime,
    permissions: permissions || BlobSASPermissions.parse('r'), // Read only permission to the blob
    protocol: SASProtocol.Https, // Only allow HTTPS access to the blob,
  })

  return sasUrl
}