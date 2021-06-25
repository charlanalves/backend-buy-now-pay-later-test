// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import * as chai from 'chai';
import * as sinon from 'sinon';
import * as sinonChai from 'sinon-chai';

chai.use(sinonChai);
const expect = chai.expect;

import { v4 as uuidv4, validate as uuidValidate } from 'uuid';
import * as AWSMock from 'aws-sdk-mock';
import * as AWS from 'aws-sdk';

import { handler } from '../index';

interface Customer {
  uid: string;
  full_name: string;
  email: string;  
  birth: string;
  city: string;
  country: string;  
};

describe('get all customer tests', () => {
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



  it('should get no customers from dynamodb', async () => {
    // arrange
    dynamoDbStub = sandbox.stub().callsFake((params, cb) => cb(null, {Items:[]}));
    AWSMock.mock('DynamoDB', 'scan', dynamoDbStub);

    // act
    const response = await handler();

    // assert
    expect(dynamoDbStub).to.have.been.calledWith({
      TableName: 'customers'
    });
    expect(response).to.have.property('statusCode', 200);
    expect(response).to.have.deep.property('headers', { 'Content-Type': 'application/json' });
    expect(response).to.have.property('body');

    const customers: Customer[] = JSON.parse(response.body);
    expect(customers).to.have.length(0);
  });

  it('should return an error if call to DynamoDB fails', async () => {
    // arrange
    dynamoDbStub = sandbox.stub().callsFake((params, cb) => cb('Error'));
    AWSMock.mock('DynamoDB', 'scan', dynamoDbStub);
    
    // act
    const response = await handler();

    // assert
    expect(dynamoDbStub).to.have.been.calledWith({
      TableName: 'customers'
    });
    expect(response).to.deep.equal({
      statusCode: 500,
      headers: {},
      body: undefined
    });
  });

  function buildDynamoDbCustomers(count: number = 2) {
    const customers: AWS.DynamoDB.ScanOutput = { Items: [] };
    for (let i = 0; i < count; i++) {
      customers.Items?.push({        
        full_name: { S:'1' },
        email: { S: '1' },        
        birth: { S: '1' },
        city: { S: '1' },
        country: { S: '1' }        
      });
    }
    return customers;
  }

});