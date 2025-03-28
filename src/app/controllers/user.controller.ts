import {Request, Response} from "express";
import Logger from '../../config/logger';
import bcrypt from 'bcrypt';
import * as User from '../models/user.model';
import {validate} from "../services/validator";
import * as schemas from "../resources/schemas.json";

const SALT_ROUNDS = 10;

const register = async (req: Request, res: Response): Promise<void> => {
    const validation = await validate(schemas.user_register, req.body);
    if (validation !== true) {
        res.statusMessage = `Bad Request: ${validation.toString()}`;
        res.status(400).send();
        return;
    }
    const { firstName, lastName, email, password } = req.body;
    try {
        // Check if email already exists
        const emailExists = await User.checkEmailExists(email);
        if (emailExists) {
            res.status(403).send({ error: 'Email already in use' });
            return;
        }
        const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
        const userId = await User.create({ firstName, lastName, email, password: hashedPassword });
        res.status(201).json({ userId });
    } catch (err) {
        Logger.error(err);
        res.statusMessage = "Internal Server Error";
        res.status(500).send();
    }
}

const login = async (req: Request, res: Response): Promise<void> => {
    const validation = await validate(schemas.user_login, req.body);
    if (validation !== true) {
        res.statusMessage = `Bad Request: ${validation.toString()}`;
        res.status(400).send();
        return;
    }
    const { email, password } = req.body;
    try {
        const user = await User.getByEmail(email);
        if (!user) {
            res.status(401).send({ error: 'Email doesn\'t exist' });
            return;
        }
        const passwordMatch = await bcrypt.compare(password, user.password);
        if (!passwordMatch) {
            res.status(401).send({ error: 'Incorrect password' });
            return;
        }
        const token = await User.generateAndStoreToken(user.userId);
        res.status(200).json({ userId: user.userId, token });
    } catch (err) {
        Logger.error(err);
        res.statusMessage = "Internal Server Error";
        res.status(500).send();
    }
}

const logout = async (req: Request, res: Response): Promise<void> => {
    const token = req.header("X-Authorization");
    try {
        if (!token) {
            res.status(401).send({ error: "Unauthorized" });
            return;
        }
        const success = await User.clearToken(token);
        if (!success) {
            res.status(401).send({ error: "Invalid token" });
            return;
        }
        res.status(200).send();
    } catch (err) {
        Logger.error(err);
        res.statusMessage = "Internal Server Error";
        res.status(500).send();
    }
}

const view = async (req: Request, res: Response): Promise<void> => {
    const userId = parseInt(req.params.id, 10);
    const authToken = req.header("X-Authorization");
    try {
        if (isNaN(userId)) {
            res.status(400).send({ error: "Invalid user ID" });
            return;
        }
        const user = await User.getById(userId);
        if (!user) {
            res.status(404).send({ error: "User not found" });
            return;
        }
        if (authToken && authToken === user.auth_token) {
            res.status(200).json({
                firstName: user.first_name,
                lastName: user.last_name,
                email: user.email
            });
        } else {
            res.status(200).json({
                firstName: user.first_name,
                lastName: user.last_name
            });
        }
    } catch (err) {
        Logger.error(err);
        res.statusMessage = "Internal Server Error";
        res.status(500).send();
    }
}

const update = async (req: Request, res: Response): Promise<void> => {
    const authToken = req.header("X-Authorization");
    const validation = await validate(schemas.user_edit, req.body);
    if (validation !== true) {
        res.statusMessage = `Bad Request: ${validation.toString()}`;
        res.status(400).send();
        return;
    }
    const userId = parseInt(req.params.id, 10);
    try {
        if (isNaN(userId)) {
            res.status(400).send({ error: "Invalid user ID" });
            return;
        }
        const user = await User.getById(userId);
        if (!user) {
            res.status(404).send({ error: "User not found" });
            return;
        }
        if (!authToken || authToken !== user.auth_token) {
            res.status(403).send({ error: "Forbidden: Can't update another user's info" });
            return;
        }
        const email  = req.body.email;
        const newPassword  = req.body.password;
        const currentPassword = req.body.currentPassword;
        // Check if email is being changed and is already in use
        if (email && email !== user.email) {
            const emailInUse = await User.checkEmailExists(email);
            if (emailInUse) {
                res.status(403).send({ error: "Email already in use" });
                return;
            }
        }
        // Handle password change
        if (currentPassword || newPassword) {
            if (!currentPassword || !newPassword) {
                res.status(400).send({ error: "Both current and new password must be provided" });
                return;
            }
            if (currentPassword === newPassword) {
                res.status(403).send({ error: "New password must be different from current password" });
                return;
            }
            const match = await bcrypt.compare(currentPassword, user.password);
            if (!match) {
                res.status(401).send({ error: "Incorrect current password" });
                return;
            }
            req.body.password = await bcrypt.hash(newPassword, SALT_ROUNDS);
        }
        await User.updateUser(userId, req.body);
        res.status(200).send();
    } catch (err) {
        Logger.error(err);
        res.statusMessage = "Internal Server Error";
        res.status(500).send();
    }
}

export {register, login, logout, view, update}