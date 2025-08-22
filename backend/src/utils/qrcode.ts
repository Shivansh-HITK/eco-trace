import QRCode from 'qrcode';
import crypto from 'crypto';
import { QRCodeData, DeviceType, ItemStatus } from '@types/index';
import { JWTUtils } from './jwt';

const QR_BASE_URL = process.env.QR_CODE_BASE_URL || 'https://your-domain.com/track';
const QR_ERROR_CORRECTION_LEVEL = process.env.QR_CODE_ERROR_CORRECTION_LEVEL as QRCode.QRCodeErrorCorrectionLevel || 'M';

export class QRCodeUtils {
  /**
   * Generate QR code data structure
   */
  static generateQRData(item: {
    _id: string;
    trackingId: string;
    deviceType: DeviceType;
    brand: string;
    model: string;
    status: ItemStatus;
    submittedAt: Date;
    estimatedCredits: number;
    submittedBy: string;
  }): QRCodeData {
    // Create verification hash for security
    const verificationString = `${item._id}${item.trackingId}${item.submittedBy}`;
    const verificationHash = crypto
      .createHash('sha256')
      .update(verificationString)
      .digest('hex')
      .substring(0, 16);

    return {
      type: 'e-waste-item',
      itemId: item._id,
      trackingId: item.trackingId,
      deviceType: item.deviceType,
      brand: item.brand,
      model: item.model,
      status: item.status,
      submittedAt: item.submittedAt,
      estimatedCredits: item.estimatedCredits,
      verificationHash
    };
  }

  /**
   * Generate QR code as data URL (base64 image)
   */
  static async generateQRCodeDataURL(
    qrData: QRCodeData,
    options: {
      width?: number;
      margin?: number;
      color?: {
        dark?: string;
        light?: string;
      };
    } = {}
  ): Promise<string> {
    try {
      const qrOptions: QRCode.QRCodeToDataURLOptions = {
        errorCorrectionLevel: QR_ERROR_CORRECTION_LEVEL,
        type: 'image/png',
        quality: 0.92,
        margin: options.margin || 2,
        width: options.width || 256,
        color: {
          dark: options.color?.dark || '#000000',
          light: options.color?.light || '#FFFFFF'
        }
      };

      const qrString = JSON.stringify(qrData);
      return await QRCode.toDataURL(qrString, qrOptions);
    } catch (error) {
      throw new Error(`Failed to generate QR code: ${error}`);
    }
  }

  /**
   * Generate QR code as SVG string
   */
  static async generateQRCodeSVG(
    qrData: QRCodeData,
    options: {
      width?: number;
      margin?: number;
      color?: {
        dark?: string;
        light?: string;
      };
    } = {}
  ): Promise<string> {
    try {
      const qrOptions: QRCode.QRCodeToStringOptions = {
        errorCorrectionLevel: QR_ERROR_CORRECTION_LEVEL,
        type: 'svg',
        margin: options.margin || 2,
        width: options.width || 256,
        color: {
          dark: options.color?.dark || '#000000',
          light: options.color?.light || '#FFFFFF'
        }
      };

      const qrString = JSON.stringify(qrData);
      return await QRCode.toString(qrString, qrOptions);
    } catch (error) {
      throw new Error(`Failed to generate QR code SVG: ${error}`);
    }
  }

  /**
   * Generate QR code as buffer (for file storage)
   */
  static async generateQRCodeBuffer(
    qrData: QRCodeData,
    options: {
      width?: number;
      margin?: number;
      color?: {
        dark?: string;
        light?: string;
      };
    } = {}
  ): Promise<Buffer> {
    try {
      const qrOptions: QRCode.QRCodeToBufferOptions = {
        errorCorrectionLevel: QR_ERROR_CORRECTION_LEVEL,
        type: 'png',
        margin: options.margin || 2,
        width: options.width || 256,
        color: {
          dark: options.color?.dark || '#000000',
          light: options.color?.light || '#FFFFFF'
        }
      };

      const qrString = JSON.stringify(qrData);
      return await QRCode.toBuffer(qrString, qrOptions);
    } catch (error) {
      throw new Error(`Failed to generate QR code buffer: ${error}`);
    }
  }

  /**
   * Parse and validate QR code data
   */
  static parseQRData(qrString: string): QRCodeData {
    try {
      const data = JSON.parse(qrString);
      
      // Validate required fields
      if (!data.type || data.type !== 'e-waste-item') {
        throw new Error('Invalid QR code type');
      }

      if (!data.itemId || !data.trackingId || !data.verificationHash) {
        throw new Error('Missing required QR code fields');
      }

      return data as QRCodeData;
    } catch (error) {
      throw new Error(`Failed to parse QR code data: ${error}`);
    }
  }

