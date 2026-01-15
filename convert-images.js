import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Fix for __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const directoryPath = path.join(__dirname, 'public');

// Helper to crawl directories recursively
const getAllFiles = (dirPath, arrayOfFiles) => {
  const files = fs.readdirSync(dirPath);

  arrayOfFiles = arrayOfFiles || [];

  files.forEach((file) => {
    if (fs.statSync(dirPath + "/" + file).isDirectory()) {
      arrayOfFiles = getAllFiles(dirPath + "/" + file, arrayOfFiles);
    } else {
      if (file.endsWith('.png') || file.endsWith('.jpg') || file.endsWith('.jpeg')) {
        arrayOfFiles.push(path.join(dirPath, "/", file));
      }
    }
  });

  return arrayOfFiles;
};

const convertImages = async () => {
  const files = getAllFiles(directoryPath);
  
  console.log(`Found ${files.length} images to convert...`);

  for (const file of files) {
    const dir = path.dirname(file);
    const ext = path.extname(file);
    const name = path.basename(file, ext);
    const newPath = path.join(dir, `${name}.webp`);

    try {
      await sharp(file)
        .webp({ quality: 80 }) // 80% quality is usually indistinguishable but 50% smaller
        .toFile(newPath);
      
      console.log(`✅ Converted: ${name}${ext} -> ${name}.webp`);
      
      // OPTIONAL: Uncomment the next line to DELETE the old PNG automatically
      // fs.unlinkSync(file); 
      
    } catch (err) {
      console.error(`❌ Failed: ${file}`, err);
    }
  }
};

convertImages();