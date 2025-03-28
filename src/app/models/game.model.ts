import { Request } from "express";
import { getPool } from "../../config/db";
import path from "path";
import fs from "fs";

export const getGenres = async () => {
    return await getPool().query('SELECT id as genreId, name FROM genre');
};

export const getPlatforms = async () => {
    return await getPool().query('SELECT id as platformId, name FROM platform');
};

const sortOptions: { [key: string]: string } = {
    ALPHABETICAL_ASC: "g.title ASC",
    ALPHABETICAL_DESC: "g.title DESC",
    PRICE_ASC: "g.price ASC",
    PRICE_DESC: "g.price DESC",
    CREATED_ASC: "g.creation_date ASC",
    CREATED_DESC: "g.creation_date DESC",
    RATING_ASC: "rating ASC",
    RATING_DESC: "rating DESC"
};

export const getFilteredGames = async (req: Request, userId: number, token: string) => {
    const pool = getPool();
    const startIndex = parseInt(req.query.startIndex as string, 10) || 0;
    const count = parseInt(req.query.count as string, 10) || 100;
    const q = req.query.q;
    const genreIds = req.query.genreIds;
    const platformIds = req.query.platformIds;
    const price = req.query.price;
    const creatorId = req.query.creatorId;
    const reviewerId = req.query.reviewerId;
    const ownedByMe = req.query.ownedByMe || false;
    const wishlistedByMe = req.query.wishlistedByMe || false;
    const sortBy = req.query.sortBy || 'CREATED_ASC';
    const filters: string[] = [];
    const values: any[] = [];
    // Search by title or description
    if (q) {
        filters.push(`(g.title LIKE ? OR g.description LIKE ?)`);
        values.push(`%${q}%`, `%${q}%`);
    }
    // Filter by genreId(s)
    if (genreIds) {
        const ids = Array.isArray(genreIds) ? genreIds : [genreIds];
        filters.push(`g.genre_id IN (${ids.map(() => "?").join(",")})`);
        values.push(...ids);
    }
    // Filter by platformId(s)
    if (platformIds) {
        const ids = Array.isArray(platformIds) ? platformIds : [platformIds];
        filters.push(`EXISTS (
            SELECT * FROM game_platforms gp
            WHERE gp.game_id = g.id AND gp.platform_id IN (${ids.map(() => "?").join(",")})
        )`);
        values.push(...ids);
    }
    // Filter by price
    if (price !== undefined) {
        filters.push(`g.price <= ?`);
        values.push(Number(price));
    }
    // Filter by creatorId
    if (creatorId) {
        filters.push(`g.creator_id = ?`);
        values.push(Number(creatorId));
    }
    // Filter by reviewerId
    if (reviewerId) {
        filters.push(`EXISTS (
            SELECT * FROM game_review r
            WHERE r.game_id = g.id AND r.user_id = ?
        )`);
        values.push(Number(reviewerId));
    }
    // Get the specific user's games
    if (ownedByMe && userId) {
        const [auth]: any = await pool.query("SELECT id FROM user WHERE auth_token = ?", [token]);
        if (!auth.length || auth[0].id !== userId) {
            throw { status: 401, message: "Unauthorized" };
        }
        filters.push(`EXISTS (
            SELECT * FROM owned o
            WHERE o.game_id = g.id AND o.user_id = ?
        )`);
        values.push(Number(userId));
    }
    // Get the specific user's wishlisted games
    if (wishlistedByMe && userId) {
        const [auth]: any = await pool.query("SELECT id FROM user WHERE auth_token = ?", [token]);
        if (!auth.length || auth[0].id !== userId) {
            throw { status: 401, message: "Unauthorized" };
        }
        filters.push(`EXISTS (
            SELECT * FROM wishlist w
            WHERE w.game_id = g.id AND w.user_id = ?
        )`);
        values.push(Number(userId));
    }
    const whereClause = filters.length > 0 ? `WHERE ${filters.join(" AND ")}` : "";
    const orderBy = sortOptions[sortBy as string];
    const query = `
        SELECT g.id AS gameId, g.title, g.genre_id AS genreId,
               g.creation_date AS creationDate, g.creator_id AS creatorId, g.price,
               u.first_name AS creatorFirstName, u.last_name AS creatorLastName,
               ROUND(AVG(r.rating), 1) AS rating,
               COALESCE(
                       JSON_ARRAYAGG(DISTINCT gp.platform_id ORDER BY gp.platform_id ASC),
                       JSON_ARRAY()
               ) AS platformIds
        FROM game g
                 JOIN user u ON g.creator_id = u.id
                 LEFT JOIN game_review r ON g.id = r.game_id
                 LEFT JOIN game_platforms gp ON g.id = gp.game_id
            ${whereClause}
        GROUP BY g.id
        ORDER BY ${orderBy}
            LIMIT ?, ?`;
    values.push(startIndex, count);
    const [gameRows] = await pool.query(query, values);
    if (!(gameRows.length > 0)) {
        throw { status: 400, message: "Bad request" };
    }
    const games = await Promise.all(
        gameRows.map(async (game: any) => {
            return {
                ...game,
                rating: game.rating ? parseFloat(game.rating) : 0,
                platformIds: game.platformIds ? JSON.parse(game.platformIds) : []
            };
        })
    );
    // Count total matching games (ignoring LIMIT for count)
    const countQuery = `
        SELECT COUNT(DISTINCT g.id) AS total
        FROM game g
        LEFT JOIN game_review r ON g.id = r.game_id
        ${whereClause}`;
    const [countResult] = await pool.query(countQuery, values.slice(0, -2)); // Skip LIMIT values for count
    return {
        games,
        count: countResult[0]?.total || 0
    };
};

