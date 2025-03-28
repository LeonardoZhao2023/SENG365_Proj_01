import fs from "fs";
import path from "path";
import { getPool } from "../../config/db";

const imageDir = "storage/images";
const validTypes: { [key: string]: string } = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/gif": ".gif"
};

const getImageFile = async (userId: number): Promise<{ data: Buffer; mimeType: string } | null> => {
    const pool = getPool();
    const [rows]: any = await pool.query("SELECT image_filename FROM user WHERE id = ?", [userId]);
    if (!rows.length || !rows[0].image_filename) {
        return null;
    }
    const filePath = path.join(imageDir, rows[0].image_filename);
    if (!fs.existsSync(filePath)) {
        return null;
    }
    const ext = path.extname(filePath);
    const mimeType = Object.keys(validTypes).find(type => validTypes[type] === ext);
    const data = fs.readFileSync(filePath);
    return { data, mimeType: mimeType || "application/octet-stream" };
};

const setUserImage = async (userId: number, token: string | undefined, imageData: Buffer, contentType: string): Promise<number> => {
    const pool = getPool();
    const [auth]: any = await pool.query("SELECT id FROM user WHERE auth_token = ?", [token]);
    if (!auth.length || auth[0].id !== userId) {
        throw { status: 403, message: "Forbidden" };
    }
    const [user]: any = await pool.query("SELECT image_filename FROM user WHERE id = ?", [userId]);
    const oldFile = user[0]?.image_filename;
    const extension = validTypes[contentType];
    const filename = `user_${userId}${extension}`;
    const filepath = path.join(imageDir, filename);
    fs.writeFileSync(filepath, imageData);
    await pool.query("UPDATE user SET image_filename = ? WHERE id = ?", [filename, userId]);
    if (oldFile && oldFile !== filename) {
        const oldPath = path.join(imageDir, oldFile);
        if (fs.existsSync(oldPath)) {
            fs.unlinkSync(oldPath);
        }
    }
    return oldFile ? 200 : 201;
};

const deleteUserImage = async (userId: number, token: string | undefined): Promise<number> => {
    const pool = getPool();
    const [auth]: any = await pool.query("SELECT id FROM user WHERE auth_token = ?", [token]);
    if (!auth.length || auth[0].id !== userId) {
        throw { status: 403, message: "Forbidden" };
    }
    const [user]: any = await pool.query("SELECT image_filename FROM user WHERE id = ?", [userId]);
    if (!user.length || !user[0].image_filename) {
        return 404;
    }
    const imagePath = path.join(imageDir, user[0].image_filename);
    if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
    }
    await pool.query("UPDATE user SET image_filename = NULL WHERE id = ?", [userId]);
    return 200;
};

export { validTypes, getImageFile, setUserImage, deleteUserImage };