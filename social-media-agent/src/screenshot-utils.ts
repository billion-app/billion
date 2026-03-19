import { Page, Locator } from 'playwright';
import * as path from 'path';
import * as fs from 'fs';
import sharp from 'sharp';

export class ScreenshotUtils {
  constructor(private screenshotsDir: string) {
    // Ensure directory exists
    if (!fs.existsSync(screenshotsDir)) {
      fs.mkdirSync(screenshotsDir, { recursive: true });
    }
  }

  async captureElement(
    page: Page,
    selector: string,
    name: string,
    options: { padding?: number; highlight?: boolean } = {}
  ): Promise<string> {
    const { padding = 10, highlight = false } = options;

    try {
      // Wait for selector to be visible
      await page.waitForSelector(selector, { timeout: 5000 });

      const element = page.locator(selector).first();

      // Highlight element if requested (for debugging)
      if (highlight) {
        await element.evaluate((el: Element) => {
          const htmlEl = el as HTMLElement;
          const originalOutline = htmlEl.style.outline;
          htmlEl.style.outline = '3px solid #ff0000';
          setTimeout(() => {
            htmlEl.style.outline = originalOutline;
          }, 1000);
        });
        await page.waitForTimeout(1000);
      }

      // Get element bounding box
      const box = await element.boundingBox();
      if (!box) {
        throw new Error(`Element ${selector} not visible or has zero size`);
      }

      // Add padding
      const paddedBox = {
        x: Math.max(0, box.x - padding),
        y: Math.max(0, box.y - padding),
        width: box.width + padding * 2,
        height: box.height + padding * 2,
      };

      // Take screenshot of element region
      const screenshotPath = this.getScreenshotPath(name);
      await page.screenshot({
        path: screenshotPath,
        clip: paddedBox,
        type: 'png',
      });

      console.log(`Screenshot saved: ${screenshotPath}`);
      return screenshotPath;

    } catch (error) {
      console.error(`Failed to capture element ${selector}:`, error);

      // Fallback to full page screenshot
      console.log('Falling back to full page screenshot');
      return this.captureFullPage(page, `${name}-fullpage`);
    }
  }

  async captureFullPage(page: Page, name: string): Promise<string> {
    const screenshotPath = this.getScreenshotPath(name);

    await page.screenshot({
      path: screenshotPath,
      fullPage: true,
      type: 'png',
    });

    console.log(`Full page screenshot saved: ${screenshotPath}`);
    return screenshotPath;
  }

  async captureMultipleElements(
    page: Page,
    selectors: string[],
    name: string,
    options: { spacing?: number; direction?: 'vertical' | 'horizontal' } = {}
  ): Promise<string> {
    const { spacing = 20, direction = 'vertical' } = options;
    const elementImages: Buffer[] = [];
    let maxWidth = 0;
    let maxHeight = 0;
    let totalHeight = 0;
    let totalWidth = 0;

    for (let i = 0; i < selectors.length; i++) {
      const selector = selectors[i];
      try {
        await page.waitForSelector(selector, { timeout: 3000 });
        const element = page.locator(selector).first();
        const box = await element.boundingBox();

        if (box) {
          const screenshot = await page.screenshot({
            clip: box,
            type: 'png',
          });

          elementImages.push(Buffer.from(screenshot));

          if (direction === 'vertical') {
            maxWidth = Math.max(maxWidth, box.width);
            totalHeight += box.height + (i < selectors.length - 1 ? spacing : 0);
          } else {
            maxHeight = Math.max(maxHeight, box.height);
            totalWidth += box.width + (i < selectors.length - 1 ? spacing : 0);
          }
        }
      } catch (error) {
        console.error(`Failed to capture element ${selector}:`, error);
      }
    }

    if (elementImages.length === 0) {
      throw new Error('No elements captured');
    }

    // Create composite image
    const compositePath = this.getScreenshotPath(name);

    if (direction === 'vertical') {
      await this.createVerticalComposite(elementImages, maxWidth, totalHeight, spacing, compositePath);
    } else {
      await this.createHorizontalComposite(elementImages, totalWidth, maxHeight, spacing, compositePath);
    }

    return compositePath;
  }

  private async createVerticalComposite(
    images: Buffer[],
    width: number,
    totalHeight: number,
    spacing: number,
    outputPath: string
  ): Promise<void> {
    const composite = sharp({
      create: {
        width,
        height: totalHeight,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      }
    });

    // Compute metadata for all images first
    const imageMetadata = await Promise.all(
      images.map(async (imageBuffer) => {
        const metadata = await sharp(imageBuffer).metadata();
        return { imageBuffer, metadata };
      })
    );

    let y = 0;
    const operations = imageMetadata.map(({ imageBuffer, metadata }, index) => {
      const newHeight = Math.round(width * metadata.height! / metadata.width!);
      const operation = sharp(imageBuffer)
        .resize(width, newHeight)
        .toBuffer();

      const currentY = y;
      y += metadata.height! + (index < images.length - 1 ? spacing : 0);

      return { operation, x: 0, y: currentY };
    });

    const resolvedOperations = await Promise.all(
      operations.map(async (op) => ({
        input: await op.operation,
        left: op.x,
        top: op.y,
      }))
    );

    await composite.composite(resolvedOperations).toFile(outputPath);
  }

  private async createHorizontalComposite(
    images: Buffer[],
    totalWidth: number,
    height: number,
    spacing: number,
    outputPath: string
  ): Promise<void> {
    const composite = sharp({
      create: {
        width: totalWidth,
        height,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      }
    });

    // Compute metadata for all images first
    const imageMetadata = await Promise.all(
      images.map(async (imageBuffer) => {
        const metadata = await sharp(imageBuffer).metadata();
        return { imageBuffer, metadata };
      })
    );

    let x = 0;
    const operations = imageMetadata.map(({ imageBuffer, metadata }, index) => {
      const newWidth = Math.round(height * metadata.width! / metadata.height!);
      const operation = sharp(imageBuffer)
        .resize(newWidth, height)
        .toBuffer();

      const currentX = x;
      x += metadata.width! + (index < images.length - 1 ? spacing : 0);

      return { operation, x: currentX, y: 0 };
    });

    const resolvedOperations = await Promise.all(
      operations.map(async (op) => ({
        input: await op.operation,
        left: op.x,
        top: op.y,
      }))
    );

    await composite.composite(resolvedOperations).toFile(outputPath);
  }

  async addBranding(
    screenshotPath: string,
    options: { watermark?: string; logoPath?: string } = {}
  ): Promise<string> {
    const { watermark = 'via Billion App', logoPath } = options;

    const image = sharp(screenshotPath);
    const metadata = await image.metadata();

    // Add watermark text
    const svgText = `
      <svg width="${metadata.width}" height="${metadata.height}">
        <style>
          .watermark {
            font-family: Arial, sans-serif;
            font-size: 24px;
            fill: rgba(255, 255, 255, 0.7);
            text-anchor: end;
          }
        </style>
        <text x="95%" y="97%" class="watermark">${watermark}</text>
      </svg>
    `;

    const brandedPath = screenshotPath.replace('.png', '-branded.png');

    await image
      .composite([
        {
          input: Buffer.from(svgText),
          top: 0,
          left: 0,
        },
      ])
      .toFile(brandedPath);

    return brandedPath;
  }

  private getScreenshotPath(name: string): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const safeName = name.replace(/[^a-z0-9]/gi, '-').toLowerCase();
    const filename = `${timestamp}-${safeName}.png`;
    return path.join(this.screenshotsDir, filename);
  }

  getScreenshotsDir(): string {
    return this.screenshotsDir;
  }
}