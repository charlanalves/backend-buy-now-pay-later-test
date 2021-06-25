import { APIGatewayProxyResult } from 'aws-lambda';
import * as AWSCore from 'aws-sdk';
import * as AWSXRay from 'aws-xray-sdk-core';
const {
  DynamoDBClient, UpdateItemCommand,
} = require('@aws-sdk/client-dynamodb');
const { marshall, unmarshall } = require('@aws-sdk/util-dynamodb');

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

const update = async (tableName: String, key: Object, item: Object) => {
  const client = new DynamoDBClient(process.env.AWS_REGION);
  const itemKeys = Object.keys(item);
  console.log(JSON.stringify(itemKeys))

  // When we do updates we need to tell DynamoDB what fields we want updated.
  // If that's not annoying enough, we also need to be careful as some field names
  // are reserved - so DynamoDB won't like them in the UpdateExpressions list.
  // To avoid passing reserved words we prefix each field with "#field" and provide the correct
  // field mapping in ExpressionAttributeNames. The same has to be done with the actual
  // value as well. They are prefixed with ":value" and mapped in ExpressionAttributeValues
  // along witht heir actual value
  const { Attributes } = await client.send(new UpdateItemCommand({
    TableName:tableName,
    Key: marshall(key),
    ReturnValues: 'ALL_NEW',
    UpdateExpression: `SET ${itemKeys.map((k, index) => `#field${index} = :value${index}`).join(', ')}`,
    ExpressionAttributeNames: itemKeys.reduce((accumulator, k, index) => ({ ...accumulator, [`#field${index}`]: k }), {}),
    ExpressionAttributeValues: marshall(itemKeys.reduce((accumulator, k, index) => ({ ...accumulator, [`:value${index}`]: item[k] }), {})),
  }));
  
  return unmarshall(Attributes);
};

async function handler(event: any): Promise<APIGatewayProxyResult> {
  let response: APIGatewayProxyResult;
  try {
   
    const customer = JSON.parse(event.body);
    const {uid} = customer;

    var client = new AWS.DynamoDB(ddbOptions);
   
  const ret = await update(
    process.env.TABLE || 'customers', 
    {uid: uid}, 
    customer
  );

  response = {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(ret)
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