import { DocumentProcessorServiceClient } from '@google-cloud/documentai';
import axios from 'axios';
import { fromBuffer } from 'file-type';
import logger from './logger';

const docaiClient = new DocumentProcessorServiceClient();
const projectId = process.env.GCP_PROJECT!;
const location = 'us'; // or 'eu'
const processorId = 'f0e49fa3b2aa5242';

export async function extractTextFromDocument(fileUrl: string): Promise<string> {
    logger.info(`Starting text extraction for file: ${fileUrl}`);

    const name = `projects/${projectId}/locations/${location}/processors/${processorId}`;
    logger.debug(`Document AI processor name: ${name}`);

    try {
        // Step 1: Download the file
        logger.info(`Downloading file from URL: ${fileUrl}`);
        const response = await axios.get<ArrayBuffer>(fileUrl, {
            responseType: 'arraybuffer',
        });

        const fileBuffer = Buffer.from(response.data);
        logger.info(`File downloaded successfully. Size: ${fileBuffer.length} bytes`);

        // Step 2: Detect MIME type dynamically
        logger.info(`Detecting MIME type of the file`);
        const fileType = await fromBuffer(fileBuffer);
        if (!fileType || !fileType.mime) {
            logger.error('Unable to determine MIME type of the file');
            throw new Error('Unable to determine MIME type of the file');
        }

        const mimeType = fileType.mime; // e.g. 'application/pdf', 'image/jpeg'
        logger.info(`MIME type detected: ${mimeType}`);

        // Step 3: Send to Document AI
        logger.info(`Sending file to Document AI for processing`);
        const request = {
            name,
            rawDocument: {
                content: fileBuffer.toString('base64'),
                mimeType,
            },
        };

        const [result] = await docaiClient.processDocument(request);
        logger.info(`Document AI processing completed successfully`);

        return result.document?.text || '';
    } catch (error) {
        logger.error(`Error during text extraction: ${error instanceof Error ? error.message : error}`);
        throw error;
    }
}