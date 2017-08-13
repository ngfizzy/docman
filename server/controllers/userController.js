import { User } from '../models';
import errorMessages from '../constants/errors';
import successMessages from '../constants/successes';
import authHelpers from '../helpers/authHelpers';
import helpers from '../helpers/helpers';

const { userAuthErrors, unmatchedUserSearch } = errorMessages;

const { userAuthSuccess, userDeleteSuccessful } = successMessages;
const { filterUsersResult, getPageMetadata } = helpers;

export default {
  /**
   * @description responds with a json web token to be used for authorization
   * on providing email and password. or an error message if an error occurs 
   * in when using this method
   * @param {object} request Express http request object
   * @param {object} response Express http response object
   * @returns {Promise} Promise object from express HTTP response
   */
  loginUser: (request, response) => {
    const { email, password } = request.body;
    return User.findOne({ where: { email } })
      .then((user) => {
        const hashedPassword = user.dataValues.password;
        const userCredentials = user.dataValues;
        const successMessage = userAuthSuccess.successfulLogin;
        authHelpers.isPasswordCorrect(password, hashedPassword);
        return authHelpers
          .sendUniqueJWT(userCredentials, response, successMessage);
      })
      .catch(() => {
        response.status(401).json({
          error: userAuthErrors.wrongEmailOrPassword
        });
      });
  },
  /**
   * @description responds with a json web token to be used for authorization
   * on providing email and password and username or an error message 
   * when an error occur while using this endpoint
   * @param {object} request Express http request object
   * @param {object} response Express http response object
   * @returns {Promise} Promise object from express HTTP response
   */
  signupUser: (request, response) => {
    const {
      email,
      password,
      confirmationPassword,
      username
    } = request.body;

    if (authHelpers.isTheTwoPasswordsSame(password,
      confirmationPassword,
      response)) {
      return User.create({ email, password, username })
        .then(user => authHelpers.sendUniqueJWT(user.dataValues, response))
        .catch(error => authHelpers.handleSignupError(error, response))
        .catch(() => User.findOne({ where: { email } }))
        .then((user) => {
          const { dataValues } = user;
          if (dataValues) {
            return authHelpers.sendUniqueJWT(dataValues, response);
          }
        })
        .catch(() => {
          response
            .status(503)
            .json({
              error: `your connection is probably slow.
              Please try again after a while`
            });
        });
    }
  },
  /**
  * @description responds with list of all users when error when
  * request parameters does not contain limit and offset query
  * responds with list of users with pagination metadata
  * when request paramiters contains limit and offset query.
  *  or an error message if an error occurs 
  * in when using this method
  * @param {object} request Express http request object
  * @param {object} response Express http response object
  * @returns {Promise} Promise object from express HTTP response
  */
  getUsers: (request, response) => {
    let { limit, offset } = request.query;
    if (limit && offset) {
      if (Number.isNaN(Number(limit)) || Number.isNaN(Number(offset))) {
        return response
          .status(406)
          .json({ error: errorMessages.paginationQueryError });
      }
      limit = Number.parseInt(limit, 10);
      offset = Number.parseInt(offset, 10);
      return User.findAndCountAll({ limit, offset })
        .then((queryResult) => {
          const users = filterUsersResult(queryResult.rows);
          const metaData = getPageMetadata(limit, offset, queryResult.count);
          return response.json({ users, metaData });
        });
    }
    return User.findAndCountAll()
      .then(queryResult => response
        .json({
          users: filterUsersResult(queryResult.rows),
          metaData: {
            count: queryResult.count
          }
        }));
  },
  /**
  * @description responds with a simgle user object from the
  * @param {object} request Express http request object
  * @param {object} response Express http response object
  * @returns {Promise} Promise object from express HTTP response
  */
  getUserById: (request, response) => {
    const userQueryPromise = User.findById(request.params.id)
      .then((user) => {
        if (!user) {
          return response
            .status(404)
            .json({ error: errorMessages.userNotFound });
        }
        const { password, ...userData } = user.dataValues;
        return response.json(userData);
      })
      .catch(() => response
        .status(400)
        .json({ error: errorMessages.wrongIdTypeError }));
    return userQueryPromise;
  },
  /**
  * @description updates any user data apart from id. reponds
  * with new user object or error message if any error occurs in 
  * the process. It is only going to get needed payload and ignore
  * other payloads
  * @param {object} request Express http request object
  * @param {object} response Express http response object
  * @returns {Promise} Promise object from express HTTP response
  */
  updateUserInfo: (request, response) => {
    const updateData = helpers.getOnlyTruthyAttributes(request.body);
    return User.findById(request.params.id)
      .then((user) => {
        helpers.terminateUserUpdateOnBadPayload(
          updateData,
          request.body,
          user);
        let { userSuccessfullyUpdated } = userAuthSuccess;
        if (request.body.newPassword) {
          updateData.password = request.body.newPassword;
          userSuccessfullyUpdated += ` ${userAuthSuccess.userUpdatedPassword}`;
        }
        return user
          .update(updateData)
          .then((updatedUser) => {
            user.dataValues.password = '********';
            return response
              .json({
                user: updatedUser.dataValues,
                message: userSuccessfullyUpdated
              });
          });
      })
      .catch(error => helpers.handleUserUpdateError(error, response));
  },
  /**
  * @description deletes a user from the database. responds with a success
  * message. there is no error handling in this method as all error handling
  * is expected to be done by a middleware
  * @param {object} request Express http request object
  * @param {object} response Express http response object
  * @returns {Promise} Promise object from express HTTP response
  */
  deleteUser: (request, response) => {
    const userToDelete = request.params.id;
    User.destroy({ where: { id: userToDelete } })
      .then(() => response
        .status(200)
        .json({
          message: userDeleteSuccessful
        })
      );
  },
  /**
  * @description searches user by email. respoonds with all
  * matching instances or an error message if search term does
  * not match any email in the database
  * @param {object} request Express http request object
  * @param {object} response Express http response object
  * @returns {Promise} Promise object from express HTTP response
  */
  searchUser: (request, response) => {
    const query = request.query.q;
    User.findAndCountAll({
      where: { email: { $ilike: `%${query}%` } },
      attributes: { exclude: ['password'] }
    })
      .then((users) => {
        if (!users.count) {
          return response
            .status(404)
            .json({ error: unmatchedUserSearch });
        }
        return response.json({ matches: users.count, users: users.rows });
      });
  }
};
