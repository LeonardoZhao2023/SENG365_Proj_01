import { Request, Response } from "express";
import * as UserImage from "../models/user.image.model";
import Logger from "../../config/logger";
import { validTypes } from "../models/user.image.model";

const getImage = async (req: Request, res: Response): Promise<void> => {
    try {
        const image = await UserImage.getImageFile(parseInt(req.params.id, 10));
        if (!image) {
            res.status(404).send("User not found or no image");
            return;
        }
        res.contentType(image.mimeType);
        res.send(image.data);
    } catch (err) {
        Logger.error(err);
        res.statusMessage = "Internal Server Error";
        res.status(500).send();
    }
}

const setImage = async (req: Request, res: Response): Promise<void> => {
    const userId = parseInt(req.params.id, 10);
    if (!userId) {
        res.statusMessage = `Bad Request`;
        res.status(400).send();
        return;
    }
    const token = req.header("X-Authorization");
    const contentType = req.header("Content-Type");
    if (!contentType || !validTypes[contentType]) {
        res.status(400).send("Invalid image type");
        return;
    }
    try {
        const status = await UserImage.setUserImage(userId, token, req.body, contentType);
        res.status(status).send();
    } catch (err: any) {
        Logger.error(err);
        res.status(err.status || 500).send(err.message || "Internal Server Error");
    }
}

const deleteImage = async (req: Request, res: Response): Promise<void> => {
    const token = req.header("X-Authorization");
    const userId = parseInt(req.params.id, 10);
    if (!userId) {
        res.statusMessage = `Bad Request`;
        res.status(400).send();
        return;
    }
    try {
        const status = await UserImage.deleteUserImage(userId, token);
        res.status(status).send();
    } catch (err: any) {
        Logger.error(err);
        res.status(err.status || 500).send(err.message || "Internal Server Error");
    }
}

export {getImage, setImage, deleteImage}