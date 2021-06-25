import * as chai from 'chai';
import * as sinon from 'sinon';
import * as sinonChai from 'sinon-chai';


chai.use(sinonChai);
const expect = chai.expect;

import * as AWSMock from 'aws-sdk-mock';
import * as AWS from 'aws-sdk';

import {handler} from '../index';
const {v4: uuidv4} = require('uuid');

describe('create customer tests', () => {
  let sandbox: sinon.SinonSandbox;
  let dynamoDbStub;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    AWSMock.setSDKInstance(AWS);    
  });

  afterEach(() => {
    AWSMock.restore('DynamoDB');
    sandbox.restore();
  });

  it('should put a customer into DynamoDB', async () => {
    // arrange
    dynamoDbStub = sandbox.stub().callsFake((params, cb) => cb(null));
    AWSMock.mock('DynamoDB', 'putItem', dynamoDbStub);
    
    const customer = buildCustomer();
    const event = {body: JSON.stringify(customer)};
    
    // act
    const response = await handler(event);
 
    expect(response).to.deep.equal({
      statusCode: 201,
      headers: {'Content-Type': 'application/json'},
      body: ""
    });
  });



  function buildCustomer(): object {
    return {        
      uid:'30b81f55-6a6d-417b-b7ba-db98c00ada09',   
      full_name: 'charlan santos',
      email: 'test@test.com',      
      birth: '24/09/1985',
      city: 'SP',
      country: 'Brazil'      
    }
  }

});