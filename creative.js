import { createCanvas, loadImage } from 'canvas';
import fs from 'fs';
import fetch from 'node-fetch';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { MongoClient } from 'mongodb';
import { PythonShell } from 'python-shell';
import 'dotenv/config';
// import * as tf from '@tensorflow/tfjs-node';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// // Load the font prediction model
// const modelPath = path.join(__dirname, 'font_classifier_model.h5'); // Update with your model path
// const model = loadModel(modelPath);

const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const dbName = 'Images';
const urlsCollectionName = 'URLs';

// Function to run Python script using PythonShell
async function runPythonScript(scriptName, args) {
  return new Promise((resolve, reject) => {
    PythonShell.run(scriptName, { args: args, scriptPath: __dirname }, (err, results) => {
      if (err) {
        return reject(`Python error: ${err}`);
      }
      resolve(results);
    });
  });
}

// Function to download an image from a URL and save it locally
async function downloadImage(url, outputPath) {
  const response = await fetch(url);
  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);  // Convert ArrayBuffer to Buffer
  fs.writeFileSync(outputPath, buffer);
  console.log(`Downloaded image to ${outputPath}`);
}

// // // Predict the font style using the image
// async function predictFontStyle(imagePath) {
//   return new Promise((resolve, reject) => {
//       PythonShell.run('font_style_predict.py', { args: [imagePath, modelPath] }, function (err, results) {
//           if (err) reject(err);
//           resolve(results[0]); // Font style prediction result
//       });
//   });
// }

// Function to get font style
async function getFontStyle(imagePath, modelPath) {
  try {
    const result = await runPythonScript('font_style_predict.py', [imagePath, modelPath]);
    return result[0]; // Assuming the Python script returns the font style as the first result
  } catch (error) {
    console.error(error);
    throw error;
  }
}

// Function to fetch USP phrase
async function fetchPhrase(googlePlayUrl, appleAppUrl) {
  try {
    const response = await fetch('http://localhost:8000/generate-phrases', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        google_play: googlePlayUrl,
        apple_app: appleAppUrl
      }),
    });

    const data = await response.json();

    // Find the first actual phrase (skip the section headers)
    const phrases = data.filter(line => line.match(/^\d+\.\s\*\*(.*?)\*\*/)); // Matches numbered phrases
    const firstPhrase = phrases.length > 0 ? phrases[0].replace(/^\d+\.\s\*\*(.*?)\*\*/, '$1') : 'Default USP phrase';
    
    console.log('Selected phrase:', firstPhrase);
    return firstPhrase;
  } catch (error) {
    console.error('Error fetching USP phrase:', error);
    return 'Default USP phrase';
  }
}


// Run Python script to get the background color
async function getBackgroundColor(imagePath) {
  return new Promise((resolve, reject) => {
    const pythonProcess = spawn('python', [path.join(__dirname, 'backgroundColor.py'), imagePath]);

    // Capture the output from Python script
    pythonProcess.stdout.on('data', (data) => {
      const color = data.toString().trim();
      resolve(color);  // Return the color to Node.js
    });

    pythonProcess.stderr.on('data', (data) => {
      reject(`Python error: ${data}`);
    });

    pythonProcess.on('close', (code) => {
      if (code !== 0) {
        reject(`Python script exited with code ${code}`);
      }
    });
  });
}

// Adaptive font size calculation
function calculateFontSize(ctx, phrase, maxWidth) {
  let fontSize = 20;
  ctx.font = `${fontSize}px Times New Roman`;
  let textWidth = ctx.measureText(phrase).width;

  while (textWidth > maxWidth && fontSize > 10) {
    fontSize -= 1;
    ctx.font = `${fontSize}px Times New Roman`;
    textWidth = ctx.measureText(phrase).width;
  }

  return fontSize;
}

