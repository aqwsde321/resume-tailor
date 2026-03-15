"use client";

const ACCEPTED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_SOURCE_FILE_SIZE = 6 * 1024 * 1024;
const OUTPUT_SIZE = 480;
const OUTPUT_MIME_TYPE = "image/jpeg";
const OUTPUT_QUALITY = 0.9;

function loadImageElement(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const reader = new FileReader();

    reader.onerror = () => {
      reject(new Error("이미지 파일을 읽지 못했어요."));
    };

    reader.onload = () => {
      const image = new Image();

      image.onerror = () => {
        reject(new Error("이미지 파일을 열지 못했어요."));
      };

      image.onload = () => {
        resolve(image);
      };

      image.src = typeof reader.result === "string" ? reader.result : "";
    };

    reader.readAsDataURL(file);
  });
}

export async function createPdfProfileImageDataUrl(file: File) {
  if (!ACCEPTED_IMAGE_TYPES.has(file.type)) {
    throw new Error("JPG, PNG, WebP 이미지만 사용할 수 있어요.");
  }

  if (file.size > MAX_SOURCE_FILE_SIZE) {
    throw new Error("이미지는 6MB 이하로 올려 주세요.");
  }

  const image = await loadImageElement(file);
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("이미지 편집을 위한 캔버스를 만들지 못했어요.");
  }

  const cropSize = Math.min(image.width, image.height);
  const sourceX = Math.max(0, (image.width - cropSize) / 2);
  const sourceY = Math.max(0, (image.height - cropSize) / 2);

  canvas.width = OUTPUT_SIZE;
  canvas.height = OUTPUT_SIZE;
  context.drawImage(
    image,
    sourceX,
    sourceY,
    cropSize,
    cropSize,
    0,
    0,
    OUTPUT_SIZE,
    OUTPUT_SIZE
  );

  return canvas.toDataURL(OUTPUT_MIME_TYPE, OUTPUT_QUALITY);
}
