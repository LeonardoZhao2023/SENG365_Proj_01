import { Request, Response } from "express";
import Logger from "../../config/logger";
import * as Game from "../models/game.model";
import {validate} from "../services/validator";
import * as schemas from "../resources/schemas.json";

const getAllGames = async(req: Request, res: Response): Promise<void> => {
    try {
        const token = req.header("X-Authorization");
        const userId = req.body.userId;
        const validation = await validate(schemas.game_search, req.query);
        if (validation !== true) {
            res.statusMessage = `Bad Request: ${validation.toString()}`;
            res.status(400).send();
            return;
        }
        Logger.info(token);
        const result = await Game.getFilteredGames(req, userId, token);
        res.status(200).json(result);
    } catch (err) {
        Logger.error(err);
        res.status(err.status || 500).send(err.message || "Internal Server Error");
    }
}

const getGame = async(req: Request, res: Response): Promise<void> => {
    try {
        const validation = await validate(schemas.game_search, req.query);
        if (validation !== true) {
            res.statusMessage = `Bad Request: ${validation.toString()}`;
            res.status(400).send();
            return;
        }
        const id = parseInt(req.params.id, 10);
        if (!id) {
            res.statusMessage = `Bad Request`;
            res.status(400).send();
            return;
        }
        const game = await Game.getFullGameDetails(id); // updated model function
        if (!game) {
            res.status(404).send("Game not found");
        } else {
            res.status(200).json(game);
        }
    } catch (err) {
        Logger.error(err);
        res.statusMessage = "Internal Server Error";
        res.status(500).send();
    }
}

const addGame = async(req: Request, res: Response): Promise<void> => {
    try {
        const userId = req.body.userId;
        const validation = await validate(schemas.game_post, req.body);
        if (validation !== true) {
            res.statusMessage = `Bad Request: ${validation.toString()}`;
            res.status(400).send();
            return;
        }
        const genreExists = await Game.genreExists(req.body.genreId);
        if (!genreExists) {
            res.status(400).send("Invalid genreId");
            return;
        }
        const platformIds = req.body.platformIds;
        const unique = new Set(platformIds);
        if (unique.size !== platformIds.length) {
            res.status(400).send("Duplicate platform IDs are not allowed.");
            return;
        }
        const validPlatforms = await Game.validatePlatformIds(platformIds);
        if (!validPlatforms) {
            res.status(400).send("Invalid or missing platformIds");
            return;
        }
        const titleTaken = await Game.titleExists(req.body.title);
        if (titleTaken) {
            res.status(400).send("Title must be unique");
            return;
        }
        const gameId = await Game.createGame(req.body, userId);
        res.status(201).json({ gameId });
    } catch (err) {
        Logger.error(err);
        res.statusMessage = "Internal Server Error";
        res.status(500).send();
    }
}


const editGame = async(req: Request, res: Response): Promise<void> => {
    try {
        const userId = req.body.userId;
        const validation = await validate(schemas.game_patch, req.body);
        if (validation !== true) {
            res.statusMessage = `Bad Request: ${validation.toString()}`;
            res.status(400).send(`Bad Request: ${validation.toString()}`);
            return;
        }
        const gameId = parseInt(req.params.id, 10);
        if (!gameId) {
            res.statusMessage = `Bad Request`;
            res.status(400).send();
            return;
        }
        const creatorId = await Game.getGameCreatorId(gameId);
        if (!creatorId) {
            res.status(404).send("Game not found");
            return;
        }
        if (creatorId !== userId) {
            res.status(403).send("Forbidden: Only creator can edit this game");
            return;
        }
        await Game.updateGame(gameId, req.body);
        res.status(200).send();
    } catch (err) {
        Logger.error(err);
        res.statusMessage = "Internal Server Error";
        res.status(500).send();
    }
}

const deleteGame = async(req: Request, res: Response): Promise<void> => {
    try {
        const userId = req.body.userId;
        const gameId = parseInt(req.params.id, 10);
        if (!gameId) {
            res.statusMessage = `Bad Request`;
            res.status(400).send();
            return;
        }
        const creatorId = await Game.getGameCreatorId(gameId);
        if (!creatorId) {
            res.status(404).send("Game not found");
            return;
        }
        if (creatorId !== userId) {
            res.status(403).send("Forbidden: Only creator can delete this game");
            return;
        }
        const hasReviews = await Game.hasGameReviews(gameId);
        if (hasReviews) {
            res.status(403).send("Forbidden: Cannot delete a game with one or more reviews");
            return;
        }
        await Game.deleteGame(gameId);
        res.status(200).send();
    } catch (err) {
        Logger.error(err);
        res.statusMessage = "Internal Server Error";
        res.status(500).send();
    }
}


const getGenres = async(req: Request, res: Response): Promise<void> => {
    try {
        const [genres] = await Game.getGenres();
        res.status(200).json(genres);
    } catch (err) {
        Logger.error(err);
        res.statusMessage = "Internal Server Error";
        res.status(500).send();
    }
}

const getPlatforms = async(req: Request, res: Response): Promise<void> => {
    try {
        const [platforms] = await Game.getPlatforms();
        res.status(200).json(platforms);
    } catch (err) {
        Logger.error(err);
        res.statusMessage = "Internal Server Error";
        res.status(500).send();
    }
}

export {getAllGames, getGame, addGame, editGame, deleteGame, getGenres, getPlatforms};