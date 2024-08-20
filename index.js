const ffmpeg = require('fluent-ffmpeg');
const puppeteer = require('puppeteer');
const stream = require('stream');

const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');
//const fs = require('fs')

require('dotenv').config();

async function main() {
    // Configura gli argomenti
    const argv = yargs(hideBin(process.argv))
        .option('web', {
            describe: 'Web Source',
            type: 'boolean',
        })
        .option('local', {
            describe: 'Local Source',
            type: 'boolean',
        })
        .check((argv) => {
            if (argv.web && argv.local) {
                throw new Error('--web or --local');
            }
            if (!argv.web && !argv.local) {
                throw new Error('--web or --local');
            }
            return true;
        })
        .argv;

    const rtmpURL = process.env.RTMP_URL
    if (argv.web) {
        console.log("AUTOSTREAM - Web Source");
        const url = process.env.URL
        streamWebSource(url, rtmpURL)

    } else if (argv.local) {
        console.log("AUTOSTREAM - Local Source");
        const image = process.env.IMAGE
        const audio = process.env.AUDIO
        streamLocalSource(image, audio, rtmpURL)
    }
}


async function captureScreen(url) {

    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720 });
    await page.goto(url, { waitUntil: 'networkidle2' });

    await page.evaluate(() => {
        document.body.style.background = 'transparent';
    });

    const screenStream = new stream.PassThrough();

    setInterval(async () => {
        const screenshotBuffer = await page.screenshot({ encoding: 'binary', omitBackground: true });

        screenStream.write(screenshotBuffer)
        //fs.writeFileSync('img/screenshot.png', screenshotBuffer);
    }, 1000 / 15); // 25 FPS

    return screenStream;
}

async function streamLocalSource(imageSource, audioSource, rtmpURL) {
    ffmpeg()

        
        .input(audioSource)
        .inputOption("-stream_loop -1")

        .input(imageSource)
        .loop()

        .size('1280x720') // Imposta la risoluzione del video
        .videoBitrate('500k') // Bitrate video limitato a 500 kbps
        .audioBitrate('64k') // Bitrate audio limitato a 64 kbps
        .addOption('-pix_fmt', 'yuv420p') // Assicura la compatibilità con la maggior parte dei player
        .videoCodec('libx264') // Codec video H.264
        .audioCodec('aac') // Codec audio AAC
        .outputFormat('flv') // RTMP richiede il formato FLV
        .fps(30) // Frame rate del video        
        .addOption('-loglevel', 'verbose')
        .addOption('-bufsize', '1000k') // Imposta la dimensione del buffer
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
}




// Combinare l'immagine di sfondo con il flusso del browser
async function streamWebSource(inputURL, rtmpURL) {
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


main()





