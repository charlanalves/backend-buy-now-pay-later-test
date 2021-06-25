const AWS = require('aws-sdk');
const client = new AWS.DynamoDB({ apiVersion: '2012-08-10' });
const {v4: uuidv4} = require('uuid');

const table = process.env.TABLE || 'customers';

const save = async (customers) => {
  try {
    const putRequests = [];
    for (let customer of customers) {
      putRequests.push({
        PutRequest: {
          Item: {
            uid: { S: uuidv4() },
            full_name: { S: customer.full_name },
            email: { S: customer.email },            
            birth: { S: customer.birth },
            city: { S: customer.city },
            country: { S: customer.country.toString() }            
          }
        }
      })
    }
  
    const params = {
      RequestItems: {
        [table]: putRequests
      }
    };
  
    await client.batchWriteItem(params).promise();
  } catch (e) {
    console.log('error saving test customers into dynamodb', e);
    throw e;
  }
  
};

const remove = async (customers) => {
  try {
    const deleteRequests = [];
    for (let customer of customers) {
      deleteRequests.push({
        DeleteRequest: {
          Key: {
            uid: { S: customer.uid }
          }
        }
      })
    }
  
    const params = {
      RequestItems: {
        [table]: deleteRequests
      }
    };
  
    await client.batchWriteItem(params).promise();
  } catch (e) {
    console.log('error removing test customers from dynamodb', e);
    throw e;
  }
};

const get = async customer => {
  try {
    const params = {
      TableName: table,
      Key: {
        'full_name': {S: customer.full_name}
      }
    };
  
    const result = await client.getItem(params).promise();
    return {
      uid: result.Item.uid.S,
      full_name: result.Item.full_name.S,
      email: result.Item.email.S,      
      birth: result.Item.birth.S,
      city: result.Item.city.S,
      country: result.Item.country.S,      
    };
  } catch (e) {
    console.log('error retrieving test customer from dynamodb', e);
    throw e;
  }
}

const find = (customer, list) => {
  for (e of list) {
    if (e.full_name === customer.full_name) return e;
  }
}

exports.save = save;
exports.remove = remove;
exports.get = get;
exports.findCustomerInList = find;