export const getFullGameDetails = async (gameId: number): Promise<any> => {
    const pool = getPool();
    const [gameRows] = await pool.query(
        `SELECT g.id AS gameId, g.title, g.description, g.genre_id AS genreId,
               g.creation_date AS creationDate, g.creator_id AS creatorId, g.price,
               u.first_name AS creatorFirstName, u.last_name AS creatorLastName,
               (SELECT ROUND(AVG(r.rating), 1) FROM game_review r WHERE r.game_id = g.id) AS rating
        FROM game g
        JOIN user u ON g.creator_id = u.id
        JOIN genre ge ON g.genre_id = ge.id
        WHERE g.id = ?`,
        [gameId]
    );
    if (gameRows.length === 0) return null;
    const [platformRows] = await pool.query(
        `SELECT platform_id FROM game_platforms WHERE game_id = ?`,
        [gameId]
    );
    const platformIds = platformRows.map((row: any) => row.platform_id);
    const [wishlistRows] = await pool.query(
        `SELECT COUNT(*) AS numberOfWishlists FROM wishlist WHERE game_id = ?`,
        [gameId]
    );
    const numberOfWishlists = wishlistRows[0].numberOfWishlists;
    const [ownerRows] = await pool.query(
        `SELECT COUNT(*) AS numberOfOwners FROM owned WHERE game_id = ?`,
        [gameId]
    );
    const numberOfOwners = ownerRows[0].numberOfOwners;
    const game = gameRows[0];
    return {
        ...game,
        rating: game.rating ? parseFloat(game.rating) : 0,
        platformIds,
        numberOfWishlists,
        numberOfOwners
    };
};

export const createGame = async (gameData: any, creatorId: number): Promise<any> => {
    const title = gameData.title;
    const description = gameData.description;
    const genreId = gameData.genreId;
    const price = gameData.price;
    const platformIds = gameData.platformIds;
    const [result] = await getPool().query(
        `INSERT INTO game (title, description, genre_id, price, creator_id, creation_date)
        VALUES (?, ?, ?, ?, ?, NOW())`,
        [title, description, genreId, price, creatorId]
    );
    const gameId = (result as any).insertId;
    for (const platformId of platformIds) {
        await getPool().query(
            `INSERT INTO game_platforms (game_id, platform_id) VALUES (?, ?)`,
            [gameId, platformId]
        );
    }
    return gameId;
};

