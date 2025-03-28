import {Request, Response} from "express";
import fs from "fs";
import path from "path";
import Logger from "../../config/logger";
import * as Game from "../models/game.model";

const imageDir = "storage/images";
const validTypes: { [key: string]: string } = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/gif": ".gif"
};

const getImage = async (req: Request, res: Response): Promise<void> => {
    const gameId = parseInt(req.params.id, 10);
    if (!gameId) {
        res.status(400).send("Bad Request");
        return;
    }
    try {
        const imageFileName = await Game.getGameImageFilename(gameId);
        if (!imageFileName) {
            res.status(404).send("Game or image not found");
            return;
        }
        const filePath = path.join(imageDir, imageFileName);
        if (!fs.existsSync(filePath)) {
            res.status(404).send("Image file not found");
            return;
        }
        const ext = path.extname(imageFileName).toLowerCase();
        const mimeType = Object.keys(validTypes).find(type => validTypes[type] === ext);
        res.contentType(mimeType || "application/octet-stream");
        fs.createReadStream(filePath).pipe(res);
    } catch (err) {
        Logger.error(err);
        res.statusMessage = "Internal Server Error";
        res.status(500).send();
    }
}

const setImage = async (req: Request, res: Response): Promise<void> => {
    const gameId = parseInt(req.params.id, 10);
    if (!gameId) {
        res.status(400).send("Bad Request");
        return;
    }
    const userId = req.body.userId;
    const contentType = req.header("Content-Type");
    if (!contentType || !validTypes[contentType]) {
        res.status(400).send("Invalid image type");
        return;
    }
    try {
        const creatorId = await Game.getGameCreatorId(gameId);
        if (!creatorId) {
            res.status(404).send("Game not found");
            return;
        }
        if (creatorId !== userId) {
            res.status(403).send("Forbidden");
            return;
        }
        const status = await Game.updateGameImageFilename(gameId, req.body, contentType);
        res.status(status).send();
    } catch (err) {
        Logger.error(err);
        res.status(err.status || 500).send(err.message || "Internal Server Error");
    }
}

export {getImage, setImage};