import fs from "node:fs";
import path from "node:path";

const fontsDir = path.join(process.cwd(), "src/assets/fonts");

async function loadGoogleFonts(): Promise<
  Array<{ name: string; data: ArrayBuffer; weight: number; style: string }>
> {
  const fontsConfig = [
    {
      name: "IBM Plex Mono",
      file: "IBMPlexMono-Regular.ttf",
      weight: 400,
      style: "normal",
    },
    {
      name: "IBM Plex Mono",
      file: "IBMPlexMono-Bold.ttf",
      weight: 700,
      style: "bold",
    },
  ];

  return fontsConfig.map(({ name, file, weight, style }) => {
    const buffer = fs.readFileSync(path.join(fontsDir, file));
    const data = buffer.buffer.slice(
      buffer.byteOffset,
      buffer.byteOffset + buffer.byteLength
    ) as ArrayBuffer;
    return { name, data, weight, style };
  });
}

export default loadGoogleFonts;