export const genreExists = async (genreId: number): Promise<boolean> => {
    const pool = getPool();
    const [rows] = await pool.query(`SELECT name FROM genre WHERE id = ?`, [genreId]);
    return rows.length > 0;
};

export const titleExists = async (title: string): Promise<boolean> => {
    const pool = getPool();
    const [rows] = await pool.query(`SELECT id FROM game WHERE title = ?`, [title]);
    return rows.length > 0;
};

export const validatePlatformIds = async (platformIds: number[]): Promise<boolean> => {
    if (!Array.isArray(platformIds) || platformIds.length === 0) return false;
    const pool = getPool();
    const [rows] = await pool.query(`SELECT id FROM platform WHERE id IN (?)`, [platformIds]);
    return rows.length === platformIds.length;
};

export const updateGame = async (gameId: number, updateFields: any) => {
    const fields = [];
    const values = [];
    if (updateFields.title) {
        fields.push(`title = ?`);
        values.push(updateFields.title);
    }
    if (updateFields.description) {
        fields.push(`description = ?`);
        values.push(updateFields.description);
    }
    if (updateFields.genreId) {
        fields.push(`genre_id = ?`);
        values.push(updateFields.genreId);
    }
    if (updateFields.price !== undefined) {
        fields.push(`price = ?`);
        values.push(updateFields.price);
    }
    if (fields.length) {
        const query = `UPDATE game SET ${fields.join(`, `)} WHERE id = ?`;
        values.push(gameId);
        await getPool().query(query, values);
    }
    if (updateFields.platforms) {
        await getPool().query(`DELETE FROM game_platforms WHERE game_id = ?`, [gameId]);
        for (const pid of updateFields.platforms) {
            await getPool().query(
                `INSERT INTO game_platforms (game_id, platform_id) VALUES (?, ?)`,
                [gameId, pid]
            );
        }
    }
};

export const hasGameReviews = async (gameId: number): Promise<boolean> => {
    const pool = getPool();
    const [rows] = await pool.query(`SELECT COUNT(*) AS count FROM game_review WHERE game_id = ?`, [gameId]);
    return rows[0].count > 0;
};

export const deleteGame = async (gameId: number): Promise<void> => {
    const pool = getPool();
    await pool.query(`DELETE FROM game_platforms WHERE game_id = ?`, [gameId]);
    await pool.query(`DELETE FROM wishlist WHERE game_id = ?`, [gameId]);
    await pool.query(`DELETE FROM owned WHERE game_id = ?`, [gameId]);
    await pool.query(`DELETE FROM game WHERE id = ?`, [gameId]);
};

// --- Game Reviews ---

export const getGameReviews = async (gameId: number) => {
    const pool = getPool();
    const query =
        `SELECT r.user_id AS reviewerId, u.first_name AS reviewerFirstName, u.last_name AS reviewerLastName,
               r.rating, r.review, r.timestamp
        FROM game_review r
        JOIN user u ON r.user_id = u.id
        WHERE r.game_id = ?
        ORDER BY r.timestamp DESC;`;
    const [rows] = await pool.query(query, [gameId]);
    return rows;
};

export const testID = async (gameId: number) => {
    const pool = getPool();
    const query = `SELECT * FROM game WHERE id = ?`;
    const [rows] = await pool.query(query, [gameId]);
    return rows.length > 0;
}

export const hasUserReviewedGame = async (gameId: number, userId: number) => {
    const pool = getPool();
    const query = `SELECT COUNT(*) AS count FROM game_review WHERE game_id = ? AND user_id = ?`;
    const [rows] = await pool.query(query, [gameId, userId]);
    return rows[0].count > 0;
};

export const isUserGameCreator = async (gameId: number, userId: number) => {
    const pool = getPool();
    const query = `SELECT COUNT(*) AS count FROM game WHERE id = ? AND creator_id = ?`;
    const [rows] = await pool.query(query, [gameId, userId]);
    return rows[0].count > 0;
};

