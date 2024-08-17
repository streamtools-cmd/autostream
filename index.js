const ffmpeg = require('fluent-ffmpeg');
const puppeteer = require('puppeteer');
const stream = require('stream');
//const fs = require('fs')

require('dotenv').config();

// Funzione per catturare lo schermo
async function captureScreen(url) {
    
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720 });
    await page.goto(url, { waitUntil: 'networkidle2' });

    await page.evaluate(() => {
        document.body.style.background = 'transparent';
    });

    console.log('Flusso dello schermo creato');

    // Creiamo un stream che può essere usato come input in FFmpeg
    const screenStream = new stream.PassThrough();

    // Cattura schermate continue
    setInterval(async () => {
        const screenshotBuffer = await page.screenshot({ encoding: 'binary', omitBackground: true });
        
        screenStream.write(screenshotBuffer)
        //fs.writeFileSync('img/screenshot.png', screenshotBuffer);
    }, 1000 / 15); // 25 FPS

    return screenStream;
}

// Combinare l'immagine di sfondo con il flusso del browser
async function streamWithOverlay(inputURL, rtmpURL) {
    const screenStream = await captureScreen(inputURL);
    //screenStream.on('data', (chunk) => {});

    const ffmpegStream = new stream.PassThrough();
    ffmpeg()
        .input(ffmpegStream)
        .inputFormat("image2pipe")
        .inputFPS(15) // Imposta il frame rate
        //.loop()

        .size('1280x720') // Imposta la risoluzione del video
        .videoBitrate('500k') // Bitrate video limitato a 500 kbps
        .audioBitrate('64k') // Bitrate audio limitato a 64 kbps
        .addOption('-pix_fmt', 'yuv420p') // Assicura la compatibilità con la maggior parte dei player
        .videoCodec('libx264') // Codec video H.264
        .audioCodec('aac') // Codec audio AAC
        .outputFormat('flv') // RTMP richiede il formato FLV
        .fps(15) // Frame rate del video        
        .addOption('-loglevel', 'verbose')
        .addOption('-bufsize', '500k') // Imposta la dimensione del buffer
        .addOption('-tune', 'zerolatency') // Ottimizza per la latenza bassa
        .addOption('-preset', 'ultrafast') // Riduce il tempo di codifica

        .on('start', (commandLine) => {
            console.log(`FFmpeg comando: ${commandLine}`);
        })
        .on('progress', (progress) => {
            console.log(`FPS: ${progress.currentFps} Kbps: ${progress.currentKbps} Frames: ${progress.frames} Progresso: ${progress.timemark}`);
        })

        .on('end', () => {
            console.log('Stream completato con successo');
        })
        .on('error', (err) => {
            console.error(`Errore durante lo stream: ${err.message}`);
        })
        //.output('output.mp4')
        .output(rtmpURL)
        .run();

    screenStream.pipe(ffmpegStream);
}


const url =  process.env.URL 
const rtmpURL = process.env.RTMP_URL
streamWithOverlay(url, rtmpURL)
