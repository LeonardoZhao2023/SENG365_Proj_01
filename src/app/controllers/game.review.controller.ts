import {Request, Response} from "express";
import Logger from "../../config/logger";
import * as Game from "../models/game.model";
import {validate} from "../services/validator";
import * as schemas from "../resources/schemas.json";

const testGameID = async (res: Response, gameId: number) => {
    try {
        if (!gameId) {
            res.statusMessage = `Bad Request: Invalid gameId ${gameId}`;
            res.status(400).send();
            return;
        }
        if (await Game.testID(gameId) !== true){
            res.statusMessage = `Bad Request: Invalid gameId ${gameId}`;
            res.status(404).send();
            return;
        }
    } catch (err){
        Logger.error(err);
        res.statusMessage = `Bad Request: Invalid gameId ${gameId}`;
        res.status(404).send();
    }
}

const getGameReviews = async(req: Request, res: Response): Promise<void> => {
    const gameId = parseInt(req.params.id, 10);
    await testGameID(res, gameId);
    try {
        const reviews = await Game.getGameReviews(gameId);
        res.status(200).json(reviews);
    } catch (err) {
        Logger.error(err);
        res.statusMessage = "Internal Server Error";
        res.status(500).send();
    }
}

const addGameReview = async(req: Request, res: Response): Promise<void> => {
    const userId = req.body.userId;
    if (!userId) {
        res.statusMessage = "Unauthorized";
        res.status(401).send();
        return;
    }
    const validation = await validate(schemas.game_review_post, req.body);
    if (validation !== true) {
        res.statusMessage = `Bad Request: ${validation.toString()}`;
        res.status(400).send();
        return;
    }
    const gameId = parseInt(req.params.id, 10);
    await testGameID(res, gameId);
    const rating = req.body.rating;
    const review = req.body.review;
    try {
        const isCreator = await Game.isUserGameCreator(gameId, userId);
        if (isCreator) {
            res.statusMessage = "Forbidden. Cannot review your own game.";
            res.status(403).send();
            return;
        }
        const alreadyReviewed = await Game.hasUserReviewedGame(gameId, userId);
        if (alreadyReviewed) {
            res.statusMessage = "Forbidden. You have already reviewed this game.";
            res.status(403).send();
            return;
        }
        await Game.insertGameReview(gameId, userId, rating, review ?? null);
        res.status(201).send();
    } catch (err) {
        Logger.error(err);
        res.statusMessage = "Internal Server Error";
        res.status(500).send();
    }
}

export {getGameReviews, addGameReview};