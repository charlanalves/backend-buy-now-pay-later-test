import {CodeDeploy, Lambda, DynamoDB} from 'aws-sdk';
const {v4: uuidv4} = require('uuid');


const cdClient = new CodeDeploy({apiVersion: '2014-10-06'});
const lambdaClient = new Lambda();
const ddbClient = new DynamoDB({apiVersion: '2012-08-10'});

const tableName = process.env.TABLE || 'customers';

exports.handler = async (event: any)  => {
    let status = 'Succeeded';
    try {
        console.log('Entering PreTraffic Hook!');

        console.log('CodeDeploy event', event);
	
        const functionToTest = process.env.FN_NEW_VERSION || 'customers-create';
        console.log('Testing new function version: ' + functionToTest);
    
        const customer = {full_name: 'Charlan Santos', email: 'teste@teste.com', birth: '24/09/1985', city: 'São Paulo', country: 'Brazil',};
        const request = {
          body: JSON.stringify(customer)
        }

        const lParams: Lambda.Types.InvocationRequest = {
            FunctionName: functionToTest,
            Payload: JSON.stringify(request)
        };
        await lambdaClient.invoke(lParams).promise();
        
        const ddbParams: DynamoDB.Types.GetItemInput = {
            TableName: tableName,
            Key: {full_name: {S: customer.full_name}},
            ConsistentRead: true
        };

        console.log('DynamoDB getItem params', JSON.stringify(ddbParams, null, 2));
        await wait();
        const {Item} = await ddbClient.getItem(ddbParams).promise();
        console.log('DynamoDB item', JSON.stringify(Item, null, 2));

        if (!Item) {
            throw new Error('Test customer not inserted in DynamoDB');
        }

        delete ddbParams.ConsistentRead;
        await ddbClient.deleteItem(ddbParams).promise();
        console.log('Test DynamoDB item deleted');

    } catch (e) {
        console.log(e);
        status = 'Failed';
    }

    const cdParams: CodeDeploy.Types.PutLifecycleEventHookExecutionStatusInput = {
        deploymentId: event.DeploymentId,
        lifecycleEventHookExecutionId: event.LifecycleEventHookExecutionId,
        status
    };

    return await cdClient.putLifecycleEventHookExecutionStatus(cdParams).promise();
};

function wait(ms?: number) {
    const t = ms || 1500;
    return new Promise(resolve => {
        setTimeout(resolve, t);
    });
}