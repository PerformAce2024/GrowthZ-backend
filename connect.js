import { MongoClient } from 'mongodb';
import fetch from 'node-fetch';
import * as cheerio from 'cheerio';
import { createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import 'dotenv/config';

const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const dbName = 'performace';
const imagesCollectionName = 'downloaded_images';
const playStoreUrl = 'https://play.google.com/store/apps/details?id=zolve.credit.card.us&hl=en_IN&pli=1';

async function downloadImage(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch image from ${url}`);
  
  // Return image buffer
  const imageBuffer = await response.arrayBuffer();
  return imageBuffer;
}

async function storeImageInMongoDB(filename, imageBuffer) {
  const db = client.db(dbName);
  const imagesCollection = db.collection(imagesCollectionName);

  await imagesCollection.insertOne({
    filename: filename,
    data: imageBuffer,
  });

  console.log(`Stored ${filename} in MongoDB`);
}

async function scrapeAndStoreImages() {
  try {
    await client.connect();
    const response = await fetch(playStoreUrl);
    const html = await response.text();
    const $ = cheerio.load(html);

    // Find images with the 'Screenshot image' alt text
    const imageUrls = [];
    $('img[alt="Screenshot image"]').each((i, elem) => {
      let imageUrl = $(elem).attr('src');
      if (imageUrl) {
        if (imageUrl.startsWith('//')) {
          imageUrl = 'https:' + imageUrl;  // Ensure URL is absolute
        }
        imageUrls.push(imageUrl);
      }
    });

    // Download and store each image
    for (const url of imageUrls) {
      const filename = `screenshot_${Date.now()}.jpg`;
      const imageBuffer = await downloadImage(url);
      await storeImageInMongoDB(filename, imageBuffer);
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

scrapeAndStoreImages();
