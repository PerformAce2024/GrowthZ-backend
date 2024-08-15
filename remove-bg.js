import { MongoClient } from 'mongodb';
import fetch from 'node-fetch';
import FormData from 'form-data';
import { Blob } from 'buffer'; // Add this import
import 'dotenv/config';

const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri, {
  serverApi: {
    version: '1',
    strict: true,
    deprecationErrors: true,
  }
});

const dbName = 'performace';
const imagesCollectionName = 'downloaded_images'; // Collection to store original images
const extractedImagesCollectionName = 'extracted_images'; // Collection to store images with removed background

async function fetchImagesFromMongoDB() {
  try {
    console.log('Connecting to MongoDB...');
    await client.connect();
    const db = client.db(dbName);
    const imagesCollection = db.collection(imagesCollectionName);

    console.log('Fetching images from MongoDB...');
    const files = await imagesCollection.find({}).toArray(); // Fetch all images from collection
    console.log(`Found ${files.length} images.`);
    return files;
  } catch (error) {
    console.error('Error fetching images:', error);
    return []; // Return an empty array in case of an error
  }
}

async function removeBg(buffer) {
  const formData = new FormData();
  formData.append("size", "auto");
  formData.append("image_file", new Blob([buffer]));

  const response = await fetch("https://api.remove.bg/v1.0/removebg", {
    method: "POST",
    headers: { "X-Api-Key": "bwY3Qn2yNU3j3dMsfDcB3ow6" },
    body: formData,
  });

  if (response.ok) {
    return await response.arrayBuffer();
  } else {
    throw new Error(`${response.status}: ${response.statusText}`);
  }
}

async function storeImageInMongoDB(filename, buffer) {
  try {
    console.log(`Storing image ${filename} in MongoDB...`);
    const db = client.db(dbName);
    const extractedImagesCollection = db.collection(extractedImagesCollectionName);

    await extractedImagesCollection.insertOne({
      filename: filename,
      data: buffer,
    });

    console.log(`Image ${filename} stored successfully.`);
  } catch (error) {
    console.error('Error storing image:', error);
  }
}

async function processImages() {
  try {
    console.log('Starting image processing...');
    const images = await fetchImagesFromMongoDB();

    for (const image of images) {
      console.log(`Processing image ${image.filename}...`);

      // Ensure image.data is a Buffer
      const buffer = Buffer.isBuffer(image.data) ? image.data : Buffer.from(image.data);

      const noBgImageBuffer = await removeBg(buffer);

      const extractedFilename = `extracted_${image.filename}`;
      await storeImageInMongoDB(extractedFilename, noBgImageBuffer);

      console.log(`Processed and stored ${extractedFilename}`);
    }
  } catch (error) {
    console.error('Error processing images:', error);
  } finally {
    console.log('Closing MongoDB connection...');
    await client.close();
    console.log('MongoDB connection closed.');
  }
}

// Run the process
processImages();
