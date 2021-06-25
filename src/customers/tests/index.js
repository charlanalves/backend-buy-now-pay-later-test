// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

const axios = require('axios');
const { expect } = require('chai');

const {v4: uuidv4} = require('uuid');
const AWS = require('aws-sdk');

const manager = require('./customers-manager');

const region = process.env.AWS_REGION;

const cognitoServiceProvider = new AWS.CognitoIdentityServiceProvider({
  apiVersion: '2016-04-18',
  region
});

describe('End-to-end tests for Customer API', () => {
  const apiEndpoint = process.env.API_ENDPOINT;
  const customersEndpoint = `${apiEndpoint}customers`;

  const username = `success+${uuidv4()}@simulator.amazonses.com`; 
  const userPoolId = process.env.USER_POOL_ID;
  const userPoolClientId = process.env.USER_POOL_CLIENT_ID;
  const password = uuidv4();

  let token;

  before(async () => {
    await createUser();
    const accessToken = await getAccessToken();
    token = `Bearer ${accessToken}`;
  });

  after(deleteUser);

  context('Getting all customers', () => {

    it('should not required authentication', async () => {
      // act
      return axios
        .get(customersEndpoint)
        .then(response => {
          // assert
          expect(response).to.have.property('status', 200);
        });
    });

    it('should return customers', async () => {
      // arrange
      const n = 5;
      const customersToCreate = buildCustomers(n);
      await manager.save(customersToCreate);

      // act
      return axios
        .get(customersEndpoint)
        .then(response => {
          // assert
          expect(response).to.have.property('status', 200);

          const {data} = response;
          expect(data).to.have.lengthOf(n);
          for (let i = 0; i < n; i++) {
            const customer = data[i];
            const expectedCustomer = manager.findCustomerInList(customer, customersToCreate);
            expect(expectedCustomer).to.deep.equal(customer);
          }

          // clean up
          return manager.remove(customersToCreate);
        })
        .catch(async e => {
          // clean up
          await manager.remove(customersToCreate);
          return Promise.reject(e);
        });
    });
  });

  context('Creating a new customer', () => {

    it('should not allow to create a customer without token', async () => {
      // act
      return axios
        .post(customersEndpoint, buildCustomers(1)[0])
        .catch(result => {
          // assert
          const {response} = result;
          expect(response).to.have.property('status', 401);
        });
    });
  
    it('should return an error if payload doesnt match expected schema', async () => {
      // arrange
      const incorrectCustomer = buildCustomers(1)[0];
      delete incorrectCustomer.city;

      // act
      return axios
        .post(customersEndpoint, incorrectCustomer, {headers: {Authorization: token}})
        .catch(result => {
          // assert
          const {response} = result;
          expect(response).to.have.property('status', 500);
        });
    });

    it('should create a new customer', async () => {
      // arrange
      const customer = buildCustomers(1)[0];

      // act
      return axios
        .post(customersEndpoint, customer, {headers: {Authorization: token}})
        .then(async response  => {
          // assert
          expect(response).to.have.property('status', 201);

          const savedCustomer = await manager.get(customer);
          expect(customer).to.deep.equal(savedCustomer);

          // clean up
          await manager.remove([customer]);
        })
        .catch(async e => {
          // clean up
          await manager.remove([customer]);
          return Promise.reject(e);
        });
    });
  });

  async function createUser() {
    // create user
    const createUserParams = {
      UserPoolId: userPoolId,
      Username: username,
      UserAttributes: [{
        Name: 'email_verified', Value: 'True'
      }, {
        Name: 'email', Value: username
      }]
    };
    const createUserResponse = await cognitoServiceProvider.adminCreateUser(createUserParams).promise();
    
    // confirm user
    const setPwParams = {
      UserPoolId: userPoolId,
      Username: username,
      Password: password,
      Permanent: true
    };
    await cognitoServiceProvider.adminSetUserPassword(setPwParams).promise();
    
    return createUserResponse.User;
  }

  async function getAccessToken() {
    const params = {
      AuthFlow: 'USER_PASSWORD_AUTH',
      ClientId: userPoolClientId,
      AuthParameters: {
        'USERNAME': username,
        'PASSWORD': password
      }
    }
    const response = await cognitoServiceProvider.initiateAuth(params).promise();
    return response.AuthenticationResult.AccessToken;
  }

  async function deleteUser() {
    const deleteUserParams = {
      UserPoolId: userPoolId,
      Username: username
    };
    
    return cognitoServiceProvider.adminDeleteUser(deleteUserParams).promise();
  }

  function buildCustomers(count) {
    count = count || 1;
    const customers = [];
    for (let i = 0; i < count; i++) {
      customers.push({
        uid: uuidv4(),
        full_name: uuidv4(),
        email: `email_${i}`,        
        birth: `birth_${i}`,
        city: `city_${i}`,
        country: `Brazil_${i}`        
      });
    }
    return customers;
  }
});