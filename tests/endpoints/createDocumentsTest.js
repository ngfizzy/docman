import { assert } from 'chai';
import supertest from 'supertest';
import jwtDriver from 'jsonwebtoken';
import { User, Document } from '../../server/models/';
import server from '../../server/server';
import dummyUsers from '../dummyData/dummyUsers';
import errorMessages from '../../server/constants/errors';


const {
  invalidDocAccessLevelError,
  duplicateDocTitleError
} = errorMessages;

const request = supertest(server);

describe('POST /api/v1/documents/', () => {
  const { email, password, username } = dummyUsers[0];
  const dummyUser = {
    email,
    password,
    username,
    confirmationPassword: password
  };
  let jwt;
  before(() => User
    .destroy({ where: {}, cascade: true, restartIdentity: true })
    .then(() => Document.destroy(
      {
        where: {},
        cascade: true,
        restartIdentity: true
      }))
    .then(() => request
      .post('/api/v1/users/')
      .send(dummyUser)
      .expect(200)
      .then((response) => {
        jwt = response.body.token;
      }))
  );

  it(`should respond with '${invalidDocAccessLevelError}'
  an invalid access is specified`, () => request
      .post('/api/v1/documents/')
      .send({
        title: 'some title',
        content: 'some content',
        access: 'sh*t'
      })
      .set('Authorization', jwt)
      .expect(403)
      .expect((response) => {
        assert.equal(response.body.error, invalidDocAccessLevelError);
      })
  );

  it('should respond with an array of errors if any validation error occurs',
    () => request
      .post('/api/v1/documents')
      .send({
        title: 'some title',
        content: null,
        access: 'public'
      })
      .set('Authorization', jwt)
      .expect(403)
      .expect((response) => {
        const errors = response.body.errors;
        assert.typeOf(errors, 'Array');
        assert.lengthOf(errors, 1);
        assert.typeOf(errors[0].message, 'string');
      }));

  it(`should respond with the created user object when valid  payload
      is expected`, () => request
      .post('/api/v1/documents')
      .send({
        title: 'some title',
        content: 'some content',
        access: 'public'
      })
      .set('Authorization', jwt)
      .expect(201)
      .expect((response) => {
        const doc = response.body.document;
        const expectedAuthor = jwtDriver.decode(jwt.split(' ')[1]);
        const expectedAuthorId = expectedAuthor.data.id;
        assert.equal(doc.title, 'some title');
        assert.equal(doc.content, 'some content');
        assert.equal(doc.access, 'public');
        assert.equal(doc.author, expectedAuthorId);
      })
  );
  it(`should respond with '${duplicateDocTitleError}' when document
  title already exist in the database`, () => request
      .post('/api/v1/documents')
      .send({
        title: 'some title',
        content: 'some content',
        access: 'public'
      })
      .set('Authorization', jwt)
      .expect(403)
      .expect((response) => {
        const error = response.body.error;
        assert.equal(error, duplicateDocTitleError);
      })
  );
});
