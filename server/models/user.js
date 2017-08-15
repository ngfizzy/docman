import bcrypt from 'bcrypt';
import errorMessages from '../constants/errors';

const { userAuthErrors } = errorMessages;

module.exports = (sequelize, DataTypes) => {
  const User = sequelize.define('User', {
    email: {
      type: DataTypes.STRING,
      unique: true,
      allowNull: false,
      validate: {
        isEmail: {
          msg: userAuthErrors.badEmailError
        }
      }
    },
    password: {
      type: DataTypes.STRING,
      allowNull: false
    },
    username: {
      type: DataTypes.STRING,
      unique: true,
      allowNull: false,
      validate: {
        len: {
          args: [2, 15],
          msg: errorMessages.usernameLimitError
        }
      }
    },
    fullName: {
      type: DataTypes.STRING,
      validate: {
        len: {
          arg: [0, 25],
          msg: errorMessages.fullNameLimitError
        }
      }
    },
    bio: {
      type: DataTypes.STRING,
      validate: {
        len: {
          args: [0, 240],
          msg: errorMessages.bioLimitError
        }
      }
    }
  },
  {
    hooks: {
      beforeCreate: (user) => {
        user.hashPassword(user);
      },
      beforeUpdate: (user) => {
        user.hashPassword(user);
      }
    }
  });
  User.prototype.hashPassword = (user) => {
    user.password = bcrypt.hashSync(user.password, 10);
  };
  User.associate = (models) => {
    User.hasMany(models.Document, {
      foreignKey: 'author',
      sourceKey: 'id',
      as: 'author',
      onDelete: 'CASCADE'
    });
    User.belongsTo(models.Role, {
      foreignKey: 'role',
      targetKey: 'id',
      defaultValue: 2,
      onDelete: 'CASCADE',
    });
  };
  return User;
};
