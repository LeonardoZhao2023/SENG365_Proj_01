import {Request, Response} from "express";
import {getPool} from "../../config/db";

export const authenticate = async (req: Request, res: Response, next: () => void) => {
    const authHeader = req.header("X-Authorization");
    if (!authHeader) {
        res.status(401).send("Unauthorized: Missing or invalid token");
        return;
    }
    const token = authHeader;
    const query = "SELECT id FROM user WHERE auth_token = ?";
    const [rows] = await getPool().query(query, [token]);
    if (rows.length === 0) {
        res.status(401).send("Unauthorized: Token not recognized");
        return;
    }
    req.body.userId = rows[0].id;
    next();
};