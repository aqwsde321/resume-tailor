import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { cropSourceRegion } from "@/server/source-region";
describe("source image region selection", () => {
  it("상대 좌표의 선택 영역만 잘라 OCR 입력으로 만든다", async () => {
    const image = await sharp({ create: { width: 200, height: 100, channels: 3, background: "white" } }).png().toBuffer();
    const cropped = await cropSourceRegion(image, { x: 0.25, y: 0.2, width: 0.5, height: 0.6 });
    const metadata = await sharp(cropped).metadata();
    expect(metadata.width).toBe(100); expect(metadata.height).toBe(60);
  });
  it("이미지 바깥 영역이나 크기가 없는 선택은 거절한다", async () => {
    const image = await sharp({ create: { width: 20, height: 10, channels: 3, background: "white" } }).png().toBuffer();
    await expect(cropSourceRegion(image, { x: 0.9, y: 0, width: 0.5, height: 0.5 })).rejects.toThrow();
  });
});