export const insertGameReview = async (gameId: number, userId: number, rating: number, review: string | null) => {
    const pool = getPool();
    const query = `INSERT INTO game_review (game_id, user_id, rating, review, timestamp) VALUES (?, ?, ?, ?, NOW())`;
    await pool.query(query, [gameId, userId, rating, review]);
};

// --- Game Images ---

export const getGameImageFilename = async (gameId: number) => {
    const pool = getPool();
    const query = `SELECT image_filename FROM game WHERE id = ?`;
    const [rows] = await pool.query(query, [gameId]);
    return rows.length ? rows[0].image_filename : null;
};

export const updateGameImageFilename = async (gameId: number, imageData: Buffer, contentType: string) => {
    const validTypes: any = {
        "image/png": ".png",
        "image/jpeg": ".jpg",
        "image/gif": ".gif",
    };
    const imageDir = "storage/images";
    const pool = getPool();
    const [games]: any = await pool.query(`SELECT image_filename FROM game WHERE id = ?`, [gameId]);
    const oldFile = games[0]?.image_filename;
    const extension = validTypes[contentType];
    const filename = `game_${gameId}${extension}`;
    const filepath = path.join(imageDir, filename);
    fs.writeFileSync(filepath, imageData);
    await pool.query(`UPDATE game SET image_filename = ? WHERE id = ?`, [filename, gameId]);
    if (oldFile && oldFile !== filename) {
        const oldPath = path.join(imageDir, oldFile);
        if (fs.existsSync(oldPath)) {
            fs.unlinkSync(oldPath);
        }
    }
    return oldFile ? 200 : 201;
};

export const getGameCreatorId = async (gameId: number): Promise<number | null> => {
    const pool = getPool();
    const query = `SELECT creator_id FROM game WHERE id = ?`;
    const [rows] = await pool.query(query, [gameId]);
    return rows.length ? rows[0].creator_id : null;
};

// --- Game Actions ---

export const isGameWishlisted = async (gameId: number, userId: number): Promise<boolean> => {
    const pool = getPool();
    const query = `SELECT COUNT(*) AS count FROM wishlist WHERE game_id = ? AND user_id = ?`;
    const [rows] = await pool.query(query, [gameId, userId]);
    return rows[0].count > 0;
};

export const isGameOwned = async (gameId: number, userId: number): Promise<boolean> => {
    const pool = getPool();
    const query = `SELECT COUNT(*) AS count FROM owned WHERE game_id = ? AND user_id = ?`;
    const [rows] = await pool.query(query, [gameId, userId]);
    return rows[0].count > 0;
};

export const addGameToWishlist = async (gameId: number, userId: number): Promise<void> => {
    const pool = getPool();
    const query = `INSERT INTO wishlist (game_id, user_id) VALUES (?, ?)`;
    await pool.query(query, [gameId, userId]);
};

export const removeGameFromWishlist = async (gameId: number, userId: number): Promise<void> => {
    const pool = getPool();
    const query = `DELETE FROM wishlist WHERE game_id = ? AND user_id = ?`;
    await pool.query(query, [gameId, userId]);
};

export const addGameToOwned = async (gameId: number, userId: number): Promise<void> => {
    const pool = getPool();
    const query = `INSERT INTO owned (game_id, user_id) VALUES (?, ?)`;
    await pool.query(query, [gameId, userId]);
};

export const removeGameFromOwned = async (gameId: number, userId: number): Promise<void> => {
    const pool = getPool();
    const query = `DELETE FROM owned WHERE game_id = ? AND user_id = ?`;
    await pool.query(query, [gameId, userId]);
};

export const removeGameFromWishlistIfExists = async (gameId: number, userId: number): Promise<void> => {
    const pool = getPool();
    await pool.query(`DELETE FROM wishlist WHERE game_id = ? AND user_id = ?`, [gameId, userId]);
};