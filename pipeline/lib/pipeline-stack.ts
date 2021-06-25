import * as cdk from '@aws-cdk/core';
import * as codebuild from '@aws-cdk/aws-codebuild';
import * as codepipeline from '@aws-cdk/aws-codepipeline';
import * as codepipeline_actions from '@aws-cdk/aws-codepipeline-actions';
import * as ssm from '@aws-cdk/aws-ssm';

import { CodeBuildAction, GitHubSourceAction, ManualApprovalAction } from '@aws-cdk/aws-codepipeline-actions';
import { Bucket, BucketEncryption } from '@aws-cdk/aws-s3';

export class PipelineStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const accountId = this.account;

    // Bucket for pipeline artifacts
    const pipelineArtifactBucket = new Bucket(this, 'CiCdPipelineArtifacts', {
      bucketName: `customers-ci-cd-pipeline-artifacts-a1${accountId}`,
      encryption: BucketEncryption.S3_MANAGED
    });

    const apiArtifactBucket = new Bucket(this, 'ApiArtifacts', {
      bucketName: `customers-api-artifacts-a1${accountId}`,
      encryption: BucketEncryption.S3_MANAGED
    });

   
    const sourceArtifacts = new codepipeline.Artifact();
    const sourceAction: GitHubSourceAction = new codepipeline_actions.GitHubSourceAction({
      actionName: 'Source',
      owner: ssm.StringParameter.fromStringParameterName(this, 'GithubUsername', 'github_username').stringValue,
      repo: 'buy-now-pay-later-test',
      oauthToken: cdk.SecretValue.secretsManager('github_token', {jsonField: 'github_token'}),
      output: sourceArtifacts,
      branch: 'main',
      trigger: codepipeline_actions.GitHubTrigger.WEBHOOK,
      variablesNamespace: 'SourceVariables'
    });

    // Build
    const buildProject = new codebuild.PipelineProject(this, 'CiCdBuild', {
      buildSpec: codebuild.BuildSpec.fromSourceFilename('pipeline/buildspec.json'),
      environment: {
        buildImage: codebuild.LinuxBuildImage.STANDARD_3_0
      },
      projectName: 'customers-api-build'
    });

    apiArtifactBucket.grantPut(buildProject);

    const buildArtifacts = new codepipeline.Artifact();
    const buildAction: CodeBuildAction = new codepipeline_actions.CodeBuildAction({
      actionName: 'Build',
      input: sourceArtifacts,
      environmentVariables: {
        S3_BUCKET: {value: apiArtifactBucket.bucketName},
        GIT_BRANCH: {value: sourceAction.variables.branchName}
      },
      project: buildProject,
      variablesNamespace: 'BuildVariables',
      outputs: [buildArtifacts]
    });

    // Deploy
    const deployProject = new codebuild.PipelineProject(this, 'CiCdDeploy', {
      buildSpec: codebuild.BuildSpec.fromSourceFilename('pipeline/buildspec-deploy.json'),
      environment: {
        buildImage: codebuild.LinuxBuildImage.STANDARD_3_0
      },
      projectName: 'customers-api-deploy'
    });

    apiArtifactBucket.grantRead(deployProject);
    deployProject.role?.addManagedPolicy({managedPolicyArn: 'arn:aws:iam::aws:policy/AWSCloudFormationFullAccess'});
    deployProject.role?.addManagedPolicy({managedPolicyArn: 'arn:aws:iam::aws:policy/AmazonDynamoDBFullAccess'});
    deployProject.role?.addManagedPolicy({managedPolicyArn: 'arn:aws:iam::aws:policy/AWSLambda_FullAccess'});
    deployProject.role?.addManagedPolicy({managedPolicyArn: 'arn:aws:iam::aws:policy/AmazonAPIGatewayAdministrator'});
    deployProject.role?.addManagedPolicy({managedPolicyArn: 'arn:aws:iam::aws:policy/IAMFullAccess'});
    deployProject.role?.addManagedPolicy({managedPolicyArn: 'arn:aws:iam::aws:policy/AWSCodeDeployFullAccess'});
    deployProject.role?.addManagedPolicy({managedPolicyArn: 'arn:aws:iam::aws:policy/AmazonCognitoPowerUser'});

    // Deploy to staging
    const deployToStagingAction: CodeBuildAction = new codepipeline_actions.CodeBuildAction({
      actionName: 'Deploy',
      input: sourceArtifacts,
      environmentVariables: {
        STACK_NAME: {value: 'CustomersApiStaging'},
        ENVIRONMENT: {value: 'staging'},
        ARTIFACTS_PATH: {value: buildAction.variable('ARTIFACTS_PATH')}
      },
      variablesNamespace: 'StagingVariables',
      project: deployProject,
      runOrder: 1
    });

    
    // Deploy to production
    const manualApprovalAction: ManualApprovalAction = new codepipeline_actions.ManualApprovalAction({
      actionName: 'Review',
      additionalInformation: 'Ensure Customers API works correctly in Staging and release date is agreed with Product Owners',
      runOrder: 1
    });

    const deployToProductionAction: CodeBuildAction = new codepipeline_actions.CodeBuildAction({
      actionName: 'Deploy',
      input: sourceArtifacts,
      environmentVariables: {
        STACK_NAME: {value: 'CustomersApiProduction'},
        ENVIRONMENT: {value: 'production'},
        ARTIFACTS_PATH: {value: buildAction.variable('ARTIFACTS_PATH')}
      },
      project: deployProject,
      runOrder: 2
    });

    // Pipeline
    new codepipeline.Pipeline(this, 'CiCdPipeline', {
      pipelineName: 'CustomersApi',
      artifactBucket: pipelineArtifactBucket,
      stages: [
        {
          stageName: 'Source',
          actions: [sourceAction],
        }, {
          stageName: 'Build',
          actions: [buildAction]
        }, {
          stageName: 'Staging',
          actions: [deployToStagingAction]        
        }, {
          stageName: 'Production',
          actions: [manualApprovalAction, deployToProductionAction]
        }
      ]
    });
  }
}
