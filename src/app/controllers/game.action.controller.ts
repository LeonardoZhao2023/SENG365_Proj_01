import {Request, Response} from "express";
import Logger from "../../config/logger";
import * as gameModel from "../models/game.model";

const addGameToWishlist = async (req: Request, res: Response): Promise<void> => {
    const gameId = parseInt(req.params.id, 10);
    if (!gameId) {
        res.status(400).send("Bad request");
    }
    const userId = req.body.userId;
    try {
        const creatorId = await gameModel.getGameCreatorId(gameId);
        if (creatorId === null) {
            res.status(404).send("Game not found");
            return;
        }
        if (creatorId === userId) {
            res.status(403).send("Cannot wishlist your own game");
            return;
        }
        const isOwned = await gameModel.isGameOwned(gameId, userId);
        if (isOwned) {
            res.status(403).send("Cannot wishlist a game you already own");
            return;
        }
        const isWListed = await gameModel.isGameWishlisted(gameId, userId);
        if (isWListed) {
            res.status(200).send(); // Already w-listed
            return;
        }
        await gameModel.addGameToWishlist(gameId, userId);
        res.status(200).send();
    } catch (err) {
        Logger.error(err);
        res.statusMessage = "Internal Server Error";
        res.status(500).send();
    }
};

const removeGameFromWishlist = async (req: Request, res: Response): Promise<void> => {
    const gameId = parseInt(req.params.id, 10);
    if (!gameId) {
        res.status(400).send("Bad request");
    }
    const userId = req.body.userId;
    try {
        const isWListed = await gameModel.isGameWishlisted(gameId, userId);
        if (!isWListed) {
            res.status(403).send("Game is not in your wishlist");
            return;
        }
        await gameModel.removeGameFromWishlist(gameId, userId);
        res.status(200).send();
    } catch (err) {
        Logger.error(err);
        res.statusMessage = "Internal Server Error";
        res.status(500).send();
    }
};

const addGameToOwned = async (req: Request, res: Response): Promise<void> => {
    const gameId = parseInt(req.params.id, 10);
    if (!gameId) {
        res.status(400).send("Bad request");
    }
    const userId = req.body.userId;
    try {
        const creatorId = await gameModel.getGameCreatorId(gameId);
        if (creatorId === null) {
            res.status(404).send("Game not found");
            return;
        }
        if (creatorId === userId) {
            res.status(403).send("Cannot own your own game");
            return;
        }
        const isOwned = await gameModel.isGameOwned(gameId, userId);
        if (isOwned) {
            res.status(200).send(); // Already owned
            return;
        }
        await gameModel.removeGameFromWishlistIfExists(gameId, userId);
        await gameModel.addGameToOwned(gameId, userId);
        res.status(200).send();
    } catch (err) {
        Logger.error(err);
        res.statusMessage = "Internal Server Error";
        res.status(500).send();
    }
};

const removeGameFromOwned = async (req: Request, res: Response): Promise<void> => {
    const gameId = parseInt(req.params.id, 10);
    if (!gameId) {
        res.status(400).send("Bad request");
    }
    const userId = req.body.userId;
    try {
        const isOwned = await gameModel.isGameOwned(gameId, userId);
        if (!isOwned) {
            res.status(403).send("Game is not marked as owned");
            return;
        }

        await gameModel.removeGameFromOwned(gameId, userId);
        res.status(200).send();
    } catch (err) {
        Logger.error(err);
        res.statusMessage = "Internal Server Error";
        res.status(500).send();
    }
};

export {addGameToWishlist, removeGameFromWishlist, addGameToOwned, removeGameFromOwned};