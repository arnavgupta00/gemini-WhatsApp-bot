import express from 'express';
import bodyParser from 'body-parser';
import "dotenv/config"

import qrcode from 'qrcode-terminal';
import { Client } from 'whatsapp-web.js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import sharp from 'sharp';

import fs from 'fs';
import util from 'util';

const app = express();
app.use(bodyParser.json());

const client = new Client();
const genAI = new GoogleGenerativeAI(process.env.API_KEY);
client.on('qr', (qr) => {
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('Client is ready!');
});


async function WhatsAppText(prompt) {
    try {
        return new Promise(async (resolve, reject) => {
            try {
                const promptText = encodeURIComponent(prompt); // Encode the prompt
                console.log(promptText);

                const model = genAI.getGenerativeModel({ model: 'gemini-pro' });

                const result = await model.generateContent(promptText);
                const response = await result.response;
                const text = response.text();
                console.log(text);

                const textWithWatermark = `${text} `;

                const data = {
                    text: textWithWatermark,
                };

                resolve(data);
            } catch (error) {
                reject(error);
            }
        });
    } catch {
        return {
            text: "Error Tpy correctly"
        }
    }
}


async function convertJpegToPngBase64(jpegBase64) {
    try {
        const jpegBuffer = Buffer.from(jpegBase64, 'base64');

        const pngBuffer = await sharp(jpegBuffer).png().toBuffer();

        const pngBase64 = pngBuffer.toString('base64');

        return pngBase64;
    } catch (error) {
        console.error('Error converting JPEG to PNG:', error.message);
        throw error;
    }
}

async function WhatsAppTextImage(prompt, image) {
    try {
        console.log("here2")
        const model = genAI.getGenerativeModel({ model: "gemini-pro-vision" });

        const promptText = encodeURIComponent(prompt);

        const imageF = {
            inlineData: {
                data: image.data,
                mimeType: image.mimetype,
            },
        };
        console.log(image.data);
        const result = await model.generateContent([promptText, imageF]);
        const response = await result.response;
        const text = response.text();
        console.log(response);
        console.log("here4")
        return text
    } catch {
        return "Error While GeneratinG rESPONSE";
    }
}







client.on('message', async (msg) => {
    if (msg.body.startsWith('/generateText')) {
        try {
            const textInput = msg.body.substring('/generateText'.length).trim();
            const textOutput = await WhatsAppText(textInput);
            await client.sendMessage(msg.from, textOutput.text,{ fromMe: true });
        } catch {
            await client.sendMessage(msg.from, "Error Generating Messages",{ fromMe: true });
        }

    } else if (msg.body.startsWith('/generateImageText')) {

        try {
            const textInput = msg.body.substring('/generateImageText'.length).trim();
            const imageInput = msg.hasMedia ? await msg.downloadMedia() : null;
            console.log(imageInput);
            if (imageInput) {
                await client.sendMessage(msg.from, "Loading, This may take some time",{ fromMe: true });
                console.log("here1")
                const textOutput = await WhatsAppTextImage(textInput, imageInput);
                console.log("here3")
                await client.sendMessage(msg.from, textOutput,{ fromMe: true });
                console.log("here5")
            } else {
                await client.sendMessage(msg.from, 'No image attachment found.',{ fromMe: true });
            }
        } catch {
            await client.sendMessage(msg.from, "Error Generating Messages",{ fromMe: true });
        }
    }
});

app.get('/generateText', (req, res) => {
    const textInput = req.query.text;
    const textOutput = `Your input was: ${textInput}`;
    res.send(textOutput);
});

// Use multer for handling file uploads
import multer from 'multer';
const upload = multer({ dest: 'uploads/' });

app.post('/generateImageText', upload.single('image'), async (req, res) => {
    const textInput = req.body.text;
    const imageInput = req.file;

    if (imageInput) {
        const imageBase64 = await util.promisify(fs.readFile)(imageInput.path, 'base64');
        const textOutput = `Your input was: ${textInput}`;
        res.send({ image: imageBase64, text: textOutput });
    } else {
        res.send('No image attachment found.');
    }
});

client.initialize();

app.listen(5000, () => {
    console.log('App running on port 5000');
});
