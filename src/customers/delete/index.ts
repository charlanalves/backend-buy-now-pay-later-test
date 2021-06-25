import { APIGatewayProxyResult } from 'aws-lambda';
import * as AWSCore from 'aws-sdk';
import * as AWSXRay from 'aws-xray-sdk-core';

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
   
    const customer = JSON.parse(event.body);
    const { uid } = customer;
    var client = new AWS.DynamoDB(ddbOptions);

    let params = {
      TableName: process.env.TABLE || 'customers',
      "Key": {
        "uid": {
          "S": uid.toString()
        }
      }
    };

  await client.deleteItem(params, () => {}).promise();     

  response = {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: ''
  };


  } catch (e) {
    response = {
      statusCode: 500,
      headers: {},
      body:e.message
    };    
  }
  return response;
}

export { handler };