// Fetch all extracted images data from MongoDB
async function fetchAllImageData() {
  try {
    console.log('Connecting to MongoDB...');
    await client.connect();
    const db = client.db(dbName);
    const urlsCollection = db.collection(urlsCollectionName);

    console.log('Fetching all image data from MongoDB...');
    const imageDataArray = await urlsCollection.find({}, { projection: { url: 1, extracted_url: 1, google_play_url: 1, apple_app_url: 1 } }).toArray();
    
    if (imageDataArray.length === 0) {
      throw new Error('No image data found in MongoDB');
    }

    console.log(`Fetched ${imageDataArray.length} image data entries.`);
    return imageDataArray;
  } catch (error) {
    console.error('Error fetching image data from MongoDB:', error);
    throw error;
  } finally {
    console.log('Closing MongoDB connection...');
    await client.close();
    console.log('MongoDB connection closed.');
  }
}

// Create ad image
async function createAdImage(imageData, phrase, index) {
  try {
    // Download the original image locally
    const localImagePath = path.join(__dirname, `downloaded_image_${index}.png`);
    await downloadImage(imageData.url, localImagePath);
    console.log(`Image downloaded to: ${localImagePath}`);

    const modelPath = path.join(__dirname, 'font_classifier_model.h5');
 
    // Get the background color from the Python script
    const fontStyle = await getFontStyle(localImagePath, modelPath);
    console.log(`Font style predicted: ${fontStyle}`);
    
    let backgroundColor = await getBackgroundColor(localImagePath);
    console.log(`YES!! Background color is: ${backgroundColor}`);

    // Convert the color to rgb() format
    backgroundColor = `rgb${backgroundColor}`;  // Convert "(176, 6, 50)" to "rgb(176, 6, 50)"

    // // Predict the font style using the downloaded image
    // let fontStyle = await predictFontStyle(localImagePath);
    // console.log(`Detected Font Style: ${fontStyle}`);

    // // Map the detected font style to the font family in Canvas (Adjust as needed)
    // const fontFamily = fontStyle || 'Arial';

    // // Get the predicted font style from the Python script
    // const modelPath = path.join(__dirname, 'font_classifier_model.h5');  // Specify the correct path to your model
    // const predictedFontStyle = await getFontStyle(localImagePath, modelPath);
    // console.log(`Predicted font style is: ${predictedFontStyle}`);
    
    /// Create a canvas
    const width = 333;
    const height = 592;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // Set the background color
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, width, height);

    // Load the extracted image (no background) from the URL
    const baseImage = await loadImage(imageData.extracted_url);

    // Increase image size
    const imgWidth = baseImage.width * 2;  // Increase the size by 50%
    const imgHeight = baseImage.height * 2;  // Maintain aspect ratio

    // Calculate the position to center the image
    const x = (width - imgWidth) / 2;
    const y = (height - imgHeight);

    // Draw the base image on the canvas with the new size
    ctx.drawImage(baseImage, x, y, imgWidth, imgHeight);

    // Calculate font size based on phrase length
    const fontSize = calculateFontSize(ctx, phrase, width - 40);
    ctx.font = `${fontSize}px ${fontStyle}`;
    ctx.fillStyle = 'black';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    // Define padding
    const paddingX = 20; // 20px padding from the left and right
    const paddingY = 20; // 20px padding from the top

    // Calculate the position for the text with padding
    const textX = width / 2;
    const textY = paddingY; // Adjust this value as needed for spacing from the top
   
    // Draw the text on the canvas with padding
    ctx.fillText(phrase, textX, textY, width - paddingX * 2, 24); // The last parameter is the max width for text

    // Save the image to a file
    const outputPath = path.join(__dirname, `Ads-${index}-${Date.now()}.png`);
    const buffer = canvas.toBuffer('image/png');
    fs.writeFileSync(outputPath, buffer);

    console.log(`Ad image created at ${outputPath}`);
  } catch (error) {
    console.error('Error creating ad image:', error);
  }
}

// Run the function to create ads for all entries
async function createAdsForAllImages() {
  try {
    const imageDataArray = await fetchAllImageData();
    for (let i = 0; i < imageDataArray.length; i++) {
      const imageData = imageDataArray[i];
      const phrase = await fetchPhrase(imageData.google_play_url, imageData.apple_app_url);
      await createAdImage(imageData, phrase, i);
    }
  } catch (error) {
    console.error('Error processing ad images:', error);
  }
}

// Run the function
createAdsForAllImages();