import sharp from "sharp";
import { HttpError } from "@/server/http";
export async function cropSourceRegion(buffer: Buffer, region: { x: number; y: number; width: number; height: number }): Promise<Buffer> {
  if (![region.x, region.y, region.width, region.height].every(Number.isFinite) || region.x < 0 || region.y < 0 || region.width <= 0 || region.height <= 0 || region.x + region.width > 1.00001 || region.y + region.height > 1.00001) throw new HttpError(400, "선택 영역이 원본 이미지 밖에 있습니다.");
  const oriented = await sharp(buffer, { limitInputPixels: 40000000 }).rotate().toBuffer({ resolveWithObject: true });
  const left = Math.floor(region.x * oriented.info.width); const top = Math.floor(region.y * oriented.info.height);
  const width = Math.min(oriented.info.width - left, Math.max(1, Math.round(region.width * oriented.info.width)));
  const height = Math.min(oriented.info.height - top, Math.max(1, Math.round(region.height * oriented.info.height)));
  return sharp(oriented.data).extract({ left, top, width, height }).png().toBuffer();
}