  /**
   * Verify QR code authenticity
   */
  static verifyQRCode(qrData: QRCodeData, item: {
    _id: string;
    trackingId: string;
    submittedBy: string;
  }): boolean {
    try {
      // Regenerate verification hash
      const verificationString = `${item._id}${item.trackingId}${item.submittedBy}`;
      const expectedHash = crypto
        .createHash('sha256')
        .update(verificationString)
        .digest('hex')
        .substring(0, 16);

      return qrData.verificationHash === expectedHash;
    } catch (error) {
      return false;
    }
  }

  /**
   * Generate tracking URL for QR code
   */
  static generateTrackingURL(trackingId: string): string {
    return `${QR_BASE_URL}/${trackingId}`;
  }

  /**
   * Generate QR code with tracking URL
   */
  static async generateTrackingQRCode(
    trackingId: string,
    options: {
      width?: number;
      margin?: number;
      color?: {
        dark?: string;
        light?: string;
      };
    } = {}
  ): Promise<string> {
    try {
      const trackingURL = this.generateTrackingURL(trackingId);
      
      const qrOptions: QRCode.QRCodeToDataURLOptions = {
        errorCorrectionLevel: QR_ERROR_CORRECTION_LEVEL,
        type: 'image/png',
        quality: 0.92,
        margin: options.margin || 2,
        width: options.width || 256,
        color: {
          dark: options.color?.dark || '#000000',
          light: options.color?.light || '#FFFFFF'
        }
      };

      return await QRCode.toDataURL(trackingURL, qrOptions);
    } catch (error) {
      throw new Error(`Failed to generate tracking QR code: ${error}`);
    }
  }

  /**
   * Generate batch QR codes for multiple items
   */
  static async generateBatchQRCodes(
    items: Array<{
      _id: string;
      trackingId: string;
      deviceType: DeviceType;
      brand: string;
      model: string;
      status: ItemStatus;
      submittedAt: Date;
      estimatedCredits: number;
      submittedBy: string;
    }>,
    options: {
      width?: number;
      margin?: number;
      color?: {
        dark?: string;
        light?: string;
      };
      format?: 'dataURL' | 'svg' | 'buffer';
    } = {}
  ): Promise<Array<{ itemId: string; trackingId: string; qrCode: string | Buffer }>> {
    const results = [];
    const format = options.format || 'dataURL';

    for (const item of items) {
      try {
        const qrData = this.generateQRData(item);
        let qrCode: string | Buffer;

        switch (format) {
          case 'svg':
            qrCode = await this.generateQRCodeSVG(qrData, options);
            break;
          case 'buffer':
            qrCode = await this.generateQRCodeBuffer(qrData, options);
            break;
          default:
            qrCode = await this.generateQRCodeDataURL(qrData, options);
        }

        results.push({
          itemId: item._id,
          trackingId: item.trackingId,
          qrCode
        });
      } catch (error) {
        console.error(`Failed to generate QR code for item ${item._id}:`, error);
        // Continue with other items
      }
    }

    return results;
  }

  /**
   * Generate QR code with JWT token for secure scanning
   */
  static async generateSecureQRCode(
    itemId: string,
    userId: string,
    options: {
      width?: number;
      margin?: number;
      color?: {
        dark?: string;
        light?: string;
      };
    } = {}
  ): Promise<string> {
    try {
      // Generate JWT token for QR verification
      const token = JWTUtils.generateQRVerificationToken(itemId, userId);
      const secureURL = `${QR_BASE_URL}/secure/${token}`;

      const qrOptions: QRCode.QRCodeToDataURLOptions = {
        errorCorrectionLevel: QR_ERROR_CORRECTION_LEVEL,
        type: 'image/png',
        quality: 0.92,
        margin: options.margin || 2,
        width: options.width || 256,
        color: {
          dark: options.color?.dark || '#000000',
          light: options.color?.light || '#FFFFFF'
        }
      };

      return await QRCode.toDataURL(secureURL, qrOptions);
    } catch (error) {
      throw new Error(`Failed to generate secure QR code: ${error}`);
    }
  }

  /**
   * Extract item ID from QR code data
   */
  static extractItemId(qrString: string): string | null {
    try {
      const qrData = this.parseQRData(qrString);
      return qrData.itemId;
    } catch (error) {
      return null;
    }
  }

  /**
   * Generate QR code with custom logo/branding
   */
  static async generateBrandedQRCode(
    qrData: QRCodeData,
    options: {
      width?: number;
      margin?: number;
      color?: {
        dark?: string;
        light?: string;
      };
      logo?: {
        url: string;
        size: number;
      };
    } = {}
  ): Promise<string> {
    try {
      // For now, generate standard QR code
      // In a production environment, you might want to use a library like 'qrcode-with-logos'
      // or implement custom logo overlay functionality
      return await this.generateQRCodeDataURL(qrData, options);
    } catch (error) {
      throw new Error(`Failed to generate branded QR code: ${error}`);
    }
  }
}