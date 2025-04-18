import express from 'express';
import multer from 'multer';
import WebTorrent from 'webtorrent';
import fs from 'fs';
import archiver from 'archiver';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import cors from 'cors'; // Import de cors

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const upload = multer({ dest: 'uploads/' });
const client = new WebTorrent();

const DOWNLOAD_DIR = path.join(__dirname, 'downloads');
if (!fs.existsSync(DOWNLOAD_DIR)) fs.mkdirSync(DOWNLOAD_DIR);

// Utilisation du middleware CORS pour autoriser toutes les origines
app.use(cors()); // Autorise toutes les origines

app.post('/upload', upload.single('file'), (req, res) => {
    if (!req.file || !req.file.originalname.endsWith('.torrent')) {
        return res.status(400).send({ error: 'Fichier .torrent requis' });
    }

    const torrentPath = path.join(__dirname, req.file.path);
    const tempFolder = path.join(DOWNLOAD_DIR, uuidv4());

    client.add(torrentPath, { path: tempFolder }, torrent => {
        console.log(`Téléchargement de : ${torrent.name}`);
        torrent.on('done', () => {
            console.log('Terminé. Zippage en cours...');

            const zipPath = `${tempFolder}.zip`;
            const output = fs.createWriteStream(zipPath);
            const archive = archiver('zip', { zlib: { level: 9 } });

            output.on('close', () => {
                fs.rmSync(tempFolder, { recursive: true, force: true });
                res.download(zipPath, `${torrent.name}.zip`, () => {
                    fs.unlinkSync(zipPath);
                    fs.unlinkSync(torrentPath);
                });
            });

            archive.on('error', err => res.status(500).send({ error: err.message }));
            archive.pipe(output);
            archive.directory(tempFolder, false);
            archive.finalize();
        });
    });
});

app.get('/test', (req, res) => {
  res.send('OK');
});

app.listen(3001, '0.0.0.0', () => {
    console.log('✅ API dispo sur http://0.0.0.0:3001');
});
