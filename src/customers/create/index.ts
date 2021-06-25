
import { APIGatewayProxyResult } from 'aws-lambda';
import * as AWSCore from 'aws-sdk';
import * as AWSXRay from 'aws-xray-sdk-core';
const {v4: uuidv4} = require('uuid');

let AWS;

const ddbOptions: AWSCore.DynamoDB.Types.ClientConfiguration = {
  apiVersion: '2012-08-10'
};


if (process.env.AWS_SAM_LOCAL) {
  AWS = AWSCore;
  ddbOptions.endpoint = 'http://dynamodb:8000';
} else {
  AWS = AWSXRay.captureAWS(AWSCore);
}

async function handler(event: any): Promise<APIGatewayProxyResult> {
  let response: APIGatewayProxyResult;
  try {
 
      const client = new AWS.DynamoDB(ddbOptions);
      const reqCustomer = JSON.parse(event.body)
      reqCustomer.uid = uuidv4();
      
      const customer = reqCustomer      
      
      const params: AWS.DynamoDB.Types.PutItemInput = {
          TableName: process.env.TABLE || 'customers',
          Item: {
          uid: {S: customer.uid},
          full_name: { S: customer.full_name },
          email: { S: customer.email },        
          birth: { S: customer.birth },
          city: { S: customer.city },
          country: { S: customer.country }     
        }
      };

      await client.putItem(params).promise();         
        response = {
        statusCode: 201,
        headers: { 'Content-Type': 'application/json' },
        body: ''
      };

  } catch (e) {
      response = {
        statusCode: 500,
        headers: {},
        body: e.message
      };
  }
  return response;
}

export { handler };