import { getPool } from "../../config/db";

const checkEmailExists = async (email: string): Promise<boolean> => {
    const query = "SELECT * FROM user WHERE email = ?";
    const [rows] = await getPool().query(query, [email]);
    return rows.length > 0;
};

const create = async (user: {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
}): Promise<number> => {
    const query = `
        INSERT INTO user (first_name, last_name, email, password)
        VALUES (?, ?, ?, ?)
    `;
    const [result] = await getPool().query(query, [
        user.firstName,
        user.lastName,
        user.email,
        user.password,
    ]);
    return (result as any).insertId;
};

const getByEmail = async (email: string): Promise<any | null> => {
    const query = "SELECT id AS userId, password FROM user WHERE email = ?";
    const [rows] = await getPool().query(query, [email]);
    return rows[0] || null;
};

const generateAndStoreToken = async (userId: number): Promise<string> => {
    const Uid = require('rand-token').uid;
    const token = Uid(16);
    const query = "UPDATE user SET auth_token = ? WHERE id = ?";
    await getPool().query(query, [token, userId]);
    return token;
};

const clearToken = async (token: string): Promise<boolean> => {
    const query = "UPDATE user SET auth_token = NULL WHERE auth_token = ?";
    const [result] = await getPool().query(query, [token]);
    return (result as any).affectedRows > 0;
};

const getById = async (userId: number): Promise<any | null> => {
    const query = `
        SELECT id AS userId, first_name, last_name, email, auth_token
        FROM user
        WHERE id = ?
    `;
    const [rows] = await getPool().query(query, [userId]);
    return rows[0] || null;
};

const updateUser = async (id: number, updates: any): Promise<void> => {
    const fields: string[] = [];
    const values: any[] = [];
    if (updates.firstName) {
        fields.push("first_name = ?");
        values.push(updates.firstName);
    }
    if (updates.lastName) {
        fields.push("last_name = ?");
        values.push(updates.lastName);
    }
    if (updates.email) {
        fields.push("email = ?");
        values.push(updates.email);
    }
    if (updates.password) {
        fields.push("password = ?");
        values.push(updates.password);
    }
    if (fields.length === 0) {
        return;
    }
    const query = `UPDATE user SET ${fields.join(", ")} WHERE id = ?`;
    values.push(id);
    await getPool().query(query, values);
};

export { checkEmailExists, create, getByEmail, generateAndStoreToken, clearToken, getById, updateUser };