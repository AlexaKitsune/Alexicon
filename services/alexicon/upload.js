const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const getIdByToken = require('../../utils/getIdByToken');
const router = express.Router();

const ALLOWED_PATHS = ['alexicon', 'yipnet']; // carpetas válidas
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.mp4', '.mov', '.webm', ".pdf", ".docx", ".xls", ".xlsx", ".ttf", ".otf", ".woff", ".html", ".htm", ".ogg", ".pdf", ".psd", ".txt", ".xml", ".csv", ".py", ".cpp", ".js", ".css", ".json", ".bat"];
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB

// Multer: limita tamaño de archivo y usa memoria para procesar luego
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_FILE_SIZE },
    fileFilter: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        if (ALLOWED_EXTENSIONS.includes(ext)) {
            cb(null, true);
        } else {
            cb(new Error('Tipo de archivo no permitido.'));
        }
    }
}).single('file');

router.post('/upload', async (req, res) => {
    upload(req, res, async function (err) {
        if (err) {
            return res.status(400).json({ status: 'error', message: err.message });
        }

        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).json({ status: 'error', message: 'Token requerido.' });
        }

        const token = authHeader.split(" ")[1];
        const userId = await getIdByToken(token);
        if (!userId) {
            return res.status(401).json({ status: 'error', message: 'Token inválido.' });
        }

        const file = req.file;
        const targetPath = req.body.targetPath;
        if (!file || !targetPath) {
            return res.status(400).json({ status: 'error', message: 'Falta archivo o ruta.' });
        }

        // Sanitizar y validar ruta
        const safePath = path.normalize(targetPath).replace(/^(\.\.(\/|\\|$))+/, '').replace(/^\/+/, '');
        const pathParts = safePath.split('/');
        if (!ALLOWED_PATHS.includes(pathParts[0])) {
            return res.status(400).json({ status: 'error', message: 'Ruta de destino no permitida.' });
        }

        const storagePath = path.join(__dirname, '../../storage', safePath);
        fs.mkdirSync(storagePath, { recursive: true });

        let finalName = file.originalname;
        let finalPath = path.join(storagePath, finalName);

        // Si existe, renombrar
        if (fs.existsSync(finalPath)) {
            const timestamp = Date.now();
            const ext = path.extname(finalName);
            const base = path.basename(finalName, ext);
            finalName = `${base}_${timestamp}${ext}`;
            finalPath = path.join(storagePath, finalName);
        }

        const ext = path.extname(finalName).toLowerCase();

        try {
            if (['.jpg', '.jpeg', '.png', '.webp'].includes(ext) && file.size > 1024 * 1024) {
                // Comprimir imagen si es grande
                await sharp(file.buffer)
                    .resize({ width: 1920 }) // opcional, puedes quitar para conservar tamaño
                    .jpeg({ quality: 80 })
                    .toFile(finalPath);
            } else {
                // Guardar directamente
                fs.writeFileSync(finalPath, file.buffer);
            }

            return res.json({
                status: 'ok',
                filename: finalName,
                relativePath: path.join(safePath, finalName),
                //fullPath: finalPath
            });
        } catch (compressionError) {
            console.error("Error al guardar archivo:", compressionError);
            return res.status(500).json({ status: 'error', message: 'No se pudo guardar el archivo.' });
        }
    });
});

module.exports = router;
