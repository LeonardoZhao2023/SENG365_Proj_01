import {Express} from "express";
import {rootUrl} from "./base.routes";
import {authenticate} from "../middleware/auth.middleware";
import * as gameController from '../controllers/game.controller'
import * as gameReviewController from '../controllers/game.review.controller'
import * as gameActionController from '../controllers/game.action.controller'
import * as gameImageController from '../controllers/game.image.controller'
import {authenticateOpt} from "../middleware/auth_opt.middleware";


module.exports = (app: Express) => {
    app.route(rootUrl + '/games')
        .get(authenticateOpt, gameController.getAllGames)
        .post(authenticate, gameController.addGame);

    app.route(rootUrl + '/games/genres')
        .get(gameController.getGenres);

    app.route(rootUrl + '/games/platforms')
        .get(gameController.getPlatforms);

    app.route(rootUrl + '/games/:id')
        .get(gameController.getGame)
        .patch(authenticate, gameController.editGame)
        .delete(authenticate, gameController.deleteGame);

    app.route(rootUrl + '/games/:id/reviews')
        .get(gameReviewController.getGameReviews)
        .post(authenticate, gameReviewController.addGameReview);

    app.route(rootUrl + '/games/:id/wishlist')
        .post(authenticate, gameActionController.addGameToWishlist)
        .delete(authenticate, gameActionController.removeGameFromWishlist);

    app.route(rootUrl + '/games/:id/owned')
        .post(authenticate, gameActionController.addGameToOwned)
        .delete(authenticate, gameActionController.removeGameFromOwned);

    app.route(rootUrl + '/games/:id/image')
        .get(gameImageController.getImage)
        .put(authenticate, gameImageController.setImage);
}